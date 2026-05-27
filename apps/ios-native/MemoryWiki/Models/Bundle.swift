// Bundle — a curated collection of documents. Mirrors the web's
// /api/bundles + /api/bundles/<id> response. Shares the same
// visibility / sync / time vocabulary as Document so the iOS
// list reads the same way the docs do.

import Foundation

struct AppBundle: Identifiable, Hashable, Decodable {
    let id: String
    let title: String?
    let description: String?
    let documentCount: Int?
    let updatedAt: Date?
    let createdAt: Date?
    let isDraft: Bool?
    let visibility: String?
    let allowedEmailsCount: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case documentCount
        case updatedAt = "updated_at"
        case createdAt = "created_at"
        case isDraft = "is_draft"
        case visibility
        case allowedEmailsCount = "allowed_emails_count"
    }

    var publicURL: URL { URL(string: "https://memory.wiki/b/\(id)")! }

    var displayTitle: String {
        let raw = (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return raw.isEmpty ? "Untitled Bundle" : raw
    }

    var isRestricted: Bool { (allowedEmailsCount ?? 0) > 0 }

    var sortDate: Date { updatedAt ?? createdAt ?? .distantPast }

    var compactTime: String {
        // Reuse Document's formatter shape so timeline + bundles
        // read with the same time vocabulary.
        let doc = Document(id: id, title: nil, updatedAt: updatedAt, createdAt: createdAt,
                           isDraft: isDraft, viewCount: nil, allowedEmails: nil, source: nil)
        return doc.compactTime
    }

    var bucket: TimelineBucket {
        Document(id: id, title: nil, updatedAt: updatedAt, createdAt: createdAt,
                 isDraft: isDraft, viewCount: nil, allowedEmails: nil, source: nil).bucket
    }
}

/// Full bundle payload — list of member docs.
struct BundleDetail: Identifiable, Hashable {
    let id: String
    let title: String?
    let description: String?
    let isDraft: Bool?
    let visibility: String?
    let documents: [Document]

    var publicURL: URL { URL(string: "https://memory.wiki/b/\(id)")! }
    var displayTitle: String { (title?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 } ?? "Untitled Bundle" }
}
