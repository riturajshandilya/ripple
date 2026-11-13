import AppKit
import Foundation

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let window = NSWindow(contentRect: NSRect(x: 120, y: 120, width: 420, height: 220), styleMask: [.titled, .closable], backing: .buffered, defer: false)
window.title = "Ripple temporary focus test"
let normal = NSTextField(frame: NSRect(x: 20, y: 65, width: 360, height: 28))
    normal.stringValue = "before after"
normal.setAccessibilityIdentifier("synthetic.normal")
let secure = NSSecureTextField(frame: NSRect(x: 20, y: 20, width: 360, height: 28))
secure.stringValue = "synthetic"
secure.setAccessibilityIdentifier("synthetic.secure")
let readOnly = NSTextView(frame: NSRect(x: 20, y: 110, width: 360, height: 70))
readOnly.string = "selected terminal output"
readOnly.isEditable = false
readOnly.isSelectable = true
readOnly.setAccessibilityIdentifier("synthetic.readonly")
window.contentView?.addSubview(normal)
window.contentView?.addSubview(secure)
window.contentView?.addSubview(readOnly)
window.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)
DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
    normal.selectText(nil)
    if let editor = normal.currentEditor() {
        editor.selectedRange = NSRange(location: 7, length: 5)
    }
    readOnly.setSelectedRange(NSRange(location: 0, length: 17))
    print("READY"); fflush(stdout)
}
DispatchQueue.main.asyncAfter(deadline: .now() + 30) { app.terminate(nil) }
app.run()
