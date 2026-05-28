// ChatSheet — conversational surface over a user's hub, an
// individual bundle, or a single document. Streams responses
// token-by-token from /api/hub/<slug>/chat, /api/bundles/<id>/chat,
// or /api/docs/<id>/chat.
//
// Assistant replies are rendered as markdown via SwiftUI's
// AttributedString(markdown:) so **bold**, lists, and code spans
// don't show as literal characters. The server is instructed to
// cite docs with `[doc:<id>]` — those tokens are detected on the
// way out and rendered as tappable buttons that push the
// referenced document into the active NavigationStack.

import SwiftUI

struct ChatSheet: View {
    enum Scope: Equatable {
        case hub(slug: String, title: String)
        case bundle(id: String, title: String)
        case doc(id: String, title: String)
        var label: String {
            switch self {
            case .hub(_, let t):     return t
            case .bundle(_, let t):  return t
            case .doc(_, let t):     return t
            }
        }
        var apiScope: APIClient.ChatScope {
            switch self {
            case .hub(let s, _):     return .hub(slug: s)
            case .bundle(let id, _): return .bundle(id: id)
            case .doc(let id, _):    return .doc(id: id)
            }
        }
        var scopeLabel: String {
            switch self {
            case .hub:     return "Hub"
            case .bundle:  return "Bundle"
            case .doc:     return "Document"
            }
        }
    }

