// BrandTheme — single source of truth for colors, typography, and
// spacing on iOS. Mirrors the web's globals.css token set (dark
// zinc + lime, JetBrains Mono for mono labels, Cal Sans for
// display, Noto Sans for body) so the iOS surface reads as one
// product with the web.
//
// Rules of thumb (from the v8 color-balance feedback memo):
//   - Body / chips / buttons stay INK (--text-primary on
//     --background or --surface). Lime accent only in small dots,
//     badges, micro-icons.
//   - No system blue, no SF Symbol-only affordances, no rounded
//     "system" buttons. Everything renders against the brand
//     tokens below.

import SwiftUI
import UIKit

enum Brand {
    // MARK: - Color tokens (mirrors globals.css [data-theme="dark"])

    /// Page background — zinc-950-ish. The deepest tone, used for
    /// the app shell and screens that aren't elevated cards.
    static let background = Color(hex: 0x09090B)

    /// Even darker — used by the bundle viewer's split-pane canvas
    /// on the web. We use it for the navigation chrome behind the
    /// content so it reads as one layer back.
    static let canvas     = Color(hex: 0x070708)

    /// Card / row surface — zinc-900. Anything that "sits above"
    /// the background uses this fill.
    static let surface    = Color(hex: 0x18181B)

    /// Hairline borders + the quiet ring around inactive controls.
    static let border     = Color(hex: 0x2D2D31)
    static let borderDim  = Color(hex: 0x27272A).opacity(0.6)

    /// Toggle hover / pressed background.
    static let toggleBg   = Color(hex: 0x18181B).opacity(0.8)

    static let textPrimary   = Color(hex: 0xFAFAFA)
    static let textSecondary = Color(hex: 0xC4C4C9)
    static let textMuted     = Color(hex: 0xA1A1AA)
    static let textFaint     = Color(hex: 0x8A8A91)

    /// Lime — the v8 default accent. Use ONLY for small dots,
    /// micro-badges, status indicators. Body text + buttons +
    /// chips stay ink per the v8 color-balance rule.
    static let accent     = Color(hex: 0xB5FF1A)
    static let accentDim  = Color(hex: 0xB5FF1A).opacity(0.15)

    /// Micro-color tokens (mirrors --micro-*). Each one signals a
    /// status, never a brand. Use sparingly.
    static let microInfo  = Color(hex: 0x60A5FA)
    static let microWarn  = Color(hex: 0xFBBF24)
    static let microRed   = Color(hex: 0xEF4444)
    static let microLime  = Color(hex: 0xB5FF1A)

    // MARK: - Typography

    /// Cal Sans 600 — the display face for app-name and large H1.
    /// Falls back to system rounded if the bundled font fails to
    /// register (CI / non-iOS targets).
    static func display(size: CGFloat) -> Font {
        if UIFont(name: "CalSans-Regular", size: size) != nil {
            return Font.custom("CalSans-Regular", size: size)
        }
        return Font.system(size: size, weight: .semibold, design: .rounded)
    }

    /// Noto Sans — the body face. Most prose, list rows, form
    /// labels. Weights: 400 / 500 / 600.
    static func body(size: CGFloat = 15, weight: Font.Weight = .regular) -> Font {
        let suffix: String
        switch weight {
        case .semibold, .bold, .heavy, .black: suffix = "SemiBold"
        case .medium: suffix = "Medium"
        default: suffix = "Regular"
        }
        let name = "NotoSans-\(suffix)"
        if UIFont(name: name, size: size) != nil {
            return Font.custom(name, size: size)
        }
        return Font.system(size: size, weight: weight)
    }

    /// JetBrains Mono — the mono face. URL display, faint
    /// uppercase captions, numbers in lists.
    static func mono(size: CGFloat = 11, weight: Font.Weight = .regular) -> Font {
        let name = weight == .medium ? "JetBrainsMono-Medium" : "JetBrainsMono-Regular"
        if UIFont(name: name, size: size) != nil {
            return Font.custom(name, size: size)
        }
        return Font.system(size: size, weight: weight, design: .monospaced)
    }

    // MARK: - Common shapes

    /// Standard quiet button — ink text on the surface fill with a
    /// hairline border. Use for the primary CTA on each screen.
    /// Lime stays out of the button per the color-balance rule.
    struct QuietButtonStyle: ButtonStyle {
        var prominent: Bool = false
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .font(Brand.body(size: 15, weight: .medium))
                .foregroundStyle(prominent ? Brand.background : Brand.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(prominent ? Brand.textPrimary : Brand.surface)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(prominent ? .clear : Brand.border, lineWidth: 1)
                )
                .opacity(configuration.isPressed ? 0.82 : 1)
                .animation(.snappy(duration: 0.12), value: configuration.isPressed)
        }
    }
}

// MARK: - Hex helper

extension Color {
    /// Init from an `0xRRGGBB` literal. Keeps the BrandTheme call
    /// sites compact and lets us paste hex values from the web
    /// CSS without converting.
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
