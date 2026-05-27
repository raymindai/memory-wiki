// MemoryWiki — iOS app entry. v8 W9 scaffold.
//
// Single Scene, root NavigationStack hosting the TabView with
// Timeline / Capture / Profile tabs. The auth state lives in a
// shared @StateObject so child views can react to sign-in/out
// without prop-drilling.

import SwiftUI

import WidgetKit
import CoreSpotlight

@main
struct MemoryWikiApp: App {
    @StateObject private var auth = AuthManager.shared
    @StateObject private var router = AppRouter.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        BackgroundRefresh.registerHandler()
    }

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
                .onContinueUserActivity(CSSearchableItemActionType) { activity in
                    // User tapped a Spotlight result for one of
                    // our docs. uniqueIdentifier is the doc id.
                    guard let id = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
                          let url = URL(string: "memorywiki://doc/\(id)") else { return }
                    router.handle(url: url)
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active:
                        // Foreground arrival — refresh the widget +
                        // bounce a NotificationCenter ping so the
                        // active TimelineModel reloads. No spinner
                        // (the existing data is shown first; the
                        // fresh values just replace it on completion).
                        WidgetCenter.shared.reloadAllTimelines()
                        NotificationCenter.default.post(name: .mwForegroundRefresh, object: nil)
                    case .background:
                        BackgroundRefresh.scheduleNext()
                    default: break
                    }
                }
        }
    }
}

extension Notification.Name {
    /// Broadcast when the app foregrounds — TimelineModel +
    /// BundlesModel listen so the list refreshes the moment the
    /// user comes back without a spinner.
    static let mwForegroundRefresh = Notification.Name("MWForegroundRefresh")
}
