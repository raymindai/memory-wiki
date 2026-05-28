// Skeleton — placeholder list rows + small surfaces shown
// during the first paint of any list-shaped tab (Timeline,
// Bundles, Start). Replaces the centred spinner that used to
// snap-fill the screen; skeleton rows convey "this is where the
// content goes" so the layout doesn't shift jarringly when real
// data arrives.
//
// All skeletons share a soft shimmer (animated linear-gradient
// across the placeholder shape) so they feel alive rather than
// frozen — the standard iOS 26 / macOS pattern.

import SwiftUI

/// Single row skeleton — title bar + meta line + status pill, all
/// rendered as muted surface fills. Used for TimelineView and
/// BundlesView first-paint.
struct SkeletonRow: View {
    var body: some View {
        HStack(spacing: 12) {
            // Status-icon placeholder
            Circle()
                .fill(Brand.surface)
                .frame(width: 22, height: 22)
                .modifier(ShimmerModifier())
            VStack(alignment: .leading, spacing: 8) {
                // Title bar
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(Brand.surface)
                    .frame(height: 12)
                    .frame(maxWidth: .infinity)
                    .modifier(ShimmerModifier())
                // Meta line — narrower
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(Brand.surface)
                    .frame(width: 130, height: 9)
                    .modifier(ShimmerModifier())
            }
            Spacer(minLength: 6)
            // Time chip placeholder
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(Brand.surface)
                .frame(width: 36, height: 9)
                .modifier(ShimmerModifier())
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(Brand.borderDim, lineWidth: 0.5))
        )
    }
}

/// Vertical stack of N SkeletonRows — caller chooses how many to
/// fill the visible viewport without scrolling. Defaults to 6 for
/// timeline density.
struct SkeletonList: View {
    var count: Int = 6
    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<count, id: \.self) { _ in
                SkeletonRow()
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 4)
    }
}

/// Compact stat-tile placeholder — used by StartView's hero strip
/// while the document/bundle counts hydrate. Same shape as
/// HubStatTile so the swap is geometric, not jarring.
struct SkeletonStatStrip: View {
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            ForEach(0..<3, id: \.self) { i in
                VStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(Brand.surface)
                        .frame(width: 38, height: 22)
                        .modifier(ShimmerModifier())
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(Brand.surface)
                        .frame(width: 56, height: 8)
                        .modifier(ShimmerModifier())
                }
                .frame(maxWidth: .infinity)
                if i < 2 {
                    Rectangle()
                        .fill(Brand.borderDim)
                        .frame(width: 0.5, height: 28)
                }
            }
        }
        .padding(.vertical, 14)
    }
}

/// Shimmer — a moving sheen across the placeholder surface so it
/// reads as "loading" instead of "permanently empty". Uses a
/// repeating linear gradient mask animation that respects the
/// system Reduce Motion accessibility setting (static fill in
/// that case to avoid vestibular discomfort).
struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content
                .overlay(
                    GeometryReader { geo in
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0),
                                Color.white.opacity(0.08),
                                Color.white.opacity(0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geo.size.width * 1.5)
                        .offset(x: phase * geo.size.width)
                    }
                    .mask(content)
                )
                .onAppear {
                    withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                        phase = 1.5
                    }
                }
        }
    }
}

/// Stale-while-revalidate header indicator — small dot + tiny
/// "refreshing" caption that appears when a background load is
/// running over already-displayed data. Used by the tab headers
/// so the user knows fresh data is on the way without losing the
/// current view.
struct RefreshingPip: View {
    var body: some View {
        HStack(spacing: 5) {
            ProgressView()
                .scaleEffect(0.5)
                .tint(Brand.textFaint)
                .frame(width: 10, height: 10)
            Text("REFRESHING")
                .font(Brand.mono(size: 8, weight: .medium))
                .tracking(1.0)
                .foregroundStyle(Brand.textFaint)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.9, anchor: .leading)))
    }
}
