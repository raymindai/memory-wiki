// RootView — top-level shell. Renders TabView when signed in,
// AuthView when not. Tab order matches the v8 capture → organize
// → use flow: Timeline (organize/read), Capture (write), Profile
// (use surface — the /@<slug> URL the user shares with AI tools).

import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthManager

    var body: some View {
        Group {
            if auth.isSignedIn {
                TabView {
                    TimelineView()
                        .tabItem { Label("Timeline", systemImage: "clock") }
                    CaptureView()
                        .tabItem { Label("Capture", systemImage: "plus.circle.fill") }
                    ProfileView()
                        .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                }
            } else {
                AuthView()
            }
        }
        .animation(.snappy(duration: 0.25), value: auth.isSignedIn)
    }
}

#Preview {
    RootView()
        .environmentObject(AuthManager.preview())
}
