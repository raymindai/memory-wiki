// Document — minimal value type mirroring the /api/user/documents
// response. Only the fields the iOS surfaces need; we add columns
// as new screens require them (no eager 1:1 with the DB schema).

import Foundation

struct Document: Identifiable, Hashable, Decodable {
    let id: String
    let title: String?
    let updatedAt: Date?
    let isDraft: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case updatedAt = "updated_at"
        case isDraft = "is_draft"
    }

    /// Canonical short URL the user shares. Dual-response on the
    /// server means any AI client paste-fetching this gets markdown
    /// without us asking for `.md` explicitly.
    var publicURL: URL {
        URL(string: "https://memory.wiki/\(id)")!
    }

    var updatedAtRelative: String? {
        guard let d = updatedAt else { return nil }
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f.localizedString(for: d, relativeTo: Date())
    }
}
