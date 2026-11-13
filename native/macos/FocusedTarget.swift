import AppKit
import ApplicationServices
import Foundation

/// A target is valid only while its application, focused element, and selection remain unchanged.
/// It reads only text that the user explicitly selected for a selection-transform request.
enum FocusGuardError: Error {
    case accessibilityDenied, noFrontmostApplication, noFocusedElement
    case unsupportedField, secureField, selectionUnavailable, targetChanged
    case unsupportedText, keyEventUnavailable, deliveryUncertain
}

struct FocusedTarget {
    private let applicationPID: pid_t
    private let element: AXUIElement
    private let selection: CFRange
    let selectedText: String?
    let canPaste: Bool

    private static func attribute(_ element: AXUIElement, _ name: CFString) -> (AXError, CFTypeRef?) {
        var result: CFTypeRef?
        let status = AXUIElementCopyAttributeValue(element, name, &result)
        return (status, result)
    }

    private static func focusedElement(pid: pid_t) throws -> AXUIElement {
        let app = AXUIElementCreateApplication(pid)
        AXUIElementSetMessagingTimeout(app, 1)
        let (status, value) = attribute(app, kAXFocusedUIElementAttribute as CFString)
        guard status == .success, let value, CFGetTypeID(value) == AXUIElementGetTypeID() else {
            throw FocusGuardError.noFocusedElement
        }
        let focused = unsafeBitCast(value, to: AXUIElement.self)
        AXUIElementSetMessagingTimeout(focused, 1)
        return focused
    }

    private static func verifyEditable(_ element: AXUIElement) throws {
        let (roleStatus, roleValue) = attribute(element, kAXRoleAttribute as CFString)
        guard roleStatus == .success, let role = roleValue as? String,
              role == kAXTextFieldRole as String || role == kAXTextAreaRole as String else {
            throw FocusGuardError.unsupportedField
        }
        let (subroleStatus, subroleValue) = attribute(element, kAXSubroleAttribute as CFString)
        if subroleStatus == .success, (subroleValue as? String) == (kAXSecureTextFieldSubrole as String) {
            throw FocusGuardError.secureField
        }
        guard subroleStatus == .success || subroleStatus == .noValue || subroleStatus == .attributeUnsupported else {
            throw FocusGuardError.unsupportedField
        }
        var settable = DarwinBoolean(false)
        guard AXUIElementIsAttributeSettable(element, kAXSelectedTextAttribute as CFString, &settable) == .success,
              settable.boolValue else { throw FocusGuardError.unsupportedField }
    }

    private static func verifyReadableSelection(_ element: AXUIElement) throws {
        let (roleStatus, roleValue) = attribute(element, kAXRoleAttribute as CFString)
        guard roleStatus == .success, let role = roleValue as? String,
              [kAXTextFieldRole as String, kAXTextAreaRole as String, "AXTextView", "AXWebArea", "AXStaticText"].contains(role) else {
            throw FocusGuardError.unsupportedField
        }
        let (subroleStatus, subroleValue) = attribute(element, kAXSubroleAttribute as CFString)
        if subroleStatus == .success, (subroleValue as? String) == (kAXSecureTextFieldSubrole as String) {
            throw FocusGuardError.secureField
        }
    }

    private static func selectedRange(_ element: AXUIElement) throws -> CFRange {
        let (status, value) = attribute(element, kAXSelectedTextRangeAttribute as CFString)
        guard status == .success, let value, CFGetTypeID(value) == AXValueGetTypeID() else {
            throw FocusGuardError.selectionUnavailable
        }
        let axValue = unsafeBitCast(value, to: AXValue.self)
        var range = CFRange()
        guard AXValueGetValue(axValue, .cfRange, &range), range.location >= 0, range.length >= 0 else {
            throw FocusGuardError.selectionUnavailable
        }
        return range
    }

