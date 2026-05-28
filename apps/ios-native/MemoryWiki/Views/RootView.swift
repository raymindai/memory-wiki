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

                    // All five tab views stay mounted across tab
                    // switches. Previous `switch` rebuilt the active
                    // view on every selection — destroying its
                    // @StateObject and forcing a refetch on the
                    // next visit, which is what made the app feel
                    // "load on every tap." ZStack + opacity keeps
                    // each model alive; hit testing is gated so
                    // hidden tabs don't intercept taps. Memory cost
                    // is modest (~five NavigationStacks).
                    ZStack {
                        StartView()
                            .opacity(router.selectedTab == .start ? 1 : 0)
                            .allowsHitTesting(router.selectedTab == .start)
                        TimelineView()
                            .opacity(router.selectedTab == .timeline ? 1 : 0)
                            .allowsHitTesting(router.selectedTab == .timeline)
                        BundlesView()
                            .opacity(router.selectedTab == .bundles ? 1 : 0)
                            .allowsHitTesting(router.selectedTab == .bundles)
                        CaptureView()
                            .opacity(router.selectedTab == .capture ? 1 : 0)
                            .allowsHitTesting(router.selectedTab == .capture)
                        ProfileView()
                            .opacity(router.selectedTab == .profile ? 1 : 0)
                            .allowsHitTesting(router.selectedTab == .profile)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    // iOS 26 floating-glass paradigm: content extends
                    // edge-to-edge behind the tab bar (the blur
                    // strip reveals what's underneath), but scrollable
                    // children get an extra ~88pt of bottom safe-area
                    // inset so the LAST row can actually scroll above
                    // the bar — otherwise content sat permanently
                    // hidden under the floating capsule. SwiftUI
                    // automatically propagates this inset to inner
                    // ScrollView / List.
                    // Each tab now declares its own .safeAreaInset
                    // (50pt) inside its NavigationStack, since the
                    // parent inset wasn't propagating reliably
                    // through NavigationStack's coordinate space —
                    // only Start (which had explicit bottom padding
                    // in its ScrollView) was clearing the tab bar.

                    // Floating-glass tab bar isolation strip — sits
                    // ABOVE content but BELOW the tab bar in the
                    // ZStack. Two layers stacked:
                    //   1. .ultraThinMaterial behind a top-→-bottom
                    //      black mask so the blur ramps in toward
                    //      the bottom (zero blur at top edge, full
                    //      blur by the home indicator).
                    //   2. Dark gradient on top so content fades to
                    //      Brand.background, giving the tab bar a
                    //      clear ink-on-dark backdrop regardless of
                    //      what's scrolled underneath.
                    // Extends past the safe-area bottom so the home-
                    // indicator zone is part of the strip, not a
                    // hard cutoff.
                    if !keyboardUp {
                        BottomFadeStrip()
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                            .ignoresSafeArea(.container, edges: .bottom)
                            .allowsHitTesting(false)
                    }
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
            // Sized so the blob feels like the centre hero
            // without overwhelming the bar — tuned down from
            // 48pt per user feedback.
            AnimatedBlob(size: 38, theme: .dark)
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

/// Floating "liquid glass" tab bar in the iOS 26 native style —
/// capsule shape, ultraThinMaterial fill, hairline border, sits
/// inset from the screen edges instead of spanning edge-to-edge.
/// Replaces the older full-width bordered strip.
private struct BrandTabBar: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var router: AppRouter
    @Binding var selected: AppTab
    /// Bumped when the user taps the active tab while it's already
    /// at root — drives the horizontal shake on the whole bar.
    @State private var shakeCount: CGFloat = 0

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                Button {
                    handleTap(tab)
                } label: {
                    VStack(spacing: tab == .start ? 1 : 3) {
                        glyph(for: tab)
                            .font(.system(size: 16, weight: .regular))
                            .frame(height: tab == .start ? 38 : 26)
                        if tab != .start {
                            Text(tab.label)
                                .font(Brand.mono(size: 9, weight: .medium))
                                .tracking(0.5)
                                .textCase(.uppercase)
                        }
                        Rectangle()
                            .fill(selected == tab ? Brand.textPrimary : Color.clear)
                            .frame(width: 14, height: 1)
                    }
                    .foregroundStyle(selected == tab ? Brand.textPrimary : Brand.textFaint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, tab == .start ? 6 : 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .background(
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(
                    Capsule(style: .continuous)
                        .strokeBorder(Brand.borderDim, lineWidth: 0.5)
                )
                .shadow(color: Color.black.opacity(0.35), radius: 18, x: 0, y: 6)
        )
        .clipShape(Capsule(style: .continuous))
        .padding(.horizontal, 12)
        .padding(.bottom, 4)
        // Horizontal shake when the user re-taps the active tab
        // while already at root — visual companion to the warning
        // haptic so the input feels acknowledged instead of dead.
        .modifier(ShakeEffect(animatableData: shakeCount))
    }

    /// iOS-native pattern: tapping the active tab pops its
    /// navigation stack back to root; tapping while already at
    /// root fires a heavier haptic so the user gets feedback that
    /// the tap was registered (matches Mail, Safari, Settings).
    private func handleTap(_ tab: AppTab) {
        if selected == tab {
            // Already on this tab — try to pop its nav stack.
            let popped: Bool = {
                switch tab {
                case .timeline:
                    if !router.timelinePath.isEmpty {
                        router.timelinePath = []
                        return true
                    }
                case .bundles:
                    if !router.bundlesPath.isEmpty {
                        router.bundlesPath = []
                        return true
                    }
                default: break
                }
                return false
            }()
            if popped {
                Haptics.selection()
            } else {
                // Already at root — explicit feedback that the
                // tap was registered (otherwise it's silent and
                // feels broken). Visual shake + warning haptic.
                Haptics.warning()
                withAnimation(.easeInOut(duration: 0.32)) {
                    shakeCount += 1
                }
            }
        } else {
            Haptics.selection()
            selected = tab
        }
    }

    /// .profile tab paints the user's avatar (small circle) when
    /// available — everything else falls through to the static
    /// AppTab.glyph mapping. Done here rather than in AppTab so the
    /// enum stays free of EnvironmentObject coupling.
    @ViewBuilder
    private func glyph(for tab: AppTab) -> some View {
        switch tab {
        case .profile:
            ProfileTabAvatar(
                avatarURL: auth.session.flatMap { $0.avatarURL },
                isActive: selected == .profile
            )
        default:
            tab.glyph
        }
    }
}

/// 22pt circle avatar with a subtle ink ring when the tab is
/// active. Falls back to the SF person glyph when no avatar URL
/// exists (signed-in user without an uploaded picture yet).
private struct ProfileTabAvatar: View {
    let avatarURL: URL?
    let isActive: Bool

    var body: some View {
        Group {
            if let url = avatarURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFill()
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: 22, height: 22)
        .clipShape(Circle())
        .overlay(
            Circle().strokeBorder(
                isActive ? Brand.textPrimary : Brand.borderDim,
                lineWidth: isActive ? 1.5 : 0.5
            )
        )
    }

    private var placeholder: some View {
        ZStack {
            Circle().fill(Brand.surface)
            Image(systemName: "person.fill")
                .font(.system(size: 11))
                .foregroundStyle(Brand.textMuted)
        }
    }
}

/// Horizontal shake — used by the tab bar when the user taps the
/// active tab while it's already at root. Three left/right cycles
/// of ±6pt translation; ties into a withAnimation block by binding
/// `animatableData` to a state counter that the caller increments.
private struct ShakeEffect: GeometryEffect {
    var amount: CGFloat = 6
    var shakesPerUnit: CGFloat = 3
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        let x = amount * sin(animatableData * .pi * shakesPerUnit)
        return ProjectionTransform(CGAffineTransform(translationX: x, y: 0))
    }
}

