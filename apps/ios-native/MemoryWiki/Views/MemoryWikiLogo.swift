// MemoryWikiLogo — port of the web's canonical MemoryWikiLogo.tsx.
// Brand v2 lockup: mwblob_morph mark on the left, "memory.wiki"
// wordmark on the right, single line, mark scales relative to
// wordmark cap-height.
//
// Strict notes from the web spec:
//   - Wordmark is LOWERCASE ("memory.wiki"), Cal Sans 500.
//   - Wordmark colour is --text-primary (ink) on dark, --text-primary
//     (ink) on light. No lime split anywhere.
//   - Mark is the morph SVG (`mwblob`), white version on dark.
//   - Mark size = wordmark size × 1.55 when wordmark <= 30, × 1.25 above.
//   - Gap = max(6, size × 0.35), same rhythm rule as the web.

import SwiftUI

struct MemoryWikiLogo: View {
    enum Variant { case full, textOnly, iconOnly }

    var size: CGFloat = 22
    var variant: Variant = .full

    private var iconSize: CGFloat {
        let scale: CGFloat = size <= 30 ? 1.55 : 1.25
        return size * scale
    }

    private var gap: CGFloat { max(6, size * 0.35) }

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: gap) {
            if variant != .textOnly {
                AnimatedBlob(size: iconSize, theme: colorScheme == .light ? .light : .dark)
            }
            if variant != .iconOnly {
                Text("memory.wiki")
                    .font(Brand.display(size: size))
                    .foregroundStyle(Brand.textPrimary)
                    .tracking(0)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Memory.Wiki")
    }
}

#Preview {
    ZStack {
        Brand.background.ignoresSafeArea()
        VStack(spacing: 36) {
            MemoryWikiLogo(size: 18)
            MemoryWikiLogo(size: 28)
            MemoryWikiLogo(size: 36)
            MemoryWikiLogo(size: 22, variant: .textOnly)
            MemoryWikiLogo(size: 22, variant: .iconOnly)
        }
    }
}
