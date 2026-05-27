// ShareSheetView — SwiftUI surface inside the Share Extension.
// Brand chrome (dark zinc, Cal Sans title, Noto Sans body, glass
// surfaces) so the extension reads as the same product the main
// app is, even though it runs in a different process.

import SwiftUI

struct ShareSheetView: View {
    let extensionContext: NSExtensionContext?
    let initial: SharePayload

    @State private var title: String
    @State private var note: String
    @State private var working = false
    @State private var savedURL: URL?
    @State private var error: String?

    init(extensionContext: NSExtensionContext?, initial: SharePayload) {
        self.extensionContext = extensionContext
        self.initial = initial
        _title = State(initialValue: initial.title ?? "")
        _note = State(initialValue: initial.text ?? "")
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color(red: 0.035, green: 0.035, blue: 0.043).ignoresSafeArea()

            VStack(alignment: .leading, spacing: 14) {
                header
                if let url = initial.url {
                    sourceChip(url: url)
                }
                titleField
                noteField
                if let error {
                    Text(error)
                        .font(.system(size: 12))
                        .foregroundStyle(Color(red: 0.94, green: 0.27, blue: 0.27))
                }
                if let savedURL {
                    successCard(url: savedURL)
                }
                Spacer(minLength: 8)
                actionRow
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 18)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            // Lockup: lime "memory" + ink ".wiki" rendered as text
            // so we don't have to bundle the brand SVG inside the
            // extension binary.
            HStack(spacing: 0) {
                Text("memory")
                    .foregroundStyle(Color(red: 0.71, green: 1.0, blue: 0.10))
                Text(".wiki")
                    .foregroundStyle(.white)
            }
            .font(.system(size: 18, weight: .semibold))
            Spacer()
            Button { cancel() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(.white.opacity(0.08)))
            }
        }
    }

    private func sourceChip(url: URL) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "link")
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.5))
            Text(url.absoluteString)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.white.opacity(0.8))
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(.white.opacity(0.05))
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(.white.opacity(0.1), lineWidth: 1))
        )
    }

    private var titleField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TITLE")
                .font(.system(size: 9, weight: .medium, design: .monospaced))
                .tracking(1)
                .foregroundStyle(.white.opacity(0.45))
            TextField("", text: $title)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white)
                .tint(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(.white.opacity(0.05))
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(.white.opacity(0.1), lineWidth: 1))
                )
        }
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("NOTE (optional)")
                .font(.system(size: 9, weight: .medium, design: .monospaced))
                .tracking(1)
                .foregroundStyle(.white.opacity(0.45))
            TextEditor(text: $note)
                .scrollContentBackground(.hidden)
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .tint(.white)
                .frame(minHeight: 90, maxHeight: 130)
                .padding(.horizontal, 8)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(.white.opacity(0.05))
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(.white.opacity(0.1), lineWidth: 1))
                )
        }
    }

    private func successCard(url: URL) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.white)
            Text(url.absoluteString)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.white)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer()
            Button("Done") { finish() }
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.black)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(.white))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(.white.opacity(0.10))
        )
    }

    private var actionRow: some View {
        Button {
            Task { await save() }
        } label: {
            Text(working ? "Saving…" : "Save to Memory.Wiki")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(canSave ? Color.white : Color.white.opacity(0.25))
                )
        }
        .buttonStyle(.plain)
        .disabled(!canSave)
        .opacity(savedURL == nil ? 1 : 0.5)
    }

    private var canSave: Bool {
        !working && savedURL == nil && !(title.isEmpty && note.isEmpty && initial.url == nil)
    }

    private func save() async {
        working = true
        error = nil
        let md = initial.toMarkdown(overrideTitle: title.isEmpty ? nil : title)
        let composed: String
        if note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            composed = md
        } else if md.isEmpty {
            composed = note
        } else {
            composed = md + "\n\n" + note
        }
        do {
            savedURL = try await SharedAPI.createDocument(
                markdown: composed,
                title: title.isEmpty ? nil : title,
                source: "ios-share"
            )
        } catch {
            self.error = error.localizedDescription
        }
        working = false
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    private func cancel() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
