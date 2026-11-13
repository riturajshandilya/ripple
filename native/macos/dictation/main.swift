import AppKit
import AVFoundation
import ApplicationServices
import Foundation
import QuartzCore
import SwiftUI

final class Bubble {
    let panel: NSPanel
    let heading = NSTextField(labelWithString: "Ready")
    let previewLabel = NSTextField(labelWithString: "")
    let dropletModel = DropletModel()
    let toastDropletModel = DropletModel()
    private var dropletHostingView: DropletHostingView!
    private var toastDropletHostingView: NSHostingView<DropletView>!
    let copy = NSButton(title: "Copy", target: nil, action: nil)
    let inspect = NSButton(title: "Details ↗", target: nil, action: nil)
    let enable = NSButton(title: "Enable Access", target: nil, action: nil)
    let close = NSButton(title: "×", target: nil, action: nil)
    var copyAction: ((String) -> Void)?
    var inspectAction: (() -> Void)?
    var permissionAction: (() -> Void)?
    private let copyHandler = ButtonHandler(), inspectHandler = ButtonHandler(), enableHandler = ButtonHandler(), closeHandler = ButtonHandler()
    private var compact = true
    private var canCopy = false
    private var canEnable = false
    private var autoCollapseTimer: Timer?
    private var rootContainer: NSView!
    private var background: NSView!
    private var content: NSView!
    private var glassBackground: NSView?
    private var currentText = ""
    private var rawText = ""
    final class ButtonHandler: NSObject { var action: (() -> Void)?; @objc func click() { action?() } }

    init() {
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 120, height: 120), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.title = "Ripple Orb"; panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = false
        panel.level = .floating; panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]; panel.hidesOnDeactivate = false

        rootContainer = NSView(frame: NSRect(x: 0, y: 0, width: 120, height: 120))
        rootContainer.wantsLayer = true
        panel.contentView = rootContainer

        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectView(frame: rootContainer.bounds)
            glass.style = .regular
            glass.cornerRadius = 16
            glass.tintColor = NSColor.systemTeal.withAlphaComponent(0.18)
            glassBackground = glass
            background = glass
        } else {
            let visual = NSVisualEffectView(frame: rootContainer.bounds)
            visual.material = .hudWindow
            visual.blendingMode = .behindWindow
            visual.state = .active
            visual.wantsLayer = true
            visual.layer?.cornerRadius = 16
            background = visual
        }
        rootContainer.addSubview(background)

        content = NSView(frame: rootContainer.bounds)
        content.wantsLayer = true
        rootContainer.addSubview(content)

        heading.font = .systemFont(ofSize: 12, weight: .semibold)
        heading.textColor = .white
        heading.lineBreakMode = .byTruncatingTail

        previewLabel.font = .systemFont(ofSize: 11.5, weight: .regular)
        previewLabel.textColor = NSColor(hex: 0xF5F6F8, alpha: 0.82)
        previewLabel.lineBreakMode = .byTruncatingTail
        previewLabel.maximumNumberOfLines = 2
        previewLabel.usesSingleLineMode = false

        dropletModel.phase = .idle
        toastDropletModel.phase = .idle
        toastDropletModel.isCompact = false

        dropletHostingView = DropletHostingView(rootView: DropletView(model: dropletModel))
        dropletHostingView.dropletModel = dropletModel
        dropletHostingView.frame = content.bounds
        dropletHostingView.onTap = { [weak self] in
            guard let self else { return }
            if self.canEnable {
                self.setCompact(false)
            } else {
                self.inspectAction?()
            }
        }

        toastDropletHostingView = NSHostingView(rootView: DropletView(model: toastDropletModel))
        toastDropletHostingView.frame = NSRect(x: 16, y: 21, width: 22, height: 22)

        for button in [copy, inspect, enable] {
            button.bezelStyle = .recessed
            button.isBordered = true
            button.font = .systemFont(ofSize: 11, weight: .medium)
            button.contentTintColor = .white
        }
        copy.toolTip = "Copy text"
        inspect.toolTip = "View details & iterate in Ripple Hub"

        close.isBordered = false
        close.font = .systemFont(ofSize: 15, weight: .medium)
        close.contentTintColor = NSColor.white.withAlphaComponent(0.75)

        copyHandler.action = { [weak self] in
            guard let self else { return }
            self.copyAction?(self.currentText)
        }
        inspectHandler.action = { [weak self] in
            self?.setCompact(true)
            self?.inspectAction?()
        }
        enableHandler.action = { [weak self] in self?.permissionAction?() }
        closeHandler.action = { [weak self] in self?.setCompact(true) }

        copy.target = copyHandler; copy.action = #selector(ButtonHandler.click)
        inspect.target = inspectHandler; inspect.action = #selector(ButtonHandler.click)
        enable.target = enableHandler; enable.action = #selector(ButtonHandler.click)
        close.target = closeHandler; close.action = #selector(ButtonHandler.click)

        for view in [dropletHostingView, toastDropletHostingView, heading, previewLabel, copy, inspect, enable, close] as [NSView] {
            content.addSubview(view)
        }
        setCompact(true)
    }

    func show(title: String, text: String, rawText: String? = nil, canCopy: Bool = false, canEnable: Bool = false, expandToast: Bool = false) {
        autoCollapseTimer?.invalidate()
        heading.stringValue = title
        let singleLine = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        previewLabel.stringValue = singleLine

        currentText = text
        self.rawText = rawText ?? text
        self.canCopy = canCopy
        self.canEnable = canEnable

        let targetPhase: DropletPhase
        if title == "Listening" {
            targetPhase = .listening
            setCompact(true)
        } else if title.localizedCaseInsensitiveContains("polish") {
            targetPhase = .polishing
            setCompact(true)
        } else if title.localizedCaseInsensitiveContains("transcrib") || title.localizedCaseInsensitiveContains("process") || title.localizedCaseInsensitiveContains("format") {
            targetPhase = .transcribing
            setCompact(true)
        } else if canEnable || title.localizedCaseInsensitiveContains("too short") || title.localizedCaseInsensitiveContains("couldn’t start") || title.localizedCaseInsensitiveContains("error") {
            targetPhase = .error
            setCompact(!expandToast)
            if expandToast { scheduleAutoCollapse() }
        } else if canCopy {
            targetPhase = .success
            setCompact(!expandToast)
            if expandToast { scheduleAutoCollapse() }
        } else {
            targetPhase = .idle
            setCompact(!expandToast)
            if expandToast { scheduleAutoCollapse() }
        }

        dropletModel.setPhase(targetPhase)
        toastDropletModel.setPhase(targetPhase)

        panel.orderFrontRegardless()
    }

    func updateAudioMeters(averagePower: Float, peakPower: Float) {
        DropletMath.updateAudioFollower(
            rawDb: averagePower,
            peakDb: peakPower,
            energy: &dropletModel.energy,
            low: &dropletModel.low,
            high: &dropletModel.high
        )
    }

    func resetAudioMeters() {
        dropletModel.energy = 0
        dropletModel.low = 0
        dropletModel.high = 0
    }

    private func scheduleAutoCollapse() {
        autoCollapseTimer?.invalidate()
        autoCollapseTimer = Timer.scheduledTimer(withTimeInterval: 6.5, repeats: false) { [weak self] _ in
            self?.setCompact(true)
        }
    }

    func setCompact(_ value: Bool) {
        compact = value
        dropletModel.isCompact = value
        if value {
            autoCollapseTimer?.invalidate()
            let size = NSSize(width: 120, height: 120)
            if let screen = NSScreen.main {
                let rect = screen.visibleFrame
                panel.setFrame(NSRect(x: rect.midX - 60, y: rect.minY + 26 - 43, width: 120, height: 120), display: true)
            } else {
                panel.setFrame(NSRect(x: panel.frame.midX - 60, y: panel.frame.minY, width: 120, height: 120), display: true)
            }
            rootContainer.frame = NSRect(origin: .zero, size: size)
            background.frame = NSRect(origin: .zero, size: size)
            content.frame = rootContainer.bounds
            applyLayout()
        } else {
            let size = canEnable ? NSSize(width: 336, height: 92) : NSSize(width: 368, height: 64)
            if let screen = NSScreen.main {
                let rect = screen.visibleFrame
                panel.setFrame(NSRect(x: rect.midX - size.width / 2, y: rect.minY + 26, width: size.width, height: size.height), display: true)
            } else {
                panel.setFrame(NSRect(x: panel.frame.midX - size.width / 2, y: panel.frame.minY, width: size.width, height: size.height), display: true)
            }
            rootContainer.frame = NSRect(origin: .zero, size: size)
            background.frame = NSRect(origin: .zero, size: size)
            content.frame = rootContainer.bounds
            applyLayout()
        }
    }

    private func applyLayout() {
        guard background != nil else { return }
        if compact {
            background.isHidden = true
            heading.isHidden = true
            previewLabel.isHidden = true
            copy.isHidden = true
            inspect.isHidden = true
            enable.isHidden = true
            close.isHidden = true
            toastDropletHostingView.isHidden = true

            dropletHostingView.isHidden = false
            dropletHostingView.frame = content.bounds
        } else {
            let width = panel.frame.width, height = panel.frame.height
            let radius: CGFloat = 16
            background.isHidden = false
            background.layer?.cornerRadius = radius
            background.layer?.backgroundColor = NSColor.clear.cgColor
            background.layer?.borderWidth = 0
            if #available(macOS 26.0, *) { (glassBackground as? NSGlassEffectView)?.cornerRadius = radius }
            content.layer?.backgroundColor = NSColor.clear.cgColor
            content.layer?.cornerRadius = radius

            dropletHostingView.isHidden = true
            toastDropletHostingView.isHidden = false
            toastDropletHostingView.frame = NSRect(x: 16, y: (height - 22) / 2, width: 22, height: 22)

            close.isHidden = false
            close.frame = NSRect(x: width - 26, y: height - 26, width: 18, height: 18)

            if canEnable {
                heading.isHidden = false
                heading.frame = NSRect(x: 50, y: height - 27, width: width - 82, height: 17)
                previewLabel.isHidden = false
                previewLabel.frame = NSRect(x: 50, y: 38, width: width - 66, height: 28)
                enable.isHidden = false
                enable.frame = NSRect(x: 50, y: 10, width: 112, height: 22)
                copy.isHidden = true
                inspect.isHidden = true
            } else {
                let actionsWidth: CGFloat = canCopy ? 142 : 76
                heading.isHidden = false
                heading.frame = NSRect(x: 50, y: height - 26, width: width - actionsWidth - 70, height: 16)
                previewLabel.isHidden = false
                previewLabel.frame = NSRect(x: 50, y: 12, width: width - actionsWidth - 70, height: 16)
                enable.isHidden = true
                if canCopy {
                    copy.isHidden = false
                    copy.frame = NSRect(x: width - 154, y: (height - 24) / 2, width: 54, height: 24)
                    inspect.isHidden = false
                    inspect.frame = NSRect(x: width - 94, y: (height - 24) / 2, width: 66, height: 24)
                } else {
                    copy.isHidden = true
                    inspect.isHidden = false
                    inspect.frame = NSRect(x: width - 94, y: (height - 24) / 2, width: 66, height: 24)
                }
            }
        }
    }
}

