import AppKit
import Foundation

let output = URL(fileURLWithPath: CommandLine.arguments[1])
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let transform = AffineTransform(scale: CGFloat(pixels) / 1024)
        (transform as NSAffineTransform).concat()
        let forest = NSColor(srgbRed: 0.086, green: 0.184, blue: 0.157, alpha: 1)
        let parchment = NSColor(srgbRed: 0.945, green: 0.929, blue: 0.855, alpha: 1)
        let gold = NSColor(srgbRed: 0.890, green: 0.773, blue: 0.510, alpha: 1)
        func sheet(_ rect: NSRect, radius: CGFloat, color: NSColor) {
            color.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
        }
        sheet(NSRect(x: 70, y: 70, width: 884, height: 884), radius: 202, color: forest)
        sheet(NSRect(x: 370, y: 351, width: 385, height: 465), radius: 30, color: gold)
        sheet(NSRect(x: 263, y: 241, width: 413, height: 492), radius: 34, color: forest)
        sheet(NSRect(x: 263, y: 241, width: 385, height: 465), radius: 30, color: parchment)
        sheet(NSRect(x: 339, y: 525, width: 214, height: 26), radius: 5, color: forest)
        sheet(NSRect(x: 339, y: 441, width: 169, height: 26), radius: 5, color: forest)
        NSGraphicsContext.restoreGraphicsState()
        let name = "icon_\(size)x\(size)\(scale == 2 ? "@2x" : "").png"
        try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent(name))
    }
}
