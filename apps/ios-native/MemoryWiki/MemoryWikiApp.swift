// MemoryWiki — iOS app entry. v8 W9 scaffold.
//
// Single Scene, root NavigationStack hosting the TabView with
// Timeline / Capture / Profile tabs. The auth state lives in a
// shared @StateObject so child views can react to sign-in/out
// without prop-drilling.

import SwiftUI

@main
struct MemoryWikiApp: App {
    @StateObject private var auth = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .onOpenURL { url in
                    // memorywiki:// callback from the web sign-in
                    // flow. AuthManager strips the token + writes
                    // to the keychain; subsequent API calls pick
                    // it up automatically.
                    Task { await auth.handleCallback(url: url) }
                }
        }
    }
}
