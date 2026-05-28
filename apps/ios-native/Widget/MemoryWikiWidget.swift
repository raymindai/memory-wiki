// MemoryWikiWidget — Home + Lock screen widget.
//
// Layout (all sizes):
//   ┌──────────────────────────────────────────┐
//   │  [blob] memory.wiki  RECENT          ·   │   header
//   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
//   │   • <doc 1>                         3m  │
//   │   • <doc 2>                         2h  │
//   │   • <doc 3>                          ⋮  │
//   │                                          │
//   │  ┌────────────────────────────────────┐  │
//   │  │  +  Capture                         │  │   bottom CTA
//   │  └────────────────────────────────────┘  │
//   └──────────────────────────────────────────┘
//
// Each row deep-links into the main app at memorywiki://doc/<id>.
// Capture pill deep-links to memorywiki://capture. Auth lives in
// the App Group Keychain via SharedSessionStore — no Supabase
// SDK in the widget binary.

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
        .description("Recent memories + a one-tap Capture shortcut.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        // Opt out of the system widget content margins so we own
        // the full canvas. Combined with the tiny inner padding
        // below, this kills the fat dead band that previously
        // ringed every row.
        .contentMarginsDisabled()
    }
}

// MARK: - Brand tokens

enum WTheme {
    static let background   = Color(red: 0.035, green: 0.035, blue: 0.043)
    static let surface      = Color(red: 0.094, green: 0.094, blue: 0.106)
    static let textPrimary  = Color(red: 0.980, green: 0.980, blue: 0.980)
    static let textMuted    = Color(red: 0.631, green: 0.631, blue: 0.667)
    static let textFaint    = Color(red: 0.541, green: 0.541, blue: 0.569)
    static let borderDim    = Color(red: 0.180, green: 0.180, blue: 0.196)
    static let microLime    = Color(red: 0.71, green: 1.0, blue: 0.10)
}

// MARK: - Brand blob (SwiftUI Shape)

/// Brand blob silhouette — the canonical
/// `mwlogoset v2/icon-inline-dark.svg` bundled into the
/// widget's asset catalog with vector representation
/// preserved, so it scales crisply at any size on iOS 17+.
/// Widgets are static snapshots so we can't animate the
/// morph; the static silhouette is the correct mark.
struct BlobMark: View {
    var color: Color = WTheme.textPrimary
    var body: some View {
        // .renderingMode(.template) lets us tint the artwork
        // ink/light to match the rest of the widget surface.
        Image("mwblob-dark")
            .resizable()
            .renderingMode(.template)
            .aspectRatio(contentMode: .fit)
            .foregroundStyle(color)
    }
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
        ZStack {
            // Ambient background — large faint blob centered.
            // Widgets are snapshots so we render the static
            // silhouette; opacity tuned to feel like texture.
            GeometryReader { proxy in
                let dim = max(proxy.size.width, proxy.size.height) * 1.4
                BlobMark(color: WTheme.textPrimary)
                    .opacity(0.05)
                    .blur(radius: 6)
                    .frame(width: dim, height: dim)
                    .position(x: proxy.size.width * 0.85, y: proxy.size.height * 0.9)
            }
            .allowsHitTesting(false)

            if !entry.signedIn {
                placeholder
            } else {
                signedInBody
            }
        }
    }

    private var rowCount: Int {
        switch family {
        case .systemSmall:  return 2
        case .systemMedium: return 3
        case .systemLarge:  return 6
        default: return 1
        }
    }

    private var visible: [SharedAPI.CompactDoc] {
        Array(entry.docs.prefix(rowCount))
    }

    private var signedInBody: some View {
        VStack(alignment: .leading, spacing: 6) {
            header
            VStack(alignment: .leading, spacing: family == .systemSmall ? 3 : 5) {
                ForEach(visible) { doc in
                    Link(destination: docURL(doc.id)) {
                        DocPreview(doc: doc, dense: family == .systemSmall)
                    }
                }
                if visible.isEmpty {
                    Text("Nothing yet — tap below to capture.")
                        .font(.system(size: 10))
                        .foregroundStyle(WTheme.textMuted)
                        .padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
            captureButton
        }
        // Tight inner padding — combined with .contentMarginsDisabled
        // on the WidgetConfiguration, the canvas now fills nearly
        // edge to edge instead of being framed by a fat dead band.
        .padding(.horizontal, family == .systemSmall ? 10 : 12)
        .padding(.vertical, family == .systemSmall ? 10 : 12)
    }

    /// Header — small blob mark + ink wordmark + faint RECENT
    /// caption. Always shown with the blob (per the user feedback
    /// "memory.wiki 나올때는 항상 심볼이 같이 나오면 좋겠음").
    private var header: some View {
        HStack(alignment: .center, spacing: 6) {
            BlobMark()
                .frame(width: family == .systemSmall ? 14 : 16,
                       height: family == .systemSmall ? 14 : 16)
            Text("memory.wiki")
                .font(.system(size: family == .systemSmall ? 12 : 13,
                              weight: .semibold, design: .rounded))
                .foregroundStyle(WTheme.textPrimary)
            if family != .systemSmall {
                Text("RECENT")
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .tracking(1.0)
                    .foregroundStyle(WTheme.textFaint)
            }
            Spacer()
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(WTheme.borderDim.opacity(0.4))
                .frame(height: 0.5)
                .padding(.top, 22)
        }
    }

    /// Bottom-wide Capture button — full row, ink-on-textPrimary
    /// to read as the primary action. Bigger tap target than the
    /// previous tiny pill so it works on small widget too.
    private var captureButton: some View {
        Link(destination: URL(string: "memorywiki://capture")!) {
            HStack(spacing: 6) {
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .bold))
                Text("Capture")
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(WTheme.background)
            .frame(maxWidth: .infinity, minHeight: family == .systemSmall ? 28 : 32)
            .background(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(WTheme.textPrimary)
            )
        }
    }

    private var placeholder: some View {
        VStack(alignment: .leading, spacing: 6) {
            header
            Spacer()
            Text("Open the app once to sign in. Your recent memories will land here.")
                .font(.system(size: family == .systemSmall ? 10 : 11))
                .foregroundStyle(WTheme.textMuted)
                .lineSpacing(2)
            Spacer()
            captureButton.opacity(0.4)
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
            statusBadge
            Text(doc.displayTitle)
                .font(.system(size: dense ? 11 : 12, weight: .medium))
                .foregroundStyle(WTheme.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 4)
            Text(time)
                .font(.system(size: dense ? 9 : 10, weight: .medium, design: .monospaced))
                .foregroundStyle(WTheme.textFaint)
        }
    }

    /// Status icon mirroring the iOS DocStatusIcon vocabulary:
    /// globe for public, cloud for private. Same semantics as
    /// the main app so the widget reads as the same product.
    /// (Was a coloured dot + hollow ring earlier — user couldn't
    /// tell what the difference meant.)
    @ViewBuilder
    private var statusBadge: some View {
        Image(systemName: isPublic ? "globe" : "cloud.fill")
            .font(.system(size: dense ? 10 : 11, weight: .regular))
            .foregroundStyle(isPublic ? WTheme.textPrimary : WTheme.textFaint)
            .frame(width: 12)
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
