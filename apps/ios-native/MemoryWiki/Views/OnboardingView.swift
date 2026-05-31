// OnboardingView — three-card first-launch explainer. Surfaces
// the iOS-companion thesis without making the user read a
// landing page:
//
//   1. Capture from anywhere via the iOS Share Sheet
//   2. Your URL works in every AI
//   3. The web is the canonical editor
//
// Shown only on the first signed-in session. UserDefaults flag
// `mw.onboarded` flips when the user dismisses or finishes.

import SwiftUI

struct OnboardingView: View {
    @Binding var done: Bool
    @State private var page = 0

    private let cards: [Card] = [
        Card(
            label: "01 / CAPTURE",
            title: "Save anything, in one tap.",
            body: "From Safari, Notes, a photo, a thought spoken out loud. Every input becomes a memory in your hub. Never lose an idea to “I'll write that down later.”",
            glyph: "square.and.arrow.up"
        ),
        Card(
            label: "02 / FEED YOUR AI",
            title: "Stop re-explaining yourself.",
            body: "Paste memory.wiki/@you into Claude, ChatGPT, Cursor. They all read the same memory. One link, every model already knows who you are and what you've learned.",
            glyph: "sparkles"
        ),
        Card(
            label: "03 / ALWAYS WITHIN REACH",
            title: "Your hub follows you everywhere.",
            body: "Home-screen widget, Siri voice capture, Spotlight search, Shortcuts. iOS keeps your memory one tap away. Full editor + collaboration + bundles live on the web.",
            glyph: "iphone.gen3"
        ),
    ]

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            // Subtle ambient blob behind everything — same
            // treatment AuthView uses for brand continuity.
            GeometryReader { proxy in
                let dim = max(proxy.size.width, proxy.size.height) * 0.95
                AnimatedBlob(size: dim, theme: .dark)
                    .opacity(0.06)
                    .blur(radius: 10)
                    .frame(width: proxy.size.width, height: proxy.size.height)
            }
            .ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                TabView(selection: $page) {
                    ForEach(cards.indices, id: \.self) { i in
                        CardView(card: cards[i]).tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                pageDots
                actions
                    .padding(.horizontal, 22)
                    .padding(.bottom, 28)
            }
        }
    }

    // MARK: chrome

    private var topBar: some View {
        HStack {
            MemoryWikiLogo(size: 18)
            Spacer()
            Button("Skip") { dismiss() }
                .font(Brand.body(size: 13, weight: .medium))
                .foregroundStyle(Brand.textMuted)
        }
        .padding(.horizontal, 22)
        .padding(.top, 22)
    }

    private var pageDots: some View {
        HStack(spacing: 8) {
            ForEach(cards.indices, id: \.self) { i in
                Capsule()
                    .fill(i == page ? Brand.textPrimary : Brand.border)
                    .frame(width: i == page ? 18 : 6, height: 4)
                    .animation(.snappy(duration: 0.22), value: page)
            }
        }
        .padding(.vertical, 18)
    }

    private var actions: some View {
        Button {
            if page < cards.count - 1 {
                withAnimation(.snappy(duration: 0.25)) { page += 1 }
            } else {
                dismiss()
            }
        } label: {
            Text(page < cards.count - 1 ? "Next" : "Start capturing")
                .font(Brand.body(size: 15, weight: .semibold))
                .foregroundStyle(Brand.background)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Brand.textPrimary))
        }
        .buttonStyle(.plain)
    }

    private func dismiss() {
        UserDefaults.standard.set(true, forKey: "mw.onboarded")
        withAnimation(.snappy(duration: 0.3)) { done = true }
    }
}

private struct Card: Hashable {
    let label: LocalizedStringKey
    let title: LocalizedStringKey
    let body: LocalizedStringKey
    let glyph: String
    /// Stable identity for SwiftUI's diffing — LocalizedStringKey
    /// isn't comparable by literal value, so we hash on the glyph
    /// (each card has a unique system image).
    func hash(into hasher: inout Hasher) { hasher.combine(glyph) }
    static func == (lhs: Card, rhs: Card) -> Bool { lhs.glyph == rhs.glyph }
}

private struct CardView: View {
    let card: Card
    var body: some View {
        VStack(spacing: 22) {
            Spacer()
            Image(systemName: card.glyph)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Brand.textPrimary)
                .padding(.bottom, 8)
            Text(card.label)
                .font(Brand.mono(size: 10, weight: .medium))
                .tracking(1.4)
                .foregroundStyle(Brand.textFaint)
            Text(card.title)
                .font(Brand.display(size: 30))
                .foregroundStyle(Brand.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
                .fixedSize(horizontal: false, vertical: true)
            Text(card.body)
                .font(Brand.body(size: 15))
                .foregroundStyle(Brand.textMuted)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 32)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            Spacer()
        }
        .padding(.horizontal, 14)
    }
}

#Preview {
    OnboardingView(done: .constant(false))
}
