// CaptureView — quick-capture tab. Plain text field that POSTs to
// /api/docs and returns the new doc's permanent URL. The Share
// Extension covers the "from any other app" path; this is the
// in-app fast lane (paste from clipboard, write a thought, etc.).

import SwiftUI

struct CaptureView: View {
    @State private var draft = ""
    @State private var saving = false
    @State private var savedURL: URL?
    @State private var errorMessage: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                TextEditor(text: $draft)
                    .focused($focused)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
                    .font(.body)
                    .overlay(alignment: .topLeading) {
                        if draft.isEmpty {
                            Text("Paste anything. Markdown welcomed.")
                                .foregroundStyle(.tertiary)
                                .padding(.horizontal, 18)
                                .padding(.top, 16)
                                .allowsHitTesting(false)
                        }
                    }
                if let url = savedURL {
                    HStack(spacing: 10) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text(url.absoluteString).font(.footnote.monospaced()).lineLimit(1).truncationMode(.middle)
                        Spacer()
                        ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
                    }
                    .padding(12)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
                    .padding(12)
                }
                if let error = errorMessage {
                    Text(error).font(.caption).foregroundStyle(.red).padding(.horizontal, 16).padding(.bottom, 8)
                }
            }
            .navigationTitle("Capture")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") { Task { await save() } }
                        .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || saving)
                }
            }
            .onAppear { focused = true }
        }
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

#Preview {
    CaptureView()
}