/// Bottom-of-screen blur + dark fade backing for the floating
/// tab bar. Two stacked layers:
///   1. .ultraThinMaterial, masked with a vertical gradient so the
///      blur ramps from invisible at the top edge to full strength
///      at the home indicator. Content scrolled under the strip
///      stays legible at the top, gets progressively de-emphasised
///      toward the tab bar.
///   2. A dark fade (clear → Brand.background) painted on top so
///      the tab bar always sits over an ink-on-dark backdrop, no
///      matter what's underneath.
/// 200pt tall to give the ramp room to breathe.
private struct BottomFadeStrip: View {
    var body: some View {
        ZStack {
            // BLUR layer — ultraThinMaterial in dark mode reads as a
            // translucent dark frost, not the gray/white wash that
            // .thickMaterial gave. Masked with a vertical gradient
            // so blur intensity ramps in toward the bottom; content
            // above the strip stays sharp.
            // Blur — slightly stronger but still ultraThin (dark
            // frost, not gray). Mask lets it ramp from 0 at the
            // top to ~80% at the bottom so content behind the
            // home indicator goes properly out of focus.
            Rectangle()
                .fill(.ultraThinMaterial)
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: Color.black.opacity(0),    location: 0.00),
                            .init(color: Color.black.opacity(0.30), location: 0.30),
                            .init(color: Color.black.opacity(0.65), location: 0.55),
                            .init(color: Color.black.opacity(0.80), location: 1.00)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            // Black tint capped at 0.65 — dark glass look without
            // hiding content behind it.
            LinearGradient(
                stops: [
                    .init(color: Color.black.opacity(0.00), location: 0.00),
                    .init(color: Color.black.opacity(0.22), location: 0.30),
                    .init(color: Color.black.opacity(0.48), location: 0.55),
                    .init(color: Color.black.opacity(0.65), location: 1.00)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .frame(height: 130)
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
