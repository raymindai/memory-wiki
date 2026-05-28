// BrandLoader — the canonical loading affordance. Replaces
// ProgressView / shimmer skeletons across the app so every wait
// state reads as the brand instead of UIKit chrome.
//
// Animated morph blob (the same artwork the auth hero uses) over
// a faint mono "LOADING" caption. Compact variant for inline use
// (timeline empty state, doc body in flight); full-screen variant
// for boot.

import SwiftUI

struct BrandLoader: View {
    enum Variant {
        case inline       // bigger blob + caption — empty list / body in flight
        case full         // largest blob + caption — app boot
    }
    var variant: Variant = .inline
    var caption: String = "LOADING"

    // Larger sizes per the brand-loader feedback — the previous
    // 56/96pt blobs felt timid; bump for presence.
    private var size: CGFloat { variant == .full ? 140 : 96 }

    var body: some View {
        VStack(spacing: 18) {
            AnimatedBlob(size: size, theme: .dark)
            Text(caption)
                .font(Brand.mono(size: 10, weight: .medium))
                .tracking(1.4)
                .foregroundStyle(Brand.textFaint)
        }
        // Anchor TOP — sits inside the content area rather than
        // dead-centering the whole screen. Caller wraps in a
        // VStack with whatever header offset the surface uses.
        .frame(maxWidth: .infinity, alignment: .top)
        .padding(.top, 40)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading")
    }
}

#Preview {
    ZStack {
        Brand.background.ignoresSafeArea()
        BrandLoader()
    }
}
