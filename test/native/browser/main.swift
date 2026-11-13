import AppKit
import ApplicationServices
import Foundation

guard CommandLine.arguments.count == 2, let pid = Int32(CommandLine.arguments[1]) else { exit(2) }
_ = NSRunningApplication(processIdentifier: pid)?.activate(options: [])
usleep(700_000)
guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
    print("Test aborted without inspecting another application.")
    exit(3)
}
do {
    let target = try FocusedTarget.capture()
    let text = "TEST हिन्दी 1234567890 "
    try target.sendText(text)
    let app = AXUIElementCreateApplication(pid)
    var raw: CFTypeRef?
    guard AXUIElementCopyAttributeValue(app, kAXFocusedUIElementAttribute as CFString, &raw) == .success,
          let raw, CFGetTypeID(raw) == AXUIElementGetTypeID() else { exit(4) }
    let focused = unsafeBitCast(raw, to: AXUIElement.self)
    var fieldValue: CFTypeRef?
    guard AXUIElementCopyAttributeValue(focused, kAXValueAttribute as CFString, &fieldValue) == .success,
          (fieldValue as? String) == "before " + text + "after" else {
        print("Synthetic browser text verification failed")
        exit(5)
    }
    print("Inserted and verified multi-chunk English/Hindi synthetic browser text")
} catch {
    print("Browser probe failed: \(error)")
    exit(1)
}
