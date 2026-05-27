// Document — mirrors the /api/user/documents response. Carries
// enough fields to drive the same status-icon vocabulary the web
// sidebar uses (Cloud / Globe / Users / synced-checkmark badge)
// so the iOS timeline reads at a glance like a smaller version
// of the desktop sidebar.

import Foundation

struct Document: Identifiable, Hashable, Decodable {
    let id: String
    let title: String?
    let updatedAt: Date?
    let createdAt: Date?
    let isDraft: Bool?
    let viewCount: Int?
    let allowedEmails: [String]?
    let source: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case updatedAt = "updated_at"
        case createdAt = "created_at"
        case isDraft = "is_draft"
        case viewCount = "view_count"
        case allowedEmails = "allowed_emails"
        case source
    }

    var publicURL: URL { URL(string: "https://memory.wiki/\(id)")! }

    // MARK: - Display helpers

    /// Title with markdown link / emphasis / heading syntax
    /// stripped so the timeline doesn't show `[name](url)` raw.
    /// Matches what the web's truncateTitle helper does.
    var displayTitle: String {
        let raw = (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return "Untitled" }
        return stripMarkdown(raw)
    }

    /// Source tag if the doc was synced in from a companion app.
    /// Matches the web's SYNCED_SOURCES set.
    var syncedSource: String? {
        guard let s = source?.lowercased(),
              ["vscode", "desktop", "cli", "mcp", "chrome"].contains(s) else { return nil }
        return s
    }

    /// True when this doc has explicit non-owner recipients on
    /// the allow-list. The owner email is filtered out at the
    /// API layer so any non-empty `allowed_emails` already means
    /// "shared with specific people."
    var isRestricted: Bool {
        (allowedEmails?.count ?? 0) > 0
    }

    // MARK: - Time

    var sortDate: Date { updatedAt ?? createdAt ?? .distantPast }

    /// Compact "24m / 3h / yesterday / Mon / Oct 4" — same
    /// vocabulary the web's `relativeTime` uses but a touch
    /// tighter to fit the right-aligned mono slot.
    var compactTime: String {
        let date = sortDate
        let now = Date()
        let secs = now.timeIntervalSince(date)
        if secs < 60 { return "now" }
        let min = Int(secs / 60)
        if min < 60 { return "\(min)m" }
        let hr = Int(secs / 3600)
        if hr < 24 { return "\(hr)h" }
        let day = Int(secs / 86400)
        if day == 1 { return "yesterday" }
        if day < 7 {
            let f = DateFormatter()
            f.dateFormat = "EEE"
            return f.string(from: date)
        }
        let f = DateFormatter()
        f.dateFormat = day < 365 ? "MMM d" : "MMM yyyy"
        return f.string(from: date)
    }

    /// Bucket for the group header. Today / Yesterday / This
    /// week / Earlier — matches the web's start-screen Recents.
    var bucket: TimelineBucket {
        let cal = Calendar.current
        let date = sortDate
        if cal.isDateInToday(date) { return .today }
        if cal.isDateInYesterday(date) { return .yesterday }
        let days = cal.dateComponents([.day], from: date, to: Date()).day ?? 0
        if days < 7 { return .thisWeek }
        if days < 30 { return .thisMonth }
        return .earlier
    }
}

/// Full doc payload — the body markdown plus the metadata the
/// reader needs. Mirrors the Document value type but carries the
/// markdown body; kept separate so the lightweight Document
/// loaded into the Timeline list stays small.
struct DocumentDetail: Identifiable, Hashable {
    let id: String
    let title: String?
    let markdown: String
    let updatedAt: Date?
    let createdAt: Date?
    let isDraft: Bool?
    let viewCount: Int?
    let allowedEmails: [String]?
    let source: String?
    let ownerEmail: String?

    /// Projection so the DocStatusIcon view (which takes Document)
    /// can render against a DocumentDetail without code duplication.
    var asDocument: Document {
        Document(
            id: id,
            title: title,
            updatedAt: updatedAt,
            createdAt: createdAt,
            isDraft: isDraft,
            viewCount: viewCount,
            allowedEmails: allowedEmails,
            source: source
        )
    }

    var publicURL: URL { URL(string: "https://memory.wiki/\(id)")! }

    var displayTitle: String { asDocument.displayTitle }
}

enum TimelineBucket: String, CaseIterable, Identifiable {
    case today, yesterday, thisWeek, thisMonth, earlier
    /// Synthetic bucket — rendered as a section above the time
    /// buckets when there's at least one pinned doc. Never
    /// returned from Document.bucket; only the view layer uses it.
    case pinned
    var id: String { rawValue }
    var label: String {
        switch self {
        case .today: return "TODAY"
        case .yesterday: return "YESTERDAY"
        case .thisWeek: return "THIS WEEK"
        case .thisMonth: return "THIS MONTH"
        case .earlier: return "EARLIER"
        case .pinned: return "PINNED"
        }
    }
}

// MARK: - Markdown stripper

/// Lightweight title sanitiser. Drops `[text](url)` → text,
/// `**bold**` → bold, leading `# ` headings, `~~strike~~`,
/// backticks, and most inline syntax the title may carry over
/// from the body's first line.
private func stripMarkdown(_ input: String) -> String {
    var s = input
    s = s.replacingOccurrences(of: "^#+\\s*", with: "", options: .regularExpression)
    // [text](url) → text
    s = s.replacingOccurrences(of: "\\[([^\\]]+)\\]\\([^)]+\\)", with: "$1", options: .regularExpression)
    // ![alt](url) → alt (rare in titles)
    s = s.replacingOccurrences(of: "!\\[([^\\]]*)\\]\\([^)]+\\)", with: "$1", options: .regularExpression)
    // **bold** / __bold__ → bold
    s = s.replacingOccurrences(of: "\\*\\*([^*]+)\\*\\*", with: "$1", options: .regularExpression)
    s = s.replacingOccurrences(of: "__([^_]+)__", with: "$1", options: .regularExpression)
    // *italic* / _italic_ → italic
    s = s.replacingOccurrences(of: "(?<![*\\w])\\*([^*\\n]+)\\*(?!\\w)", with: "$1", options: .regularExpression)
    s = s.replacingOccurrences(of: "(?<![_\\w])_([^_\\n]+)_(?!\\w)", with: "$1", options: .regularExpression)
    // ~~strike~~
    s = s.replacingOccurrences(of: "~~([^~]+)~~", with: "$1", options: .regularExpression)
    // `code` → code
    s = s.replacingOccurrences(of: "`([^`]+)`", with: "$1", options: .regularExpression)
    // Collapse whitespace
    s = s.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    return s.trimmingCharacters(in: .whitespacesAndNewlines)
}