final class DictationApp: NSObject, NSApplicationDelegate, AVAudioRecorderDelegate {
    enum State { case idle, recording, processing }
    private var state: State = .idle
    private var tap: CFMachPort?
    private var source: CFRunLoopSource?
    private var armed = true
    private var held = false
    private var target: FocusedTarget?
    private var recorder: AVAudioRecorder?
    private var folder: URL?
    private var meter: Timer?
    private var hideTimer: Timer?
    private var status: NSStatusItem?
    private let bubble = Bubble()
    private var resultText = ""
    private var rawResultText = ""
    private var lastHistoryId: String?
    private var mode = "raw"
    private var style = "plain"
    private var outputMode = "spoken"
    private var targetLanguage = "English"
    private var inputLanguage = "auto"
    private var verifyEnglish = false
    private var menu: NSMenu?
    private var worker: Process?
    private var phase: CGFloat = 0
    private var recordingStartedAt: Date?
    private var targetProblem = "This field does not support automatic insertion."
    private var historyWarning = false
    private var workerProgressBuffer = Data()
    private var recordingDurationMs: Double = 0
    private var hubWindow: NSWindow?
    private let hubModel = HubViewModel()
    private var saveHistory: Bool { UserDefaults.standard.object(forKey: "saveDictationHistory") as? Bool ?? true }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        let savedMode = UserDefaults.standard.string(forKey: "dictationMode") ?? "raw"
        if ["raw", "polish"].contains(savedMode) { mode = savedMode }
        let savedStyle = UserDefaults.standard.string(forKey: "dictationStyle") ?? "plain"
        if ["plain", "email", "code"].contains(savedStyle) { style = savedStyle }
        let savedOutputMode = UserDefaults.standard.string(forKey: "dictationOutputMode") ?? "spoken"
        if ["spoken", "romanize", "translate"].contains(savedOutputMode) { outputMode = savedOutputMode }
        let savedTargetLanguage = UserDefaults.standard.string(forKey: "dictationTargetLanguage") ?? "English"
        if isValidTargetLanguage(savedTargetLanguage) { targetLanguage = savedTargetLanguage }
        let savedInputLanguage = UserDefaults.standard.string(forKey: "dictationInputLanguage") ?? "auto"
        if savedInputLanguage == "auto" || inputLanguageChoices.contains(where: { $0.code == savedInputLanguage }) {
            inputLanguage = savedInputLanguage
        }
        verifyEnglish = UserDefaults.standard.bool(forKey: "dictationVerifyEnglish") && inputLanguage == "en"

        configureHubModel()
        bubble.copyAction = { [weak self] text in self?.copyResult(text) }
        bubble.inspectAction = { [weak self] in
            guard let self else { return }
            self.showHub(selectingEntryID: self.lastHistoryId)
        }
        bubble.permissionAction = { [weak self] in self?.openNextPermissionSettings() }
        setupMenu()

