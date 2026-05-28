// CaptureView — the multi-method capture surface.
//
// Apple Notes treats capture as "write a document." We treat it as
// "drop a memory" — text is one of several inputs, alongside URL
// paste, photo OCR, voice dictation, and (soon) file import.
// The mode picker just under the header surfaces those methods so
// the user doesn't have to guess; Write is the default.
//
// Header style stays consistent with MDs / Bundles / Settings /
// Start — large display "Capture" title at the top-left, optional
// char-count chip, and Cancel / Save controls on the right that
// only appear while there's content to save.

import SwiftUI
import UIKit

struct CaptureView: View {
    @EnvironmentObject private var router: AppRouter
    @State private var titleDraft = ""
    @State private var bodyDraft = ""
    @State private var saving = false
    @State private var savedURL: URL?
    @State private var errorMessage: String?
    @State private var clipboardURL: URL?
    @State private var showPhotoPicker = false
    @State private var showURLSheet = false
    @State private var showImportSheet = false
    @State private var ocrBanner: String? = nil
    enum CaptureField { case title, body }
    @FocusState private var focused: CaptureField?
    @State private var keyboardUp = false

    @AppStorage("mw.draft.title") private var persistedTitle: String = ""
    @AppStorage("mw.draft.body") private var persistedBody: String = ""
    @State private var restorableTitle: String? = nil
    @State private var restorableBody: String? = nil
    @State private var dictation = DictationController()
    @State private var isDictating = false

