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
        // Centre vertically + horizontally INSIDE whatever space
        // the caller hands us. Spacers + maxHeight: .infinity
        // means the blob+caption land in the middle of the
        // available content area — header / filter strip stays
        // put at the top, only the loader moves to centre.
        VStack(spacing: 18) {
            Spacer(minLength: 0)
            AnimatedBlob(size: size, theme: .dark)
            Text(caption)
                .font(Brand.mono(size: 10, weight: .medium))
                .tracking(1.4)
                .foregroundStyle(Brand.textFaint)
            Spacer(minLength: 0)
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