        let args = CommandLine.arguments
        if args.contains("--ui-preview") || args.contains("--ui-preview-processing") || args.contains("--ui-preview-details") || args.contains("--ui-preview-permission") || args.contains("--ui-preview-hub") || args.contains("--ui-preview-hub-inspector") {
            runUIPreview(args: args)
        } else {
            installTap()
            if args.contains("--show-hub") || args.contains("--hub") {
                showHub(selectingEntryID: nil)
            }
        }
    }

    private func runUIPreview(args: [String]) {
        if args.contains("--ui-preview-hub") || args.contains("--ui-preview-hub-inspector") {
            let sampleEntries: [DictationEntry] = [
                DictationEntry(
                    id: "11111111-1111-1111-1111-111111111111",
                    createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-180)),
                    date: Date().addingTimeInterval(-180),
                    rawText: "hey team let us push the design review to 4 pm no wait 4 30 pm so priya can join",
                    text: "Hi team,\n\nLet's move the design review to 4:30 PM so Priya can join.\n\nBest regards,",
                    mode: "polish",
                    style: "email",
                    outputMode: "spoken",
                    targetLanguage: "English",
                    status: "polished"
                ),
                DictationEntry(
                    id: "22222222-2222-2222-2222-222222222222",
                    createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-2400)),
                    date: Date().addingTimeInterval(-2400),
                    rawText: "um we need to make sure the sqlite database migration preserves all v1 rows without dropping anything",
                    text: "We need to make sure the SQLite database migration preserves all v1 rows without dropping anything.",
                    mode: "polish",
                    style: "plain",
                    outputMode: "spoken",
                    targetLanguage: "English",
                    status: "polished"
                ),
                DictationEntry(
                    id: "33333333-3333-3333-3333-333333333333",
                    createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-7200)),
                    date: Date().addingTimeInterval(-7200),
                    rawText: "आप कैसे हो कल सुबह बात करते हैं",
                    text: "Aap kaise ho, kal subah baat karte hain.",
                    mode: "polish",
                    style: "plain",
                    outputMode: "romanize",
                    targetLanguage: "English",
                    status: "polished"
                ),
            ]
            showHub(selectingEntryID: nil, skipRefresh: true)
            hubModel.entries = sampleEntries
            if args.contains("--ui-preview-hub-inspector") {
                hubModel.openInspector(for: sampleEntries[0].id)
            }
            self.hubModel.isPreviewMode = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                guard let self else { return }
                let name = args.contains("--ui-preview-hub-inspector") ? "ripple-hub-inspector-preview.png" : "ripple-hub-preview.png"
                let outURL = URL(fileURLWithPath: "/tmp").appendingPathComponent(name)
                let rootView = HubRootView(model: self.hubModel)
                    .frame(width: 900, height: 580)
                    .environment(\.colorScheme, .dark)
                let renderer = ImageRenderer(content: rootView)
                renderer.scale = 2.0
                if let nsImage = renderer.nsImage,
                   let tiff = nsImage.tiffRepresentation,
                   let rep = NSBitmapImageRep(data: tiff),
                   let png = rep.representation(using: .png, properties: [:]) {
                    try? png.write(to: outURL)
                } else if let view = self.hubWindow?.contentView,
                          let image = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
                    view.cacheDisplay(in: view.bounds, to: image)
                    if let png = image.representation(using: .png, properties: [:]) {
                        try? png.write(to: outURL)
                    }
                }
                NSApp.terminate(nil)
            }
            return
        }

        if args.contains("--ui-preview-details") {
            bubble.show(title: "Copied · Preview", text: "Hi team, I want to schedule our meeting for 7 p.m.", rawText: "Hi team I want to schedule at 6 no no 7 p.m.", canCopy: true, expandToast: true)
        } else if args.contains("--ui-preview-processing") {
            bubble.show(title: "Polishing", text: "Refining your words…")
        } else if args.contains("--ui-preview-permission") {
            bubble.show(title: "Permissions needed", text: "Enable Input Monitoring and Accessibility. Click to open each in turn.", canEnable: true)
        } else {
            bubble.dropletModel.energy = 0.65
            bubble.dropletModel.low = 0.65
            bubble.dropletModel.high = 0.35
            bubble.show(title: "Listening", text: "Speak naturally. Release Control or Option when you’re done.")
        }
        if let view = bubble.panel.contentView, let image = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
            view.cacheDisplay(in: view.bounds, to: image)
            if let png = image.representation(using: .png, properties: [:]) {
                let name = args.contains("--ui-preview-details") ? "ripple-details-preview.png" : (args.contains("--ui-preview-permission") ? "ripple-permission-preview.png" : (args.contains("--ui-preview-processing") ? "ripple-processing-preview.png" : "ripple-bubble-preview.png"))
                try? png.write(to: URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(name))
            }
        }
        print("BUBBLE_WINDOW=\(bubble.panel.windowNumber)"); fflush(stdout)
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { NSApp.terminate(nil) }
    }

    func applicationWillTerminate(_ notification: Notification) {
        recorder?.stop()
        worker?.terminate()
        cleanup()
        if let tap { CGEvent.tapEnable(tap: tap, enable: false) }
    }

    private func configureHubModel() {
        syncHubModelSettings()
        refreshHubPermissions()
        hubModel.onCopyText = { [weak self] text in
            _ = self?.writeClipboard(text)
        }
        hubModel.onRefreshRequested = { [weak self] in
            self?.refreshHistory()
        }
        hubModel.onDeleteEntry = { [weak self] id in
            self?.deleteHistoryEntry(id)
        }
        hubModel.onClearAll = { [weak self] in
            self?.historyRequest(payload: ["action": "clear"]) { _ in
                self?.hubModel.selectedEntryID = nil
                self?.refreshHistory()
            }
        }
        hubModel.onReformatRequested = { [weak self] id, mode, style, outputMode, targetLang, instruction, completion in
            var payload: [String: Any] = [
                "action": "reformat",
                "id": id,
                "mode": mode,
                "style": style,
                "outputMode": outputMode,
                "targetLanguage": targetLang,
            ]
            if let instruction, !instruction.isEmpty {
                payload["instruction"] = instruction
            }
            self?.historyRequest(payload: payload) { response in
                if let row = response?["result"] as? [String: Any],
                   let updated = DictationEntry.from(dictionary: row) {
                    completion(.success(updated))
                } else {
                    completion(.failure(NSError(domain: "Reformat", code: 1)))
                }
            }
        }
        hubModel.onUpdateSettings = { [weak self] newMode, newStyle, newOutputMode, newTargetLang, newInputLang, newVerifyEnglish, newSaveHistory in
            guard let self else { return }
            self.mode = newMode
            self.style = newStyle
            self.outputMode = newOutputMode
            if self.isValidTargetLanguage(newTargetLang) {
                self.targetLanguage = newTargetLang.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            self.inputLanguage = newInputLang
            self.verifyEnglish = newVerifyEnglish && newInputLang == "en"
            UserDefaults.standard.set(self.mode, forKey: "dictationMode")
            UserDefaults.standard.set(self.style, forKey: "dictationStyle")
            UserDefaults.standard.set(self.outputMode, forKey: "dictationOutputMode")
            UserDefaults.standard.set(self.targetLanguage, forKey: "dictationTargetLanguage")
            UserDefaults.standard.set(self.inputLanguage, forKey: "dictationInputLanguage")
            UserDefaults.standard.set(self.verifyEnglish, forKey: "dictationVerifyEnglish")
            UserDefaults.standard.set(newSaveHistory, forKey: "saveDictationHistory")
            self.refreshMenu()
        }
        hubModel.onOpenPermission = { [weak self] section in
            _ = self?.openPrivacySettings(section)
        }
        hubModel.onRecheckPermissions = { [weak self] in
            self?.refreshHubPermissions()
            if self?.tap == nil && CGPreflightListenEventAccess() {
                self?.installTap()
            }
        }
    }

    private func syncHubModelSettings() {
        hubModel.appMode = mode
        hubModel.appStyle = style
        hubModel.appOutputMode = outputMode
        hubModel.appTargetLanguage = targetLanguage
        hubModel.appInputLanguage = inputLanguage
        hubModel.appVerifyEnglish = verifyEnglish
        hubModel.saveHistory = saveHistory
    }

    private func refreshHubPermissions() {
        hubModel.hasInputMonitoring = CGPreflightListenEventAccess()
        hubModel.hasAccessibility = AXIsProcessTrusted()
        hubModel.hasMicrophone = AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
    }

    private func setupMenu() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "◉"
        item.button?.toolTip = "Ripple"
        status = item
        refreshMenu()
    }

    private func refreshMenu() {
        syncHubModelSettings()
        let menu = NSMenu()
        let openHub = NSMenuItem(title: "Open Ripple Hub…", action: #selector(showHistory), keyEquivalent: "h")
        openHub.target = self; menu.addItem(openHub)
        menu.addItem(NSMenuItem(title: "Hold Control + Option to dictate", action: nil, keyEquivalent: ""))
        menu.addItem(.separator())
        addMode(menu, title: "Raw transcript", action: #selector(rawMode), selected: mode == "raw")
        addMode(menu, title: "Polish · Plain", action: #selector(plainMode), selected: mode == "polish" && style == "plain")
        addMode(menu, title: "Polish · Email", action: #selector(emailMode), selected: mode == "polish" && style == "email")
        addMode(menu, title: "Polish · Code", action: #selector(codeMode), selected: mode == "polish" && style == "code")
        let outputItem = NSMenuItem(title: "Output language / script", action: nil, keyEquivalent: "")
        let outputMenu = NSMenu()
        addMode(outputMenu, title: "Spoken language (original script)", action: #selector(spokenOutput), selected: outputMode == "spoken")
        addMode(outputMenu, title: "Latin (Romanized) · e.g. Aap kaise ho?", action: #selector(romanizedOutput), selected: outputMode == "romanize")
        addMode(outputMenu, title: "Translate to English", action: #selector(translateToEnglish), selected: outputMode == "translate" && targetLanguage.caseInsensitiveCompare("English") == .orderedSame)
        addMode(outputMenu, title: "Choose translation language…", action: #selector(chooseTranslationLanguage), selected: outputMode == "translate" && targetLanguage.caseInsensitiveCompare("English") != .orderedSame)
        outputItem.submenu = outputMenu
        menu.addItem(outputItem)
        let inputItem = NSMenuItem(title: "Speech recognition language", action: nil, keyEquivalent: "")
        let inputMenu = NSMenu()
        addMode(inputMenu, title: "Auto-detect · multilingual", action: #selector(autoInputLanguage), selected: inputLanguage == "auto" && !verifyEnglish)
        addMode(inputMenu, title: "English only · verify first", action: #selector(verifiedEnglishInput), selected: verifyEnglish)
        addMode(inputMenu, title: "Hindi · force Hindi recognition", action: #selector(hindiInput), selected: inputLanguage == "hi")
        let manualName = inputLanguageChoices.first(where: { $0.code == inputLanguage })?.name
        addMode(inputMenu, title: manualName.map { "Choose another… · current: \($0)" } ?? "Choose language…", action: #selector(chooseInputLanguage), selected: inputLanguage != "auto" && inputLanguage != "hi" && !verifyEnglish)
        inputItem.submenu = inputMenu
        menu.addItem(inputItem)
        menu.addItem(.separator())
        let permissions = NSMenuItem(title: "Check permissions…", action: #selector(checkPermissions), keyEquivalent: "")
        permissions.target = self; menu.addItem(permissions)
        let history = NSMenuItem(title: "Transcripts & Inspector…", action: #selector(showHistory), keyEquivalent: "")
        history.target = self; menu.addItem(history)
        let saving = NSMenuItem(title: "Save transcript history", action: #selector(toggleHistory), keyEquivalent: "")
        saving.target = self; saving.state = saveHistory ? .on : .off; menu.addItem(saving)
        let show = NSMenuItem(title: "Show last result", action: #selector(showLast), keyEquivalent: "")
        show.target = self; menu.addItem(show)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit Dictation", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(quit)
        status?.menu = menu
        self.menu = menu
    }

    private func addMode(_ menu: NSMenu, title: String, action: Selector, selected: Bool) {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self; item.state = selected ? .on : .off; menu.addItem(item)
    }

    private func persistModeAndStyle() {
        UserDefaults.standard.set(mode, forKey: "dictationMode")
        UserDefaults.standard.set(style, forKey: "dictationStyle")
        refreshMenu()
    }

    @objc private func rawMode() { mode = "raw"; persistModeAndStyle() }
    @objc private func plainMode() { mode = "polish"; style = "plain"; persistModeAndStyle() }
    @objc private func emailMode() { mode = "polish"; style = "email"; persistModeAndStyle() }
    @objc private func codeMode() { mode = "polish"; style = "code"; persistModeAndStyle() }

    private func isValidTargetLanguage(_ value: String) -> Bool {
        let language = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return !language.isEmpty && language.count <= 40 && language.range(of: "^[\\p{L}][\\p{L}\\p{M} ()-]*$", options: .regularExpression) != nil
    }

    private func setOutputMode(_ value: String, target: String? = nil) {
        outputMode = value
        if let target { targetLanguage = target }
        else if value != "translate" { targetLanguage = "English" }
        UserDefaults.standard.set(outputMode, forKey: "dictationOutputMode")
        UserDefaults.standard.set(targetLanguage, forKey: "dictationTargetLanguage")
        refreshMenu()
    }

    @objc private func spokenOutput() { setOutputMode("spoken") }
    @objc private func romanizedOutput() { setOutputMode("romanize") }
    @objc private func translateToEnglish() { setOutputMode("translate", target: "English") }
    @objc private func chooseTranslationLanguage() {
        showHub(selectingEntryID: nil)
        hubModel.selectedSection = .styleAndLanguage
        hubModel.appOutputMode = "translate"
    }

    private func setInputLanguage(_ code: String, verify: Bool = false) {
        inputLanguage = code
        verifyEnglish = verify
        UserDefaults.standard.set(code, forKey: "dictationInputLanguage")
        UserDefaults.standard.set(verify, forKey: "dictationVerifyEnglish")
        refreshMenu()
    }

    @objc private func autoInputLanguage() { setInputLanguage("auto") }
    @objc private func verifiedEnglishInput() { setInputLanguage("en", verify: true) }
    @objc private func hindiInput() { setInputLanguage("hi") }
    @objc private func chooseInputLanguage() {
        showHub(selectingEntryID: nil)
        hubModel.selectedSection = .styleAndLanguage
    }

    @objc private func showLast() {
        showHub(selectingEntryID: lastHistoryId)
    }

    @objc private func checkPermissions() {
        openNextPermissionSettings()
    }

    private func openPrivacySettings(_ section: String) -> Bool {
        let identifiers = [
            "com.apple.settings.PrivacySecurity.extension",
            "com.apple.preference.security",
            "com.apple.preferences.security",
        ]
        for identifier in identifiers {
            guard let url = URL(string: "x-apple.systempreferences:\(identifier)?\(section)") else { continue }
            if NSWorkspace.shared.open(url) { return true }
        }
        return false
    }

    private func showPermissionSettings(title: String, section: String, fallback: String) {
        let instructions = openPrivacySettings(section)
            ? "Allow Ripple here. Return and click again for the next setting."
            : "Open Privacy & Security → \(fallback). Return and click again."
        bubble.show(title: title, text: instructions, canEnable: true)
    }

    private func openNextPermissionSettings() {
        refreshHubPermissions()
        if !CGPreflightListenEventAccess() {
            _ = CGRequestListenEventAccess()
            showPermissionSettings(title: "Input Monitoring permission", section: "Privacy_ListenEvent", fallback: "Input Monitoring")
            return
        }
        if !AXIsProcessTrusted() {
            _ = AXIsProcessTrusted()
            showPermissionSettings(title: "Accessibility permission", section: "Privacy_Accessibility", fallback: "Accessibility")
            return
        }
        let microphone = AVCaptureDevice.authorizationStatus(for: .audio)
        if microphone == .notDetermined {
            AVCaptureDevice.requestAccess(for: .audio) { _ in }
            showPermissionSettings(title: "Microphone permission", section: "Privacy_Microphone", fallback: "Microphone")
            return
        }
        if microphone != .authorized {
            showPermissionSettings(title: "Microphone permission", section: "Privacy_Microphone", fallback: "Microphone")
            return
        }
        if tap == nil { installTap() }
        bubble.show(title: "Ready", text: "Focus a text field, then hold Control + Option to dictate.")
    }

    private func installTap() {
        guard tap == nil else { return }
        guard CGPreflightListenEventAccess() else {
            bubble.show(title: "Input Monitoring needed", text: "Enable access in System Settings to use the shortcut.", canEnable: true)
            return
        }
        let selfPointer = Unmanaged.passUnretained(self).toOpaque()
        let mask = CGEventMask(1) << CGEventType.flagsChanged.rawValue
        guard let eventTap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly, eventsOfInterest: mask, callback: { _, type, event, info in
            guard let info else { return Unmanaged.passUnretained(event) }
            let app = Unmanaged<DictationApp>.fromOpaque(info).takeUnretainedValue()
            if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
                DispatchQueue.main.async { app.tapInterrupted() }
            } else if type == .flagsChanged {
                let flags = event.flags
                DispatchQueue.main.async { app.flagsChanged(flags) }
            }
            return Unmanaged.passUnretained(event)
        }, userInfo: selfPointer) else {
            bubble.show(title: "Shortcut unavailable", text: "Enable Input Monitoring in System Settings, then relaunch.", canEnable: true)
            return
        }
        tap = eventTap
        source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
        if let source { CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes) }
        CGEvent.tapEnable(tap: eventTap, enable: true)
        let flags = CGEventSource.flagsState(.combinedSessionState)
        armed = !flags.contains(.maskControl) && !flags.contains(.maskAlternate)
    }

    private func tapInterrupted() {
        if state == .recording {
            recorder?.stop(); recorder = nil; meter?.invalidate(); meter = nil
            cleanup(); state = .idle; target = nil
            bubble.show(title: "Recording cancelled", text: "Input monitoring was interrupted. Please try again.")
        }
        if let tap { CGEvent.tapEnable(tap: tap, enable: true) }
        armed = false
    }

    private func flagsChanged(_ flags: CGEventFlags) {
        let control = flags.contains(.maskControl), option = flags.contains(.maskAlternate)
        held = control && option
        if !control && !option { armed = true }
        if state == .recording && !held { finishRecording(); return }
        if state == .idle && armed && held && !flags.contains(.maskCommand) && !flags.contains(.maskShift) {
            armed = false
            beginRecording()
        }
    }

    private func beginRecording() {
        guard state == .idle else { return }
        hideTimer?.invalidate()
        resultText = ""; historyWarning = false; targetProblem = "This field does not support automatic insertion."
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: break
        case .notDetermined:
            bubble.show(title: "Microphone permission", text: "Allow microphone access, then hold Control + Option again.", expandToast: true)
            AVCaptureDevice.requestAccess(for: .audio) { _ in }
            return
        default:
            bubble.show(title: "Microphone unavailable", text: "Allow access in System Settings → Privacy & Security → Microphone.", canEnable: true)
            return
        }
        do {
            target = try FocusedTarget.capture()
            diagnostic(stage: "target_capture", reason: "ready")
        } catch FocusGuardError.secureField {
            diagnostic(stage: "target_capture", reason: "secure_field")
            target = nil; bubble.show(title: "Secure field", text: "Dictation is disabled in this field.", expandToast: true); return
        } catch FocusGuardError.accessibilityDenied {
            diagnostic(stage: "target_capture", reason: "accessibility_denied"); targetProblem = "Enable Accessibility permission to insert text."; target = nil
        } catch FocusGuardError.unsupportedField {
            diagnostic(stage: "target_capture", reason: "unsupported_field"); target = nil
        } catch FocusGuardError.selectionUnavailable {
            diagnostic(stage: "target_capture", reason: "selection_unavailable"); targetProblem = "Could not verify the cursor position in this field."; target = nil
        } catch {
            diagnostic(stage: "target_capture", reason: "unavailable"); target = nil
        }
        do {
            let dir = FileManager.default.temporaryDirectory.resolvingSymlinksInPath().appendingPathComponent("ripple-dictation-" + UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
            folder = dir
            let options: [String: Any] = [AVFormatIDKey: Int(kAudioFormatLinearPCM), AVSampleRateKey: 16000, AVNumberOfChannelsKey: 1, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false]
            let audio = try AVAudioRecorder(url: dir.appendingPathComponent("input.wav"), settings: options)
            audio.delegate = self; audio.isMeteringEnabled = true
            guard audio.record(forDuration: 300), audio.isRecording else {
                throw NSError(domain: "Recording", code: 1)
            }
            recorder = audio; state = .recording; recordingStartedAt = Date()
            diagnostic(stage: "recording", reason: "started")
            bubble.show(title: "Listening", text: "Speak naturally. Release Control or Option when you’re done.")
            meter = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
                guard let self, let recorder = self.recorder else { return }
                recorder.updateMeters()
                let avg = recorder.averagePower(forChannel: 0)
                let peak = recorder.peakPower(forChannel: 0)
                self.bubble.updateAudioMeters(averagePower: avg, peakPower: peak)
            }
        } catch {
            diagnostic(stage: "recording", reason: "start_failed")
            cleanup(); target = nil; state = .idle
            bubble.show(title: "Couldn’t start recording", text: "Check Microphone access in System Settings.", expandToast: true)
        }
    }

    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if state == .recording { finishRecording() }
    }

    private func finishRecording() {
        guard state == .recording, let recorder, let folder else { return }
        let duration = max(recorder.currentTime, recordingStartedAt.map { Date().timeIntervalSince($0) } ?? 0)
        recordingDurationMs = min(301000, duration * 1000)
        recordingStartedAt = nil
        state = .processing
        self.recorder = nil
        recorder.delegate = nil
        recorder.stop()
        meter?.invalidate(); meter = nil; bubble.resetAudioMeters()
        guard duration >= 0.25 else {
            diagnostic(stage: "recording", reason: "too_short")
            cleanup(); target = nil; state = .idle
            bubble.show(title: "Too short", text: "Hold Control + Option while you speak.")
            return
        }
        bubble.show(title: "Transcribing locally", text: "Converting speech to text on this Mac…")
        runWorker(audio: folder.appendingPathComponent("input.wav"))
    }

    private func runWorker(audio: URL) {
        guard let root = Bundle.main.object(forInfoDictionaryKey: "RippleProjectRoot") as? String,
              let node = Bundle.main.object(forInfoDictionaryKey: "RippleNodePath") as? String else {
            finishFailure("The app configuration is missing. Rebuild the app."); return
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: node)
        process.arguments = [URL(fileURLWithPath: root).appendingPathComponent("dist/dictation/worker.js").path]
        process.currentDirectoryURL = URL(fileURLWithPath: root)
        let environment = ProcessInfo.processInfo.environment
        process.environment = ["PATH": environment["PATH"] ?? "/opt/homebrew/bin:/usr/bin:/bin", "HOME": environment["HOME"] ?? NSHomeDirectory(), "TMPDIR": environment["TMPDIR"] ?? NSTemporaryDirectory(), "LANG": environment["LANG"] ?? "en_US.UTF-8", "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1"]
        let input = Pipe(), output = Pipe(), progress = Pipe()
        process.standardInput = input; process.standardOutput = output; process.standardError = progress.fileHandleForWriting
        progress.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else { return }
            self?.workerProgressBuffer.append(chunk)
            while let newline = self?.workerProgressBuffer.firstIndex(of: 0x0a) {
                guard let self else { break }
                let line = self.workerProgressBuffer.prefix(upTo: newline)
                self.workerProgressBuffer.removeSubrange(...newline)
                guard let event = (try? JSONSerialization.jsonObject(with: Data(line))) as? [String: Any],
                      let stage = event["stage"] as? String else { continue }
                DispatchQueue.main.async { self.showWorkerStage(stage) }
            }
        }
        var request: [String: Any] = ["audioFile": audio.path, "mode": mode, "style": style, "outputMode": outputMode, "targetLanguage": targetLanguage, "inputLanguage": inputLanguage, "verifyEnglish": verifyEnglish, "recordingDurationMs": recordingDurationMs, "saveHistory": saveHistory]
        if let selectedText = target?.selectedText, selectedText.utf16.count <= 12_000 {
            request["selectedText"] = selectedText
        }
        guard let data = try? JSONSerialization.data(withJSONObject: request) else { finishFailure("Couldn’t prepare the recording."); return }
        do {
            try process.run()
            worker = process
            workerProgressBuffer = Data()
            input.fileHandleForWriting.write(data)
            try? input.fileHandleForWriting.close()
        } catch { finishFailure("Couldn’t start the local transcription worker."); return }
        let timeout = DispatchWorkItem { [weak process] in if process?.isRunning == true { process?.terminate() } }
        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + 180, execute: timeout)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let data = output.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            progress.fileHandleForReading.readabilityHandler = nil
            timeout.cancel()
            let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            DispatchQueue.main.async { self?.handleResult(result, exit: process.terminationStatus) }
        }
    }

    private func showWorkerStage(_ stage: String) {
        switch stage {
        case "transcribing": bubble.show(title: "Transcribing", text: "Turning speech into text…")
        case "polishing": bubble.show(title: "Polishing", text: "Refining your words…")
        case "formatting": bubble.show(title: "Formatting output", text: "Converting language or script…")
        default: break
        }
    }

    private func handleResult(_ result: [String: Any]?, exit: Int32) {
        worker = nil
        if let error = result?["error"] as? String {
            switch error {
            case "selection_required":
                diagnostic(stage: "selection", reason: "source_unavailable")
                finishFailure("No selected text was readable from this field.")
            case "transformation_failed":
                finishFailure("Couldn’t transform the selected text. Selection left unchanged.")
            case "language_check_failed":
                finishFailure("Recording was not verified as English; nothing was inserted.")
            default:
                finishFailure("No usable speech was recognized. Try again.")
            }
            return
        }
        guard exit == 0, let result, result["ok"] as? Bool == true, let text = result["text"] as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            finishFailure("No usable speech was recognized. Try again."); return
        }
        resultText = text
        rawResultText = result["rawText"] as? String ?? text
        lastHistoryId = result["historyId"] as? String
        let selectionTransform = result["selectionTransform"] as? Bool == true
        if selectionTransform { diagnostic(stage: "selection", reason: "transformed") }
        let fallback = result["status"] as? String == "fallback"
        if saveHistory && result["historySaved"] as? Bool != true {
            diagnostic(stage: "history", reason: "save_failed"); historyWarning = true
        }
        if hubWindow?.isVisible == true {
            refreshHistory()
        }
        cleanup()
        bubble.show(title: fallback ? "Local formatter unavailable · Raw text" : "Your text", text: text, rawText: rawResultText, canCopy: true)
        guard let target else {
            state = .idle
            self.target = nil
            showClipboardFallback(text, title: "Paste unavailable")
            return
        }
        if !target.canPaste {
            do {
                try target.validate()
                diagnostic(stage: "selection", reason: "copy_only")
                state = .idle; self.target = nil
                showClipboardFallback(text, title: selectionTransform ? "Read-only selection" : "Preview only")
            } catch {
                state = .idle; self.target = nil
                showClipboardFallback(text, title: "Selection changed")
            }
            return
        }
        // Wait for both modifiers to be released so synthetic text is not modified by held keys.
        waitForKeyRelease(target: target, text: text, attempts: 0)
    }

    private func waitForKeyRelease(target: FocusedTarget, text: String, attempts: Int) {
        let flags = CGEventSource.flagsState(.combinedSessionState)
        if flags.contains(.maskControl) || flags.contains(.maskAlternate) {
            if attempts < 30 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in self?.waitForKeyRelease(target: target, text: text, attempts: attempts + 1) }; return }
            state = .idle; self.target = nil
            showClipboardFallback(text, title: "Paste manually")
            return
        }
        do {
            try target.sendText(text)
            diagnostic(stage: "delivery", reason: "sent")
            // Stay in the minimal resting droplet on clean paste; only show toast if history saving failed.
            bubble.show(title: historyWarning ? "Sent · History not saved" : "Sent", text: text, rawText: rawResultText, canCopy: true, expandToast: historyWarning)
        } catch FocusGuardError.unsupportedText {
            diagnostic(stage: "delivery", reason: "unsupported_text")
            showClipboardFallback(text, title: "Text unsupported")
        } catch FocusGuardError.targetChanged {
            diagnostic(stage: "delivery", reason: "target_changed")
            showClipboardFallback(text, title: "Focus changed")
        } catch {
            // Some characters may have been delivered. Never retry automatically.
            diagnostic(stage: "delivery", reason: "uncertain")
            showClipboardFallback(text, title: "Delivery uncertain")
        }
        state = .idle; self.target = nil
    }

    private func finishFailure(_ message: String) {
        cleanup(); target = nil; worker = nil; state = .idle
        bubble.show(title: "Dictation unavailable", text: message, expandToast: true)
    }

    private func copyResult(_ text: String) {
        guard !text.isEmpty else { return }
        _ = writeClipboard(text)
        bubble.show(title: "Copied to clipboard", text: resultText, rawText: rawResultText, canCopy: true, expandToast: true)
    }

    /// Makes the completed result available for manual paste after any non-successful delivery.
    /// Never retries Command-V because a prior event may have been partially delivered.
    private func showClipboardFallback(_ text: String, title: String) {
        let copied = writeClipboard(text)
        diagnostic(stage: "clipboard", reason: copied ? "fallback" : "failed")
        bubble.show(title: copied ? "Copied · \(title)" : "\(title) · copy failed", text: text, rawText: rawResultText, canCopy: true, expandToast: true)
    }

    @discardableResult
    private func writeClipboard(_ text: String) -> Bool {
        guard !text.isEmpty else { return false }
        NSPasteboard.general.clearContents()
        return NSPasteboard.general.setString(text, forType: .string)
    }

    /// Records a fixed status code, never the field, transcript, app name or error details.
    private func diagnostic(stage: String, reason: String) {
        guard let root = Bundle.main.object(forInfoDictionaryKey: "RippleProjectRoot") as? String else { return }
        let allowedStages = ["target_capture", "delivery", "history", "recording", "selection", "clipboard"]
        let allowedReasons = ["ready", "secure_field", "accessibility_denied", "unsupported_field", "selection_unavailable", "unavailable", "sent", "unsupported_text", "target_changed", "uncertain", "save_failed", "started", "start_failed", "too_short", "source_unavailable", "transformed", "copy_only", "fallback", "failed"]
        guard allowedStages.contains(stage), allowedReasons.contains(reason) else { return }
        let path = URL(fileURLWithPath: root).appendingPathComponent("data/performance.jsonl").path
        let event: [String: Any] = ["time": ISO8601DateFormatter().string(from: Date()), "stage": stage, "reason": reason]
        guard var data = try? JSONSerialization.data(withJSONObject: event) else { return }
        data.append(0x0a)
        let fd = open(path, O_WRONLY | O_APPEND | O_CREAT, 0o600)
        guard fd >= 0 else { return }
        defer { close(fd) }
        _ = fchmod(fd, 0o600)
        _ = data.withUnsafeBytes { raw in write(fd, raw.baseAddress, raw.count) }
    }

    @objc private func toggleHistory() {
        UserDefaults.standard.set(!saveHistory, forKey: "saveDictationHistory")
        refreshMenu()
    }

    @objc private func showHistory() {
        showHub(selectingEntryID: nil)
    }

    private func showHub(selectingEntryID: String?, skipRefresh: Bool = false) {
        if hubWindow == nil {
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 900, height: 580),
                styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                backing: .buffered,
                defer: false
            )
            window.title = "Ripple"
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.minSize = NSSize(width: 780, height: 500)
            window.center()
            window.isReleasedWhenClosed = false
            window.contentView = NSHostingView(rootView: HubRootView(model: hubModel))
            hubWindow = window
        }
        syncHubModelSettings()
        refreshHubPermissions()
        if !skipRefresh {
            refreshHistory(selectingAfterLoad: selectingEntryID)
        } else if let selectingEntryID {
            hubModel.openInspector(for: selectingEntryID)
        }
        NSApp.activate(ignoringOtherApps: true)
        hubWindow?.makeKeyAndOrderFront(nil)
    }

    private func deleteHistoryEntry(_ id: String) {
        historyRequest(payload: ["action": "delete", "id": id]) { [weak self] _ in
            guard let self else { return }
            if self.hubModel.selectedEntryID == id {
                self.hubModel.selectedEntryID = nil
            }
            self.hubModel.entries.removeAll { $0.id == id }
        }
    }

    @objc private func refreshHistory() {
        refreshHistory(selectingAfterLoad: nil)
    }

    private func refreshHistory(selectingAfterLoad: String?) {
        hubModel.isLoading = true
        historyRequest(payload: ["action": "list"]) { [weak self] response in
            guard let self else { return }
            self.hubModel.isLoading = false
            guard let rows = response?["result"] as? [[String: Any]] else { return }
            self.hubModel.entries = rows.compactMap { DictationEntry.from(dictionary: $0) }
            if let selectingAfterLoad {
                self.hubModel.openInspector(for: selectingAfterLoad)
            } else if let selected = self.hubModel.selectedEntry {
                self.hubModel.syncInspectorControls(with: selected)
            }
        }
    }

    private func historyRequest(payload: [String: Any], completion: @escaping ([String: Any]?) -> Void) {
        guard let root = Bundle.main.object(forInfoDictionaryKey: "RippleProjectRoot") as? String,
              let node = Bundle.main.object(forInfoDictionaryKey: "RippleNodePath") as? String else { completion(nil); return }
        DispatchQueue.global(qos: .userInitiated).async {
            let p = Process(); p.executableURL = URL(fileURLWithPath: node)
            p.arguments = [URL(fileURLWithPath: root).appendingPathComponent("dist/dictation/history-worker.js").path]
            p.currentDirectoryURL = URL(fileURLWithPath: root); p.standardError = FileHandle.nullDevice
            let env = ProcessInfo.processInfo.environment
            p.environment = ["PATH": env["PATH"] ?? "/opt/homebrew/bin:/usr/bin:/bin", "HOME": env["HOME"] ?? NSHomeDirectory(), "TMPDIR": env["TMPDIR"] ?? NSTemporaryDirectory(), "LANG": env["LANG"] ?? "en_US.UTF-8", "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1"]
            let input = Pipe(), output = Pipe(); p.standardInput = input; p.standardOutput = output
            do {
                try p.run(); input.fileHandleForWriting.write(try JSONSerialization.data(withJSONObject: payload)); try? input.fileHandleForWriting.close()
                let data = output.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit()
                let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                DispatchQueue.main.async { completion(value?["ok"] as? Bool == true ? value : nil) }
            } catch { DispatchQueue.main.async { completion(nil) } }
        }
    }

    private func cleanup() {
        if let folder { try? FileManager.default.removeItem(at: folder) }
        folder = nil
    }
}

@MainActor
private func renderHubPreviewIfNeeded() -> Bool {
    let args = CommandLine.arguments
    guard args.contains("--ui-preview-hub") || args.contains("--ui-preview-hub-narrow") || args.contains("--ui-preview-hub-inspector") || args.contains("--ui-preview-hub-style") else {
        return false
    }
    let model = HubViewModel()
    model.isPreviewMode = true
    model.appMode = "polish"
    model.appStyle = "plain"
    model.appOutputMode = "spoken"
    model.appInputLanguage = "auto"
    model.hasInputMonitoring = true
    model.hasAccessibility = true
    model.hasMicrophone = true
    let sampleEntries: [DictationEntry] = [
        DictationEntry(
            id: "11111111-1111-1111-1111-111111111111",
            createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-180)),
            date: Date().addingTimeInterval(-180),
            rawText: "hey team let us push the design review to 4 pm no wait 4 30 pm so priya can join",
            text: "Hi team,\n\nLet's move the design review to 4:30 PM so Priya can join.\n\nBest regards,",
            mode: "polish",
            style: "email",
            outputMode: "spoken",
            targetLanguage: "English",
            status: "polished"
        ),
        DictationEntry(
            id: "22222222-2222-2222-2222-222222222222",
            createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-2400)),
            date: Date().addingTimeInterval(-2400),
            rawText: "um we need to make sure the sqlite database migration preserves all v1 rows without dropping anything",
            text: "We need to make sure the SQLite database migration preserves all v1 rows without dropping anything.",
            mode: "polish",
            style: "plain",
            outputMode: "spoken",
            targetLanguage: "English",
            status: "polished"
        ),
        DictationEntry(
            id: "33333333-3333-3333-3333-333333333333",
            createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-7200)),
            date: Date().addingTimeInterval(-7200),
            rawText: "आप कैसे हो कल सुबह बात करते हैं",
            text: "Aap kaise ho, kal subah baat karte hain.",
            mode: "polish",
            style: "plain",
            outputMode: "romanize",
            targetLanguage: "English",
            status: "polished"
        ),
    ]
    model.entries = sampleEntries
    let isNarrow = args.contains("--ui-preview-hub-narrow")
    let defaultWidth: CGFloat = isNarrow ? 560 : 900
    let defaultHeight: CGFloat = isNarrow ? 460 : 580

    let defaultName: String
    if args.contains("--ui-preview-hub-narrow") {
        defaultName = "ripple-hub-narrow-preview.png"
    } else if args.contains("--ui-preview-hub-inspector") {
        model.openInspector(for: sampleEntries[0].id)
        defaultName = "ripple-hub-inspector-preview.png"
    } else if args.contains("--ui-preview-hub-style") {
        model.selectedSection = .styleAndLanguage
        defaultName = "ripple-hub-style-preview.png"
    } else {
        defaultName = "ripple-hub-preview.png"
    }
    var targetURL = URL(fileURLWithPath: "/tmp").appendingPathComponent(defaultName)
    for flag in ["--ui-preview-hub-narrow", "--ui-preview-hub-inspector", "--ui-preview-hub-style", "--ui-preview-hub"] {
        if let idx = args.firstIndex(of: flag), idx + 1 < args.count {
            let nextArg = args[idx + 1]
            if !nextArg.hasPrefix("--") {
                targetURL = URL(fileURLWithPath: nextArg)
                break
            }
        }
    }
    let rootView = HubRootView(model: model)
        .frame(width: defaultWidth, height: defaultHeight)
        .environment(\.colorScheme, .dark)
    let renderer = ImageRenderer(content: rootView)
    renderer.scale = 2.0
    if let cgImage = renderer.cgImage {
        let rep = NSBitmapImageRep(cgImage: cgImage)
        if let png = rep.representation(using: .png, properties: [:]) {
            try? png.write(to: targetURL)
        }
    }
    return true
}

