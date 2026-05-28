// CaptureView — focused capture surface, redesigned.
//
// Brand-forward minimal header (blob + memory.wiki + CAPTURE caption),
// big editor with a compelling placeholder, smart chips above the
// editor (clipboard URL, unsaved draft, saved confirmation), sticky
// bottom action bar with Photo / Voice / Save when the keyboard is
// down. The markdown formatting toolbar slides in above the keyboard
// via MarkdownEditor's UIKit inputAccessoryView when typing.
//
// Inspirations: Drafts, Bear, Apple Notes. The principle is a
// single focused writing surface — no form chrome, no competing
// affordances, the WRITING area is the hero.

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
    @FocusState private var focused: Bool
    @State private var keyboardUp = false

    /// Persisted draft body — survives app kill so a half-typed
    /// memory isn't lost when iOS evicts the process or the user
    /// gets a call.
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
            // Ambient blob backdrop — only when the canvas is
            // truly empty (no draft, no chips, no success card).
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
                if let errorMessage {
                    Text(errorMessage)
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.microRed)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 4)
                }
            }
            // Sticky bottom action bar — appears above the tab
            // bar when keyboard is down. Hidden when keyboard up
            // (the inputAccessoryView markdown toolbar takes its
            // place anchored to the keyboard).
            if !keyboardUp {
                VStack { Spacer(); bottomBar }
            }
        }
        .onAppear { onAppearEffects() }
        .onChange(of: focused) { _, isFocused in
            if isFocused { refreshClipboard() }
        }
        .onChange(of: draft) { _, new in
            persistedDraft = new
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            withAnimation(.snappy(duration: 0.22)) { keyboardUp = true }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.snappy(duration: 0.22)) { keyboardUp = false }
        }
        .sheet(isPresented: $showPhotoPicker) {
            PhotoCaptureSheet(isPresented: $showPhotoPicker) { ocrText, _ in
                let title = "Photo capture · \(Date().formatted(date: .abbreviated, time: .shortened))"
                draft = "# \(title)\n\n\(ocrText)"
            }
            .presentationDetents([.medium])
            .preferredColorScheme(.dark)
        }
    }

    // MARK: - Header

    /// Minimal brand-forward header — blob + wordmark + CAPTURE
    /// caption + a quiet close that bounces back to Timeline.
    /// No "Save" button up here; that lives in the bottom bar so
    /// the header reads as identity, not as a form toolbar.
    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            MemoryWikiLogo(size: 20)
            Text("CAPTURE")
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.4)
                .foregroundStyle(Brand.textFaint)
            Spacer()
            Button {
                Haptics.tap()
                if focused { focused = false }
                router.selectedTab = .timeline
            } label: {
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.textMuted)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle()
                            .fill(.ultraThinMaterial)
                            .overlay(Circle().strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Brand.borderDim).frame(height: 0.5)
        }
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
            .padding(.top, 10)
        } else if let url = clipboardURL, savedURL == nil {
            ClipboardChip(url: url, busy: saving) {
                Task { await saveURL(url) }
            } onDismiss: {
                clipboardURL = nil
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
        } else if let url = savedURL {
            SavedBanner(url: url) {
                savedURL = nil
                draft = ""
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
        }
    }

    // MARK: - Editor

    private var editor: some View {
        ZStack(alignment: .topLeading) {
            // Big compelling placeholder when the editor is empty.
            // Cal Sans display weight — reads as a prompt, not a
            // hint, so the empty surface feels intentional.
            if draft.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("What's on your mind?")
                        .font(Brand.display(size: 24))
                        .foregroundStyle(Brand.textMuted)
                    Text("Type, paste a URL, or tap the mic.")
                        .font(Brand.body(size: 13))
                        .foregroundStyle(Brand.textFaint)
                }
                .padding(.horizontal, 22)
                .padding(.top, 22)
                .allowsHitTesting(false)
            }
            MarkdownEditor(
                text: $draft,
                isFocused: focused,
                onFocusChange: { focused = $0 },
                onStartDictation: { startDictation() },
                onStopDictation: { stopDictation() },
                isDictating: isDictating
            )
            .opacity(draft.isEmpty ? 0.85 : 1)
        }
    }

    // MARK: - Bottom bar

    /// Sticky bottom action bar. Photo + Voice on the left, Save
    /// on the right. Hidden when the keyboard is up (the markdown
    /// toolbar in MarkdownEditor's inputAccessoryView takes over).
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
            // Primary action — ink-on-textPrimary pill. Disabled
            // state is faint, not gray, so it reads as "ready to
            // wake up" instead of "broken."
            Button {
                Task { await saveDraft() }
            } label: {
                HStack(spacing: 6) {
                    if saving {
                        ProgressView().scaleEffect(0.6).tint(Brand.background)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    Text(saving ? "Saving…" : "Save")
                        .font(Brand.body(size: 14, weight: .semibold))
                }
                .foregroundStyle(canSave ? Brand.background : Brand.textMuted)
                .padding(.horizontal, 16)
                .padding(.vertical, 11)
                .background(
                    Capsule()
                        .fill(canSave ? Brand.textPrimary : Brand.surface)
                        .overlay(
                            Capsule().strokeBorder(canSave ? .clear : Brand.borderDim, lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            Brand.background.opacity(0.92)
                .background(.ultraThinMaterial)
                .overlay(alignment: .top) {
                    Rectangle().fill(Brand.borderDim).frame(height: 0.5)
                }
        )
        .padding(.bottom, 56) // sit above the custom tab bar
    }

    // MARK: - Clipboard

    private func refreshClipboard() {
        let pb = UIPasteboard.general
        guard pb.hasURLs, let url = pb.url else { clipboardURL = nil; return }
        if savedURL?.absoluteString == url.absoluteString {
            clipboardURL = nil
        } else {
            clipboardURL = url
        }
    }

    // MARK: - Lifecycle

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

    // MARK: - Save

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

    // MARK: - Dictation

    private func startDictation() {
        Haptics.tap()
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

/// Shared ambient blob backdrop — used by Capture / Timeline /
/// Bundles empty states. Big, blurred, very faint so the screen
/// reads as alive without competing with content. Anchored to
/// the screen (ignoresSafeArea(.all)) so keyboard arrival
/// doesn't shift its position.
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

/// Bottom action chip — icon + label, ink on glass surface.
/// Used for Photo / Voice toggles in the bottom action bar.
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
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                Capsule()
                    .fill(.ultraThinMaterial)
                    .overlay(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
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
                    .background(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
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
            Link(destination: url) {
                Text("View")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Capsule().fill(Brand.textPrimary))
            }
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
