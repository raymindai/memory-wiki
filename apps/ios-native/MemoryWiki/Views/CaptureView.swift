// CaptureView — quick capture. Two paths:
//
//   1. URL on clipboard → one-tap "Save https://… as doc" pill
//      surfaced on focus. POSTs to /api/docs with a minimal
//      `# <host>\n\nSource: <url>` body — no SSE-streaming
//      conversion (the Share Extension already covers the
//      heavier "Save with selection" case).
//   2. Type anything → textarea → POST /api/docs.
//
// Both flows surface a success card with the canonical URL +
// a ShareLink so the user can immediately hand the URL to AI.

import SwiftUI
import UIKit

struct CaptureView: View {
    @State private var draft = ""
    @State private var saving = false
    @State private var savedURL: URL?
    @State private var errorMessage: String?
    @State private var clipboardURL: URL?
    @State private var showPhotoPicker = false
    @FocusState private var focused: Bool
    /// True only while the system soft keyboard is actually
    /// on-screen. Used to gate the markdown accessory toolbar
    /// — without this gate, .toolbar(.keyboard) renders the
    /// strip floating above the tab bar (the user-reported bug)
    /// even when no keyboard is visible.
    @State private var keyboardUp = false

    /// Persisted draft body — survives app kill so a half-typed
    /// memory isn't lost when iOS evicts the process or the user
    /// gets a call. We restore on appear; if there's anything in
    /// here that DIDN'T get saved, the restore card surfaces.
    @AppStorage("mw.draft.body") private var persistedDraft: String = ""
    @State private var restorable: String? = nil
    @State private var dictation = DictationController()
    @State private var isDictating = false

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            // Ambient watermark blob — only when there's nothing
            // typed + no chips up. Mirrors the auth-screen vibe so
            // the empty Capture surface doesn't read like a dead
            // text field. Pointer-passthrough so taps reach the
            // editor underneath.
            if draft.isEmpty && clipboardURL == nil && restorable == nil && savedURL == nil {
                AmbientBlob()
            }
            VStack(spacing: 0) {
                header
                if let saved = restorable, !saved.isEmpty, savedURL == nil {
                    RestoreDraftChip(preview: saved) {
                        draft = saved
                        restorable = nil
                    } onDismiss: {
                        restorable = nil
                        persistedDraft = ""
                    }
                    .padding(.horizontal, 14)
                    .padding(.bottom, 10)
                }
                if let url = clipboardURL, savedURL == nil {
                    ClipboardChip(url: url, busy: saving) {
                        Task { await saveURL(url) }
                    } onDismiss: {
                        clipboardURL = nil
                    }
                    .padding(.horizontal, 14)
                    .padding(.bottom, 10)
                }
                editor
                if isDictating {
                    DictationBanner { stopDictation() }
                        .padding(.horizontal, 14)
                        .padding(.bottom, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                if let url = savedURL {
                    SavedBanner(url: url) { savedURL = nil; draft = "" }
                        .padding(.horizontal, 14)
                        .padding(.bottom, 10)
                }
                if let errorMessage {
                    Text(errorMessage)
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.microRed)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 8)
                }
            }
        }
        .onAppear {
            // App Intent pre-fill from CaptureNoteIntent.perform()
            // — stamped in UserDefaults to avoid background-actor
            // hop into SwiftUI state. Consume + clear here.
            let prefillKey = "mw.intent.captureText"
            if let prefill = UserDefaults.standard.string(forKey: prefillKey), !prefill.isEmpty {
                draft = prefill
                UserDefaults.standard.removeObject(forKey: prefillKey)
            }
            // Restore: if there's a non-empty persisted draft from
            // a previous run, surface a chip. Don't auto-overwrite
            // — the user might've intentionally tapped Capture
            // for a fresh start.
            if !persistedDraft.isEmpty && draft.isEmpty {
                restorable = persistedDraft
            }
            // Don't auto-focus — focus auto-shows the soft kb on
            // appear, which on tab switch sometimes leaves the
            // accessory toolbar floating without the keyboard
            // (the screenshot user reported). User taps the editor
            // to bring the keyboard up themselves.
            refreshClipboard()
        }
        .onChange(of: focused) { _, isFocused in
            if isFocused { refreshClipboard() }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            keyboardUp = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardUp = false
        }
        .onChange(of: draft) { _, new in
            // Keystroke-driven persist. @AppStorage debounces in
            // its own write path (UserDefaults is already lazy);
            // anything more elaborate is overkill at this size.
            persistedDraft = new
        }
        .sheet(isPresented: $showPhotoPicker) {
            PhotoCaptureSheet(isPresented: $showPhotoPicker) { ocrText, _ in
                // Drop OCR'd text into the draft; user can edit
                // + tap Save. Pre-fills a heading so the user
                // sees a proper title in their timeline.
                let title = "Photo capture · \(Date().formatted(date: .abbreviated, time: .shortened))"
                draft = "# \(title)\n\n\(ocrText)"
            }
            .presentationDetents([.medium])
            .preferredColorScheme(.dark)
        }
    }

    // MARK: - Chrome

    private var header: some View {
        HStack {
            Text("Capture")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            Spacer()
            Button { showPhotoPicker = true } label: {
                Image(systemName: "camera")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Brand.textMuted)
                    .frame(width: 34, height: 34)
                    .background(
                        Circle()
                            .fill(.ultraThinMaterial)
                            .overlay(Circle().strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
            }
            .buttonStyle(.plain)
            Button { Task { await saveDraft() } } label: {
                Text(saving ? "Saving…" : "Save")
                    .font(Brand.body(size: 13, weight: .medium))
                    .foregroundStyle(canSaveDraft ? Brand.background : Brand.textFaint)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 7)
                    .background(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(canSaveDraft ? Brand.textPrimary : Brand.surface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .strokeBorder(canSaveDraft ? .clear : Brand.borderDim, lineWidth: 1)
                    )
            }
            .disabled(!canSaveDraft)
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    private var editor: some View {
        ZStack(alignment: .topLeading) {
            if draft.isEmpty {
                Text("Paste anything. Markdown welcomed.")
                    .font(Brand.body(size: 15))
                    .foregroundStyle(Brand.textFaint)
                    .padding(.horizontal, 22)
                    .padding(.top, 18)
                    .allowsHitTesting(false)
            }
            // UITextView-backed editor with a real UIKit
            // inputAccessoryView — iOS guarantees the markdown
            // toolbar shows ONLY while the keyboard is on-screen.
            // SwiftUI's .toolbar(.keyboard) had been floating the
            // strip above the tab bar with no keyboard underneath
            // (the bug visible on device).
            MarkdownEditor(
                text: $draft,
                isFocused: focused,
                onFocusChange: { focused = $0 },
                onStartDictation: { startDictation() },
                onStopDictation: { stopDictation() },
                isDictating: isDictating
            )
        }
    }

    // Markdown toolbar now lives in MarkdownEditor's UIKit
    // inputAccessoryView (so it shows ONLY with the keyboard).
    // Old SwiftUI .toolbar(.keyboard) implementation removed.

    // MARK: - Clipboard

    /// UIPasteboard.hasURLs is cheap and doesn't ping the system
    /// pasteboard prompt that iOS shows on a full string read in
    /// recent OS versions; the URL value pull only happens when we
    /// know there's one to grab.
    private func refreshClipboard() {
        let pb = UIPasteboard.general
        guard pb.hasURLs, let url = pb.url else { clipboardURL = nil; return }
        // Don't surface the chip if it's the same URL we already
        // saved (avoid suggesting the same thing twice in a row).
        if savedURL?.absoluteString == url.absoluteString {
            clipboardURL = nil
        } else {
            clipboardURL = url
        }
    }

    // MARK: - Actions

    private var canSaveDraft: Bool {
        !saving && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
            let doc = try await APIClient.shared.createDocument(
                markdown: body,
                title: host
            )
            savedURL = doc.publicURL
            clipboardURL = nil
            Haptics.success()
        }
    }

    private func startDictation() {
        Haptics.tap()
        dictation.start(locales: ["ko-KR", "en-US"]) { recognised in
            // Append-on-finalise so the dictated text shows up
            // as a coherent block — partial frames flicker too
            // much to be useful for capture (vs assistant chat).
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

    private func run(_ action: @escaping () async throws -> Void) async {
        saving = true
        errorMessage = nil
        defer { saving = false }
        do { try await action() }
        catch { errorMessage = error.localizedDescription }
    }
}

/// Shared ambient blob backdrop — used by Capture / Timeline /
/// Bundles empty states. Big, blurred, very faint so the screen
/// reads as alive without competing with content.
struct AmbientBlob: View {
    var body: some View {
        GeometryReader { proxy in
            let dim = max(proxy.size.width, proxy.size.height) * 1.4
            AnimatedBlob(size: dim, theme: .dark)
                .opacity(0.04)
                .blur(radius: 14)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .center)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
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
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Brand.textFaint)
            VStack(alignment: .leading, spacing: 1) {
                Text("FROM CLIPBOARD")
                    .font(Brand.mono(size: 8, weight: .medium))
                    .tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Text(url.absoluteString)
                    .font(Brand.mono(size: 11))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.middle)
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
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

// MARK: - Restore draft chip

private struct RestoreDraftChip: View {
    let preview: String
    var onRestore: () -> Void
    var onDismiss: () -> Void
    private var oneLine: String {
        preview.replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespaces)
    }
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "tray.and.arrow.up")
                .font(.system(size: 12))
                .foregroundStyle(Brand.textFaint)
            VStack(alignment: .leading, spacing: 1) {
                Text("UNSAVED DRAFT")
                    .font(Brand.mono(size: 8, weight: .medium))
                    .tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Text(oneLine)
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
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
                .fill(.ultraThinMaterial)
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
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1)
                .foregroundStyle(Brand.textMuted)
            Text("Korean + English")
                .font(Brand.body(size: 11))
                .foregroundStyle(Brand.textFaint)
            Spacer()
            Button(action: onStop) {
                Text("Stop")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(
                        Capsule().strokeBorder(Brand.borderDim, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
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
                .font(Brand.mono(size: 11))
                .foregroundStyle(Brand.textPrimary)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer()
            ShareLink(item: url) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.textFaint)
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
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

#Preview { CaptureView() }
