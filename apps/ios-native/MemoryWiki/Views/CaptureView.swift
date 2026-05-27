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
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            VStack(spacing: 0) {
                header
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
            focused = true
            refreshClipboard()
        }
        .onChange(of: focused) { _, isFocused in
            if isFocused { refreshClipboard() }
        }
    }

    // MARK: - Chrome

    private var header: some View {
        HStack {
            Text("Capture")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            Spacer()
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
            TextEditor(text: $draft)
                .focused($focused)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .font(Brand.body(size: 15))
                .foregroundStyle(Brand.textPrimary)
                .tint(Brand.textPrimary)
        }
    }

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
        }
    }

    private func run(_ action: @escaping () async throws -> Void) async {
        saving = true
        errorMessage = nil
        defer { saving = false }
        do { try await action() }
        catch { errorMessage = error.localizedDescription }
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