    let scope: Scope
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var router: AppRouter
    @State private var input: String = ""
    @State private var messages: [APIClient.ChatMessage] = []
    @State private var partial: String = ""
    @State private var sending: Bool = false
    @State private var error: String? = nil
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                transcript
                composer
            }
        }
        .onAppear { inputFocused = true }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(scope.scopeLabel.uppercased())
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(Brand.microInfo)
                Text(scope.label)
                    .font(Brand.display(size: 20))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(.ultraThinMaterial))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 14)
    }

    // MARK: - Transcript

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    if messages.isEmpty && partial.isEmpty {
                        emptyHint
                            .padding(.top, 32)
                    }
                    ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                        bubble(role: msg.role, text: msg.content)
                    }
                    if !partial.isEmpty {
                        bubble(role: "assistant", text: partial)
                            .id("partial")
                    }
                    if sending && partial.isEmpty {
                        // Brief "thinking" indicator before the first
                        // token of the assistant reply lands.
                        HStack(spacing: 6) {
                            ProgressView()
                                .scaleEffect(0.6)
                                .tint(Brand.microInfo)
                            Text("Thinking…")
                                .font(Brand.mono(size: 10))
                                .tracking(0.6)
                                .foregroundStyle(Brand.textFaint)
                        }
                        .padding(.horizontal, 4)
                    }
                    if let error {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(Brand.microRed)
                            Text(error)
                                .font(Brand.body(size: 12))
                                .foregroundStyle(Brand.textPrimary)
                        }
                        .padding(10)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Brand.microRed.opacity(0.10))
                                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(Brand.microRed.opacity(0.4), lineWidth: 1))
                        )
                    }
                    Color.clear.frame(height: 12).id("BOTTOM")
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 12)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo("BOTTOM", anchor: .bottom)
                }
            }
            .onChange(of: partial) { _, _ in
                proxy.scrollTo("BOTTOM", anchor: .bottom)
            }
        }
    }

    private var emptyHint: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Try")
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.2)
                .foregroundStyle(Brand.textFaint)
            VStack(alignment: .leading, spacing: 8) {
                hintLine("What have I been thinking about lately?")
                hintLine("Summarise this in three bullets.")
                hintLine("What's the strongest argument across these notes?")
            }
        }
    }

    private func hintLine(_ text: String) -> some View {
        Button {
            Haptics.selection()
            input = text
            inputFocused = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.microInfo)
                Text(text)
                    .font(Brand.body(size: 14))
                    .foregroundStyle(Brand.textPrimary)
                    .multilineTextAlignment(.leading)
                Spacer()
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Message bubble

    @ViewBuilder
    private func bubble(role: String, text: String) -> some View {
        if role == "user" {
            HStack {
                Spacer(minLength: 44)
                Text(text)
                    .font(Brand.body(size: 14))
                    .foregroundStyle(Brand.textPrimary)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(
                        Capsule(style: .continuous)
                            .fill(.ultraThinMaterial)
                            .overlay(Capsule(style: .continuous)
                                .strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Text("ASSISTANT")
                    .font(Brand.mono(size: 8, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(Brand.textFaint)
                MarkdownAssistantText(raw: text, router: router, dismiss: dismiss)
            }
            .padding(.trailing, 24)
        }
    }

    // MARK: - Composer

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Ask anything…", text: $input, axis: .vertical)
                .focused($inputFocused)
                .font(Brand.body(size: 14))
                .lineLimit(1...6)
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(
                    Capsule(style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(Capsule(style: .continuous)
                            .strokeBorder(Brand.borderDim, lineWidth: 1))
                )
            Button { Task { await send() } } label: {
                Image(systemName: sending ? "stop.fill" : "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(canSend || sending ? Brand.background : Brand.textFaint)
                    .frame(width: 42, height: 42)
                    .background(
                        Circle().fill(canSend || sending ? Brand.textPrimary : Brand.surface)
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canSend && !sending)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(Brand.borderDim).frame(height: 0.5)
        }
    }

    private var canSend: Bool {
        !sending && !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Send

    private func send() async {
        let q = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !sending else { return }
        input = ""
        sending = true
        error = nil
        messages.append(APIClient.ChatMessage(role: "user", content: q))
        let history = Array(messages.dropLast())
        partial = ""
        do {
            let final = try await APIClient.shared.streamChat(
                scope: scope.apiScope,
                message: q,
                history: history,
                onChunk: { chunk in
                    partial += chunk
                }
            )
            messages.append(APIClient.ChatMessage(role: "assistant", content: final))
            partial = ""
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
        sending = false
    }
}

// MARK: - Markdown assistant text with tappable [doc:ID] links

/// Renders an assistant message that may contain markdown
/// formatting (**bold**, lists, code spans) AND `[doc:<id>]`
/// citation tokens. The citations are sliced out and rendered as
/// small tappable buttons inline with the prose. The remaining
/// chunks become AttributedString(markdown:) Text nodes so the
/// rest of the markdown renders properly instead of leaking
/// raw asterisks.
private struct MarkdownAssistantText: View {
    let raw: String
    let router: AppRouter
    let dismiss: DismissAction

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(slices().enumerated()), id: \.offset) { _, slice in
                slice
            }
        }
    }

    /// Split the assistant message into a sequence of either text
    /// runs (rendered as markdown) or doc-citation chips.
    private func slices() -> [AnyView] {
        var out: [AnyView] = []
        let pattern = #"\[?doc:([A-Za-z0-9_-]{6,})\]?"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            out.append(AnyView(markdownText(raw)))
            return out
        }
        let ns = raw as NSString
        let matches = regex.matches(in: raw, range: NSRange(location: 0, length: ns.length))
        var cursor = 0
        for m in matches {
            if m.range.location > cursor {
                let pre = ns.substring(with: NSRange(location: cursor, length: m.range.location - cursor))
                if !pre.isEmpty { out.append(AnyView(markdownText(pre))) }
            }
            let docId = ns.substring(with: m.range(at: 1))
            out.append(AnyView(docChip(docId)))
            cursor = m.range.location + m.range.length
        }
        if cursor < ns.length {
            let tail = ns.substring(with: NSRange(location: cursor, length: ns.length - cursor))
            if !tail.isEmpty { out.append(AnyView(markdownText(tail))) }
        }
        return out
    }

    @ViewBuilder
    private func markdownText(_ s: String) -> some View {
        if let attributed = try? AttributedString(
            markdown: s,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            Text(attributed)
                .font(Brand.body(size: 14))
                .foregroundStyle(Brand.textPrimary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            Text(s)
                .font(Brand.body(size: 14))
                .foregroundStyle(Brand.textPrimary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func docChip(_ id: String) -> some View {
        Button {
            Haptics.selection()
            router.selectedTab = .timeline
            router.timelinePath = [.docDetailById(id)]
            dismiss()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "doc.text")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Brand.microInfo)
                Text("doc \(id.prefix(8))")
                    .font(Brand.mono(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(
                Capsule(style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(Capsule(style: .continuous)
                        .strokeBorder(Brand.microInfo.opacity(0.45), lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    ChatSheet(scope: .hub(slug: "demo", title: "Your hub"))
        .environmentObject(AppRouter.shared)
        .preferredColorScheme(.dark)
}