@MainActor
private func renderDropletPreviewIfNeeded() -> Bool {
    let args = CommandLine.arguments
    guard let idx = args.firstIndex(of: "--ui-preview-droplet") else {
        return false
    }
    let phaseArg = idx + 1 < args.count ? args[idx + 1] : "idle"

    let targetPhase: DropletPhase
    var defaultEnergy: CGFloat = 0.0
    if phaseArg == "peak" {
        targetPhase = .listening
        defaultEnergy = 0.85
    } else if phaseArg == "listening" {
        targetPhase = .listening
        defaultEnergy = 0.45
    } else if phaseArg == "transcribing" {
        targetPhase = .transcribing
    } else if phaseArg == "polishing" {
        targetPhase = .polishing
    } else if phaseArg == "success" {
        targetPhase = .success
    } else if phaseArg == "error" {
        targetPhase = .error
    } else {
        targetPhase = .idle
    }

    var customEnergy: CGFloat? = nil
    var customPath: String? = nil
    for i in (idx + 2)..<args.count {
        let a = args[i]
        if a.hasPrefix("--") { break }
        if let val = Double(a), customEnergy == nil {
            customEnergy = CGFloat(val)
        } else if customPath == nil {
            customPath = a
        }
    }

    let energy = customEnergy ?? defaultEnergy
    let outPath = customPath ?? "/tmp/ripple-droplet-\(phaseArg).png"
    let outURL = URL(fileURLWithPath: outPath)

    let previewTime: CFTimeInterval = (targetPhase == .success) ? 0.08 : 1.0

    func configureModel() -> DropletModel {
        let model = DropletModel()
        model.phase = targetPhase
        model.fromColor = model.targetColor(for: targetPhase)
        model.toColor = model.targetColor(for: targetPhase)
        model.phaseChangedAt = 0
        model.energy = energy
        model.low = energy
        model.high = energy * 0.5
        return model
    }
    let modelDark = configureModel()
    let modelLight = configureModel()

    let compositeView = HStack(spacing: 0) {
        ZStack {
            Color(nsColor: NSColor(hex: 0x12141B))
            DropletView(model: modelDark, fixedTime: previewTime)
                .frame(width: 120, height: 120)
        }
        .frame(width: 130, height: 130)

        ZStack {
            Color.white
            DropletView(model: modelLight, fixedTime: previewTime)
                .frame(width: 120, height: 120)
        }
        .frame(width: 130, height: 130)
    }
    .frame(width: 260, height: 130)

    let renderer = ImageRenderer(content: compositeView)
    renderer.scale = 2.0
    if let cgImage = renderer.cgImage {
        let rep = NSBitmapImageRep(cgImage: cgImage)
        if let png = rep.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) {
            try? png.write(to: outURL)
            print("Rendered droplet preview (\(phaseArg)) to \(outURL.path)")
        }
    }
    return true
}

