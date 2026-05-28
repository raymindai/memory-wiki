// PinnedStore — starred / pinned items, synced with the web's
// /api/user/pins endpoint so a pin set on web shows up on iOS
// (and vice versa). Local cache survives offline; we hydrate
// from the server on load + on every .mwUserChanged broadcast.
//
// The web stores BOTH document + bundle pins under the same
// kind discriminator. We mirror that — separate ID sets for
// docs and bundles so the Timeline filter only includes docs
// and the Bundles filter only includes bundles.

import Foundation
import Combine

@MainActor
final class PinnedStore: ObservableObject {
    @Published private(set) var docIds: Set<String> = []
    @Published private(set) var bundleIds: Set<String> = []
    static let shared = PinnedStore()

    private let docKey = "mw.pinnedDocs"
    private let bundleKey = "mw.pinnedBundles"

    private init() {
        // Hydrate from local cache for instant UI; the live
        // hydrate() call from a SwiftUI view will replace these
        // with the authoritative server snapshot.
        if let raw = UserDefaults.standard.string(forKey: docKey), !raw.isEmpty {
            docIds = Set(raw.split(separator: ",").map(String.init))
        }
        if let raw = UserDefaults.standard.string(forKey: bundleKey), !raw.isEmpty {
            bundleIds = Set(raw.split(separator: ",").map(String.init))
        }
    }

    // MARK: - Queries

    func isPinned(_ id: String) -> Bool { docIds.contains(id) }
    func isPinnedBundle(_ id: String) -> Bool { bundleIds.contains(id) }

    // MARK: - Toggles (optimistic — local flip then server)

    func toggle(_ id: String) {
        let wasPinned = docIds.contains(id)
        if wasPinned { docIds.remove(id) } else { docIds.insert(id) }
        persistDocs()
        Task { await syncToggle(kind: "document", id: id, on: !wasPinned) }
    }

    func toggleBundle(_ id: String) {
        let wasPinned = bundleIds.contains(id)
        if wasPinned { bundleIds.remove(id) } else { bundleIds.insert(id) }
        persistBundles()
        Task { await syncToggle(kind: "bundle", id: id, on: !wasPinned) }
    }

    // MARK: - Server sync

    /// Pull the canonical pin list from /api/user/pins. Called
    /// from views via .task / .onReceive on user-change events.
    /// Local sets get replaced wholesale — server is source of
    /// truth.
    func hydrateFromServer() async {
        guard let session = await AuthManager.shared.session else { return }
        var req = URLRequest(url: APIClient.baseURL.appendingPathComponent("/api/user/pins"))
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            struct Response: Decodable {
                struct Pin: Decodable { let kind: String; let id: String }
                let pins: [Pin]
            }
            let parsed = try JSONDecoder().decode(Response.self, from: data)
            let docs = Set(parsed.pins.filter { $0.kind == "document" }.map(\.id))
            let bundles = Set(parsed.pins.filter { $0.kind == "bundle" }.map(\.id))
            docIds = docs
            bundleIds = bundles
            persistDocs()
            persistBundles()
        } catch {
            // Silent — fall back to whatever's in local cache.
        }
    }

    /// Wipe local state on sign-out / account switch. The next
    /// hydrateFromServer() under the new identity will repopulate.
    func clearForUserChange() {
        docIds = []
        bundleIds = []
        UserDefaults.standard.removeObject(forKey: docKey)
        UserDefaults.standard.removeObject(forKey: bundleKey)
    }

    // MARK: - Internals

    private func persistDocs() {
        UserDefaults.standard.set(docIds.sorted().joined(separator: ","), forKey: docKey)
    }
    private func persistBundles() {
        UserDefaults.standard.set(bundleIds.sorted().joined(separator: ","), forKey: bundleKey)
    }

    /// Best-effort POST / DELETE to /api/user/pins. Errors are
    /// swallowed — the local optimistic state stays put; the
    /// next hydrate() call will reconcile if the server disagrees.
    private func syncToggle(kind: String, id: String, on: Bool) async {
        guard let session = await AuthManager.shared.session else { return }
        let url = APIClient.baseURL.appendingPathComponent("/api/user/pins")
        var req = URLRequest(url: url)
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        if on {
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let body = try? JSONSerialization.data(withJSONObject: ["kind": kind, "id": id])
            req.httpBody = body
        } else {
            req.httpMethod = "DELETE"
            // DELETE wants query params, not body.
            let qURL = url.appending(queryItems: [
                URLQueryItem(name: "kind", value: kind),
                URLQueryItem(name: "id", value: id),
            ])
            req.url = qURL
        }
        _ = try? await URLSession.shared.data(for: req)
    }
}
