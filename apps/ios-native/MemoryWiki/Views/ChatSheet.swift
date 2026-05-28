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
            ZStack {
                // Dark canvas — the parent .iOS26Sheet uses
                // .ultraThinMaterial which reads too light when
                // the chat content is text-heavy. Brand background
                // overlay restores the app's ink-on-dark voice.
                Brand.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    header
                    transcript
                    composer
                }
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
                        .fill(Brand.surface)
                        .overlay(Capsule(style: .continuous)
                            .strokeBorder(Brand.borderDim, lineWidth: 1))
                )
            // Keyboard dismiss — only shown while the input has
            // focus so it doesn't clutter the row when the user
            // is already reading the transcript.
            if inputFocused {
                Button {
                    Haptics.selection()
                    inputFocused = false
                } label: {
                    Image(systemName: "keyboard.chevron.compact.down")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Brand.textMuted)
                        .frame(width: 38, height: 38)
                        .background(Circle().fill(Brand.surface))
                }
                .buttonStyle(.plain)
                .transition(.scale.combined(with: .opacity))
            }
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
        .background(Brand.background.opacity(0.85))
        .overlay(alignment: .top) {
            Rectangle().fill(Brand.borderDim).frame(height: 0.5)
        }
        .animation(.snappy(duration: 0.18), value: inputFocused)
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
        // The assistant reply is broken into paragraphs by blank
        // lines first — keeps tight prose tight and gives clean
        // gaps between sections. Inside each paragraph, [doc:id]
        // tokens are extracted out as a row of chips beneath the
        // text so the chips don't break the prose's natural line
        // wrapping.
        VStack(alignment: .leading, spacing: 10) {
            let paragraphs = raw.components(separatedBy: "\n\n").filter {
                !$0.trimmingCharacters(in: .whitespaces).isEmpty
            }
            ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, para in
                paragraphView(para)
            }
        }
    }

    @ViewBuilder
    private func paragraphView(_ para: String) -> some View {
        let (cleaned, docIds) = stripDocRefs(para)
        VStack(alignment: .leading, spacing: 6) {
            if !cleaned.isEmpty {
                markdownText(cleaned)
            }
            if !docIds.isEmpty {
                docChipsRow(docIds)
            }
        }
    }

    /// Returns the paragraph with `[doc:id]` tokens stripped + the
    /// list of unique doc ids found inside it (preserved order).
    private func stripDocRefs(_ para: String) -> (String, [String]) {
        let pattern = #"\[?doc:([A-Za-z0-9_-]{6,})\]?"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return (para, [])
        }
        let ns = para as NSString
        let matches = regex.matches(in: para, range: NSRange(location: 0, length: ns.length))
        var ids: [String] = []
        var seen = Set<String>()
        for m in matches {
            let id = ns.substring(with: m.range(at: 1))
            if !seen.contains(id) { ids.append(id); seen.insert(id) }
        }
        // Remove the matched runs from the text + collapse double
        // spaces / spaces-before-punct left behind.
        var cleaned = regex.stringByReplacingMatches(
            in: para, range: NSRange(location: 0, length: ns.length), withTemplate: ""
        )
        cleaned = cleaned.replacingOccurrences(of: "  ", with: " ")
        cleaned = cleaned.replacingOccurrences(of: " .", with: ".")
        cleaned = cleaned.replacingOccurrences(of: " ,", with: ",")
        return (cleaned.trimmingCharacters(in: .whitespacesAndNewlines), ids)
    }

    @ViewBuilder
    private func markdownText(_ s: String) -> some View {
        // Use the full block-level MarkdownBody renderer so
        // headings (##), lists (- / 1.), code fences (```),
        // blockquotes (>) and rules (---) render as styled
        // blocks instead of leaking their raw characters.
        // `AttributedString(markdown:, .inlineOnly…)` only knew
        // about **bold** / *italic* / `code` / links — every
        // block construct ended up as literal text.
        MarkdownBody(markdown: s)
    }

    private func docChipsRow(_ ids: [String]) -> some View {
        FlexibleHStack(spacing: 6) {
            ForEach(ids, id: \.self) { id in
                DocCitationChip(id: id) {
                    Haptics.selection()
                    router.selectedTab = .timeline
                    router.timelinePath = [.docDetailById(id)]
                    dismiss()
                }
            }
        }
    }
}

/// Single citation chip — fetches the doc's title via DocCache
/// (already populated by Timeline row prefetching, falls back to
/// a per-tap fetch). Displays the title instead of the raw id
/// hash, with the file glyph for affordance.
private struct DocCitationChip: View {
    let id: String
    let onTap: () -> Void
    @State private var title: String? = nil

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: "doc.text")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Brand.microInfo)
                Text(displayLabel)
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(
                Capsule(style: .continuous)
                    .fill(Brand.surface)
                    .overlay(Capsule(style: .continuous)
                        .strokeBorder(Brand.microInfo.opacity(0.40), lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
        .task { await resolveTitle() }
    }

    private var displayLabel: String {
        if let t = title?.trimmingCharacters(in: .whitespaces), !t.isEmpty { return t }
        return "doc \(id.prefix(8))"
    }

    private func resolveTitle() async {
        if let cached = DocCache.shared.get(id) {
            title = cached.title
            return
        }
        // Cache miss — kick a fetch in the background.
        DocCache.shared.prefetch(id)
        // Poll briefly for the cache to fill (prefetch dedups so
        // this is cheap). 5 × 200ms = 1 s ceiling before falling
        // back to the id label.
        for _ in 0..<5 {
            try? await Task.sleep(nanoseconds: 200_000_000)
            if let cached = DocCache.shared.get(id) {
                title = cached.title
                return
            }
        }
    }
}

/// Wraps its children left-to-right and breaks to the next line
/// when running out of horizontal room. Used for the citation
/// chip row so a paragraph that cites many docs flows naturally
/// instead of forcing horizontal scroll.
private struct FlexibleHStack<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: () -> Content
    var body: some View {
        // SwiftUI's `Layout` would be the proper API, but a Lazy
        // VGrid with adaptive columns of ~120pt min reads the
        // same for this use-case and is simpler to maintain.
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 100, maximum: 200), spacing: spacing, alignment: .leading)],
            alignment: .leading,
            spacing: spacing
        ) {
            content()
        }
    }
}

#Preview {
    ChatSheet(scope: .hub(slug: "demo", title: "Your hub"))
        .environmentObject(AppRouter.shared)
        .preferredColorScheme(.dark)
}
