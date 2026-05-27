// MemoryWikiWidget — Home + Lock screen widget. Three sizes:
//   - systemSmall  : 1 doc + a Capture deep link
//   - systemMedium : last 3 docs + a Capture deep link
//   - systemLarge  : last 5 docs + a Capture deep link
//
// Each row deep-links into the main app at memorywiki://doc/<id>.
// The "+ Capture" button deep-links to memorywiki://capture so
// the user starts a new doc in one tap from the lock screen.
//
// TimelineProvider refreshes every 30 minutes; we also kick a
// refresh on save (the main app calls WidgetCenter.shared
// .reloadAllTimelines() after a successful POST). Auth lives in
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
                .containerBackground(Color(red: 0.035, green: 0.035, blue: 0.043), for: .widget)
        }
        .configurationDisplayName("Memory.Wiki — Recent")
        .description("Last captures + a quick Capture shortcut.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
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
            let docs = (try? await SharedAPI.recentDocs(limit: 5)) ?? []
            let signedIn = SharedSessionStore.load() != nil
            completion(DocEntry(date: Date(), docs: docs, signedIn: signedIn))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DocEntry>) -> Void) {
        Task {
            let docs = (try? await SharedAPI.recentDocs(limit: 5)) ?? []
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
        case .systemSmall: return 1
        case .systemMedium: return 3
        case .systemLarge: return 5
        default: return 1
        }
    }

    private var visible: [SharedAPI.CompactDoc] {
        Array(entry.docs.prefix(rowCount))
    }

    // MARK: small

    private var smallBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            if let doc = visible.first {
                Link(destination: URL(string: "memorywiki://doc/\(doc.id)")!) {
                    DocPreview(doc: doc, dense: true)
                }
            } else {
                Text("No captures yet").font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
            }
            Spacer()
            captureButton
        }
        .padding(12)
    }

    // MARK: medium

    private var mediumBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            ForEach(visible) { doc in
                Link(destination: URL(string: "memorywiki://doc/\(doc.id)")!) {
                    DocPreview(doc: doc, dense: true)
                }
            }
            Spacer()
            captureButton
        }
        .padding(12)
    }

    // MARK: large

    private var largeBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            ForEach(visible) { doc in
                Link(destination: URL(string: "memorywiki://doc/\(doc.id)")!) {
                    DocPreview(doc: doc, dense: false)
                }
            }
            Spacer()
            captureButton
        }
        .padding(14)
    }

    // MARK: pieces

    private var header: some View {
        HStack(spacing: 0) {
            Text("memory")
                .foregroundStyle(Color(red: 0.71, green: 1.0, blue: 0.10))
            Text(".wiki")
                .foregroundStyle(.white)
        }
        .font(.system(size: 12, weight: .semibold))
    }

    private var captureButton: some View {
        Link(destination: URL(string: "memorywiki://capture")!) {
            HStack(spacing: 4) {
                Image(systemName: "plus").font(.system(size: 10, weight: .bold))
                Text("Capture").font(.system(size: 10, weight: .semibold))
            }
            .foregroundStyle(.black)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(Color.white))
        }
    }

    private var placeholder: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            Spacer()
            Text("Sign in on Memory.Wiki to see recents.")
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.6))
            Spacer()
            captureButton.opacity(0.4)
        }
        .padding(12)
    }
}

// MARK: - Row

private struct DocPreview: View {
    let doc: SharedAPI.CompactDoc
    let dense: Bool

    private var icon: String {
        doc.isDraft == false ? "globe" : "cloud.fill"
    }

    private var iconColor: Color {
        doc.isDraft == false ? Color(red: 0.71, green: 1.0, blue: 0.10) : Color.white.opacity(0.45)
    }

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
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: dense ? 9 : 11))
                .foregroundStyle(iconColor)
                .frame(width: dense ? 12 : 16)
            Text(doc.displayTitle)
                .font(.system(size: dense ? 11 : 13, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer(minLength: 4)
            Text(time)
                .font(.system(size: dense ? 9 : 10, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.5))
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