    private var combinedMarkdown: String {
        let t = titleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let b = bodyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty && !b.isEmpty { return "# \(t)\n\n\(b)" }
        if !t.isEmpty { return "# \(t)" }
        return b
    }
    private var hasDraftContent: Bool {
        !titleDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        !bodyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    private var canSave: Bool {
        !saving && savedURL == nil && hasDraftContent
    }
    private var hasRestorable: Bool {
        (restorableTitle?.isEmpty == false) || (restorableBody?.isEmpty == false)
    }
    private var charCount: Int { combinedMarkdown.count }

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            if !hasDraftContent && clipboardURL == nil && !hasRestorable && savedURL == nil {
                AmbientBlob()
            }
            VStack(spacing: 0) {
                header
                if !hasDraftContent && !keyboardUp {
                    modePicker
                        .transition(.opacity)
                }
                chipsArea
                titleField
                bodyField
                if isDictating {
                    DictationBanner { stopDictation() }
                        .padding(.horizontal, 14)
                        .padding(.bottom, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                if let ocrBanner {
                    OcrResultChip(message: ocrBanner) { self.ocrBanner = nil }
                        .padding(.horizontal, 14)
                        .padding(.bottom, 8)
                }
                if let errorMessage {
                    Text(errorMessage)
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.microRed)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 4)
                }
            }
        }
        .onAppear { onAppearEffects() }
        .onChange(of: focused) { _, isFocused in
            if isFocused != nil { refreshClipboard() }
        }
        .onChange(of: titleDraft) { _, new in persistedTitle = new }
        .onChange(of: bodyDraft) { _, new in persistedBody = new }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            withAnimation(.snappy(duration: 0.22)) { keyboardUp = true }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.snappy(duration: 0.22)) { keyboardUp = false }
        }
        .sheet(isPresented: $showPhotoPicker) {
            PhotoCaptureSheet(isPresented: $showPhotoPicker) { ocrText, _ in
                let clean = ocrText.trimmingCharacters(in: .whitespacesAndNewlines)
                if clean.isEmpty {
                    ocrBanner = "No text recognised in this image."
                } else {
                    if titleDraft.isEmpty {
                        titleDraft = "Photo capture · \(Date().formatted(date: .abbreviated, time: .shortened))"
                    }
                    bodyDraft = bodyDraft.isEmpty ? clean : "\(bodyDraft)\n\n\(clean)"
                    ocrBanner = "OCR extracted \(clean.count) characters."
                    Haptics.success()
                }
            }
            .presentationDetents([.medium])
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $showURLSheet) {
            URLImportSheet(isPresented: $showURLSheet) { url in
                Task { await saveURL(url) }
            }
            .presentationDetents([.medium])
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $showImportSheet) {
            ImportInfoSheet(isPresented: $showImportSheet)
                .presentationDetents([.medium])
                .preferredColorScheme(.dark)
        }
    }

    // MARK: - Header (tab-consistent)

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("Capture")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            if hasDraftContent {
                Text("\(charCount)")
                    .font(Brand.mono(size: 11))
                    .foregroundStyle(Brand.textFaint)
            }
            Spacer()
            if hasDraftContent || focused != nil {
                HStack(spacing: 8) {
                    Button {
                        Haptics.tap()
                        focused = nil
                        if hasDraftContent {
                            restorableTitle = titleDraft
                            restorableBody = bodyDraft
                        }
                        titleDraft = ""
                        bodyDraft = ""
                    } label: {
                        Text("Cancel")
                            .font(Brand.body(size: 13, weight: .medium))
                            .foregroundStyle(Brand.textMuted)
                    }
                    .buttonStyle(.plain)
                    Button {
                        Task { await saveDraft() }
                    } label: {
                        HStack(spacing: 5) {
                            if saving {
                                ProgressView().scaleEffect(0.55).tint(Brand.background)
                            } else {
                                Image(systemName: "arrow.up")
                                    .font(.system(size: 10, weight: .bold))
                            }
                            Text(saving ? "Saving" : "Save")
                                .font(Brand.body(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(canSave ? Brand.background : Brand.textFaint)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Capsule().fill(canSave ? Brand.textPrimary : Brand.surface))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSave)
                }
                .transition(.opacity)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
        .animation(.snappy(duration: 0.18), value: focused)
        .animation(.snappy(duration: 0.18), value: hasDraftContent)
    }

    // MARK: - Mode picker (capture methods)

    /// Row of capture-method pills shown when the editor is empty
    /// and the keyboard is down. Surfaces the non-write entry
    /// paths (URL paste, photo OCR, voice dictation, file import)
    /// so the user doesn't have to know the bottom action bar by
    /// heart — they're discoverable at the top of the surface.
    private var modePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ModePill(icon: "pencil", label: "Write", accent: Brand.microLime) {
                    Haptics.tap()
                    focused = .title
                }
                ModePill(icon: "link", label: "URL", accent: Brand.microInfo) {
                    Haptics.tap()
                    showURLSheet = true
                }
                ModePill(icon: "camera", label: "Photo", accent: Brand.microWarn) {
                    Haptics.tap()
                    showPhotoPicker = true
                }
                ModePill(icon: isDictating ? "mic.fill" : "mic",
                         label: isDictating ? "Stop" : "Voice",
                         accent: isDictating ? Brand.microRed : Brand.textPrimary) {
                    if isDictating { stopDictation() } else { startDictation() }
                }
                ModePill(icon: "tray.and.arrow.down", label: "Import", accent: Brand.textMuted) {
                    Haptics.tap()
                    showImportSheet = true
                }
            }
            .padding(.horizontal, 18)
        }
        .padding(.bottom, 10)
    }

    // MARK: - Smart chips

    @ViewBuilder
    private var chipsArea: some View {
        if hasRestorable && savedURL == nil {
            let preview = (restorableTitle?.isEmpty == false
                           ? restorableTitle!
                           : (restorableBody ?? ""))
            RestoreDraftChip(preview: preview) {
                titleDraft = restorableTitle ?? ""
                bodyDraft = restorableBody ?? ""
                restorableTitle = nil
                restorableBody = nil
            } onDismiss: {
                restorableTitle = nil
                restorableBody = nil
                persistedTitle = ""
                persistedBody = ""
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
        } else if let url = clipboardURL, savedURL == nil {
            ClipboardChip(url: url, busy: saving) {
                Task { await saveURL(url) }
            } onDismiss: { clipboardURL = nil }
            .padding(.horizontal, 14)
            .padding(.top, 6)
        } else if let url = savedURL {
            SavedBanner(url: url, onView: {
                Haptics.selection()
                openSavedDocInApp(url: url)
            }, onDismiss: {
                savedURL = nil
                titleDraft = ""
                bodyDraft = ""
            })
            .padding(.horizontal, 14)
            .padding(.top, 6)
        }
    }

    // MARK: - Title field

    private var titleField: some View {
        TextField("",
                  text: $titleDraft,
                  prompt: Text("What's on your mind?")
                    .foregroundStyle(Brand.textFaint)
                    .font(Brand.display(size: 26)))
            .focused($focused, equals: .title)
            .font(Brand.display(size: 26))
            .foregroundStyle(Brand.textPrimary)
            .tint(Brand.microWarn)
            .submitLabel(.next)
            .onSubmit { focused = .body }
            .padding(.horizontal, 18)
            .padding(.top, 4)
    }

    // MARK: - Body field

    private var bodyField: some View {
        ZStack(alignment: .topLeading) {
            if bodyDraft.isEmpty {
                Text("Add more details…")
                    .font(Brand.body(size: 16))
                    .foregroundStyle(Brand.textFaint)
                    .padding(.horizontal, 22)
                    .padding(.top, 16)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $bodyDraft)
                .focused($focused, equals: .body)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, 14)
                .padding(.top, 8)
                .font(Brand.body(size: 16))
                .foregroundStyle(Brand.textPrimary)
                .tint(Brand.microWarn)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if focused != nil && keyboardUp {
                        markdownToolbar
                    }
                }
        }
    }

    /// Notes-style horizontal scrolling toolbar. Lives via
    /// safeAreaInset on the body field so it sits cleanly above
    /// the keyboard with no clipping at the edges + an 8pt gap
    /// from the keyboard line.
    private var markdownToolbar: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    mdButton("number") { insertBody("\n# ") }
                    mdButton("bold") { wrap("**") }
                    mdButton("italic") { wrap("*") }
                    mdButton("list.bullet") { insertBody("\n- ") }
                    mdButton("list.number") { insertBody("\n1. ") }
                    mdButton("checkmark.square") { insertBody("\n- [ ] ") }
                    mdButton("chevron.left.forwardslash.chevron.right") { insertBody("\n```\n\n```\n") }
                    mdButton("link") { insertBody("[text](https://)") }
                    mdButton("quote.bubble") { insertBody("\n> ") }
                    mdButton("minus") { insertBody("\n\n---\n\n") }
                    Spacer(minLength: 12)
                    mdButton(isDictating ? "mic.fill" : "mic",
                             tint: isDictating ? Brand.microRed : Brand.textPrimary) {
                        if isDictating { stopDictation() } else { startDictation() }
                    }
                    mdButton("keyboard.chevron.compact.down", tint: Brand.textMuted) {
                        focused = nil
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
            .background(
                Brand.surface
                    .overlay(alignment: .top) {
                        Rectangle().fill(Brand.borderDim).frame(height: 0.5)
                    }
            )
            // 8pt cushion between toolbar and keyboard line.
            Color.clear.frame(height: 8).background(Brand.background)
        }
    }

    @ViewBuilder
    private func mdButton(_ systemName: String,
                          tint: Color = Brand.textPrimary,
                          action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selection()
            action()
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(tint)
                .frame(width: 38, height: 32)
        }
    }

    private func insertBody(_ scaffold: String) {
        if focused == .title { focused = .body }
        bodyDraft += scaffold
    }
    private func wrap(_ token: String) {
        if focused == .title {
            titleDraft += "\(token)\(token)"
        } else {
            bodyDraft += "\(token)\(token)"
        }
    }

    // MARK: - Lifecycle / save

    private func refreshClipboard() {
        let pb = UIPasteboard.general
        guard pb.hasURLs, let url = pb.url else { clipboardURL = nil; return }
        if savedURL?.absoluteString == url.absoluteString {
            clipboardURL = nil
        } else {
            clipboardURL = url
        }
    }

    private func onAppearEffects() {
        let prefillKey = "mw.intent.captureText"
        if let prefill = UserDefaults.standard.string(forKey: prefillKey), !prefill.isEmpty {
            bodyDraft = prefill
            UserDefaults.standard.removeObject(forKey: prefillKey)
        }
        if (!persistedTitle.isEmpty || !persistedBody.isEmpty)
            && !hasDraftContent {
            restorableTitle = persistedTitle.isEmpty ? nil : persistedTitle
            restorableBody = persistedBody.isEmpty ? nil : persistedBody
        }
        refreshClipboard()
    }

    private func saveDraft() async {
        let md = combinedMarkdown.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !md.isEmpty else { return }
        let titleHint = titleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        await run {
            let doc = try await APIClient.shared.createDocument(
                markdown: md,
                title: titleHint.isEmpty ? nil : titleHint
            )
            savedURL = doc.publicURL
            titleDraft = ""
            bodyDraft = ""
            persistedTitle = ""
            persistedBody = ""
            restorableTitle = nil
            restorableBody = nil
            focused = nil
            Haptics.success()
        }
    }

    private func saveURL(_ url: URL) async {
        let host = url.host ?? "Link"
        let body = "Source: \(url.absoluteString)\n"
        await run {
            let doc = try await APIClient.shared.createDocument(
                markdown: "# \(host)\n\n\(body)",
                title: host
            )
            savedURL = doc.publicURL
            clipboardURL = nil
            Haptics.success()
        }
    }

    private func run(_ action: @escaping () async throws -> Void) async {
        saving = true
        errorMessage = nil
        defer { saving = false }
        do { try await action() }
        catch { errorMessage = error.localizedDescription }
    }

    /// Open the saved doc inside the app — pushes DocumentDetailView
    /// onto the MDs tab's nav stack and switches tabs. Beats the
    /// previous "open in Safari" behaviour which dropped users out
    /// of the app right after saving.
    private func openSavedDocInApp(url: URL) {
        let id = url.lastPathComponent
        router.selectedTab = .timeline
        router.timelinePath = [.docDetailById(id)]
        // Clear the SavedBanner so coming back to Capture is a
        // fresh canvas.
        savedURL = nil
    }

    private func startDictation() {
        Haptics.tap()
        focused = nil
        dictation.start(locales: ["ko-KR", "en-US"]) { recognised in
            bodyDraft += bodyDraft.isEmpty ? recognised : " " + recognised
        } onError: { msg in
            errorMessage = msg
            withAnimation(.snappy) { isDictating = false }
        } onStop: {
            withAnimation(.snappy) { isDictating = false }
        }
        withAnimation(.snappy) { isDictating = true }
    }

    private func stopDictation() {
        Haptics.tap()
        dictation.stop()
        withAnimation(.snappy) { isDictating = false }
    }
}

