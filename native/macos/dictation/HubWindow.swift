import AppKit
import SwiftUI

public enum RippleTheme {
    // MARK: - Adaptive Color Tokens (Direction B — Warm Editorial)
    public enum Colors {
        // --- Surface Hierarchy ---
        public static let surfaceCanvas = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x141416) : NSColor(hex: 0xFAF9F6)
        }))

        public static let surfaceSidebar = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x18181B) : NSColor(hex: 0xF2EFE9)
        }))

        public static let surfaceInspector = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x17171A) : NSColor(hex: 0xFDFDFB)
        }))

        public static let surfaceCardBase = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x1D1D21) : NSColor(hex: 0xFFFFFF)
        }))

        public static let surfaceCardHover = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x24242A) : NSColor(hex: 0xF4F1EA)
        }))

        public static let surfaceCardSelected = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x2A2933) : NSColor(hex: 0xF0EDFA)
        }))

        public static let surfaceSubCard = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x161619) : NSColor(hex: 0xF3EFE7)
        }))

        public static let surfacePillFill = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x18181B) : NSColor(hex: 0xF2EFE9)
        }))

        // --- Hairline Borders & Dividers ---
        public static let borderHairlineSubtle = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(white: 1.0, alpha: 0.05) : NSColor(white: 0.0, alpha: 0.05)
        }))

        public static let borderHairlineHover = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(white: 1.0, alpha: 0.10) : NSColor(white: 0.0, alpha: 0.10)
        }))

        public static let borderHairlineSelected = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x8B5CF6, alpha: 0.50) : NSColor(hex: 0x6D28D9, alpha: 0.50)
        }))

        public static let borderHairlineCyan = borderHairlineSelected

        public static let dividerSeparator = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(white: 1.0, alpha: 0.05) : NSColor(white: 0.0, alpha: 0.05)
        }))

        // --- Inks (Typography Foregrounds) ---
        public static let textPrimary = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0xF5F4F1) : NSColor(hex: 0x23211E)
        }))

        public static let textSecondary = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0xA5A198) : NSColor(hex: 0x5C564E)
        }))

        public static let textTertiary = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x736E67) : NSColor(hex: 0x918B82)
        }))

        public static let textQuaternary = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x4A463F) : NSColor(hex: 0xB5B0A6)
        }))

        // --- Accents (Single Accent: Muted Iris) ---
        public static let accentPrimary = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x8B5CF6) : NSColor(hex: 0x6D28D9)
        }))

        public static let accentCyan = accentPrimary
        public static let accentViolet = accentPrimary

        public static let accentSuccess = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0x34D399) : NSColor(hex: 0x059669)
        }))

        public static let accentWarning = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0xFBBF24) : NSColor(hex: 0xD97706)
        }))

        public static let accentDestructive = Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
            appearance.isDarkMode ? NSColor(hex: 0xFB7185) : NSColor(hex: 0xE11D48)
        }))

        // Floating Pill Wave Colors
        public static let pillWaveCyan = Color(nsColor: NSColor(hex: 0x82F4FF))
        public static let pillWaveViolet = Color(nsColor: NSColor(hex: 0x8E6CFF))
        public static let pillProgressCyan = Color(nsColor: NSColor(hex: 0x55D7F2))
        public static let pillProgressViolet = Color(nsColor: NSColor(hex: 0x9B83FF))
    }

    // MARK: - Typography Tokens
    public enum Typography {
        public static let hubBrandTitle = Font.system(size: 14.0, weight: .semibold, design: .rounded)
        public static let hubSectionHeader = Font.system(size: 16.0, weight: .semibold, design: .rounded)
        public static let hubCardTitle = Font.system(size: 13.0, weight: .semibold, design: .default)
        public static let feedTranscript = Font.system(size: 13.5, weight: .regular, design: .default)
        public static let feedTimestamp = Font.system(size: 11.0, weight: .regular, design: .default)
        public static let navItemLabel = Font.system(size: 12.5, weight: .medium, design: .default)
        public static let sectionLabel = Font.system(size: 11.5, weight: .semibold, design: .default)
        public static let kickerCaps = Font.system(size: 11.5, weight: .semibold, design: .default)
        public static let inspectorBody = Font.system(size: 13.0, weight: .regular, design: .default)
        public static let spokenRawBody = Font.system(size: 12.0, weight: .regular, design: .default)
        public static let metaCode = Font.system(size: 11.0, weight: .regular, design: .default)
        public static let shortcutChord = Font.system(size: 11.0, weight: .regular, design: .default)
        public static let buttonAction = Font.system(size: 11.0, weight: .medium, design: .default)
        public static let chipLabel = Font.system(size: 11.0, weight: .medium, design: .default)
    }
}

// MARK: - NSColor & NSAppearance Utilities
extension NSColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1.0) {
        self.init(
            calibratedRed: CGFloat((hex >> 16) & 0xff) / 255.0,
            green: CGFloat((hex >> 8) & 0xff) / 255.0,
            blue: CGFloat(hex & 0xff) / 255.0,
            alpha: alpha
        )
    }
}

extension NSAppearance {
    var isDarkMode: Bool {
        if bestMatch(from: [.darkAqua, .aqua]) == .darkAqua {
            return true
        }
        return name.rawValue.lowercased().contains("dark")
    }
}

struct InputLanguageChoice: Identifiable, Hashable {
    let code: String
    let name: String
    var id: String { code }
}

let inputLanguageChoices: [InputLanguageChoice] = [
    InputLanguageChoice(code: "en", name: "English"),
    InputLanguageChoice(code: "hi", name: "Hindi"),
    InputLanguageChoice(code: "bn", name: "Bengali"),
    InputLanguageChoice(code: "gu", name: "Gujarati"),
    InputLanguageChoice(code: "kn", name: "Kannada"),
    InputLanguageChoice(code: "ml", name: "Malayalam"),
    InputLanguageChoice(code: "mr", name: "Marathi"),
    InputLanguageChoice(code: "pa", name: "Punjabi"),
    InputLanguageChoice(code: "ta", name: "Tamil"),
    InputLanguageChoice(code: "te", name: "Telugu"),
    InputLanguageChoice(code: "ur", name: "Urdu"),
    InputLanguageChoice(code: "ar", name: "Arabic"),
    InputLanguageChoice(code: "zh", name: "Chinese"),
    InputLanguageChoice(code: "nl", name: "Dutch"),
    InputLanguageChoice(code: "fr", name: "French"),
    InputLanguageChoice(code: "de", name: "German"),
    InputLanguageChoice(code: "el", name: "Greek"),
    InputLanguageChoice(code: "he", name: "Hebrew"),
    InputLanguageChoice(code: "id", name: "Indonesian"),
    InputLanguageChoice(code: "it", name: "Italian"),
    InputLanguageChoice(code: "ja", name: "Japanese"),
    InputLanguageChoice(code: "ko", name: "Korean"),
    InputLanguageChoice(code: "fa", name: "Persian"),
    InputLanguageChoice(code: "pl", name: "Polish"),
    InputLanguageChoice(code: "pt", name: "Portuguese"),
    InputLanguageChoice(code: "ru", name: "Russian"),
    InputLanguageChoice(code: "es", name: "Spanish"),
    InputLanguageChoice(code: "sv", name: "Swedish"),
    InputLanguageChoice(code: "th", name: "Thai"),
    InputLanguageChoice(code: "tr", name: "Turkish"),
    InputLanguageChoice(code: "uk", name: "Ukrainian"),
    InputLanguageChoice(code: "vi", name: "Vietnamese"),
]

