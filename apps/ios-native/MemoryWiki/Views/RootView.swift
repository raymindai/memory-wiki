// RootView — the signed-in app shell. Custom tab bar (not the
// stock TabView style) so the chrome matches the web's quiet
// bordered-row look: ink labels, hairline divider on top, lime
// reserved for the active tab's tiny dot indicator.

import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var router: AppRouter
    @StateObject private var reachability = Reachability.shared
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

                    VStack(spacing: 0) {
                        if !reachability.isOnline {
                            OfflineBanner()
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                        }
                        BrandTabBar(selected: $router.selectedTab)
                    }
                    .animation(.snappy(duration: 0.22), value: reachability.isOnline)
                }
            } else {
                AuthView()
            }
        }
        .animation(.snappy(duration: 0.22), value: auth.isSignedIn)
        .onReceive(NotificationCenter.default.publisher(for: .mwUserChanged)) { _ in
            // Wipe local-only per-user state on identity change.
            PinnedStore.shared.clearForUserChange()
        }
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
                        // Wrap with LocalizedStringKey so SwiftUI
                        // looks the value up in Localizable.strings
                        // instead of taking the verbatim path that
                        // the (String) initializer would.
                        Text(LocalizedStringKey(tab.label))
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

/// Thin status strip above the tab bar — only visible when
/// NWPathMonitor reports a downed network. Informational, not a
/// blocker: the app keeps reading cached data, saves are queued
/// by URLSession + retried on reconnect.
private struct OfflineBanner: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Brand.textMuted)
            Text("OFFLINE")
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.0)
                .foregroundStyle(Brand.textMuted)
            Text("Showing cached data")
                .font(Brand.body(size: 11))
                .foregroundStyle(Brand.textFaint)
            Spacer()
        }
        .padding(.horizontal, 14).padding(.vertical, 7)
        .background(Brand.surface)
        .overlay(alignment: .top) {
            Rectangle().fill(Brand.borderDim).frame(height: 1)
        }
    }
}

#Preview {
    RootView()
        .environmentObject(AuthManager.preview())
}