// MARK: - Pieces

struct AmbientBlob: View {
    var body: some View {
        GeometryReader { proxy in
            let dim = max(proxy.size.width, proxy.size.height) * 0.95
            AnimatedBlob(size: dim, theme: .dark)
                .opacity(0.045)
                .blur(radius: 12)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .center)
        }
        .ignoresSafeArea(.all)
        .allowsHitTesting(false)
    }
}

/// Capture-mode pill — icon + label on a quiet glass surface, with
/// the icon tinted in the relevant micro-color so the row reads
/// at a glance.
private struct ModePill: View {
    let icon: String
    let label: LocalizedStringKey
    let accent: Color
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(accent)
                Text(label)
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(Brand.surface)
                    .overlay(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }
}

/// URL paste sheet — explicit URL entry for the "Save a link" path.
/// Validates input, derives a host title.
private struct URLImportSheet: View {
    @Binding var isPresented: Bool
    var onSubmit: (URL) -> Void
    @State private var input = ""
    @FocusState private var fieldFocus: Bool
    private var parsedURL: URL? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let withScheme = trimmed.lowercased().hasPrefix("http") ? trimmed : "https://\(trimmed)"
        return URL(string: withScheme)
    }
    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 14) {
                    Text("Paste a URL")
                        .font(Brand.display(size: 22))
                        .foregroundStyle(Brand.textPrimary)
                    Text("We'll save the URL as a new memory. On Memory.Wiki the page is auto-fetched and indexed.")
                        .font(Brand.body(size: 13))
                        .foregroundStyle(Brand.textMuted)
                        .lineSpacing(3)
                    TextField("https://…", text: $input)
                        .focused($fieldFocus)
                        .font(Brand.mono(size: 14))
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 14).padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Brand.surface)
                                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                        )
                        .submitLabel(.go)
                        .onSubmit {
                            if let url = parsedURL { onSubmit(url); isPresented = false }
                        }
                    Button {
                        if let url = parsedURL { onSubmit(url); isPresented = false }
                    } label: {
                        Text("Save link")
                            .font(Brand.body(size: 15, weight: .semibold))
                            .foregroundStyle(parsedURL == nil ? Brand.textFaint : Brand.background)
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(parsedURL == nil ? Brand.surface : Brand.textPrimary)
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(parsedURL == nil)
                    Spacer()
                }
                .padding(.horizontal, 22)
                .padding(.top, 22)
            }
            .navigationTitle("URL")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { isPresented = false }
                        .foregroundStyle(Brand.textMuted)
                }
            }
            .toolbarBackground(Brand.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .onAppear { fieldFocus = true }
    }
}

