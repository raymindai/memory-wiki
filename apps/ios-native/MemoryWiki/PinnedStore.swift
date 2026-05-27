// PinnedStore — local-only pin (favorites) for docs + bundles.
// Stored as a comma-joined string in UserDefaults so it survives
// app launches and is cheap to read on the timeline render path.
// No server round-trip: pinning is a "this device" affordance
// only — the canonical doc list lives on Supabase.

import Foundation
import Combine

@MainActor
final class PinnedStore: ObservableObject {
    @Published private(set) var docIds: Set<String> = []
    static let shared = PinnedStore()

    private let key = "mw.pinnedDocs"

    private init() {
        if let raw = UserDefaults.standard.string(forKey: key), !raw.isEmpty {
            docIds = Set(raw.split(separator: ",").map(String.init))
        }
    }

    func isPinned(_ id: String) -> Bool { docIds.contains(id) }

    func toggle(_ id: String) {
        if docIds.contains(id) {
            docIds.remove(id)
        } else {
            docIds.insert(id)
        }
        persist()
    }

    private func persist() {
        UserDefaults.standard.set(docIds.sorted().joined(separator: ","), forKey: key)
    }
}
