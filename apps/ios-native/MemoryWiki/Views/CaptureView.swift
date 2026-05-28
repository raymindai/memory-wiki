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
    @State private var draft = ""
    @State private var saving = false
    @State private var savedURL: URL?
    @State private var errorMessage: String?
    @State private var clipboardURL: URL?
    @State private var showPhotoPicker = false
    @State private var ocrBanner: String? = nil
    @FocusState private var focused: Bool
    @State private var keyboardUp = false

    @AppStorage("mw.draft.body") private var persistedDraft: String = ""
    @State private var restorable: String? = nil
    @State private var dictation = DictationController()
    @State private var isDictating = false

    private var canSave: Bool {
        !saving && savedURL == nil && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            if draft.isEmpty && clipboardURL == nil && restorable == nil && savedURL == nil {
                AmbientBlob()
            }
            VStack(spacing: 0) {
                header
                chipsArea
                editor
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
            if !keyboardUp {
                VStack { Spacer(); bottomBar }
            }
        }
        .onAppear { onAppearEffects() }
        .onChange(of: focused) { _, isFocused in
            if isFocused { refreshClipboard() }
        }
        .onChange(of: draft) { _, new in persistedDraft = new }
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
                    let title = "Photo capture · \(Date().formatted(date: .abbreviated, time: .shortened))"
                    draft = "# \(title)\n\n\(clean)"
                    ocrBanner = "OCR extracted \(clean.count) characters."
                    Haptics.success()
                }
            }
            .presentationDetents([.medium])
            .preferredColorScheme(.dark)
        }
    }

    // MARK: - Header (tab-consistent — large "Capture" display title)

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("Capture")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            if !draft.isEmpty {
                Text("\(draft.count)")
                    .font(Brand.mono(size: 11))
                    .foregroundStyle(Brand.textFaint)
            }
            Spacer()
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    // MARK: - Smart chips

    @ViewBuilder
    private var chipsArea: some View {
        if let saved = restorable, !saved.isEmpty, savedURL == nil {
            RestoreDraftChip(preview: saved) {
                draft = saved
                restorable = nil
            } onDismiss: {
                restorable = nil
                persistedDraft = ""
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
                draft = ""
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
        }
    }

    // MARK: - Editor

    /// Vanilla SwiftUI TextEditor — the path of least resistance
    /// for getting cursor + keyboard + selection to actually
    /// behave. Markdown toolbar lives in .toolbar(.keyboard) so
    /// iOS slides it in with the keyboard.
    private var editor: some View {
        ZStack(alignment: .topLeading) {
            if draft.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("What's on your mind?")
                        .font(Brand.display(size: 26))
                        .foregroundStyle(Brand.textMuted)
                        .padding(.bottom, 2)
                    HStack(spacing: 14) {
                        EmptyHintRow(icon: "doc.on.clipboard", label: "Paste a URL")
                        EmptyHintRow(icon: "mic", label: "Tap mic to dictate")
                        EmptyHintRow(icon: "camera", label: "Photo OCR")
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .allowsHitTesting(false)
            }
            TextEditor(text: $draft)
                .focused($focused)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .font(Brand.body(size: 16))
                .foregroundStyle(Brand.textPrimary)
                .tint(Brand.textPrimary)
                .toolbar {
                    if focused {
                        ToolbarItemGroup(placement: .keyboard) {
                            mdButton("number") { insert("\n# ") }
                            mdButton("bold") { wrap("**") }
                            mdButton("italic") { wrap("*") }
                            mdButton("list.bullet") { insert("\n- ") }
                            mdButton("list.number") { insert("\n1. ") }
                            mdButton("chevron.left.forwardslash.chevron.right") { insert("\n```\n\n```\n") }
                            mdButton("link") { insert("[text](https://)") }
                            Spacer()
                            mdButton(isDictating ? "mic.fill" : "mic",
                                     tint: isDictating ? Brand.microRed : Brand.textPrimary) {
                                if isDictating { stopDictation() } else { startDictation() }
                            }
                            mdButton("keyboard.chevron.compact.down", tint: Brand.textMuted) {
                                focused = false
                            }
                        }
                    }
                }
        }
    }

    /// Toolbar button factory — reused for every markdown
    /// scaffold + the dictation toggle + the dismiss-keyboard.
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

    private func insert(_ scaffold: String) {
        draft += scaffold
    }
    private func wrap(_ token: String) {
        draft += "\(token)\(token)"
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
        .padding(.bottom, 56) // above the custom tab bar
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
            draft = prefill
            UserDefaults.standard.removeObject(forKey: prefillKey)
        }
        if !persistedDraft.isEmpty && draft.isEmpty {
            restorable = persistedDraft
        }
        refreshClipboard()
    }

    private func saveDraft() async {
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        await run {
            let doc = try await APIClient.shared.createDocument(markdown: body)
            savedURL = doc.publicURL
            draft = ""
            persistedDraft = ""
            restorable = nil
            Haptics.success()
        }
    }

    private func saveURL(_ url: URL) async {
        let host = url.host ?? "Link"
        let body = "# \(host)\n\nSource: \(url.absoluteString)\n"
        await run {
            let doc = try await APIClient.shared.createDocument(markdown: body, title: host)
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
        focused = false // make room visually for the LISTENING banner
        dictation.start(locales: ["ko-KR", "en-US"]) { recognised in
            draft += draft.isEmpty ? recognised : " " + recognised
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