/// Import info sheet — file import isn't shipped yet, but the entry
/// point is here so users see the roadmap. Surfaces the working
/// channels (Share Extension, web upload).
private struct ImportInfoSheet: View {
    @Binding var isPresented: Bool
    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 16) {
                    Text("Import")
                        .font(Brand.display(size: 22))
                        .foregroundStyle(Brand.textPrimary)
                    Text("Bring existing content into your hub.")
                        .font(Brand.body(size: 13))
                        .foregroundStyle(Brand.textMuted)
                    ImportRow(icon: "square.and.arrow.up",
                              title: "iOS Share Sheet",
                              detail: "From Safari, Notes, Mail, anywhere — tap Share → Memory.Wiki. Works today.")
                    ImportRow(icon: "globe",
                              title: "Web upload (memory.wiki)",
                              detail: "Drag PDF / Markdown / DOCX / TXT into the editor on memory.wiki. iOS file import coming soon.")
                    ImportRow(icon: "doc.text",
                              title: "VS Code / Desktop / CLI / MCP",
                              detail: "Capture from your editor or terminal — they all land in the same hub.")
                    Spacer()
                }
                .padding(.horizontal, 22)
                .padding(.top, 22)
            }
            .navigationTitle("Import")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { isPresented = false }
                        .foregroundStyle(Brand.textMuted)
                }
            }
            .toolbarBackground(Brand.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }
}

