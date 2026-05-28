// SplashView — the brand-led launch surface that sits between
// the static iOS UILaunchScreen (dark zinc) and the live
// RootView. Without it, the app went straight from a 200ms
// flash of LaunchBackground into the dashboard — felt
// snappy in a bad way, like a window slamming open.
//
// Now: an oversized animated blob fades + scales in over the
// dark canvas, holds for a beat, then cross-fades into the
// real chrome. Total dwell ≈ 1.0 s — short enough to feel
// instant, long enough to read as the brand greeting.

import SwiftUI

struct SplashView: View {
    @State private var appeared = false

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            VStack(spacing: 20) {
                AnimatedBlob(size: 196, theme: .dark)
                    .opacity(appeared ? 1 : 0)
                    .scaleEffect(appeared ? 1 : 0.86)
                    .animation(.spring(response: 0.95, dampingFraction: 0.78), value: appeared)
                VStack(spacing: 8) {
                    Text("memory.wiki")
                        .font(Brand.display(size: 26))
                        .foregroundStyle(Brand.textPrimary)
                        .opacity(appeared ? 0.92 : 0)
                        .offset(y: appeared ? 0 : 8)
                        .animation(.easeOut(duration: 0.55).delay(0.16), value: appeared)
                    // v6 product line — anchors the brand in the
                    // user's first half-second of attention.
                    Text("Knowledge hub for the age of AI")
                        .font(Brand.body(size: 12, weight: .regular))
                        .tracking(0.4)
                        .foregroundStyle(Brand.textMuted)
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : 6)
                        .animation(.easeOut(duration: 0.55).delay(0.28), value: appeared)
                }
            }
        }
        .onAppear { appeared = true }
    }
}
