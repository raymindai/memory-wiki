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
    @StateObject private var router = AppRouter.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(router)
                .onOpenURL { url in
                    // memorywiki:// — two flavours:
                    //   auth-callback → AuthManager
                    //   doc/bundle/capture/profile → AppRouter
                    if url.host == "auth-callback" {
                        Task { await auth.handleCallback(url: url) }
                    } else {
                        router.handle(url: url)
                    }
                }
        }
    }
}