private struct ImportRow: View {
    let icon: String
    let title: String
    /// Renamed from `body` to avoid colliding with the View
    /// protocol's required `body` property.
    let detail: String
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Brand.textMuted)
                .frame(width: 24, alignment: .leading)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(Brand.body(size: 14, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                Text(detail)
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textMuted)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

// MARK: - Chips

private struct RestoreDraftChip: View {
    let preview: String
    var onRestore: () -> Void
    var onDismiss: () -> Void
    private var oneLine: String {
        preview.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
    }
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "tray.and.arrow.up")
                .font(.system(size: 12)).foregroundStyle(Brand.textFaint)
            VStack(alignment: .leading, spacing: 1) {
                Text("UNSAVED DRAFT")
                    .font(Brand.mono(size: 8, weight: .medium)).tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Text(oneLine)
                    .font(Brand.body(size: 12)).foregroundStyle(Brand.textPrimary)
                    .lineLimit(1).truncationMode(.tail)
            }
            Spacer(minLength: 8)
            Button(action: { Haptics.tap(); onRestore() }) {
                Text("Restore")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().fill(Brand.textPrimary))
            }
            .buttonStyle(.plain)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

private struct DictationBanner: View {
    var onStop: () -> Void
    @State private var pulse = false
    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Brand.microRed)
                .frame(width: 8, height: 8)
                .opacity(pulse ? 1 : 0.3)
                .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
                .onAppear { pulse = true }
            Text("LISTENING")
                .font(Brand.mono(size: 9, weight: .medium)).tracking(1)
                .foregroundStyle(Brand.textMuted)
            Text("Korean + English")
                .font(Brand.body(size: 11)).foregroundStyle(Brand.textFaint)
            Spacer()
            Button(action: onStop) {
                Text("Stop")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

private struct OcrResultChip: View {
    let message: String
    var onDismiss: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "text.viewfinder")
                .font(.system(size: 12))
                .foregroundStyle(Brand.microInfo)
            Text(message)
                .font(Brand.body(size: 12))
                .foregroundStyle(Brand.textPrimary)
            Spacer()
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

private struct ClipboardChip: View {
    let url: URL
    let busy: Bool
    var onSave: () -> Void
    var onDismiss: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "doc.on.clipboard")
                .font(.system(size: 12)).foregroundStyle(Brand.textFaint)
            VStack(alignment: .leading, spacing: 1) {
                Text("FROM CLIPBOARD")
                    .font(Brand.mono(size: 8, weight: .medium)).tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Text(url.absoluteString)
                    .font(Brand.mono(size: 11)).foregroundStyle(Brand.textPrimary)
                    .lineLimit(1).truncationMode(.middle)
            }
            Spacer(minLength: 8)
            Button(action: onSave) {
                Text(busy ? "Saving…" : "Save")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().fill(Brand.textPrimary))
            }
            .buttonStyle(.plain)
            .disabled(busy)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

/// Saved banner — confirmation card after a successful save. View
/// pushes the doc inside the app (MDs tab → DocumentDetailView)
/// instead of bouncing out to Safari.
private struct SavedBanner: View {
    let url: URL
    var onView: () -> Void
    var onDismiss: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.microLime)
            Text(url.absoluteString.replacingOccurrences(of: "https://", with: ""))
                .font(Brand.mono(size: 11)).foregroundStyle(Brand.textPrimary)
                .lineLimit(1).truncationMode(.middle)
            Spacer()
            Button(action: onView) {
                Text("View")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().fill(Brand.textPrimary))
            }
            .buttonStyle(.plain)
            ShareLink(item: url) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 12)).foregroundStyle(Brand.textFaint)
            }
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

#Preview { CaptureView() }