private func runDropletStabilityTestIfNeeded() -> Bool {
    let args = CommandLine.arguments
    guard args.contains("--test-droplet-stability") else {
        return false
    }
    print("Running headless Droplet v2 numerical stability test (10,000 frames)...")
    let sim = DropletSimulation()
    let features = DropletAudioFeatures(energy: 1.0, low: 1.0, high: 1.0)
    let baseR: CGFloat = 25.0
    let targetR = baseR + 5.0 * features.energy
    sim.targetRadius = targetR
    sim.currentRadius = targetR
    sim.noiseAmp = 1.0

    for frame in 0..<10_000 {
        let dt: CGFloat = (frame % 100 == 0) ? 0.10 : 0.0166667
        let t = Double(frame) * 0.0166667
        sim.step(
            dt: dt,
            features: features,
            phase: .listening,
            targetR: targetR,
            elapsedInPhase: t,
            time: t
        )

        let center = CGPoint(x: 60, y: 60)
        let _ = sim.buildContourPath(
            center: center,
            phase: .listening,
            features: features,
            reduceMotion: false
        )

        let r0 = sim.currentRadius
        let minR = r0 * 0.50
        let maxR = r0 * 1.70

        for (idx, pt) in sim.points.enumerated() {
            guard pt.x.isFinite && pt.y.isFinite else {
                print("FAILED: Non-finite point at frame \(frame), node \(idx): \(pt)")
                exit(1)
            }
            let dist = hypot(pt.x - center.x, pt.y - center.y)
            guard dist >= minR && dist <= maxR else {
                print("FAILED: Point outside stability bounds at frame \(frame), node \(idx): dist=\(dist), min=\(minR), max=\(maxR)")
                exit(1)
            }
        }
    }
    print("Stability test PASSED: 10,000 frames simulated successfully. All points finite and within [0.5*R0, 1.7*R0].")
    return true
}

