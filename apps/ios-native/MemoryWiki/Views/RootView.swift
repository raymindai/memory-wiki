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
    /// Hide the tab bar entirely while the soft keyboard is up
    /// — the keyboard otherwise rides over the markdown toolbar
    /// AND the tab bar piles in above it (the user-reported mess).
    @State private var keyboardUp = false

    var body: some View {
        Group {
            if auth.isSignedIn {
                ZStack(alignment: .bottom) {
                    Brand.background.ignoresSafeArea()

                    Group {
                        switch router.selectedTab {
                        case .start:    StartView()
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
                        // Hide tab bar entirely while keyboard is
                        // up — otherwise iOS shoves it into the
                        // space between markdown toolbar and
                        // editor content (the screenshot mess).
                        if !keyboardUp {
                            BrandTabBar(selected: $router.selectedTab)
                                .transition(.opacity.combined(with: .move(edge: .bottom)))
                        }
                    }
                    .animation(.snappy(duration: 0.22), value: reachability.isOnline)
                    .animation(.snappy(duration: 0.22), value: keyboardUp)
                    .ignoresSafeArea(.keyboard, edges: .bottom)
                }
                // Force SwiftUI to fully tear down + rebuild the
                // signed-in surface when the user identity changes.
                // Without this @StateObject TimelineModel/BundlesModel
                // can survive a sign-out → sign-in-as-other cycle and
                // briefly show the previous account's docs.
                .id(auth.session?.userId ?? "anon")
            } else {
                AuthView()
            }
        }
        .animation(.snappy(duration: 0.22), value: auth.isSignedIn)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            keyboardUp = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardUp = false
        }
        .onReceive(NotificationCenter.default.publisher(for: .mwUserChanged)) { _ in
            // Wipe local-only per-user state on identity change +
            // reset the router so the next sign-in lands on the
            // Timeline (not whatever tab the previous user was on)
            // and clears any pushed detail screens from the old
            // navigation stacks.
            PinnedStore.shared.clearForUserChange()
            router.selectedTab = .timeline
            router.timelinePath = []
            router.bundlesPath = []
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
    // Order: MDs / Bundles / Start (centre) / Capture / Settings.
    // Centre slot gets the brand blob — it's the dashboard / hero
    // surface, visually anchoring the bar.
    case timeline, bundles, start, capture, profile

    var label: String {
        switch self {
        case .start:    return "Start"
        case .timeline: return "MDs"
        case .bundles:  return "Bundles"
        case .capture:  return "Capture"
        case .profile:  return "Settings"
        }
    }

    /// Single-line glyph drawn in code. Start tab uses the
    /// AnimatedBlob (real morph SVG) at a much larger size so
    /// it reads as the brand mark anchoring the centre of the
    /// tab bar; everything else stays SF Symbols.
    @ViewBuilder var glyph: some View {
        switch self {
        case .start:
            // Big enough to fill the no-caption cell. .font(...)
            // doesn't affect AnimatedBlob (WKWebView), so the
            // size has to come from the init parameter directly.
            AnimatedBlob(size: 48, theme: .dark)
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
                    VStack(spacing: tab == .start ? 1 : 3) {
                        tab.glyph
                            // .font only affects SF Symbols; the
                            // Start blob sizes itself via init.
                            .font(.system(size: 16, weight: .regular))
                            // Start cell is taller so the 48pt
                            // blob has room to breathe.
                            .frame(height: tab == .start ? 50 : 28)
                        // Other tabs render the mono caption; Start
                        // skips it entirely (blob is self-evident)
                        // so the indicator sits flush under it
                        // instead of where the empty caption was.
                        if tab != .start {
                            Text(tab.label)
                                .font(Brand.mono(size: 9, weight: .medium))
                                .tracking(0.5)
                                .textCase(.uppercase)
                        }
                        // Active indicator — ink hairline.
                        Rectangle()
                            .fill(selected == tab ? Brand.textPrimary : Color.clear)
                            .frame(width: 14, height: 1)
                    }
                    .foregroundStyle(selected == tab ? Brand.textPrimary : Brand.textFaint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, tab == .start ? 4 : 8)
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
