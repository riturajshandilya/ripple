# Dictation feasibility checks on the Mac

These checks used synthetic data and disposable test windows. They are evidence for the next milestone, not proof that every app or mobile device will work.

## Native tooling and permissions

- The globally selected Command Line Tools Swift/SDK combination previously failed. `/Applications/Xcode.app/Contents/Developer` compiled and ran a small AppKit + AVFoundation program when supplied through `DEVELOPER_DIR` for that command; no global developer-directory change was needed. Xcode reported the iOS 26.5 SDK as installed. This does not prove an iOS simulator or physical iPhone works.
- Input Monitoring preflight and Accessibility trust reported allowed for the test processes. A temporary native executable reported microphone authorization. A future packaged app can have a different identity and may need its own macOS permission grants; no credential or account permission was requested.

## Controlled input tests

- Two synthetic AppKit text fields were placed in a disposable window. A separate process identified the focused `AXTextField`, inserted synthetic text at the caret using `AXSelectedText`, and verified the resulting synthetic value. It identified the synthetic password field using subrole `AXSecureTextField` and detected a changed focus when the test moved to that field. No real user field or user text was inspected or changed.
- An isolated Chrome profile opened a local synthetic HTML textarea with renderer accessibility explicitly forced on. The accessibility setter reported success but the field value did not change after the test waited. After bringing that test browser to the foreground and checking its focused element, a Unicode keyboard event targeted to its process inserted the synthetic text at the expected position. The probe then verified the field's synthetic value. No clipboard was modified.
- Do not assume these behaviors generalize to existing browser profiles, rich editors, contenteditable, Electron, secure fields, international input methods, terminal programs, or every macOS app. Post-event delivery lacks a universal acknowledgment. The production design should require a verified target, fail safely if focus or selection changes, and offer preview/copy if delivery cannot be established. Blindly trying a second insertion after an uncertain first attempt can duplicate text.
- `native/macos/FocusedTarget.swift` now implements capture and revalidation without reading field contents or inserting text. `npm run test:mac-focus` compiles it with the installed Xcode toolchain, opens a disposable test window, and checks that an unchanged target passes while moving the caret, changing focus, and focusing the synthetic secure field are rejected. The check does not prove all secure fields are detectable, or prevent a race after validation.
- The controlled test read the synthetic field value only to verify the experiment. A production client must not silently read or log surrounding real text merely to infer context or verify insertion; agree on privacy behavior and provide a fallback when verification is not possible.

## Offline models

- The already-installed Whisper.cpp multilingual `small` model and Qwen3 `1.7b` local formatter ran together on synthetic audio in an isolated test: both the client and a separate Ollama server were restricted from external outbound network connections while loopback remained allowed. The result reported successful polishing and nonempty transcription. This did not disconnect the whole Mac, test microphone capture, or measure real dictation accuracy.
- A small synthetic Qwen test returned `totalCount = 0` for one code-style request and performed light punctuation on an email-style request. It did not reliably produce a complete email with a salutation, and a plain-style sample retained a filler. The samples and timings are not a benchmark; Hinglish, names, formatting and invented content need real evaluation. Models were left installed for later use; the test model was unloaded after testing.

## Remaining verification

- Test insertion and focus/selection-change handling in real target apps with user-controlled disposable documents. Decide which applications/fields are excluded and how to avoid duplicate insertion when delivery is uncertain.
- Test the app's actual microphone permission, hotkey, status UI, handling of silence and multilingual recognition. The earlier assistant test confirms its existing Python recorder worked for the user; it does not verify a new native app identity or offline dictation UI.
- Google Drive OAuth, sync, conflict handling, encryption and restoration are not configured or tested. Testing them requires a concrete implementation and the user's consent to the necessary Google account permissions; no billing should be enabled.
- iOS SDK presence is not an iOS app or keyboard test. Simulator/device feasibility, microphone handoff and app-distribution constraints remain separate milestones.
