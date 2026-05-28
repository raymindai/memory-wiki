// CaptureView — focused capture surface, vanilla-SwiftUI rebuild.
//
// Rebuild notes: the previous UIViewRepresentable wrapper was
// reliable on paper but the user could not get the cursor to
// engage on device + the markdown bar floated below the tab bar.
// This version uses a plain SwiftUI TextEditor — which is the
// canonical iOS native input — and pairs it with the standard
// .toolbar(.keyboard) markdown row. The tab bar already has
// .ignoresSafeArea(.keyboard) (from a prior fix in RootView)
// so the toolbar lands above the keyboard, not below the tab
// bar.
//
// Capture is the most important surface; the layout is now
// title-feeling, like Apple Notes: large display "Capture",
// big body editor with a prompt placeholder, photo / voice
// chips on the left of the sticky bottom bar, primary Save
// pill on the right.

import SwiftUI
import UIKit

struct CaptureView: View {
    @EnvironmentObject private var router: AppRouter
    // Two-field layout (Apple Notes pattern): title at the top
    // styled H1, body below styled P. Combined on save as
    // `# <title>\n\n<body>` so the server's title-extractor
    // picks the first line just like every other channel.
    @State private var titleDraft = ""
    @State private var bodyDraft = ""
    @State private var saving = false
    @State private var savedURL: URL?
    @State private var errorMessage: String?
    @State private var clipboardURL: URL?
    @State private var showPhotoPicker = false
    @State private var ocrBanner: String? = nil
    /// Three focus targets so we can drive cursor placement
    /// explicitly + know which field is active for the
    /// keyboard-up state machine.
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

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            if !hasDraftContent && clipboardURL == nil && !hasRestorable && savedURL == nil {
                AmbientBlob()
            }
            VStack(spacing: 0) {
                header
                chipsArea
                titleField
                // No divider — Notes lets typography do the
                // work. Title bold/large, body regular/smaller
                // is enough hierarchy.
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
                if !keyboardUp {
                    bottomBar
                        .transition(.move(edge: .bottom).combined(with: .opacity))
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
    }

    // MARK: - Header — Apple Notes pattern (floating circle buttons)

    /// Floating circle buttons mirroring Apple Notes' compose
    /// chrome: small ellipsis on the left, share + yellow Done
    /// (microWarn check) on the right when content exists or
    /// focus is live. Header is minimal otherwise — Notes lets
    /// the canvas dominate, and so should we.
    private var header: some View {
        HStack(spacing: 8) {
            // Left: minimal char count chip when there's content.
            if hasDraftContent {
                Text("\(combinedMarkdown.count)")
                    .font(Brand.mono(size: 10, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
            }
            Spacer()
            if hasDraftContent || focused != nil {
                // Cancel — small glass circle with an X. Stashes
                // current text into restorable in case it was a
                // mistap, then clears the fields.
                CircleHeaderButton(systemName: "xmark", tint: Brand.textMuted) {
                    Haptics.tap()
                    focused = nil
                    if hasDraftContent {
                        restorableTitle = titleDraft
                        restorableBody = bodyDraft
                    }
                    titleDraft = ""
                    bodyDraft = ""
                }
                // Done — yellow filled circle with a check. The
                // signature Apple Notes affordance, micro-warn
                // tinted to match the brand's star vocabulary.
                Button {
                    Task { await saveDraft() }
                } label: {
                    Image(systemName: saving ? "ellipsis" : "checkmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(canSave ? Brand.background : Brand.textFaint)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(canSave ? Brand.microWarn : Brand.surface))
                        .overlay(Circle().strokeBorder(canSave ? .clear : Brand.borderDim, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(!canSave)
                .transition(.opacity)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 4)
        .animation(.snappy(duration: 0.18), value: focused)
        .animation(.snappy(duration: 0.18), value: hasDraftContent)
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
            SavedBanner(url: url) {
                savedURL = nil
                titleDraft = ""
                bodyDraft = ""
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
        }
    }

    // MARK: - Title field (H1)

    /// Bold display TextField — Notes-style title at the top of
    /// the canvas. Placeholder is the brand prompt.
    private var titleField: some View {
        TextField("",
                  text: $titleDraft,
                  prompt: Text("What's on your mind?")
                    .foregroundStyle(Brand.textFaint)
                    .font(Brand.display(size: 28)))
            .focused($focused, equals: .title)
            .font(Brand.display(size: 28))
            .foregroundStyle(Brand.textPrimary)
            .tint(Brand.microWarn)
            .submitLabel(.next)
            .onSubmit { focused = .body }
            .padding(.horizontal, 18)
            .padding(.top, 4)
    }

    // MARK: - Body field (P)

    /// Normal body-sized TextEditor below the title. Markdown
    /// keyboard accessory attaches here.
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
                .toolbar {
                    if focused != nil {
                        ToolbarItemGroup(placement: .keyboard) {
                            mdButton("number") { insertBody("\n# ") }
                            mdButton("bold") { wrap("**") }
                            mdButton("italic") { wrap("*") }
                            mdButton("list.bullet") { insertBody("\n- ") }
                            mdButton("list.number") { insertBody("\n1. ") }
                            mdButton("chevron.left.forwardslash.chevron.right") { insertBody("\n```\n\n```\n") }
                            mdButton("link") { insertBody("[text](https://)") }
                            Spacer()
                            mdButton(isDictating ? "mic.fill" : "mic",
                                     tint: isDictating ? Brand.microRed : Brand.textPrimary) {
                                if isDictating { stopDictation() } else { startDictation() }
                            }
                            mdButton("keyboard.chevron.compact.down", tint: Brand.textMuted) {
                                focused = nil
                            }
                        }
                    }
                }
        }
    }

    // MARK: - Toolbar helpers

    @ViewBuilder
    private func mdButton(_ systemName: String,
                          tint: Color = Brand.textPrimary,
                          action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selection()
            action()
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(tint)
                .frame(minWidth: 32)
        }
    }

    /// Markdown scaffolds always insert into the body. If user
    /// is in the title, move focus first.
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

    // MARK: - Bottom bar

    private var bottomBar: some View {
        HStack(spacing: 12) {
            BottomChip(systemImage: "camera", label: "Photo") {
                Haptics.tap()
                showPhotoPicker = true
            }
            BottomChip(systemImage: isDictating ? "mic.fill" : "mic",
                       label: isDictating ? "Stop" : "Voice",
                       accent: isDictating ? Brand.microRed : nil) {
                if isDictating { stopDictation() } else { startDictation() }
            }
            Spacer()
            Button {
                Task { await saveDraft() }
            } label: {
                HStack(spacing: 6) {
                    if saving {
                        ProgressView().scaleEffect(0.6).tint(Brand.background)
                    } else {
                        Image(systemName: "arrow.up").font(.system(size: 11, weight: .semibold))
                    }
                    Text(saving ? "Saving…" : "Save")
                        .font(Brand.body(size: 14, weight: .semibold))
                }
                .foregroundStyle(canSave ? Brand.background : Brand.textMuted)
                .padding(.horizontal, 16).padding(.vertical, 11)
                .background(
                    Capsule()
                        .fill(canSave ? Brand.textPrimary : Brand.surface)
                        .overlay(Capsule().strokeBorder(canSave ? .clear : Brand.borderDim, lineWidth: 1))
                )
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            Brand.background
                .overlay(alignment: .top) {
                    Rectangle().fill(Brand.borderDim).frame(height: 0.5)
                }
        )
        // No extra .padding(.bottom, 56) — RootView already
        // reserves that space for the custom tab bar, so adding
        // it here doubled the gap and pushed the bar visibly
        // above the tab strip (the dead-space bug).
    }

    // MARK: - Clipboard / lifecycle / save / dictation

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

    private func startDictation() {
        Haptics.tap()
        focused = nil // make room visually for the LISTENING banner
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

private struct EmptyHintRow: View {
    let icon: String
    let label: LocalizedStringKey
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .regular))
            Text(label)
                .font(Brand.body(size: 12))
        }
        .foregroundStyle(Brand.textFaint)
    }
}

/// Notes-style circular header button — glass surface, small,
/// quiet ink glyph. Used for Cancel.
private struct CircleHeaderButton: View {
    let systemName: String
    let tint: Color
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            Image(systemName: systemName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(
                    Circle()
                        .fill(.ultraThinMaterial)
                        .overlay(Circle().strokeBorder(Brand.borderDim, lineWidth: 1))
                )
        }
        .buttonStyle(.plain)
    }
}

private struct BottomChip: View {
    let systemImage: String
    let label: LocalizedStringKey
    var accent: Color? = nil
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .regular))
                Text(label)
                    .font(Brand.body(size: 13, weight: .medium))
            }
            .foregroundStyle(accent ?? Brand.textPrimary)
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(
                Capsule()
                    .fill(Brand.surface)
                    .overlay(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }
}

/// Banner that surfaces what the OCR extracted (or didn't).
/// Same vocabulary as the other capture chips.
private struct OcrResultChip: View {
    let message: String
    var onDismiss: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "text.viewfinder")
                .font(.system(size: 12))
                .foregroundStyle(Brand.textFaint)
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

// MARK: - Restore draft chip

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

// MARK: - Dictation banner

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

// MARK: - Clipboard chip

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

// MARK: - Saved banner

private struct SavedBanner: View {
    let url: URL
    var onDismiss: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.textPrimary)
            Text(url.absoluteString.replacingOccurrences(of: "https://", with: ""))
                .font(Brand.mono(size: 11)).foregroundStyle(Brand.textPrimary)
                .lineLimit(1).truncationMode(.middle)
            Spacer()
            Link(destination: url) {
                Text("View")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Capsule().fill(Brand.textPrimary))
            }
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