@MainActor
private func renderDropletSequenceIfNeeded() -> Bool {
    let args = CommandLine.arguments
    guard let idx = args.firstIndex(of: "--ui-preview-droplet-sequence") else {
        return false
    }

    var totalDuration: Double = 2.0
    var outDirPath = "/tmp/droplet-sequence"

    for i in (idx + 1)..<args.count {
        let a = args[i]
        if a.hasPrefix("--") { break }
        if let val = Double(a) {
            totalDuration = val
        } else {
            outDirPath = a
        }
    }

    let outURL = URL(fileURLWithPath: outDirPath)
    try? FileManager.default.createDirectory(at: outURL, withIntermediateDirectories: true)

    let fps: Double = 30.0
    let totalFrames = max(1, Int(totalDuration * fps))
    print("Rendering Droplet v2 sequence (\(totalFrames) frames @ \(Int(fps)) fps, duration \(totalDuration)s) to \(outDirPath)...")

    let modelDark = DropletModel()
    let modelLight = DropletModel()

    for frame in 0..<totalFrames {
        let t = Double(frame) / fps
        let normalizedT = t / totalDuration

        let currentPhase: DropletPhase
        let currentEnergy: CGFloat

        if normalizedT < 0.10 {
            currentPhase = .idle
            currentEnergy = 0.0
        } else if normalizedT < 0.45 {
            currentPhase = .listening
            let pulse = CGFloat(sin((normalizedT - 0.10) / 0.35 * .pi))
            currentEnergy = 0.20 + 0.55 * pulse
        } else if normalizedT < 0.58 {
            currentPhase = .listening
            currentEnergy = 0.03
        } else if normalizedT < 0.80 {
            currentPhase = .listening
            let peakPulse = CGFloat(sin((normalizedT - 0.58) / 0.22 * .pi))
            currentEnergy = 0.40 + 0.55 * peakPulse
        } else if normalizedT < 0.90 {
            currentPhase = .transcribing
            currentEnergy = 0.0
        } else if normalizedT < 0.96 {
            currentPhase = .polishing
            currentEnergy = 0.0
        } else {
            currentPhase = .success
            currentEnergy = 0.0
        }

        for m in [modelDark, modelLight] {
            m.setPhase(currentPhase)
            m.energy = currentEnergy
            m.low = currentEnergy * 0.9
            m.high = currentEnergy * 0.4
        }

        let compositeView = HStack(spacing: 0) {
            ZStack {
                Color(nsColor: NSColor(hex: 0x12141B))
                DropletView(model: modelDark, fixedTime: t)
                    .frame(width: 120, height: 120)
            }
            .frame(width: 130, height: 130)

            ZStack {
                Color.white
                DropletView(model: modelLight, fixedTime: t)
                    .frame(width: 120, height: 120)
            }
            .frame(width: 130, height: 130)
        }
        .frame(width: 260, height: 130)

        let renderer = ImageRenderer(content: compositeView)
        renderer.scale = 2.0
        if let cgImage = renderer.cgImage {
            let rep = NSBitmapImageRep(cgImage: cgImage)
            if let png = rep.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) {
                let frameFileName = String(format: "frame_%04d.png", frame)
                let frameURL = outURL.appendingPathComponent(frameFileName)
                try? png.write(to: frameURL)
            }
        }
    }

    print("Sequence export complete: \(totalFrames) frames dumped to \(outDirPath).")
    return true
}

if !MainActor.assumeIsolated({
    runDropletStabilityTestIfNeeded() ||
    renderDropletSequenceIfNeeded() ||
    renderHubPreviewIfNeeded() ||
    renderDropletPreviewIfNeeded()
}) {
    let app = NSApplication.shared
    let delegate = DictationApp()
    app.delegate = delegate
    app.run()
}
