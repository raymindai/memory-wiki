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
            title: "From any app, in two taps.",
            body: "iOS Share Sheet → Memory.Wiki. Selection, page, URL — anything you can share lands as a doc in your hub.",
            glyph: "square.and.arrow.up"
        ),
        Card(
            label: "02 / USE",
            title: "One URL, every AI.",
            body: "Paste memory.wiki/@you into Claude, ChatGPT, or Cursor. They all fetch the same markdown.",
            glyph: "sparkles"
        ),
        Card(
            label: "03 / EDIT",
            title: "Read on mobile, edit on web.",
            body: "iOS keeps capture + reading fast. Memory.Wiki on the web is the canonical editor — open any doc there for the full surface.",
            glyph: "arrow.up.right.square"
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
    let label: String
    let title: String
    let body: String
    let glyph: String
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
