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
    @Published var selectedTab: AppTab = .timeline
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
        case "profile":
            selectedTab = .profile
        default:
            break
        }
    }
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
}
