import AppKit
import ApplicationServices
import Foundation

guard CommandLine.arguments.count == 2, let pid = Int32(CommandLine.arguments[1]) else { exit(2) }
_ = NSRunningApplication(processIdentifier: pid)?.activate(options: [])
usleep(500_000)
let fixtureIsFrontmost = NSWorkspace.shared.frontmostApplication?.processIdentifier == pid
print("Synthetic fixture is frontmost:", fixtureIsFrontmost)
guard fixtureIsFrontmost else { print("Test aborted without inspecting another application."); exit(11) }
do {
    let target = try FocusedTarget.capture()
    guard target.selectedText == "after" else { print("ERROR: selected text was not captured"); exit(13) }
    try target.validate()
    print("Captured selected text and revalidated focused synthetic field")
    let app = AXUIElementCreateApplication(pid)
    var focusedRaw: CFTypeRef?
    guard AXUIElementCopyAttributeValue(app, kAXFocusedUIElementAttribute as CFString, &focusedRaw) == .success,
          let focusedRaw, CFGetTypeID(focusedRaw) == AXUIElementGetTypeID() else { exit(8) }
    let focused = unsafeBitCast(focusedRaw, to: AXUIElement.self)
    var caret = CFRange(location: 7, length: 0)
    guard let caretValue = AXValueCreate(.cfRange, &caret),
          AXUIElementSetAttributeValue(focused, kAXSelectedTextRangeAttribute as CFString, caretValue) == .success else { exit(9) }
    do { try target.validate(); print("ERROR: accepted changed selection"); exit(10) }
    catch FocusGuardError.targetChanged { print("Rejected changed selection before transformation") }
    let afterCaretMove = try FocusedTarget.capture()
    var changedRange = CFRange(location: 0, length: 0)
    guard let rangeValue = AXValueCreate(.cfRange, &changedRange),
          AXUIElementSetAttributeValue(focused, kAXSelectedTextRangeAttribute as CFString, rangeValue) == .success else { exit(9) }
    usleep(200_000)
    do { try afterCaretMove.validate(); print("ERROR: failed to reject changed caret"); exit(10) }
    catch FocusGuardError.targetChanged { print("Rejected changed caret") }
    var windowsRaw: CFTypeRef?
    guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &windowsRaw) == .success,
          let windows = windowsRaw as? [AXUIElement], let window = windows.first else { exit(3) }
    var childrenRaw: CFTypeRef?
    guard AXUIElementCopyAttributeValue(window, kAXChildrenAttribute as CFString, &childrenRaw) == .success,
          let children = childrenRaw as? [AXUIElement] else { exit(4) }
    var secure: AXUIElement?
    for child in children {
        var value: CFTypeRef?
        _ = AXUIElementCopyAttributeValue(child, kAXIdentifierAttribute as CFString, &value)
        if (value as? String) == "synthetic.secure" { secure = child; break }
    }
    guard let secure,
          AXUIElementSetAttributeValue(secure, kAXFocusedAttribute as CFString, kCFBooleanTrue) == .success else { exit(5) }
    usleep(250_000)
    do { try afterCaretMove.validate(); print("ERROR: failed to reject changed focus"); exit(6) }
    catch FocusGuardError.targetChanged { print("Rejected changed focus") }
    do { _ = try FocusedTarget.capture(); print("ERROR: failed to reject secure field"); exit(7) }
    catch FocusGuardError.secureField { print("Rejected synthetic secure field") }
    var readOnly: AXUIElement?
    for child in children {
        var value: CFTypeRef?
        _ = AXUIElementCopyAttributeValue(child, kAXIdentifierAttribute as CFString, &value)
        if (value as? String) == "synthetic.readonly" { readOnly = child; break }
    }
    guard let readOnly,
          AXUIElementSetAttributeValue(readOnly, kAXFocusedAttribute as CFString, kCFBooleanTrue) == .success else { exit(14) }
    usleep(250_000)
    let readOnlyTarget = try FocusedTarget.capture()
    guard !readOnlyTarget.canPaste, readOnlyTarget.selectedText == "selected terminal" else {
        print("ERROR: read-only selection was not captured safely")
        exit(15)
    }
    try readOnlyTarget.validate()
    print("Captured and revalidated read-only selected text for copy-only transformation")
} catch {
    print("Focus guard probe failed: \(error)")
    exit(1)
}
