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
        case inline       // 56pt blob + caption — empty list / body in flight
        case full         // 96pt blob + caption — app boot
    }
    var variant: Variant = .inline
    var caption: String = "LOADING"

    private var size: CGFloat { variant == .full ? 96 : 56 }

    var body: some View {
        VStack(spacing: 14) {
            AnimatedBlob(size: size, theme: .dark)
            Text(caption)
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.2)
                .foregroundStyle(Brand.textFaint)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
