// MemoryWiki — iOS app entry. v8 W9 scaffold.
//
// Single Scene, root NavigationStack hosting the TabView with
// Timeline / Capture / Profile tabs. The auth state lives in a
// shared @StateObject so child views can react to sign-in/out
// without prop-drilling.

import SwiftUI

import WidgetKit
import CoreSpotlight
import UIKit
import AppIntents

@main
struct MemoryWikiApp: App {
    @StateObject private var auth = AuthManager.shared
    @StateObject private var router = AppRouter.shared
    @Environment(\.scenePhase) private var scenePhase
    @UIApplicationDelegateAdaptor(MWAppDelegate.self) private var appDelegate

    init() {
        BackgroundRefresh.registerHandler()
        // Force a refresh of the App Shortcuts metadata. iOS picks
        // these up lazily; an explicit kick on launch makes them
        // show up in Shortcuts.app / Spotlight / Siri immediately
        // after a fresh install instead of "in a few minutes".
        MemoryWikiShortcuts.updateAppShortcutParameters()
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
                        // Drain any quick-action queued during cold
                        // launch — the delegate stashes it; we apply
                        // it here once SwiftUI scene + router are up.
                        MWAppDelegate.flushPendingShortcut(to: router)
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

/// UIKit lifecycle bridge for Home-screen Quick Actions
/// (UIApplicationShortcutItem). SwiftUI's App scene doesn't
/// expose performActionFor:shortcutItem; we keep a tiny
/// AppDelegate just for this single hook.
final class MWAppDelegate: NSObject, UIApplicationDelegate {
    /// Stashed shortcut from cold-launch — applied once the
    /// SwiftUI scene transitions to .active so the router is
    /// guaranteed alive.
    private static var pending: UIApplicationShortcutItem?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        if let shortcut = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
            Self.pending = shortcut
            return false   // don't perform now; we'll route on scene .active
        }
        return true
    }

    func application(_ application: UIApplication,
                     performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        // Warm-launch path — the scene is already active, route
        // immediately. Fall back to stash if for any reason
        // routing fails.
        Task { @MainActor in
            let routed = Self.route(shortcut: shortcutItem, on: AppRouter.shared)
            if !routed { Self.pending = shortcutItem }
            completionHandler(routed)
        }
    }

    @MainActor
    static func flushPendingShortcut(to router: AppRouter) {
        guard let p = pending else { return }
        _ = route(shortcut: p, on: router)
        pending = nil
    }

    @MainActor
    static func route(shortcut: UIApplicationShortcutItem, on router: AppRouter) -> Bool {
        switch shortcut.type {
        case "wiki.memory.MemoryWiki.capture":
            router.selectedTab = .capture
            Haptics.tap()
            return true
        case "wiki.memory.MemoryWiki.search":
            router.selectedTab = .timeline
            NotificationCenter.default.post(name: .mwOpenSearch, object: nil)
            Haptics.tap()
            return true
        case "wiki.memory.MemoryWiki.hub":
            router.selectedTab = .profile
            Haptics.tap()
            return true
        default:
            return false
        }
    }
}

extension Notification.Name {
    /// Posted when the user picks the "Search" Quick Action so the
    /// Timeline can auto-focus the search bar without a binding
    /// hop through the router.
    static let mwOpenSearch = Notification.Name("MWOpenSearch")
    /// Posted when AuthManager observes a session change — sign-out
    /// or sign-in-as-different-user. Models listen and drop their
    /// in-memory cache so the previous account's docs don't flash.
    static let mwUserChanged = Notification.Name("MWUserChanged")
}