    /// Fetch only the selected range. Some AppKit controls expose the range but return an empty
    /// AXSelectedText value, so fall back to AXStringForRange rather than reading the whole field.
    private static func text(in range: CFRange, of element: AXUIElement) -> String? {
        if range.length == 0 { return "" }
        let (_, directValue) = attribute(element, kAXSelectedTextAttribute as CFString)
        if let directText = directValue as? String, directText.utf16.count == range.length {
            return directText
        }
        var requestedRange = range
        guard let rangeValue = AXValueCreate(.cfRange, &requestedRange) else { return nil }
        var rangedValue: CFTypeRef?
        guard AXUIElementCopyParameterizedAttributeValue(
            element,
            kAXStringForRangeParameterizedAttribute as CFString,
            rangeValue,
            &rangedValue
        ) == .success,
        let rangedText = rangedValue as? String,
        rangedText.utf16.count == range.length else { return nil }
        return rangedText
    }

    static func capture() throws -> FocusedTarget {
        guard AXIsProcessTrusted() else { throw FocusGuardError.accessibilityDenied }
        guard let app = NSWorkspace.shared.frontmostApplication else { throw FocusGuardError.noFrontmostApplication }
        let pid = app.processIdentifier
        let element = try focusedElement(pid: pid)
        let canPaste: Bool
        do {
            try verifyEditable(element)
            canPaste = true
        } catch FocusGuardError.unsupportedField {
            // Read-only selectable text (for example terminal scrollback) can be transformed,
            // but must be shown for copying instead of being replaced automatically.
            try verifyReadableSelection(element)
            canPaste = false
        }
        let selection = try selectedRange(element)
        let selectedText = text(in: selection, of: element)
        // Focus can change while accessibility attributes are being read.
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid,
              CFEqual(element, try focusedElement(pid: pid)) else { throw FocusGuardError.targetChanged }
        return FocusedTarget(applicationPID: pid, element: element, selection: selection, selectedText: selectedText, canPaste: canPaste)
    }

    private func stillFocused() throws {
        guard AXIsProcessTrusted(), NSWorkspace.shared.frontmostApplication?.processIdentifier == applicationPID,
              CFEqual(element, try Self.focusedElement(pid: applicationPID)) else { throw FocusGuardError.targetChanged }
        try Self.verifyEditable(element)
    }

    /// Pastes the complete transcript once into the captured target. Clipboard contents become the transcript.
    /// Enter is never sent, so terminal commands are not executed automatically.
    func sendText(_ text: String) throws {
        guard canPaste else { throw FocusGuardError.unsupportedField }
        try validate()
        guard !text.isEmpty, text.utf16.count <= 3000,
              !text.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) && !["\n", "\r", "\t"].contains(String($0)) }) else {
            throw FocusGuardError.unsupportedText
        }
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        guard pasteboard.setString(text, forType: .string) else { throw FocusGuardError.deliveryUncertain }
        try validate()
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: false) else {
            throw FocusGuardError.keyEventUnavailable
        }
        down.flags = .maskCommand
        up.flags = .maskCommand
        down.postToPid(applicationPID)
        up.postToPid(applicationPID)
        // Delivery is deliberately not retried: some applications accept paste but expose stale AX ranges.
    }

    func validate() throws {
        guard AXIsProcessTrusted(), NSWorkspace.shared.frontmostApplication?.processIdentifier == applicationPID,
              CFEqual(element, try Self.focusedElement(pid: applicationPID)) else {
            throw FocusGuardError.targetChanged
        }
        if canPaste { try Self.verifyEditable(element) }
        else { try Self.verifyReadableSelection(element) }
        let current = try Self.selectedRange(element)
        guard current.location == selection.location, current.length == selection.length else {
            throw FocusGuardError.targetChanged
        }
        if let selectedText {
            guard Self.text(in: selection, of: element) == selectedText else { throw FocusGuardError.targetChanged }
        }
    }
}
