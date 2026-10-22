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
        NSColor(calibratedRed: 0.36, green: 0.32, blue: 0.84, alpha: 1).setFill()
        NSBezierPath(roundedRect: NSRect(x: 70, y: 70, width: 884, height: 884), xRadius: 202, yRadius: 202).fill()
        NSColor.white.setStroke()
        let body = NSBezierPath(roundedRect: NSRect(x: 247, y: 294, width: 530, height: 399), xRadius: 55, yRadius: 55)
        body.lineWidth = 35; body.stroke()
        let handle = NSBezierPath(roundedRect: NSRect(x: 409, y: 693, width: 206, height: 95), xRadius: 29, yRadius: 29)
        handle.lineWidth = 35; handle.stroke()
        let seam = NSBezierPath(); seam.move(to: NSPoint(x: 253, y: 552)); seam.curve(to: NSPoint(x: 771, y: 552), controlPoint1: NSPoint(x: 394, y: 459), controlPoint2: NSPoint(x: 630, y: 459)); seam.lineWidth = 30; seam.stroke()
        NSColor.white.setFill()
        NSBezierPath(roundedRect: NSRect(x: 488, y: 478, width: 48, height: 89), xRadius: 14, yRadius: 14).fill()
        NSColor(calibratedRed: 0.79, green: 0.76, blue: 1, alpha: 1).setFill()
        NSBezierPath(ovalIn: NSRect(x: 750, y: 750, width: 82, height: 82)).fill()
        NSGraphicsContext.restoreGraphicsState()
        let name = "icon_\(size)x\(size)\(scale == 2 ? "@2x" : "").png"
        try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent(name))
    }
}
