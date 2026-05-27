// CaptureView — quick draft → POST /api/docs. Matches the web
// editor's stripped Source pane: dark zinc canvas, mono caret-
// friendly typography for the text area, quiet save chrome.

import SwiftUI

struct CaptureView: View {
    @State private var draft = ""
    @State private var saving = false
    @State private var savedURL: URL?
    @State private var errorMessage: String?
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header

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

                if let url = savedURL {
                    SavedBanner(url: url) { savedURL = nil }
                        .padding(.horizontal, 14)
                        .padding(.bottom, 10)
                }
                if let error = errorMessage {
                    Text(error)
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.microRed)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 8)
                }
            }
        }
        .onAppear { focused = true }
    }

    private var header: some View {
        HStack {
            Text("Capture")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            Spacer()
            Button { Task { await save() } } label: {
                Text(saving ? "Saving…" : "Save")
                    .font(Brand.body(size: 13, weight: .medium))
                    .foregroundStyle(canSave ? Brand.background : Brand.textFaint)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 7)
                    .background(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(canSave ? Brand.textPrimary : Brand.surface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .strokeBorder(canSave ? .clear : Brand.borderDim, lineWidth: 1)
                    )
            }
            .disabled(!canSave)
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    private var canSave: Bool {
        !saving && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        saving = true
        defer { saving = false }
        do {
            let doc = try await APIClient.shared.createDocument(markdown: body)
            savedURL = doc.publicURL
            draft = ""
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct SavedBanner: View {
    let url: URL
    var onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            // Tiny lime dot — the only color on the row. Status,
            // not brand.
            Circle().fill(Brand.accent).frame(width: 6, height: 6)
            Text(url.absoluteString)
                .font(Brand.mono(size: 11))
                .foregroundStyle(Brand.textPrimary)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer()
            ShareLink(item: url) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Brand.textFaint)
            }
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Brand.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Brand.borderDim, lineWidth: 1)
                )
        )
    }
}

#Preview {
    CaptureView()
}
