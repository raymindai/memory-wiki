// SharedAPI — slim HTTP helper available to both the main app and
// the Share Extension. Just enough to POST /api/docs from the
// extension without dragging the Supabase SDK in there.

import Foundation

public enum SharedAPIError: Error, LocalizedError {
    case notSignedIn
    case http(Int, String?)
    public var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in on Memory.Wiki first."
        case .http(let code, _): return "Save failed (\(code))."
        }
    }
}

public enum SharedAPI {
    public static var baseURL: URL {
        if let s = Bundle.main.object(forInfoDictionaryKey: "MWBaseURL") as? String,
           let u = URL(string: s) { return u }
        return URL(string: "https://memory.wiki")!
    }

    /// Compact doc shape — just what the widget needs to render
    /// a row. Mirrors enough fields for the same status-icon
    /// vocabulary (Cloud / Globe) and relative-time chip.
    public struct CompactDoc: Codable, Identifiable, Hashable {
        public let id: String
        public let title: String?
        public let updatedAt: Date?
        public let isDraft: Bool?

        enum CodingKeys: String, CodingKey {
            case id, title
            case updatedAt = "updated_at"
            case isDraft = "is_draft"
        }

        public var publicURL: URL { URL(string: "https://memory.wiki/\(id)")! }
        public var displayTitle: String {
            let t = (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? "Untitled" : t
        }
    }

    /// Last `limit` docs the signed-in user owns. Widget calls
    /// this on every timeline reload (~every 30 minutes). Returns
    /// an empty list when there's no session; the widget renders
    /// a "Sign in on Memory.Wiki" placeholder in that case.
    public static func recentDocs(limit: Int = 5) async throws -> [CompactDoc] {
        guard let session = SharedSessionStore.load() else { return [] }
        struct Response: Decodable { let documents: [CompactDoc] }
        var req = URLRequest(url: baseURL.appendingPathComponent("/api/user/documents"))
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        if let email = session.email { req.setValue(email, forHTTPHeaderField: "x-user-email") }
        let (data, _) = try await URLSession.shared.data(for: req)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let parsed = try decoder.decode(Response.self, from: data)
        return Array(parsed.documents.prefix(limit))
    }

    /// Creates a doc and returns the canonical public URL. Used
    /// by the Share Extension to capture the highlighted page /
    /// text into the user's hub.
    public static func createDocument(markdown: String, title: String? = nil, source: String = "ios-share") async throws -> URL {
        guard let session = SharedSessionStore.load() else { throw SharedAPIError.notSignedIn }
        struct Request: Encodable {
            let markdown: String
            let title: String?
            let source: String
        }
        struct Response: Decodable {
            let id: String
        }
        let body = try JSONEncoder().encode(Request(markdown: markdown, title: title, source: source))
        var req = URLRequest(url: baseURL.appendingPathComponent("/api/docs"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(session.userId, forHTTPHeaderField: "x-user-id")
        if let email = session.email { req.setValue(email, forHTTPHeaderField: "x-user-email") }
        req.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw SharedAPIError.http(-1, "no response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let raw = String(data: data, encoding: .utf8)
            throw SharedAPIError.http(http.statusCode, raw)
        }
        let parsed = try JSONDecoder().decode(Response.self, from: data)
        return URL(string: "\(baseURL.absoluteString)/\(parsed.id)")!
    }
}
