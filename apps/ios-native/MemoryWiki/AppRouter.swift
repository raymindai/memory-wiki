// AppRouter — single source of truth for cross-tab navigation
// + deep-link targets. Lives at the App level so onOpenURL can
// route to any tab + push detail without prop-drilling.
//
// URL grammar:
//   memorywiki://auth-callback?...  → AuthManager (existing)
//   memorywiki://doc/<id>           → Timeline + push DocumentDetail
//   memorywiki://bundle/<id>        → Bundles + push BundleDetail (later)
//   memorywiki://capture            → Capture tab
//   memorywiki://profile            → Profile tab

import SwiftUI

@MainActor
final class AppRouter: ObservableObject {
    @Published var selectedTab: AppTab = .start
    @Published var timelinePath: [TimelineRoute] = []
    @Published var bundlesPath: [BundlesRoute] = []

    static let shared = AppRouter()

    func handle(url: URL) {
        guard url.scheme == "memorywiki" else { return }
        let host = url.host ?? ""
        let path = url.pathComponents.filter { $0 != "/" }
        switch host {
        case "doc":
            if let id = path.first, !id.isEmpty {
                selectedTab = .timeline
                timelinePath = [.docDetailById(id)]
            }
        case "bundle":
            if let id = path.first, !id.isEmpty {
                selectedTab = .bundles
                bundlesPath = [.bundleDetailById(id)]
            }
        case "bundles":
            selectedTab = .bundles
        case "timeline":
            selectedTab = .timeline
        case "capture":
            selectedTab = .capture
        case "capture-paste":
            // Widget "Paste" shortcut — flip to Capture and tell
            // it to grab whatever is on the clipboard immediately.
            selectedTab = .capture
            NotificationCenter.default.post(name: .mwCapturePaste, object: nil)
        case "chat-hub":
            // Widget "Ask hub" shortcut — flip to Start, fire a
            // notification StartView listens for to open the chat
            // sheet over its own surface.
            selectedTab = .start
            NotificationCenter.default.post(name: .mwOpenHubChat, object: nil)
        case "search":
            // Widget "Search" shortcut — flip to Timeline and fire
            // the notification TimelineView listens for to expand
            // its search bar + focus the field. Mirrors the home-
            // screen quick-action route in MemoryWikiApp.swift.
            selectedTab = .timeline
            NotificationCenter.default.post(name: .mwOpenSearch, object: nil)
        case "profile":
            selectedTab = .profile
        case "demo-signin":
            // Screenshot-automation helper. Trips the standard
            // demo magic-link flow without UI input so simctl can
            // drive a signed-in simulator through every tab via
            // deep links. The endpoint allowlist still gates this;
            // arbitrary emails can't ride along.
            Task { try? await AuthManager.shared.signInDemo(email: "demo@memory.wiki") }
        default:
            break
        }
    }
}

extension Notification.Name {
    /// Posted from AppRouter when a memorywiki:// URL asks Capture
    /// to start a new capture pre-loaded with the system clipboard
    /// contents (URL → URL-import mode; text → body draft).
    static let mwCapturePaste = Notification.Name("MWCapturePaste")
    /// Posted from AppRouter when a memorywiki:// URL asks the
    /// Start tab to open the hub chat sheet.
    static let mwOpenHubChat = Notification.Name("MWOpenHubChat")
}

/// Hashable route values for the Timeline NavigationStack. Using
/// a value type (not the full Document) so widget + spotlight deep
/// links — which only know the id — can still push the detail
/// view; the detail view fetches the rest from the API.
enum TimelineRoute: Hashable {
    case docDetail(Document)
    case docDetailById(String)
}

enum BundlesRoute: Hashable {
    case bundleDetail(AppBundle)
    case bundleDetailById(String)
    /// Doc pushed from inside a BundleDetailView's member list.
    /// We re-use the Document model so DocumentDetailView gets the
    /// same seed shape it expects from the Timeline tab.
    /// NavigationStack(path:) enforces a single route type per
    /// stack — TimelineRoute pushes were silently dropped before.
    case docDetail(Document)
    case docDetailById(String)
}