struct DictationEntry: Identifiable, Equatable {
    let id: String
    let createdAt: String
    let date: Date?
    let rawText: String
    var text: String
    var mode: String
    var style: String
    var outputMode: String
    var targetLanguage: String
    var status: String

    static func from(dictionary row: [String: Any]) -> DictationEntry? {
        guard let id = row["id"] as? String,
              let text = row["text"] as? String,
              let rawText = row["rawText"] as? String else { return nil }
        let createdAt = row["createdAt"] as? String ?? ""
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let parsedDate = formatter.date(from: createdAt) ?? ISO8601DateFormatter().date(from: createdAt)
        return DictationEntry(
            id: id,
            createdAt: createdAt,
            date: parsedDate,
            rawText: rawText,
            text: text,
            mode: row["mode"] as? String ?? "raw",
            style: row["style"] as? String ?? "plain",
            outputMode: row["outputMode"] as? String ?? "spoken",
            targetLanguage: row["targetLanguage"] as? String ?? "English",
            status: row["status"] as? String ?? "raw"
        )
    }

    var shortTimeLabel: String {
        guard let date else { return createdAt }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }

    var fullDateLabel: String {
        guard let date else { return createdAt }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    var daySectionTitle: String {
        guard let date else { return "Recent" }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: date)
    }

    var wordCount: Int {
        text.split { $0.isWhitespace || $0.isNewline }.count
    }

    var hasTransformDifference: Bool {
        rawText.trimmingCharacters(in: .whitespacesAndNewlines) != text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var modeDisplayLabel: String {
        if mode == "raw" { return "Raw" }
        switch style {
        case "email": return "Polish · Email"
        case "code": return "Polish · Code"
        default: return "Polish · Plain"
        }
    }

    var outputDisplayLabel: String {
        switch outputMode {
        case "romanize": return "Latin (Romanized)"
        case "translate": return "Translated → \(targetLanguage)"
        default: return "Spoken Script"
        }
    }

    var statusDisplayLabel: String {
        switch status {
        case "polished": return "Polished"
        case "romanized": return "Romanized"
        case "translated": return "Translated"
        case "fallback": return "Fallback (Raw)"
        default: return "Raw"
        }
    }
}

enum HubSection: String, CaseIterable, Identifiable {
    case transcripts = "Transcripts"
    case styleAndLanguage = "Style & Language"
    case system = "System & Access"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .transcripts: return "waveform"
        case .styleAndLanguage: return "slider.horizontal.3"
        case .system: return "checkmark.shield"
        }
    }
}

final class HubViewModel: ObservableObject {
    @Published var selectedSection: HubSection = .transcripts
    @Published var entries: [DictationEntry] = []
    @Published var searchQuery: String = ""
    @Published var selectedEntryID: String?
    @Published var isLoading: Bool = false
    @Published var isReformatting: Bool = false
    @Published var reformatError: String?
    @Published var copiedEntryID: String?
    @Published var copiedRawID: String?

    // Inspector iteration state
    @Published var inspectorMode: String = "polish"
    @Published var inspectorStyle: String = "plain"
    @Published var inspectorOutputMode: String = "spoken"
    @Published var inspectorTargetLanguage: String = "English"
    @Published var customInstruction: String = ""
    @Published var showComparisonDiff: Bool = false
    @Published var isPreviewMode: Bool = false
    @Published var isSheetPresented: Bool = false

    // App-wide settings bound to DictationApp
    @Published var appMode: String = "raw"
    @Published var appStyle: String = "plain"
    @Published var appOutputMode: String = "spoken"
    @Published var appTargetLanguage: String = "English"
    @Published var appInputLanguage: String = "auto"
    @Published var appVerifyEnglish: Bool = false
    @Published var saveHistory: Bool = true

    // System permissions
    @Published var hasInputMonitoring: Bool = false
    @Published var hasAccessibility: Bool = false
    @Published var hasMicrophone: Bool = false

    var onCopyText: ((String) -> Void)?
    var onRefreshRequested: (() -> Void)?
    var onDeleteEntry: ((String) -> Void)?
    var onClearAll: (() -> Void)?
    var onReformatRequested: ((String, String, String, String, String, String?, @escaping (Result<DictationEntry, Error>) -> Void) -> Void)?
    var onUpdateSettings: ((String, String, String, String, String, Bool, Bool) -> Void)?
    var onOpenPermission: ((String) -> Void)?
    var onRecheckPermissions: (() -> Void)?

    var selectedEntry: DictationEntry? {
        guard let selectedEntryID else { return nil }
        return entries.first(where: { $0.id == selectedEntryID })
    }

