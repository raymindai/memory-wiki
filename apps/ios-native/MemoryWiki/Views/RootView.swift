// RootView — the signed-in app shell. Custom tab bar (not the
// stock TabView style) so the chrome matches the web's quiet
// bordered-row look: ink labels, hairline divider on top, lime
// reserved for the active tab's tiny dot indicator.

import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthManager
    @State private var selected: AppTab = .timeline

    var body: some View {
        Group {
            if auth.isSignedIn {
                ZStack(alignment: .bottom) {
                    Brand.background.ignoresSafeArea()

                    Group {
                        switch selected {
                        case .timeline: TimelineView()
                        case .capture:  CaptureView()
                        case .profile:  ProfileView()
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.bottom, 56) // tab-bar height

                    BrandTabBar(selected: $selected)
                }
            } else {
                AuthView()
            }
        }
        .animation(.snappy(duration: 0.22), value: auth.isSignedIn)
    }
}

enum AppTab: String, CaseIterable {
    case timeline, capture, profile

    var label: String {
        switch self {
        case .timeline: return "Timeline"
        case .capture:  return "Capture"
        case .profile:  return "Profile"
        }
    }

    /// Single-line glyph drawn in code (no SF Symbol). Matches the
    /// web's small line-icon vocabulary in the editor toolbar.
    @ViewBuilder var glyph: some View {
        switch self {
        case .timeline:
            Image(systemName: "list.bullet")
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
                        // Active indicator — the only lime in the
                        // chrome. Tiny dot, ink elsewhere.
                        Circle()
                            .fill(selected == tab ? Brand.accent : Color.clear)
                            .frame(width: 3, height: 3)
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
