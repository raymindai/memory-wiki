// APIClient — thin HTTP layer over the existing Memory.Wiki web
// API. No SDK / no codegen; the web routes are stable and small
// enough that hand-written calls beat a generator on signal-to-
// noise.
//
// Auth: AuthManager owns the Supabase JWT in the Keychain;
// requestAuthorized() pulls it on every call so a sign-in
// elsewhere in the app picks up without re-creating the client.

import Foundation

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

    func userDocuments() async throws -> [Document] {
        struct Response: Decodable { let documents: [Document] }
        let response: Response = try await getJSON("/api/user/documents")
        return response.documents
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
