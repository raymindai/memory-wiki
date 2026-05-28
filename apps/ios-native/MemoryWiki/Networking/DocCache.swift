// DocCache — tiny in-memory cache of fully-loaded DocumentDetail
// objects. Used by the timeline to PREFETCH the docs a user is
// scrolling past, so tapping a row pushes the detail view with
// the body already painted instead of flashing a spinner.
//
// Backed by NSCache (bounded, eviction-aware). The cache is per
// app-launch — sign-out / user-change flushes it so account
// crossover can't leak content.

import Foundation

@MainActor
final class DocCache {
    static let shared = DocCache()

    private let store: NSCache<NSString, Entry> = {
        let c = NSCache<NSString, Entry>()
        c.countLimit = 80
        return c
    }()
    private var inflight: [String: Task<DocumentDetail?, Never>] = [:]

    private init() {
        NotificationCenter.default.addObserver(
            forName: .mwUserChanged, object: nil, queue: nil
        ) { [weak self] _ in
            Task { @MainActor in self?.clear() }
        }
    }

    /// Synchronous read — DocumentDetailView checks this on
    /// appear before kicking a fetch. Returns nil on miss.
    func get(_ id: String) -> DocumentDetail? {
        store.object(forKey: id as NSString)?.value
    }

    /// Best-effort prewarm. Idempotent: if a fetch for this id
    /// is already running, dedupes onto it; if we already have
    /// the doc cached, no-op.
    func prefetch(_ id: String) {
        guard get(id) == nil, inflight[id] == nil else { return }
        let task = Task<DocumentDetail?, Never> { [weak self] in
            defer { Task { @MainActor in self?.inflight[id] = nil } }
            do {
                let detail = try await APIClient.shared.document(id: id)
                await MainActor.run { self?.put(detail) }
                return detail
            } catch {
                return nil
            }
        }
        inflight[id] = task
    }

    /// Manual write — DocumentDetailView calls this after its own
    /// load completes, so the row tap → push round trip warms the
    /// cache for free.
    func put(_ detail: DocumentDetail) {
        store.setObject(Entry(value: detail), forKey: detail.id as NSString)
    }

    func clear() {
        store.removeAllObjects()
        for (_, t) in inflight { t.cancel() }
        inflight.removeAll()
    }

    /// NSCache requires reference-type values; wrap the Decodable
    /// struct in a tiny boxed Entry.
    private final class Entry {
        let value: DocumentDetail
        init(value: DocumentDetail) { self.value = value }
    }
}
