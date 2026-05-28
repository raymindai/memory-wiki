// MemoryWikiWidget — Home + Lock screen widget. Three sizes:
//   - systemSmall  : 2 docs + Capture deep link
//   - systemMedium : 4 docs + Capture deep link
//   - systemLarge  : 7 docs + Capture deep link
//
// Each row deep-links into the main app at memorywiki://doc/<id>.
// The "+ Capture" button deep-links to memorywiki://capture so
// the user starts a new memory in one tap from the lock screen.
//
// TimelineProvider refreshes every 30 minutes; the main app
// calls WidgetCenter.reloadAllTimelines() after any mutation so
// the widget stays fresh between scheduled refreshes. Auth
// lives in the App Group Keychain via SharedSessionStore — no
// Supabase SDK in the widget binary.

import WidgetKit
import SwiftUI

@main
struct MemoryWikiWidgetBundle: WidgetBundle {
    var body: some Widget {
        RecentDocsWidget()
    }
}

struct RecentDocsWidget: Widget {
    let kind = "wiki.memory.MemoryWiki.Recent"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RecentDocsProvider()) { entry in
            RecentDocsView(entry: entry)
                .containerBackground(WTheme.background, for: .widget)
        }
        .configurationDisplayName("Memory.Wiki")
        .description("Recent captures + a one-tap Capture shortcut.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Brand tokens (mirrors the main app's Brand enum so the
// widget reads as one product. Re-declared here because the
// widget extension can't import the main app's module.)

enum WTheme {
    static let background   = Color(red: 0.035, green: 0.035, blue: 0.043)
    static let surface      = Color(red: 0.094, green: 0.094, blue: 0.106)
    static let textPrimary  = Color(red: 0.980, green: 0.980, blue: 0.980)
    static let textMuted    = Color(red: 0.631, green: 0.631, blue: 0.667)
    static let textFaint    = Color(red: 0.541, green: 0.541, blue: 0.569)
    static let borderDim    = Color(red: 0.180, green: 0.180, blue: 0.196)
    /// Lime only on the smallest possible surface — the public
    /// status dot. NEVER for primary text or fills.
    static let microLime    = Color(red: 0.71, green: 1.0, blue: 0.10)
}

// MARK: - Timeline

struct DocEntry: TimelineEntry {
    let date: Date
    let docs: [SharedAPI.CompactDoc]
    let signedIn: Bool
}

struct RecentDocsProvider: TimelineProvider {
    func placeholder(in context: Context) -> DocEntry {
        DocEntry(date: Date(), docs: sampleDocs, signedIn: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (DocEntry) -> Void) {
        Task {
            let docs = (try? await SharedAPI.recentDocs(limit: 7)) ?? []
            let signedIn = SharedSessionStore.load() != nil
            completion(DocEntry(date: Date(), docs: docs, signedIn: signedIn))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DocEntry>) -> Void) {
        Task {
            let docs = (try? await SharedAPI.recentDocs(limit: 7)) ?? []
            let signedIn = SharedSessionStore.load() != nil
            let entry = DocEntry(date: Date(), docs: docs, signedIn: signedIn)
            let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private var sampleDocs: [SharedAPI.CompactDoc] {
        [
            .init(id: "abc12345", title: "Memory.Wiki v8 plan", updatedAt: Date(), isDraft: false),
            .init(id: "def67890", title: "Cross-AI memo", updatedAt: Date().addingTimeInterval(-3600), isDraft: false),
            .init(id: "ghi24680", title: "Quick capture", updatedAt: Date().addingTimeInterval(-7200), isDraft: true),
        ]
    }
}

// MARK: - View

struct RecentDocsView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DocEntry

    var body: some View {
        if !entry.signedIn {
            placeholder
        } else {
            switch family {
            case .systemSmall:  smallBody
            case .systemMedium: mediumBody
            case .systemLarge:  largeBody
            default: smallBody
            }
        }
    }

    private var rowCount: Int {
        switch family {
        case .systemSmall:  return 2
        case .systemMedium: return 4
        case .systemLarge:  return 7
        default: return 1
        }
    }

    private var visible: [SharedAPI.CompactDoc] {
        Array(entry.docs.prefix(rowCount))
    }

    // MARK: small

    /// Small widget — single dense column. Header is just the
    /// ink wordmark + the Capture pill in the top-right so the
    /// row area gets every pixel it can.
    private var smallBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            compactHeader
            VStack(alignment: .leading, spacing: 6) {
                ForEach(visible) { doc in
                    Link(destination: docURL(doc.id)) {
                        DocPreview(doc: doc, dense: true)
                    }
                }
                if visible.isEmpty {
                    emptyHint
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
    }

    // MARK: medium

    private var mediumBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            fullHeader
            VStack(alignment: .leading, spacing: 6) {
                ForEach(visible) { doc in
                    Link(destination: docURL(doc.id)) {
                        DocPreview(doc: doc, dense: true)
                    }
                }
                if visible.isEmpty {
                    emptyHint
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    // MARK: large

    private var largeBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            fullHeader
            VStack(alignment: .leading, spacing: 8) {
                ForEach(visible) { doc in
                    Link(destination: docURL(doc.id)) {
                        DocPreview(doc: doc, dense: false)
                    }
                }
                if visible.isEmpty {
                    emptyHint
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
    }

    // MARK: pieces

    /// Small-widget header — ink wordmark only; Capture pill
    /// shares the row so the docs section gets all the height.
    private var compactHeader: some View {
        HStack(alignment: .center, spacing: 0) {
            Text("memory.wiki")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(WTheme.textPrimary)
            Spacer()
            captureButton
        }
    }

    /// Medium / large header — wordmark on left, Capture pill on
    /// right. A thin hairline below adds breathing room before
    /// the doc list without spending much vertical space.
    private var fullHeader: some View {
        VStack(spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("memory.wiki")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(WTheme.textPrimary)
                Text("RECENT")
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .tracking(1.0)
                    .foregroundStyle(WTheme.textFaint)
                Spacer()
                captureButton
            }
            Rectangle()
                .fill(WTheme.borderDim)
                .frame(height: 0.5)
        }
    }

    /// Capture pill — ink-on-surface (NOT white-on-ink the way
    /// the old version was). Subtle border. Matches the main
    /// app's quiet button vocabulary.
    private var captureButton: some View {
        Link(destination: URL(string: "memorywiki://capture")!) {
            HStack(spacing: 3) {
                Image(systemName: "plus")
                    .font(.system(size: 9, weight: .semibold))
                Text("Capture")
                    .font(.system(size: 9, weight: .semibold))
            }
            .foregroundStyle(WTheme.textPrimary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(WTheme.surface)
                    .overlay(Capsule().strokeBorder(WTheme.borderDim, lineWidth: 0.5))
            )
        }
    }

    /// Shown when there are no docs yet (just-signed-in or
    /// brand-new account). Quiet copy, lime-free.
    private var emptyHint: some View {
        Text("Nothing yet — tap Capture to start.")
            .font(.system(size: 10))
            .foregroundStyle(WTheme.textMuted)
            .padding(.top, 4)
    }

    /// Not-signed-in widget body. Wordmark up top, message in
    /// the middle, dimmed Capture button at the bottom.
    private var placeholder: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("memory.wiki")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(WTheme.textPrimary)
                Spacer()
                Text("SIGN IN")
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .tracking(1.0)
                    .foregroundStyle(WTheme.textFaint)
            }
            Spacer()
            Text("Open the app once to sign in. Your recent captures will land here.")
                .font(.system(size: 11))
                .foregroundStyle(WTheme.textMuted)
                .lineSpacing(2)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
    }

    private func docURL(_ id: String) -> URL {
        URL(string: "memorywiki://doc/\(id)")!
    }
}

// MARK: - Row

private struct DocPreview: View {
    let doc: SharedAPI.CompactDoc
    let dense: Bool

    private var isPublic: Bool { doc.isDraft == false }

    /// Time chip. "now / 3m / 5h / 2d" — small, monospaced,
    /// right-aligned. Matches the iOS main app's compactTime
    /// vocabulary so the two surfaces feel like the same product.
    private var time: String {
        guard let d = doc.updatedAt else { return "" }
        let secs = Date().timeIntervalSince(d)
        if secs < 60 { return "now" }
        if secs < 3600 { return "\(Int(secs / 60))m" }
        if secs < 86400 { return "\(Int(secs / 3600))h" }
        let days = Int(secs / 86400)
        if days < 7 { return "\(days)d" }
        return ""
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            // Status badge — small filled circle, lime only when
            // the doc is public. Private docs get a faint hollow
            // ring instead. Keeps lime to the smallest possible
            // surface per the brand colour-balance rule.
            statusBadge
            Text(doc.displayTitle)
                .font(.system(size: dense ? 11 : 13, weight: .medium))
                .foregroundStyle(WTheme.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 4)
            Text(time)
                .font(.system(size: dense ? 9 : 10, weight: .medium, design: .monospaced))
                .foregroundStyle(WTheme.textFaint)
        }
        .padding(.vertical, dense ? 2 : 4)
    }

    @ViewBuilder
    private var statusBadge: some View {
        if isPublic {
            Circle()
                .fill(WTheme.microLime)
                .frame(width: 5, height: 5)
        } else {
            Circle()
                .strokeBorder(WTheme.textFaint, lineWidth: 1)
                .frame(width: 5, height: 5)
        }
    }
}

#Preview(as: .systemMedium) {
    RecentDocsWidget()
} timeline: {
    DocEntry(date: Date(), docs: [
        .init(id: "a", title: "Memory.Wiki v8 plan", updatedAt: Date(), isDraft: false),
        .init(id: "b", title: "Cross-AI thesis", updatedAt: Date().addingTimeInterval(-3600), isDraft: false),
        .init(id: "c", title: "Capture flow", updatedAt: Date().addingTimeInterval(-86400), isDraft: true),
    ], signedIn: true)
}
