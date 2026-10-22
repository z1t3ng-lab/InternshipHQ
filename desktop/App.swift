import AppKit
import WebKit
import UniformTypeIdentifiers

struct LauncherConfiguration: Decodable {
    let projectPath: String
    let nodePath: String
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var loading: NSStackView!
    var statusLabel: NSTextField!
    var spinner: NSProgressIndicator!
    var retryButton: NSButton!
    var server: Process?
    var inputPipe: Pipe?
    var outputPipe: Pipe?
    var outputBuffer = ""
    var baseURL: URL?
    var configuration: LauncherConfiguration?
    var quitting = false
    var startupError: String?
    var activeDownloads: [WKDownload] = []
    var destinations: [ObjectIdentifier: URL] = [:]
    var downloadFiles: [ObjectIdentifier: URL] = [:]
    var logHandle: FileHandle?
    let logURL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/InternshipHQ/desktop.log")

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        // Launch Services normally reuses the running instance. Cover direct launches too.
        if let other = NSRunningApplication.runningApplications(withBundleIdentifier: "local.internshiphq.desktop").first(where: { $0.processIdentifier != ProcessInfo.processInfo.processIdentifier }) {
            other.activate(options: [.activateAllWindows])
            NSApp.terminate(nil)
            return
        }
        makeMenu()
        makeWindow()
        setupLog()
        do {
            let url = Bundle.main.url(forResource: "launcher", withExtension: "json")!
            configuration = try JSONDecoder().decode(LauncherConfiguration.self, from: Data(contentsOf: url))
            startServer()
        } catch { showError("The desktop launcher configuration could not be read. Rebuild the desktop app from its project folder.") }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func makeMenu() {
        let main = NSMenu()
        func submenu(_ title: String) -> NSMenu {
            let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            let menu = NSMenu(title: title); item.submenu = menu; main.addItem(item); return menu
        }
        func add(_ menu: NSMenu, _ title: String, _ selector: Selector, _ key: String = "") {
            let item = NSMenuItem(title: title, action: selector, keyEquivalent: key)
            item.target = self; menu.addItem(item)
        }
        let app = submenu("InternshipHQ")
        add(app, "About InternshipHQ", #selector(about))
        app.addItem(.separator())
        let hide = NSMenuItem(title: "Hide InternshipHQ", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h"); app.addItem(hide)
        app.addItem(.separator())
        add(app, "Quit InternshipHQ", #selector(quit), "q")
        let file = submenu("File")
        add(file, "New Application", #selector(newApplication), "n")
        add(file, "Import & Export", #selector(importExport), "i")
        file.addItem(.separator())
        add(file, "Show Project Folder", #selector(showProject))
        add(file, "Close Window", #selector(closeWindow), "w")
        let edit = submenu("Edit")
        for (name, action, key) in [("Undo", "undo:", "z"), ("Redo", "redo:", "Z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            edit.addItem(NSMenuItem(title: name, action: NSSelectorFromString(action), keyEquivalent: key))
        }
        let view = submenu("View")
        add(view, "Reload", #selector(reload), "r")
        add(view, "Zoom In", #selector(zoomIn), "+")
        add(view, "Zoom Out", #selector(zoomOut), "-")
        add(view, "Actual Size", #selector(actualSize), "0")
        let help = submenu("Help")
        add(help, "Open User Guide", #selector(showGuide))
        add(help, "Show Startup Log", #selector(showLog))
        NSApp.mainMenu = main
    }

    func makeWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1260, height: 840), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "InternshipHQ"
        window.minSize = NSSize(width: 760, height: 560)
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.setFrameAutosaveName("InternshipHQMainWindow")
        window.center()
        window.backgroundColor = NSColor(calibratedRed: 0.97, green: 0.97, blue: 0.985, alpha: 1)
        let container = NSView(); window.contentView = container
        let settings = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: settings)
        webView.navigationDelegate = self; webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isHidden = true
        container.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor), webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.topAnchor.constraint(equalTo: container.topAnchor), webView.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        let image = NSImageView(image: NSImage(contentsOf: Bundle.main.url(forResource: "AppIcon", withExtension: "icns")!) ?? NSImage())
        image.translatesAutoresizingMaskIntoConstraints = false
        image.widthAnchor.constraint(equalToConstant: 76).isActive = true; image.heightAnchor.constraint(equalToConstant: 76).isActive = true
        let heading = NSTextField(labelWithString: "Your next chapter is loading.")
        heading.font = .systemFont(ofSize: 25, weight: .semibold); heading.alignment = .center
        statusLabel = NSTextField(wrappingLabelWithString: "Starting InternshipHQ…")
        statusLabel.alignment = .center; statusLabel.textColor = .secondaryLabelColor
        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.preferredMaxLayoutWidth = 460
        spinner = NSProgressIndicator(); spinner.style = .spinning; spinner.controlSize = .regular; spinner.startAnimation(nil)
        retryButton = NSButton(title: "Try Again", target: self, action: #selector(retry)); retryButton.bezelStyle = .rounded; retryButton.isHidden = true
        loading = NSStackView(views: [image, heading, statusLabel, spinner, retryButton])
        loading.orientation = .vertical; loading.spacing = 18; loading.alignment = .centerX; loading.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(loading)
        NSLayoutConstraint.activate([loading.centerXAnchor.constraint(equalTo: container.centerXAnchor), loading.centerYAnchor.constraint(equalTo: container.centerYAnchor), loading.widthAnchor.constraint(lessThanOrEqualToConstant: 500)])
    }

    func setupLog() {
        do {
            try FileManager.default.createDirectory(at: logURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            // Keep the previous launch for troubleshooting without an ever-growing log.
            if let old = try? Data(contentsOf: logURL), old.count > 500_000 { try old.suffix(100_000).write(to: logURL) }
            if !FileManager.default.fileExists(atPath: logURL.path) { FileManager.default.createFile(atPath: logURL.path, contents: nil) }
            logHandle = try FileHandle(forWritingTo: logURL); try logHandle?.seekToEnd()
            log("\n--- InternshipHQ opened \(Date()) ---\n")
        } catch { /* A logging failure must not prevent opening the workspace. */ }
    }
    func log(_ message: String) { if let data = message.data(using: .utf8) { try? logHandle?.write(contentsOf: data) } }

    func startServer() {
        guard let config = configuration else { showError("Launcher configuration is missing."); return }
        guard FileManager.default.fileExists(atPath: config.projectPath + "/desktop/server.mjs") else {
            showError("The project folder has moved or is unavailable. Keep it at:\n\(config.projectPath)\n\nSee the desktop setup section in the README to reconnect a moved project."); return
        }
        guard FileManager.default.isExecutableFile(atPath: config.nodePath) else { showError("Node.js is no longer available at \(config.nodePath). Reinstall Node.js or rebuild the launcher after changing its location."); return }
        guard server?.isRunning != true else { return }
        outputPipe?.fileHandleForReading.readabilityHandler = nil
        outputBuffer = ""; baseURL = nil; startupError = nil
        loading.isHidden = false; webView.isHidden = true; retryButton.isHidden = true
        statusLabel.stringValue = "Starting your local workspace…"; spinner.isHidden = false; spinner.startAnimation(nil)
        let process = Process(); server = process
        process.executableURL = URL(fileURLWithPath: config.nodePath)
        process.arguments = [config.projectPath + "/desktop/server.mjs"]
        process.currentDirectoryURL = URL(fileURLWithPath: config.projectPath)
        var environment = ProcessInfo.processInfo.environment
        environment["NODE_ENV"] = "production"; environment["DEMO_MODE"] = "false"
        environment.removeValue(forKey: "INTERNSHIPHQ_REBUILD")
        process.environment = environment
        let input = Pipe(); inputPipe = input; process.standardInput = input
        let output = Pipe(); outputPipe = output; process.standardOutput = output; process.standardError = output
        output.fileHandleForReading.readabilityHandler = { [weak self, weak process] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            let text = String(decoding: data, as: UTF8.self)
            DispatchQueue.main.async { guard let self = self, self.server === process else { return }; self.receive(text) }
        }
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self = self, !self.quitting, self.server === process else { return }
                self.showError(self.startupError ?? "The local server stopped. Your saved applications are still in the database. Choose Try Again to reopen your workspace, or Help → Show Startup Log for details.")
            }
        }
        do { try process.run() }
        catch { showError("Couldn’t start InternshipHQ: \(error.localizedDescription)") }
    }

    func receive(_ text: String) {
        log(text); outputBuffer += text
        while let end = outputBuffer.firstIndex(of: "\n") {
            let line = String(outputBuffer[..<end]); outputBuffer = String(outputBuffer[outputBuffer.index(after: end)...])
            if line.hasPrefix("INTERNSHIPHQ_STATUS "), let data = line.dropFirst(20).data(using: .utf8), let value = try? JSONDecoder().decode(String.self, from: data) { statusLabel.stringValue = value }
            if line.hasPrefix("INTERNSHIPHQ_ERROR "), let data = line.dropFirst(19).data(using: .utf8), let value = try? JSONDecoder().decode(String.self, from: data) { startupError = value; showError(value) }
            if line.hasPrefix("INTERNSHIPHQ_READY "), let data = line.dropFirst(19).data(using: .utf8), let values = try? JSONDecoder().decode([String: String].self, from: data), let raw = values["url"], let url = URL(string: raw), url.host == "127.0.0.1", url.port != nil {
                baseURL = url; webView.load(URLRequest(url: url))
            }
        }
    }
    func showError(_ message: String) {
        log("ERROR: \(message)\n"); loading.isHidden = false; webView.isHidden = true
        statusLabel.stringValue = message; spinner.stopAnimation(nil); spinner.isHidden = true; retryButton.isHidden = false
        window.makeFirstResponder(retryButton)
    }
    func local(_ url: URL) -> Bool { url.scheme == baseURL?.scheme && url.host == baseURL?.host && url.port == baseURL?.port }
    func external(_ url: URL) { if ["https", "http", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) } }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let url = webView.url, local(url) else { return }
        loading.isHidden = true; webView.isHidden = false; spinner.stopAnimation(nil)
        window.makeFirstResponder(webView)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError("Couldn’t open the local workspace: \(error.localizedDescription)") }
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        guard local(url) else { if action.navigationType == .linkActivated { external(url) }; decisionHandler(.cancel); return }
        decisionHandler(action.shouldPerformDownload ? .download : .allow)
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let contentDisposition = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        decisionHandler(contentDisposition.lowercased().contains("attachment") || !response.canShowMIMEType ? .download : .allow)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { if local(url) { webView.load(action.request) } else { external(url) } }; return nil
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.canChooseDirectories = false; panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.allowedContentTypes = [.commaSeparatedText, .plainText]; panel.message = "Choose the CSV spreadsheet you want to import."
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { track(download) }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { track(download) }
    func track(_ download: WKDownload) { activeDownloads.append(download); download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename; panel.allowedContentTypes = [.commaSeparatedText]; panel.canCreateDirectories = true
        panel.beginSheetModal(for: window) { result in
            let url = result == .OK ? panel.url : nil
            guard let url = url else { completionHandler(nil); return }
            let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("internshiphq-\(UUID().uuidString).csv")
            self.destinations[ObjectIdentifier(download)] = url
            self.downloadFiles[ObjectIdentifier(download)] = temporary
            completionHandler(temporary)
        }
    }
    func downloadDidFinish(_ download: WKDownload) {
        let destination = destinations.removeValue(forKey: ObjectIdentifier(download)); activeDownloads.removeAll { $0 === download }
        guard let temporary = downloadFiles.removeValue(forKey: ObjectIdentifier(download)) else { return }
        defer { try? FileManager.default.removeItem(at: temporary) }
        if let url = destination {
            do {
                // NSSavePanel has already confirmed replacement of an existing file.
                // Download elsewhere first, then write atomically so failures keep the old file intact.
                try Data(contentsOf: temporary).write(to: url, options: .atomic)
                NSWorkspace.shared.activateFileViewerSelecting([url])
            } catch { showDownloadError(error) }
        }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        destinations.removeValue(forKey: ObjectIdentifier(download)); activeDownloads.removeAll { $0 === download }
        if let temporary = downloadFiles.removeValue(forKey: ObjectIdentifier(download)) { try? FileManager.default.removeItem(at: temporary) }
        if (error as NSError).code != NSURLErrorCancelled { showDownloadError(error) }
    }
    func showDownloadError(_ error: Error) { let alert = NSAlert(); alert.messageText = "The CSV could not be saved"; alert.informativeText = error.localizedDescription; alert.beginSheetModal(for: window) }

    @objc func retry() { if server?.isRunning == true { if let url = baseURL { webView.load(URLRequest(url: url)) } } else { startServer() } }
    @objc func reload() { if baseURL != nil { webView.reload() } else { retry() } }
    @objc func newApplication() { webView.evaluateJavaScript("window.dispatchEvent(new Event('internshiphq:add'))") }
    @objc func importExport() { if let url = baseURL { webView.load(URLRequest(url: url.appendingPathComponent("").appendingFragment("import"))) } }
    @objc func showProject() { if let config = configuration { NSWorkspace.shared.open(URL(fileURLWithPath: config.projectPath)) } }
    @objc func showGuide() { if let config = configuration { NSWorkspace.shared.open(URL(fileURLWithPath: config.projectPath + "/README.md")) } }
    @objc func showLog() { NSWorkspace.shared.open(logURL) }
    @objc func closeWindow() { window.performClose(nil) }
    @objc func zoomIn() { webView.pageZoom = min(2, webView.pageZoom + 0.1) }
    @objc func zoomOut() { webView.pageZoom = max(0.7, webView.pageZoom - 0.1) }
    @objc func actualSize() { webView.pageZoom = 1 }
    @objc func about() {
        let alert = NSAlert(); alert.messageText = "InternshipHQ"; alert.informativeText = "Your personal internship workspace.\n\nVersion 1.0 · Local macOS app\nUses the same application database as your browser workspace."
        alert.beginSheetModal(for: window)
    }
    @objc func quit() { NSApp.terminate(nil) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) {
        quitting = true; outputPipe?.fileHandleForReading.readabilityHandler = nil
        try? inputPipe?.fileHandleForWriting.close()
        if server?.isRunning == true { server?.terminate() }
        try? logHandle?.close()
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { window.makeKeyAndOrderFront(nil); return true }
}

extension URL {
    func appendingFragment(_ value: String) -> URL { var parts = URLComponents(url: self, resolvingAgainstBaseURL: false)!; parts.fragment = value; return parts.url! }
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
