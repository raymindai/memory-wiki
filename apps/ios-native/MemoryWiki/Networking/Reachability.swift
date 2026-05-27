// Reachability — thin NWPathMonitor wrapper exposed as an
// ObservableObject so any view can react to offline / online
// transitions. Used by RootView to show the offline banner; the
// rest of the app keeps acting normally (the banner is informational,
// not a blocker).

import Foundation
import Network
import Combine

@MainActor
final class Reachability: ObservableObject {
    @Published private(set) var isOnline: Bool = true

    static let shared = Reachability()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "wiki.memory.reachability")

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in
                self?.isOnline = online
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
