// RootView — the signed-in app shell. Custom tab bar (not the
// stock TabView style) so the chrome matches the web's quiet
// bordered-row look: ink labels, hairline divider on top, lime
// reserved for the active tab's tiny dot indicator.

import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var router: AppRouter
    /// One-shot first-launch onboarding flag — set true the first
    /// time the user dismisses OnboardingView.
    @AppStorage("mw.onboarded") private var onboarded: Bool = false
    @State private var onboardingDone: Bool = false

    var body: some View {
        Group {
            if auth.isSignedIn {
                ZStack(alignment: .bottom) {
                    Brand.background.ignoresSafeArea()

                    Group {
                        switch router.selectedTab {
                        case .timeline: TimelineView()
                        case .bundles:  BundlesView()
                        case .capture:  CaptureView()
                        case .profile:  ProfileView()
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.bottom, 56) // tab-bar height

                    BrandTabBar(selected: $router.selectedTab)
                }
            } else {
                AuthView()
            }
        }
        .animation(.snappy(duration: 0.22), value: auth.isSignedIn)
        // Onboarding overlay — first signed-in launch only.
        .fullScreenCover(isPresented: shouldShowOnboarding) {
            OnboardingView(done: $onboardingDone)
                .onChange(of: onboardingDone) { _, new in
                    if new { onboarded = true; onboardingDone = false }
                }
                .preferredColorScheme(.dark)
        }
    }

    private var shouldShowOnboarding: Binding<Bool> {
        Binding(
            get: { auth.isSignedIn && !onboarded },
            set: { _ in }
        )
    }
}

enum AppTab: String, CaseIterable {
    case timeline, bundles, capture, profile

    var label: String {
        switch self {
        case .timeline: return "Timeline"
        case .bundles:  return "Bundles"
        case .capture:  return "Capture"
        case .profile:  return "Settings"
        }
    }

    /// Single-line glyph drawn in code (no SF Symbol). Matches the
    /// web's small line-icon vocabulary in the editor toolbar.
    @ViewBuilder var glyph: some View {
        switch self {
        case .timeline:
            Image(systemName: "list.bullet")
        case .bundles:
            Image(systemName: "square.stack.3d.up")
        case .capture:
            Image(systemName: "plus")
        case .profile:
            Image(systemName: "person")
        }
    }
}

private struct BrandTabBar: View {
    @Binding var selected: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                Button {
                    selected = tab
                } label: {
                    VStack(spacing: 3) {
                        tab.glyph
                            .font(.system(size: 16, weight: .regular))
                        Text(tab.label)
                            .font(Brand.mono(size: 9, weight: .medium))
                            .tracking(0.5)
                            .textCase(.uppercase)
                        // Active indicator — ink hairline, no lime.
                        // Pure design: brand chrome stays grayscale,
                        // accent only earns its keep for status.
                        Rectangle()
                            .fill(selected == tab ? Brand.textPrimary : Color.clear)
                            .frame(width: 14, height: 1)
                    }
                    .foregroundStyle(selected == tab ? Brand.textPrimary : Brand.textFaint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .background(
            Brand.background
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(Brand.borderDim)
                        .frame(height: 1)
                }
        )
    }
}

#Preview {
    RootView()
        .environmentObject(AuthManager.preview())
}
