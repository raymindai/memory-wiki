// ChatSheet — conversational surface over a user's hub or
// individual bundle. Streams responses token-by-token from
// /api/hub/<slug>/chat or /api/bundles/<id>/chat so the assistant
// reply types in live.
//
// Mobile USE primitive: instead of pasting a URL into Claude /
// ChatGPT and starting a thread, the user opens this sheet,
// types a question, and the AI answer is grounded in their hub
// without leaving the app.

import SwiftUI

struct ChatSheet: View {
    enum Scope: Equatable {
        case hub(slug: String, title: String)
        case bundle(id: String, title: String)
        var label: String {
            switch self {
            case .hub(_, let t):    return t
            case .bundle(_, let t): return t
            }
        }
        var apiScope: APIClient.ChatScope {
            switch self {
            case .hub(let s, _):    return .hub(slug: s)
            case .bundle(let id, _): return .bundle(id: id)
            }
        }
    }

    let scope: Scope
    @Environment(\.dismiss) private var dismiss
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

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Ask")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Text(scope.label)
                    .font(Brand.display(size: 18))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(Brand.surface))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    if messages.isEmpty && partial.isEmpty {
                        emptyHint
                            .padding(.top, 40)
                    }
                    ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                        bubble(role: msg.role, text: msg.content)
                    }
                    if !partial.isEmpty {
                        bubble(role: "assistant", text: partial)
                            .id("partial")
                    }
                    if let error {
                        Text(error)
                            .font(Brand.body(size: 12))
                            .foregroundStyle(Brand.microRed)
                            .padding(.horizontal, 16)
                    }
                    Color.clear.frame(height: 12).id("BOTTOM")
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
            .onChange(of: messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.18)) {
                    proxy.scrollTo("BOTTOM", anchor: .bottom)
                }
            }
            .onChange(of: partial) { _, _ in
                proxy.scrollTo("BOTTOM", anchor: .bottom)
            }
        }
    }

    private var emptyHint: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Try")
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1)
                .foregroundStyle(Brand.textFaint)
            VStack(alignment: .leading, spacing: 6) {
                hintLine("What have I been thinking about lately?")
                hintLine("Summarise the bundle in three bullets.")
                hintLine("What's the strongest argument across these notes?")
            }
        }
        .padding(.horizontal, 2)
    }

    private func hintLine(_ text: String) -> some View {
        Button {
            input = text
            inputFocused = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.microInfo)
                Text(text)
                    .font(Brand.body(size: 13))
                    .foregroundStyle(Brand.textPrimary)
                    .multilineTextAlignment(.leading)
                Spacer()
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Brand.surface)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func bubble(role: String, text: String) -> some View {
        let isUser = role == "user"
        HStack(alignment: .top, spacing: 8) {
            if isUser { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 4) {
                Text(isUser ? "YOU" : "ASSISTANT")
                    .font(Brand.mono(size: 8, weight: .medium))
                    .tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Text(text)
                    .font(Brand.body(size: 14))
                    .foregroundStyle(Brand.textPrimary)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(isUser ? Brand.surface : Color.clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(isUser ? Brand.borderDim : Color.clear, lineWidth: 1)
                    )
            )
            if !isUser { Spacer(minLength: 40) }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Ask anything…", text: $input, axis: .vertical)
                .focused($inputFocused)
                .font(Brand.body(size: 14))
                .lineLimit(1...5)
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Brand.surface)
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                )
            Button { Task { await send() } } label: {
                Image(systemName: sending ? "stop.fill" : "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(canSend || sending ? Brand.background : Brand.textFaint)
                    .frame(width: 38, height: 38)
                    .background(Circle().fill(canSend || sending ? Brand.textPrimary : Brand.surface))
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

    private func send() async {
        let q = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !sending else { return }
        input = ""
        sending = true
        error = nil
        // Push the user's message immediately so it appears
        // before the streaming response starts.
        let userMsg = APIClient.ChatMessage(role: "user", content: q)
        messages.append(userMsg)
        // Build history excluding the just-pushed user message
        // (the endpoint takes that as the live `message` field).
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

#Preview {
    ChatSheet(scope: .hub(slug: "demo", title: "Your hub"))
        .preferredColorScheme(.dark)
}