    var filteredEntries: [DictationEntry] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return entries }
        return entries.filter {
            $0.text.localizedCaseInsensitiveContains(query) ||
            $0.rawText.localizedCaseInsensitiveContains(query)
        }
    }

    var groupedEntries: [(title: String, items: [DictationEntry])] {
        var groups: [(title: String, items: [DictationEntry])] = []
        for entry in filteredEntries {
            let section = entry.daySectionTitle
            if let lastIndex = groups.indices.last, groups[lastIndex].title == section {
                groups[lastIndex].items.append(entry)
            } else {
                groups.append((title: section, items: [entry]))
            }
        }
        return groups
    }

    var totalWordsCount: Int {
        entries.reduce(0) { $0 + $1.wordCount }
    }

    func openSheet(for entry: DictationEntry) {
        selectedEntryID = entry.id
        syncInspectorControls(with: entry)
        isSheetPresented = true
    }

    func closeSheet() {
        isSheetPresented = false
        selectedEntryID = nil
    }

    func selectEntry(_ entry: DictationEntry?) {
        withAnimation(.spring(response: 0.25, dampingFraction: 0.86)) {
            if let entry {
                openSheet(for: entry)
            } else {
                closeSheet()
            }
        }
    }

    func openInspector(for entryID: String) {
        selectedSection = .transcripts
        if let entry = entries.first(where: { $0.id == entryID }) {
            openSheet(for: entry)
        } else {
            selectedEntryID = entryID
            isSheetPresented = true
        }
    }

    func syncInspectorControls(with entry: DictationEntry) {
        inspectorMode = entry.mode
        inspectorStyle = entry.style
        inspectorOutputMode = entry.outputMode
        inspectorTargetLanguage = entry.targetLanguage
        customInstruction = ""
        showComparisonDiff = false
        reformatError = nil
    }

    func triggerCopy(text: String, id: String, isRaw: Bool = false) {
        onCopyText?(text)
        if isRaw {
            copiedRawID = id
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                if self?.copiedRawID == id { self?.copiedRawID = nil }
            }
        } else {
            copiedEntryID = id
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                if self?.copiedEntryID == id { self?.copiedEntryID = nil }
            }
        }
    }

    func triggerReformat(useRawImmediately: Bool = false) {
        guard let entry = selectedEntry, !isReformatting else { return }
        let mode = useRawImmediately ? "raw" : inspectorMode
        let style = useRawImmediately ? "plain" : inspectorStyle
        let outputMode = useRawImmediately ? "spoken" : inspectorOutputMode
        let targetLang = inspectorTargetLanguage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "English"
            : inspectorTargetLanguage.trimmingCharacters(in: .whitespacesAndNewlines)
        let instruction = useRawImmediately ? nil : (customInstruction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : customInstruction.trimmingCharacters(in: .whitespacesAndNewlines))

        isReformatting = true
        reformatError = nil
        onReformatRequested?(entry.id, mode, style, outputMode, targetLang, instruction) { [weak self] result in
            guard let self else { return }
            self.isReformatting = false
            switch result {
            case .success(let updated):
                if let idx = self.entries.firstIndex(where: { $0.id == updated.id }) {
                    self.entries[idx] = updated
                }
                self.syncInspectorControls(with: updated)
            case .failure:
                self.reformatError = "Couldn't re-transform this dictation. Check your formatter settings and try again."
            }
        }
    }

    func pushSettings() {
        onUpdateSettings?(
            appMode,
            appStyle,
            appOutputMode,
            appTargetLanguage,
            appInputLanguage,
            appVerifyEnglish,
            saveHistory
        )
    }
}

struct AdaptiveScrollContainer<Content: View>: View {
    let isPreview: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        if isPreview {
            GeometryReader { geo in
                VStack(alignment: .leading, spacing: 0) {
                    content()
                }
                .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
                .clipped()
            }
        } else {
            ScrollView {
                content()
            }
        }
    }
}

struct AdaptiveTextField: View {
    let placeholder: String
    @Binding var text: String
    var isPreview: Bool = false
    var font: Font = .system(size: 11.5)
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        if isPreview {
            Text(text.isEmpty ? placeholder : text)
                .font(font)
                .foregroundStyle(text.isEmpty ? RippleTheme.Colors.textTertiary : RippleTheme.Colors.textPrimary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(font)
                .foregroundStyle(RippleTheme.Colors.textPrimary)
                .onSubmit {
                    onSubmit?()
                }
        }
    }
}

struct HubRootView: View {
    @ObservedObject var model: HubViewModel
    @State private var confirmingClearAll: Bool = false

