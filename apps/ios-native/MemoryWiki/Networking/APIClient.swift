// APIClient — thin HTTP layer over the existing Memory.Wiki web
// API. No SDK / no codegen; the web routes are stable and small
// enough that hand-written calls beat a generator on signal-to-
// noise.
//
// Auth: AuthManager owns the Supabase JWT in the Keychain;
// requestAuthorized() pulls it on every call so a sign-in
// elsewhere in the app picks up without re-creating the client.

import Foundation
import WidgetKit

enum APIError: Error, LocalizedError {
    case notAuthenticated
    case http(Int, String?)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "Sign in to continue."
        case .http(let code, let msg): return msg ?? "Request failed (\(code))."
        case .decoding(let err): return "Couldn't read server response: \(err.localizedDescription)"
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    /// Base for every HTTP call + the URL we open in the in-app
    /// browser for sign-in. Overridable in DEBUG via an environment
    /// override so we can point at a staging deploy without
    /// changing source.
    static let baseURL: URL = {
        if let s = ProcessInfo.processInfo.environment["MEMORY_WIKI_BASE_URL"],
           let url = URL(string: s) {
            return url
        }
        return URL(string: "https://memory.wiki")!
    }()

    private let session: URLSession
    private let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session
        let d = JSONDecoder()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            if let d = iso.date(from: s) { return d }
            let fallback = ISO8601DateFormatter()
            fallback.formatOptions = [.withInternetDateTime]
            if let d = fallback.date(from: s) { return d }
            throw DecodingError.dataCorruptedError(in: try decoder.singleValueContainer(), debugDescription: "Bad ISO date: \(s)")
        }
        self.decoder = d
    }

    // MARK: - High-level calls

    /// Full doc fetch for the reader. /api/docs/<id> returns
    /// markdown + every metadata field; we project just what the
    /// iOS detail view needs into a value type.
    func document(id: String) async throws -> DocumentDetail {
        struct Response: Decodable {
            let id: String
            let title: String?
            let markdown: String?
            let updated_at: Date?
            let created_at: Date?
            let is_draft: Bool?
            let view_count: Int?
            let allowed_emails: [String]?
            let source: String?
            let ownerEmail: String?
        }
        let response: Response = try await getJSON("/api/docs/\(id)")
        return DocumentDetail(
            id: response.id,
            title: response.title,
            markdown: response.markdown ?? "",
            updatedAt: response.updated_at,
            createdAt: response.created_at,
            isDraft: response.is_draft,
            viewCount: response.view_count,
            allowedEmails: response.allowed_emails,
            source: response.source,
            ownerEmail: response.ownerEmail
        )
    }

    func userBundles() async throws -> [AppBundle] {
        // /api/bundles GET is already scoped to the auth user
        // (it eqs on user_id). No query needed — and never use
        // a query here because appendingPathComponent percent-
        // encodes the `?` and the URL falls into the catch-all
        // rewrite (the homepage HTML, which the JSON decoder
        // then chokes on with a confusing "Couldn't load…").
        struct Response: Decodable { let bundles: [AppBundle] }
        let response: Response = try await getJSON("/api/bundles")
        return response.bundles
    }

    func bundle(id: String) async throws -> BundleDetail {
        struct Response: Decodable {
            let id: String
            let title: String?
            let description: String?
            let is_draft: Bool?
            let visibility: String?
            let documents: [Document]?
        }
        let response: Response = try await getJSON("/api/bundles/\(id)")
        return BundleDetail(
            id: response.id,
            title: response.title,
            description: response.description,
            isDraft: response.is_draft,
            visibility: response.visibility,
            documents: response.documents ?? []
        )
    }

    func userDocuments() async throws -> [Document] {
        struct Response: Decodable { let documents: [Document] }
        let response: Response = try await getJSON("/api/user/documents")
        return response.documents
    }

    /// Trigger the home-screen widget to re-fetch. Called after
    /// any mutation (create, edit, delete, visibility) so the
    /// "Recent" widget stays in sync without the user opening
    /// the app.
    private func bumpWidget() {
        WidgetCenter.shared.reloadAllTimelines()
    }

    func createDocument(markdown: String, title: String? = nil) async throws -> Document {
        struct Request: Encodable {
            let markdown: String
            let title: String?
            let source: String = "ios"
        }
        struct Response: Decodable {
            let id: String
            let title: String?
            let updated_at: Date?
        }
        let body = try JSONEncoder().encode(Request(markdown: markdown, title: title))
        let response: Response = try await postJSON("/api/docs", body: body)
        return Document(
            id: response.id,
            title: response.title,
            updatedAt: response.updated_at,
            createdAt: response.updated_at,
            isDraft: true,
            viewCount: 0,
            allowedEmails: nil,
            source: "ios"
        )
    }

    // MARK: - File import (PDF / Office / Markdown / Text)

    /// Imports a file by POSTing it to the right web endpoint
    /// in end-to-end save mode (?save=1). Returns the canonical
    /// public doc URL the user can open immediately.
    ///
    /// Endpoint routing:
    ///   .pdf                  → /api/import/pdf?save=1
    ///   .docx / .pptx / .xlsx → /api/import/office?save=1
    ///   .md / .markdown       → /api/docs (treat as raw markdown)
    ///   .txt                  → /api/docs (treat as markdown body)
    func importFile(data: Data, filename: String, contentType: String) async throws -> URL {
        let lower = filename.lowercased()
        if lower.hasSuffix(".md") || lower.hasSuffix(".markdown") || lower.hasSuffix(".txt") {
            let body = String(data: data, encoding: .utf8) ?? ""
            let titleHint = (filename as NSString).deletingPathExtension
            let doc = try await createDocument(markdown: body, title: titleHint)
            return doc.publicURL
        }
        let endpoint: String
        if lower.hasSuffix(".pdf") {
            endpoint = "/api/import/pdf?save=1"
        } else if lower.hasSuffix(".docx") || lower.hasSuffix(".pptx") || lower.hasSuffix(".xlsx") {
            endpoint = "/api/import/office?save=1"
        } else {
            throw APIError.http(415, "Unsupported file type: \(filename)")
        }
        struct Response: Decodable { let id: String }
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        let boundary = "MWFileImport\(UUID().uuidString)"
        var body = Data()
        let header = "--\(boundary)\r\n" +
            "Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n" +
            "Content-Type: \(contentType)\r\n\r\n"
        body.append(header.data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        var req = URLRequest(url: Self.baseURL.appendingPathComponent(endpoint))
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        if let email = session.email { req.setValue(email, forHTTPHeaderField: "x-user-email") }
        req.httpBody = body
        req.timeoutInterval = 120  // PDF parsing can be slow
        let response: Response = try await perform(req)
        return URL(string: "\(Self.baseURL.absoluteString)/\(response.id)")!
    }

    // MARK: - Image upload

    /// Uploads raw image bytes to /api/upload and returns the
    /// public CDN URL. Used by Capture's Photo mode to embed an
    /// image into a new doc via `![alt](url)` markdown.
    func uploadImage(data: Data, contentType: String) async throws -> URL {
        struct Response: Decodable { let url: String }
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        let boundary = "MWImageUpload\(UUID().uuidString)"
        var body = Data()
        let filename = "capture-\(Int(Date().timeIntervalSince1970)).jpg"
        let header = "--\(boundary)\r\n" +
            "Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n" +
            "Content-Type: \(contentType)\r\n\r\n"
        body.append(header.data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        var req = URLRequest(url: Self.baseURL.appendingPathComponent("/api/upload"))
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        if let email = session.email { req.setValue(email, forHTTPHeaderField: "x-user-email") }
        req.httpBody = body
        req.timeoutInterval = 30
        let response: Response = try await perform(req)
        guard let url = URL(string: response.url) else {
            throw APIError.http(-1, "bad upload URL")
        }
        return url
    }

    // MARK: - Profile + Hub

    /// User's own profile row — display_name, avatar, hub_slug,
    /// hub_public, hub_description, plan.
    struct UserProfile: Decodable {
        let display_name: String?
        let avatar_url: String?
        let avatar_style: String?
        let plan: String?
        let hub_slug: String?
        let hub_public: Bool?
        let hub_description: String?
    }
    func userProfile() async throws -> UserProfile {
        struct Response: Decodable { let profile: UserProfile? }
        let response: Response = try await getJSON("/api/user/profile")
        guard let profile = response.profile else {
            throw APIError.http(404, "No profile")
        }
        return profile
    }

    /// Authenticated hub view for the signed-in user. Returns
    /// owner-view (public + shared + private buckets) when the
    /// Bearer token matches the hub's owner profile. Used by
    /// the iOS Profile tab to render hub stats + a snapshot of
    /// public surface.
    struct HubResponse: Decodable {
        struct Profile: Decodable {
            let display_name: String?
            let avatar_url: String?
            let hub_slug: String?
            let hub_description: String?
        }
        struct DocCard: Decodable, Identifiable, Hashable {
            let id: String
            let title: String?
            let updated_at: String?
        }
        struct BundleCard: Decodable, Identifiable, Hashable {
            let id: String
            let title: String?
            let updated_at: String?
        }
        struct Stats: Decodable {
            let documents: Int?
            let bundles: Int?
        }
        struct OwnerView: Decodable {
            struct DocSets: Decodable {
                let `public`: [DocCard]?
                let shared: [DocCard]?
                let `private`: [DocCard]?
            }
            struct BundleSets: Decodable {
                let `public`: [BundleCard]?
                let shared: [BundleCard]?
                let `private`: [BundleCard]?
            }
            let documents: DocSets?
            let bundles: BundleSets?
        }
        let profile: Profile
        let documents: [DocCard]?
        let bundles: [BundleCard]?
        let stats: Stats?
        let ownerView: OwnerView?
    }
    func hub(slug: String) async throws -> HubResponse {
        // /api/hub/[slug] uses public URL path so encode the slug.
        let path = "/api/hub/\(slug)"
        return try await getJSON(path)
    }

    // MARK: - Bundle mutations

    /// Create a new bundle with the given title + initial doc IDs.
    /// Mirrors the web's POST /api/bundles. Returns the new bundle's id.
    func createBundle(title: String, documentIds: [String] = []) async throws -> String {
        struct Request: Encodable {
            let title: String
            let documentIds: [String]
            let isDraft: Bool
        }
        struct Response: Decodable { let id: String }
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        let body = try JSONEncoder().encode(Request(title: title, documentIds: documentIds, isDraft: true))
        var req = URLRequest(url: Self.baseURL.appendingPathComponent("/api/bundles"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        if let email = session.email { req.setValue(email, forHTTPHeaderField: "x-user-email") }
        req.httpBody = body
        let response: Response = try await perform(req)
        bumpWidget()
        return response.id
    }

    /// Add doc IDs to an existing bundle. PATCH /api/bundles/<id>
    /// with action: "add-documents". Idempotent on the server.
    func addDocumentsToBundle(bundleId: String, documentIds: [String]) async throws {
        struct Request: Encodable {
            let action: String
            let documentIds: [String]
        }
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        let body = try JSONEncoder().encode(Request(action: "add-documents", documentIds: documentIds))
        var req = URLRequest(url: Self.baseURL.appendingPathComponent("/api/bundles/\(bundleId)"))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        req.httpBody = body
        try await perform(req)
        bumpWidget()
    }

    // MARK: - Low-level

    private func getJSON<T: Decodable>(_ path: String) async throws -> T {
        let req = try await requestAuthorized(path: path, method: "GET")
        return try await perform(req)
    }

    private func postJSON<T: Decodable>(_ path: String, body: Data) async throws -> T {
        var req = try await requestAuthorized(path: path, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = body
        return try await perform(req)
    }

    private func requestAuthorized(path: String, method: String) async throws -> URLRequest {
        // AuthManager is @MainActor; hop over to read the cached session.
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        var req = URLRequest(url: Self.baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        if let email = session.email { req.setValue(email, forHTTPHeaderField: "x-user-email") }
        return req
    }

    /// Convenience: pull the canonical sign-in URL only when the
    /// app needs to send the user out (e.g. linking from a
    /// secondary surface). Day-to-day auth runs through
    /// AuthManager + Supabase SDK, not this URL.
    static var signInURL: URL { baseURL.appendingPathComponent("auth") }

    /// Semantic search across the user's own docs. POSTs the
    /// query string; the server embeds it + runs cosine similarity
    /// against the caller's docs and returns ranked snippets.
    /// Falls back to title-prefix on server error so the iOS UI
    /// always has SOMETHING to render.
    struct SemanticHit: Identifiable, Hashable, Decodable {
        let id: String
        let title: String
        let snippet: String
        let updated_at: Date?
        let source: String?
        let score: Double?
    }

    func semanticSearch(query: String, limit: Int = 12) async throws -> [SemanticHit] {
        struct Request: Encodable { let query: String; let limit: Int }
        struct Response: Decodable { let results: [SemanticHit] }
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        let body = try JSONEncoder().encode(Request(query: query, limit: limit))
        var req = URLRequest(url: Self.baseURL.appendingPathComponent("/api/search/semantic"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        req.httpBody = body
        let response: Response = try await perform(req)
        return response.results
    }

    // MARK: - Doc mutations

    /// auto-save action — the same path the web editor uses. We
    /// pass title only when the caller wants to change it.
    func updateDocument(id: String, markdown: String, title: String? = nil) async throws {
        struct Request: Encodable {
            let action: String
            let markdown: String
            let title: String?
        }
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        let body = try JSONEncoder().encode(Request(action: "auto-save", markdown: markdown, title: title))
        var req = URLRequest(url: Self.baseURL.appendingPathComponent("/api/docs/\(id)"))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        req.httpBody = body
        try await perform(req)
        bumpWidget()
    }

    func deleteDocument(id: String) async throws {
        struct Request: Encodable { let action: String = "soft-delete" }
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        let body = try JSONEncoder().encode(Request())
        var req = URLRequest(url: Self.baseURL.appendingPathComponent("/api/docs/\(id)"))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        req.httpBody = body
        try await perform(req)
        bumpWidget()
    }

    func setDocumentVisibility(id: String, public makePublic: Bool) async throws {
        struct Request: Encodable { let action: String }
        guard let session = await AuthManager.shared.session else { throw APIError.notAuthenticated }
        let body = try JSONEncoder().encode(Request(action: makePublic ? "publish" : "unpublish"))
        var req = URLRequest(url: Self.baseURL.appendingPathComponent("/api/docs/\(id)"))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        req.httpBody = body
        try await perform(req)
        bumpWidget()
    }

    /// Fire-and-forget perform — used by mutations that don't
    /// need a response body decoded. Throws on non-2xx.
    private func perform(_ req: URLRequest) async throws {
        var mutable = req
        if mutable.httpBody == nil {
            mutable.httpBody = "{}".data(using: .utf8)
        }
        let (data, response) = try await session.data(for: mutable)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let raw = String(data: data, encoding: .utf8)
            throw APIError.http((response as? HTTPURLResponse)?.statusCode ?? -1, raw)
        }
    }

    private func perform<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.http(-1, "No HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8)
            throw APIError.http(http.statusCode, body)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}