    var body: some View {
        HStack(spacing: 0) {
            sidebar
            Rectangle()
                .fill(RippleTheme.Colors.dividerSeparator)
                .frame(width: 1)
            mainCanvas
        }
        .frame(minWidth: 560, minHeight: 460)
        .background(RippleTheme.Colors.surfaceCanvas)
        .sheet(isPresented: $model.isSheetPresented) {
            if let entry = model.selectedEntry {
                InspectorSheetView(entry: entry, model: model)
            }
        }
        .overlay {
            if model.isPreviewMode && model.isSheetPresented, let entry = model.selectedEntry {
                ZStack {
                    Color.black.opacity(0.40)
                    InspectorSheetView(entry: entry, model: model)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(RippleTheme.Colors.borderHairlineSubtle, lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.40), radius: 24, y: 10)
                }
            }
        }
    }

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Brand header
            HStack(spacing: 9) {
                ZStack {
                    Circle()
                        .fill(RippleTheme.Colors.accentPrimary.opacity(0.18))
                        .frame(width: 24, height: 24)
                    Circle()
                        .fill(RippleTheme.Colors.accentPrimary)
                        .frame(width: 7, height: 7)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("Ripple")
                        .font(RippleTheme.Typography.hubBrandTitle)
                        .tracking(-0.2)
                        .foregroundStyle(RippleTheme.Colors.textPrimary)
                    Text("Hold ⌃⌥ to speak")
                        .font(RippleTheme.Typography.shortcutChord)
                        .foregroundStyle(RippleTheme.Colors.textSecondary)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 38)
            .padding(.bottom, 20)

            // Navigation items
            VStack(spacing: 3) {
                ForEach(HubSection.allCases) { section in
                    let active = model.selectedSection == section
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            model.selectedSection = section
                        }
                    } label: {
                        HStack(spacing: 9) {
                            Image(systemName: section.icon)
                                .font(.system(size: 12, weight: active ? .semibold : .regular))
                                .frame(width: 16)
                                .foregroundStyle(active ? RippleTheme.Colors.textPrimary : RippleTheme.Colors.textSecondary)
                            Text(section.rawValue)
                                .font(RippleTheme.Typography.navItemLabel)
                                .foregroundStyle(active ? RippleTheme.Colors.textPrimary : RippleTheme.Colors.textSecondary)
                            Spacer()
                            if section == .system && (!model.hasInputMonitoring || !model.hasAccessibility || !model.hasMicrophone) {
                                Circle()
                                    .fill(RippleTheme.Colors.accentWarning)
                                    .frame(width: 6, height: 6)
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .fill(active ? RippleTheme.Colors.surfaceCardHover : Color.clear)
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)

            Spacer()

            // Quiet, borderless single-line status row at bottom of sidebar
            HStack(spacing: 6) {
                Circle()
                    .fill(RippleTheme.Colors.accentPrimary)
                    .frame(width: 6, height: 6)
                Text(activeProfileSummary)
                    .font(RippleTheme.Typography.metaCode)
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
                    .lineLimit(1)
                Spacer()
                Text("Ready")
                    .font(RippleTheme.Typography.metaCode)
                    .foregroundStyle(RippleTheme.Colors.textTertiary)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 14)
        }
        .frame(width: 180)
        .background(RippleTheme.Colors.surfaceSidebar)
    }

    private var activeProfileSummary: String {
        let modePart = model.appMode == "raw" ? "Raw" : model.appStyle.capitalized
        let langPart = model.appVerifyEnglish ? "EN Strict" : (model.appInputLanguage == "auto" ? "Auto" : model.appInputLanguage.uppercased())
        return "\(modePart) · \(langPart)"
    }

    @ViewBuilder
    private var mainCanvas: some View {
        switch model.selectedSection {
        case .transcripts:
            transcriptsWorkspace
        case .styleAndLanguage:
            styleAndLanguageView
        case .system:
            systemAndPermissionsView
        }
    }

    // MARK: - Page 1 (2-Pane Clean Focus Feed)

    private var transcriptsWorkspace: some View {
        VStack(spacing: 0) {
            transcriptsHeader
            Rectangle()
                .fill(RippleTheme.Colors.dividerSeparator)
                .frame(height: 1)
            if model.entries.isEmpty {
                emptyTranscriptsState
            } else if model.filteredEntries.isEmpty {
                noSearchMatchesState
            } else {
                transcriptsFeedList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .onExitCommand {
            if model.isSheetPresented {
                model.closeSheet()
            }
        }
    }

    private var transcriptsHeader: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Transcripts")
                    .font(RippleTheme.Typography.hubSectionHeader)
                    .tracking(-0.3)
                    .foregroundStyle(RippleTheme.Colors.textPrimary)
                    .lineLimit(1)
                if !model.entries.isEmpty {
                    Text("\(model.entries.count) saved · \(model.totalWordsCount) words")
                        .font(RippleTheme.Typography.feedTimestamp)
                        .monospacedDigit()
                        .foregroundStyle(RippleTheme.Colors.textSecondary)
                        .lineLimit(1)
                }
            }
            .fixedSize(horizontal: true, vertical: false)

            Spacer(minLength: 8)

            // Minimal search bar
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11.5))
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
                AdaptiveTextField(
                    placeholder: "Search transcripts…",
                    text: $model.searchQuery,
                    isPreview: model.isPreviewMode,
                    font: RippleTheme.Typography.navItemLabel
                )
                .frame(minWidth: 100, idealWidth: 140, maxWidth: 180)
                if !model.searchQuery.isEmpty {
                    Button {
                        model.searchQuery = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(RippleTheme.Colors.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(RippleTheme.Colors.surfaceSubCard)
            )

            Button {
                model.onRefreshRequested?()
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 12))
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
                    .frame(width: 26, height: 26)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Refresh transcripts")

            if !model.entries.isEmpty {
                Button {
                    confirmingClearAll = true
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .foregroundStyle(RippleTheme.Colors.textSecondary)
                        .frame(width: 26, height: 26)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help("Clear all history")
                .alert("Clear all dictation history?", isPresented: $confirmingClearAll) {
                    Button("Delete All", role: .destructive) {
                        model.onClearAll?()
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("This permanently deletes all saved transcripts from local storage.")
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 20)
        .padding(.bottom, 14)
    }

    private var emptyTranscriptsState: some View {
        VStack(spacing: 10) {
            Spacer()
            ZStack {
                Circle()
                    .fill(RippleTheme.Colors.surfaceCardHover)
                    .frame(width: 44, height: 44)
                Image(systemName: "waveform")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
            }
            Text("No dictations yet")
                .font(RippleTheme.Typography.hubCardTitle)
                .foregroundStyle(RippleTheme.Colors.textPrimary)
            Text("Hold Control + Option in any text field to speak.\nYour clean transcripts will appear here.")
                .font(RippleTheme.Typography.navItemLabel)
                .foregroundStyle(RippleTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var noSearchMatchesState: some View {
        VStack(spacing: 8) {
            Spacer()
            Text("No matching transcripts")
                .font(RippleTheme.Typography.hubCardTitle)
                .foregroundStyle(RippleTheme.Colors.textPrimary)
            Text("Try a different search term.")
                .font(RippleTheme.Typography.navItemLabel)
                .foregroundStyle(RippleTheme.Colors.textSecondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var transcriptsFeedList: some View {
        AdaptiveScrollContainer(isPreview: model.isPreviewMode) {
            LazyVStack(alignment: .leading, spacing: 18) {
                ForEach(model.groupedEntries, id: \.title) { group in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(group.title)
                            .font(RippleTheme.Typography.sectionLabel)
                            .foregroundStyle(RippleTheme.Colors.textTertiary)
                            .padding(.horizontal, 4)

                        LazyVStack(spacing: 6) {
                            ForEach(group.items) { entry in
                                TranscriptRowView(
                                    entry: entry,
                                    isSelected: model.selectedEntryID == entry.id,
                                    isCopied: model.copiedEntryID == entry.id,
                                    onSelect: {
                                        model.openSheet(for: entry)
                                    },
                                    onCopy: {
                                        model.triggerCopy(text: entry.text, id: entry.id)
                                    }
                                )
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
        }
    }

    // MARK: - Tab 2: Style & Language (Streamlined macOS Settings Form)

    private var styleAndLanguageView: some View {
        AdaptiveScrollContainer(isPreview: model.isPreviewMode) {
            VStack(alignment: .leading, spacing: 18) {
                // Header
                VStack(alignment: .leading, spacing: 3) {
                    Text("Style & Language")
                        .font(RippleTheme.Typography.hubSectionHeader)
                        .tracking(-0.3)
                        .foregroundStyle(RippleTheme.Colors.textPrimary)
                    Text("Configure default formatting, output script, and speech recognition.")
                        .font(RippleTheme.Typography.navItemLabel)
                        .foregroundStyle(RippleTheme.Colors.textSecondary)
                }

                // Section 1: Default Dictation Mode
                VStack(alignment: .leading, spacing: 8) {
                    Text("Default Dictation Mode")
                        .font(RippleTheme.Typography.sectionLabel)
                        .foregroundStyle(RippleTheme.Colors.textSecondary)

                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 2) {
                            let modes: [(title: String, mode: String, style: String)] = [
                                ("Raw", "raw", "plain"),
                                ("Plain", "polish", "plain"),
                                ("Email", "polish", "email"),
                                ("Code", "polish", "code")
                            ]
                            ForEach(modes, id: \.title) { item in
                                let isActive = (item.mode == "raw" && model.appMode == "raw") ||
                                               (item.mode == "polish" && model.appMode == "polish" && model.appStyle == item.style)
                                Button {
                                    model.appMode = item.mode
                                    model.appStyle = item.style
                                    model.pushSettings()
                                } label: {
                                    Text(item.title)
                                        .font(RippleTheme.Typography.buttonAction)
                                        .foregroundStyle(isActive ? RippleTheme.Colors.textPrimary : RippleTheme.Colors.textSecondary)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 7)
                                        .background(
                                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                                .fill(isActive ? RippleTheme.Colors.surfaceCardHover : Color.clear)
                                                .shadow(color: isActive ? Color.black.opacity(0.12) : Color.clear, radius: 1.5, y: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(3)
                        .background(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(RippleTheme.Colors.surfaceSubCard)
                        )

                        Text(dictationModeDescription)
                            .font(RippleTheme.Typography.navItemLabel)
                            .foregroundStyle(RippleTheme.Colors.textSecondary)
                            .padding(.horizontal, 4)
                    }
                }

                // Section 2: Script & Translation
                VStack(alignment: .leading, spacing: 8) {
                    Text("Script & Translation")
                        .font(RippleTheme.Typography.sectionLabel)
                        .foregroundStyle(RippleTheme.Colors.textSecondary)

                    VStack(spacing: 0) {
                        // Row 1: Output script
                        HStack {
                            Text("Output script")
                                .font(RippleTheme.Typography.hubCardTitle)
                                .foregroundStyle(RippleTheme.Colors.textPrimary)
                            Spacer()

                            if model.isPreviewMode {
                                HStack(spacing: 4) {
                                    Text(outputScriptPreviewLabel)
                                        .font(RippleTheme.Typography.chipLabel)
                                        .foregroundStyle(RippleTheme.Colors.accentPrimary)
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.system(size: 8, weight: .semibold))
                                        .foregroundStyle(RippleTheme.Colors.accentPrimary)
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(RippleTheme.Colors.surfaceSubCard)
                                )
                            } else {
                                Menu {
                                    Button("Spoken language (original script)") {
                                        model.appOutputMode = "spoken"
                                        model.pushSettings()
                                    }
                                    Button("Latin (Romanized) · e.g. Aap kaise ho?") {
                                        model.appOutputMode = "romanize"
                                        model.pushSettings()
                                    }
                                    Button("Translate to another language…") {
                                        model.appOutputMode = "translate"
                                        model.pushSettings()
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Text(outputScriptPreviewLabel)
                                            .font(RippleTheme.Typography.chipLabel)
                                            .foregroundStyle(RippleTheme.Colors.accentPrimary)
                                        Image(systemName: "chevron.up.chevron.down")
                                            .font(.system(size: 8, weight: .semibold))
                                            .foregroundStyle(RippleTheme.Colors.accentPrimary)
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .fill(RippleTheme.Colors.surfaceSubCard)
                                    )
                                }
                                .menuStyle(.borderlessButton)
                                .fixedSize()
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)

                        Rectangle()
                            .fill(RippleTheme.Colors.dividerSeparator)
                            .frame(height: 1)

                        // Row 2: Translate target
                        HStack {
                            Text("Translate target")
                                .font(RippleTheme.Typography.hubCardTitle)
                                .foregroundStyle(RippleTheme.Colors.textPrimary)
                            Spacer()

                            if model.appOutputMode == "translate" {
                                if model.isPreviewMode {
                                    Text(model.appTargetLanguage.isEmpty ? "English" : model.appTargetLanguage)
                                        .font(RippleTheme.Typography.chipLabel)
                                        .foregroundStyle(RippleTheme.Colors.textPrimary)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(
                                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                                .fill(RippleTheme.Colors.surfaceSubCard)
                                        )
                                } else {
                                    Menu {
                                        ForEach(["English", "Spanish", "French", "German", "Hindi", "Japanese", "Chinese"], id: \.self) { lang in
                                            Button(lang) {
                                                model.appTargetLanguage = lang
                                                model.pushSettings()
                                            }
                                        }
                                    } label: {
                                        HStack(spacing: 4) {
                                            Text(model.appTargetLanguage.isEmpty ? "English" : model.appTargetLanguage)
                                                .font(RippleTheme.Typography.chipLabel)
                                                .foregroundStyle(RippleTheme.Colors.textPrimary)
                                            Image(systemName: "chevron.up.chevron.down")
                                                .font(.system(size: 8, weight: .semibold))
                                                .foregroundStyle(RippleTheme.Colors.textSecondary)
                                        }
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(
                                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                                .fill(RippleTheme.Colors.surfaceSubCard)
                                        )
                                    }
                                    .menuStyle(.borderlessButton)
                                    .fixedSize()
                                }
                            } else {
                                Text("Off (keep spoken words)")
                                    .font(RippleTheme.Typography.chipLabel)
                                    .foregroundStyle(RippleTheme.Colors.textTertiary)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .fill(RippleTheme.Colors.surfaceSubCard.opacity(0.6))
                                    )
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(RippleTheme.Colors.surfaceCardBase)
                    )
                }

                // Section 3: Speech Recognition (Whisper)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Speech Recognition (Whisper)")
                        .font(RippleTheme.Typography.sectionLabel)
                        .foregroundStyle(RippleTheme.Colors.textSecondary)

                    VStack(spacing: 0) {
                        // Row 1: Spoken language
                        HStack {
                            Text("Spoken language")
                                .font(RippleTheme.Typography.hubCardTitle)
                                .foregroundStyle(RippleTheme.Colors.textPrimary)
                            Spacer()

                            if model.isPreviewMode {
                                HStack(spacing: 4) {
                                    Text(spokenLanguagePreviewLabel)
                                        .font(RippleTheme.Typography.chipLabel)
                                        .foregroundStyle(RippleTheme.Colors.textPrimary)
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.system(size: 8, weight: .semibold))
                                        .foregroundStyle(RippleTheme.Colors.textSecondary)
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(RippleTheme.Colors.surfaceSubCard)
                                )
                            } else {
                                Menu {
                                    Button("Auto-detect (multilingual)") {
                                        model.appInputLanguage = "auto"
                                        model.appVerifyEnglish = false
                                        model.pushSettings()
                                    }
                                    Button("English (en)") {
                                        model.appInputLanguage = "en"
                                        model.pushSettings()
                                    }
                                    Button("Hindi (hi)") {
                                        model.appInputLanguage = "hi"
                                        model.appVerifyEnglish = false
                                        model.pushSettings()
                                    }
                                    Divider()
                                    ForEach(inputLanguageChoices.filter { $0.code != "auto" && $0.code != "en" && $0.code != "hi" }, id: \.code) { choice in
                                        Button(choice.name) {
                                            model.appInputLanguage = choice.code
                                            model.appVerifyEnglish = false
                                            model.pushSettings()
                                        }
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Text(spokenLanguagePreviewLabel)
                                            .font(RippleTheme.Typography.chipLabel)
                                            .foregroundStyle(RippleTheme.Colors.textPrimary)
                                        Image(systemName: "chevron.up.chevron.down")
                                            .font(.system(size: 8, weight: .semibold))
                                            .foregroundStyle(RippleTheme.Colors.textSecondary)
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .fill(RippleTheme.Colors.surfaceSubCard)
                                    )
                                }
                                .menuStyle(.borderlessButton)
                                .fixedSize()
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)

                        Rectangle()
                            .fill(RippleTheme.Colors.dividerSeparator)
                            .frame(height: 1)

                        // Row 2: English-only guard
                        HStack(alignment: .center) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("English-only guard")
                                    .font(RippleTheme.Typography.hubCardTitle)
                                    .foregroundStyle(RippleTheme.Colors.textPrimary)
                                Text("Discard non-English audio before transcribing")
                                    .font(RippleTheme.Typography.navItemLabel)
                                    .foregroundStyle(RippleTheme.Colors.textTertiary)
                            }
                            Spacer()

                            Toggle("", isOn: Binding(
                                get: { model.appVerifyEnglish },
                                set: { newValue in
                                    model.appVerifyEnglish = newValue
                                    if newValue {
                                        model.appInputLanguage = "en"
                                    }
                                    model.pushSettings()
                                }
                            ))
                            .labelsHidden()
                            .toggleStyle(.switch)
                            .tint(RippleTheme.Colors.accentPrimary)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(RippleTheme.Colors.surfaceCardBase)
                    )
                }
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 18)
        }
    }

    private var dictationModeDescription: String {
        if model.appMode == "raw" {
            return "Exact Whisper transcript without any AI formatting or polishing."
        }
        switch model.appStyle {
        case "email":
            return "Structured paragraphs with greetings and sign-offs."
        case "code":
            return "Preserves technical identifiers, casing, and syntax."
        default:
            return "Cleans filler words and self-corrections naturally."
        }
    }

    private var outputScriptPreviewLabel: String {
        switch model.appOutputMode {
        case "romanize":
            return "Latin (Romanized) · e.g. Aap kaise ho?"
        case "translate":
            return "Translate to another language…"
        default:
            return "Spoken (Original script)"
        }
    }

    private var spokenLanguagePreviewLabel: String {
        if model.appVerifyEnglish {
            return "English only (verified)"
        }
        if model.appInputLanguage == "auto" {
            return "Auto-detect (multilingual)"
        }
        return inputLanguageChoices.first(where: { $0.code == model.appInputLanguage })?.name ?? model.appInputLanguage.uppercased()
    }

    // MARK: - Tab 3: System & Access

    private var systemAndPermissionsView: some View {
        AdaptiveScrollContainer(isPreview: model.isPreviewMode) {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("System & Access")
                            .font(RippleTheme.Typography.hubSectionHeader)
                            .tracking(-0.3)
                            .foregroundStyle(RippleTheme.Colors.textPrimary)
                        Text("macOS permissions required for global shortcut detection, audio capture, and pasting.")
                            .font(RippleTheme.Typography.navItemLabel)
                            .foregroundStyle(RippleTheme.Colors.textSecondary)
                    }
                    Spacer()
                    Button("Recheck Status") {
                        model.onRecheckPermissions?()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                VStack(spacing: 8) {
                    permissionRow(
                        title: "Input Monitoring",
                        detail: "Detects when you hold Control + Option to start recording",
                        granted: model.hasInputMonitoring,
                        section: "Privacy_ListenEvent"
                    )
                    permissionRow(
                        title: "Accessibility",
                        detail: "Reads selected text for transforms and pastes completed transcripts",
                        granted: model.hasAccessibility,
                        section: "Privacy_Accessibility"
                    )
                    permissionRow(
                        title: "Microphone",
                        detail: "Captures speech audio while the shortcut is held",
                        granted: model.hasMicrophone,
                        section: "Privacy_Microphone"
                    )
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Local storage & privacy")
                        .font(RippleTheme.Typography.sectionLabel)
                        .foregroundStyle(RippleTheme.Colors.textSecondary)

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Save dictation history locally")
                                .font(RippleTheme.Typography.hubCardTitle)
                                .foregroundStyle(RippleTheme.Colors.textPrimary)
                            Text("Stores raw and formatted text in owner-only data/dictations.sqlite. Audio is never stored.")
                                .font(RippleTheme.Typography.feedTimestamp)
                                .foregroundStyle(RippleTheme.Colors.textSecondary)
                        }
                        Spacer()
                        Toggle("", isOn: Binding(
                            get: { model.saveHistory },
                            set: { newValue in
                                model.saveHistory = newValue
                                model.pushSettings()
                            }
                        ))
                        .labelsHidden()
                        .toggleStyle(.switch)
                        .tint(RippleTheme.Colors.accentPrimary)
                    }
                    .padding(14)
                    .background(
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .fill(RippleTheme.Colors.surfaceCardBase)
                    )
                }
            }
            .padding(24)
        }
    }

    private func permissionRow(title: String, detail: String, granted: Bool, section: String) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(granted ? RippleTheme.Colors.accentSuccess : RippleTheme.Colors.accentWarning)
                .frame(width: 7.5, height: 7.5)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(RippleTheme.Typography.hubCardTitle)
                    .foregroundStyle(RippleTheme.Colors.textPrimary)
                Text(detail)
                    .font(RippleTheme.Typography.feedTimestamp)
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
            }
            Spacer()
            if granted {
                Text("Granted")
                    .font(RippleTheme.Typography.buttonAction)
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
            } else {
                Button("Open Settings ↗") {
                    model.onOpenPermission?(section)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(RippleTheme.Colors.surfaceCardBase)
        )
    }
}

// MARK: - Leaf-Isolated Transcript Row (Zero Parent Re-render)

struct TranscriptRowView: View {
    let entry: DictationEntry
    let isSelected: Bool
    let isCopied: Bool
    let onSelect: () -> Void
    let onCopy: () -> Void

    @State private var isHovered: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Text(entry.text.replacingOccurrences(of: "\n\n", with: "\n"))
                .font(RippleTheme.Typography.feedTranscript)
                .foregroundStyle(RippleTheme.Colors.textPrimary)
                .lineSpacing(3.5)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture {
                    onSelect()
                }

            ZStack(alignment: .trailing) {
                HStack(spacing: 4) {
                    if entry.status == "fallback" {
                        Circle()
                            .fill(RippleTheme.Colors.accentWarning)
                            .frame(width: 5.5, height: 5.5)
                            .help("Local formatter unavailable; raw text was used")
                    }
                    Text(entry.shortTimeLabel)
                        .font(RippleTheme.Typography.feedTimestamp)
                        .monospacedDigit()
                        .foregroundStyle(RippleTheme.Colors.textTertiary)
                }
                .opacity(isHovered || isSelected || isCopied ? 0 : 1)

                if isHovered || isSelected || isCopied {
                    Button {
                        onCopy()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 10, weight: .medium))
                            Text(isCopied ? "Copied" : "Copy")
                                .font(RippleTheme.Typography.buttonAction)
                        }
                        .foregroundStyle(isCopied ? RippleTheme.Colors.accentSuccess : RippleTheme.Colors.textPrimary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .fill(isCopied ? RippleTheme.Colors.accentSuccess.opacity(0.12) : RippleTheme.Colors.surfaceSubCard)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(width: 68, alignment: .trailing)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(
                    isSelected
                        ? RippleTheme.Colors.surfaceCardSelected
                        : (isHovered ? RippleTheme.Colors.surfaceCardHover : RippleTheme.Colors.surfaceCardBase)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(
                            isSelected ? RippleTheme.Colors.borderHairlineSelected : Color.clear,
                            lineWidth: 1
                        )
                )
        )
        .contentShape(Rectangle())
        .onHover { hovering in
            self.isHovered = hovering
        }
    }
}

// MARK: - Inspector Sheet (Centered On-Demand Modal)

struct InspectorSheetView: View {
    let entry: DictationEntry
    @ObservedObject var model: HubViewModel

    var body: some View {
        VStack(spacing: 0) {
            sheetHeader
            Rectangle()
                .fill(RippleTheme.Colors.dividerSeparator)
                .frame(height: 1)

            AdaptiveScrollContainer(isPreview: model.isPreviewMode) {
                VStack(alignment: .leading, spacing: 14) {
                    resultSection
                    retransformSection
                    spokenTranscriptSection
                    footerSection
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
        }
        .frame(width: 480, height: 530)
        .background(RippleTheme.Colors.surfaceCanvas)
    }

    private var sheetHeader: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Dictation Details")
                    .font(RippleTheme.Typography.hubCardTitle)
                    .foregroundStyle(RippleTheme.Colors.textPrimary)
                Text(entry.fullDateLabel)
                    .font(RippleTheme.Typography.feedTimestamp)
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
            }
            Spacer()
            Button {
                model.onDeleteEntry?(entry.id)
                model.closeSheet()
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 11.5))
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
                    .frame(width: 26, height: 26)
            }
            .buttonStyle(.plain)
            .help("Delete this dictation")

            Button {
                model.closeSheet()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
                    .frame(width: 26, height: 26)
            }
            .buttonStyle(.plain)
            .help("Close inspector (Esc)")
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    private var resultSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Result")
                    .font(RippleTheme.Typography.sectionLabel)
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
                Spacer()
                if entry.hasTransformDifference {
                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            model.showComparisonDiff.toggle()
                        }
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: model.showComparisonDiff ? "doc.plaintext" : "arrow.left.arrow.right")
                                .font(.system(size: 9))
                            Text(model.showComparisonDiff ? "Final Only" : "Compare Raw")
                                .font(RippleTheme.Typography.chipLabel)
                        }
                        .foregroundStyle(model.showComparisonDiff ? RippleTheme.Colors.accentPrimary : RippleTheme.Colors.textSecondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3.5)
                        .background(
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .fill(model.showComparisonDiff ? RippleTheme.Colors.accentPrimary.opacity(0.12) : RippleTheme.Colors.surfaceSubCard)
                        )
                    }
                    .buttonStyle(.plain)
                    .help(model.showComparisonDiff ? "Show final result only" : "Compare raw spoken text with transformed result")

                    Text("·").foregroundStyle(RippleTheme.Colors.textQuaternary)
                }

                let isCopied = model.copiedEntryID == entry.id
                Button {
                    model.triggerCopy(text: entry.text, id: entry.id)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 10))
                        Text(isCopied ? "Copied" : "Copy")
                            .font(RippleTheme.Typography.buttonAction)
                    }
                    .foregroundStyle(isCopied ? RippleTheme.Colors.accentSuccess : RippleTheme.Colors.textPrimary)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3.5)
                    .background(
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .fill(isCopied ? RippleTheme.Colors.accentSuccess.opacity(0.12) : RippleTheme.Colors.surfaceSubCard)
                    )
                }
                .buttonStyle(.plain)
            }

            if model.showComparisonDiff && entry.hasTransformDifference {
                VStack(alignment: .leading, spacing: 8) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Spoken Raw")
                            .font(RippleTheme.Typography.chipLabel)
                            .foregroundStyle(RippleTheme.Colors.textTertiary)
                        Text(entry.rawText)
                            .font(RippleTheme.Typography.spokenRawBody)
                            .foregroundStyle(RippleTheme.Colors.textSecondary)
                            .lineSpacing(2.5)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(RippleTheme.Colors.surfaceSubCard)
                            )
                    }

                    HStack {
                        Spacer()
                        Image(systemName: "arrow.down")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(RippleTheme.Colors.textTertiary)
                        Spacer()
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Final Result")
                            .font(RippleTheme.Typography.chipLabel)
                            .foregroundStyle(RippleTheme.Colors.accentPrimary)
                        Text(entry.text)
                            .font(RippleTheme.Typography.inspectorBody)
                            .foregroundStyle(RippleTheme.Colors.textPrimary)
                            .lineSpacing(2.8)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(RippleTheme.Colors.surfaceCardBase)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .strokeBorder(RippleTheme.Colors.borderHairlineSelected, lineWidth: 1)
                                    )
                            )
                    }
                }
            } else {
                Text(entry.text)
                    .font(RippleTheme.Typography.inspectorBody)
                    .foregroundStyle(RippleTheme.Colors.textPrimary)
                    .lineSpacing(2.8)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .fill(RippleTheme.Colors.surfaceCardBase)
                    )
            }
        }
    }

    private var retransformSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Re-transform")
                .font(RippleTheme.Typography.sectionLabel)
                .foregroundStyle(RippleTheme.Colors.textSecondary)

            VStack(alignment: .leading, spacing: 8) {
                // Row 1: Mode Track
                HStack(spacing: 2) {
                    let segments: [(title: String, mode: String, style: String)] = [
                        ("Plain", "polish", "plain"),
                        ("Email", "polish", "email"),
                        ("Code", "polish", "code"),
                        ("Raw", "raw", "plain")
                    ]
                    ForEach(segments, id: \.title) { segment in
                        let isActive = (segment.mode == "raw" && model.inspectorMode == "raw") ||
                                       (segment.mode == "polish" && model.inspectorMode == "polish" && model.inspectorStyle == segment.style)
                        Button {
                            model.inspectorMode = segment.mode
                            model.inspectorStyle = segment.style
                        } label: {
                            Text(segment.title)
                                .font(RippleTheme.Typography.chipLabel)
                                .foregroundStyle(isActive ? RippleTheme.Colors.textPrimary : RippleTheme.Colors.textSecondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                                .background(
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(isActive ? RippleTheme.Colors.surfaceCardBase : Color.clear)
                                        .shadow(color: isActive ? Color.black.opacity(0.12) : Color.clear, radius: 1.5, y: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(2)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(RippleTheme.Colors.surfaceSubCard)
                )

                // Row 2: Script Selector
                HStack {
                    Text("Script")
                        .font(RippleTheme.Typography.chipLabel)
                        .foregroundStyle(RippleTheme.Colors.textSecondary)
                    Spacer()

                    if model.isPreviewMode {
                        HStack(spacing: 4) {
                            let menuLabel: String = {
                                switch model.inspectorOutputMode {
                                case "romanize": return "Latin (Romanized)"
                                case "translate": return "Translate…"
                                default: return "Spoken (Original)"
                                }
                            }()
                            Text(menuLabel)
                                .font(RippleTheme.Typography.chipLabel)
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.system(size: 8, weight: .semibold))
                        }
                        .foregroundStyle(RippleTheme.Colors.textPrimary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(RippleTheme.Colors.surfaceCardBase)
                        )
                    } else {
                        Menu {
                            Button("Spoken (Original script)") {
                                model.inspectorOutputMode = "spoken"
                            }
                            Button("Latin (Romanized) · e.g. Aap kaise ho?") {
                                model.inspectorOutputMode = "romanize"
                            }
                            Button("Translate to another language…") {
                                model.inspectorOutputMode = "translate"
                            }
                        } label: {
                            HStack(spacing: 4) {
                                let menuLabel: String = {
                                    switch model.inspectorOutputMode {
                                    case "romanize": return "Latin (Romanized)"
                                    case "translate": return "Translate…"
                                    default: return "Spoken (Original)"
                                    }
                                }()
                                Text(menuLabel)
                                    .font(RippleTheme.Typography.chipLabel)
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.system(size: 8, weight: .semibold))
                            }
                            .foregroundStyle(RippleTheme.Colors.textPrimary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(RippleTheme.Colors.surfaceCardBase)
                            )
                        }
                        .menuStyle(.borderlessButton)
                        .fixedSize()
                    }
                }
                .padding(.horizontal, 4)

                // Row 3: Quick Refinement Chips
                HStack(spacing: 8) {
                    ForEach(["Shorter", "Formal", "Bullet Points"], id: \.self) { chip in
                        Button {
                            model.customInstruction = chip
                            model.triggerReformat()
                        } label: {
                            Text(chip)
                                .font(RippleTheme.Typography.chipLabel)
                                .foregroundStyle(RippleTheme.Colors.textSecondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 5)
                                .background(
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(RippleTheme.Colors.surfaceCardBase)
                                )
                        }
                        .buttonStyle(.plain)
                        .disabled(model.isReformatting)
                    }
                }

                // Row 4: Custom instruction input
                AdaptiveTextField(
                    placeholder: "Custom instruction...",
                    text: $model.customInstruction,
                    isPreview: model.isPreviewMode,
                    font: RippleTheme.Typography.chipLabel,
                    onSubmit: { model.triggerReformat() }
                )
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(RippleTheme.Colors.surfaceSubCard)
                )

                // Row 5: Apply Transform Button
                Button {
                    model.triggerReformat()
                } label: {
                    HStack(spacing: 6) {
                        if model.isReformatting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        Text(model.isReformatting ? "Transforming…" : "Apply Transform")
                            .font(RippleTheme.Typography.buttonAction)
                    }
                    .foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(RippleTheme.Colors.accentPrimary)
                    )
                }
                .buttonStyle(.plain)
                .disabled(model.isReformatting)
            }
        }
    }

    private var spokenTranscriptSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Spoken Transcript")
                    .font(RippleTheme.Typography.sectionLabel)
                    .foregroundStyle(RippleTheme.Colors.textSecondary)
                Spacer()
                let isCopiedRaw = model.copiedRawID == entry.id
                Button {
                    model.triggerCopy(text: entry.rawText, id: entry.id, isRaw: true)
                } label: {
                    HStack(spacing: 3) {
                        Image(systemName: isCopiedRaw ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 9.5))
                        Text(isCopiedRaw ? "Copied" : "Copy Raw")
                            .font(RippleTheme.Typography.chipLabel)
                    }
                    .foregroundStyle(isCopiedRaw ? RippleTheme.Colors.accentSuccess : RippleTheme.Colors.textSecondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .fill(isCopiedRaw ? RippleTheme.Colors.accentSuccess.opacity(0.12) : RippleTheme.Colors.surfaceSubCard)
                    )
                }
                .buttonStyle(.plain)
            }

            Text(entry.rawText)
                .font(RippleTheme.Typography.spokenRawBody)
                .foregroundStyle(RippleTheme.Colors.textSecondary)
                .lineSpacing(2.5)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(RippleTheme.Colors.surfaceSubCard)
                )
        }
    }

    private var footerSection: some View {
        HStack {
            Text("\(entry.statusDisplayLabel) · \(entry.outputDisplayLabel) · \(entry.wordCount) words")
                .font(RippleTheme.Typography.metaCode)
                .monospacedDigit()
                .foregroundStyle(RippleTheme.Colors.textTertiary)
            Spacer()
        }
        .padding(.top, 4)
    }
}

