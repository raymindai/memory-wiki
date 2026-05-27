// TimelineView — bordered card list of the user's documents,
// grouped by time bucket (Today / Yesterday / This week / This
// month / Earlier), each row rendering the same status-icon
// vocabulary the web sidebar uses (Cloud / Globe / Users + sync
// badge). Top toolbar carries the section title, doc count, and
// quick affordances (search, new doc) so the timeline reads as
// the active surface of the app, not a static list.

import SwiftUI

@MainActor
final class TimelineModel: ObservableObject {
    @Published private(set) var documents: [Document] = []
    @Published private(set) var loading = false
    @Published var errorMessage: String?
    @Published var searchText: String = ""

    func load() async {
        loading = true
        defer { loading = false }
        do {
            let raw = try await APIClient.shared.userDocuments()
            documents = raw.sorted { $0.sortDate > $1.sortDate }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Filter by search text + group by bucket, preserving the
    /// reverse-chronological sort inside each bucket. Buckets
    /// with zero matches are dropped so the timeline collapses
    /// gracefully under tight search queries.
    var grouped: [(TimelineBucket, [Document])] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let visible = q.isEmpty
            ? documents
            : documents.filter { $0.displayTitle.lowercased().contains(q) }
        var by: [TimelineBucket: [Document]] = [:]
        for doc in visible {
            by[doc.bucket, default: []].append(doc)
        }
        return TimelineBucket.allCases.compactMap { bucket in
            guard let docs = by[bucket], !docs.isEmpty else { return nil }
            return (bucket, docs)
        }
    }
}

struct TimelineView: View {
    @StateObject private var model = TimelineModel()
    @State private var showingSearch = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                if showingSearch { searchBar }
                content
            }
        }
        .task { await model.load() }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("Timeline")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            Text("\(model.documents.count)")
                .font(Brand.mono(size: 11))
                .foregroundStyle(Brand.textFaint)
            Spacer()
            HeaderIconButton(systemName: "magnifyingglass") {
                withAnimation(.snappy(duration: 0.22)) { showingSearch.toggle() }
                if showingSearch { searchFocused = true }
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Brand.textFaint)
            TextField("Search titles", text: $model.searchText)
                .focused($searchFocused)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .font(Brand.body(size: 14))
                .foregroundStyle(Brand.textPrimary)
                .tint(Brand.textPrimary)
            if !model.searchText.isEmpty {
                Button { model.searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.textFaint)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(Brand.borderDim, lineWidth: 1)
                )
        )
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: - Content

    @ViewBuilder private var content: some View {
        if model.loading && model.documents.isEmpty {
            VStack(spacing: 10) {
                Spacer()
                ProgressView().tint(Brand.textFaint)
                Text("LOADING")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Spacer()
            }
            .frame(maxWidth: .infinity)
        } else if let error = model.errorMessage, model.documents.isEmpty {
            EmptyState(title: "Couldn't load timeline", caption: error, glyph: "wifi.slash")
        } else if model.documents.isEmpty {
            EmptyState(title: "Nothing captured yet", caption: "Use the Capture tab or the iOS Share Sheet to add your first doc.", glyph: "tray")
        } else if model.grouped.isEmpty {
            EmptyState(title: "No matches", caption: "Try a different search.", glyph: "magnifyingglass")
        } else {
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                    ForEach(model.grouped, id: \.0) { bucket, docs in
                        Section {
                            VStack(spacing: 6) {
                                ForEach(docs) { doc in
                                    DocumentRow(doc: doc)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.bottom, 14)
                        } header: {
                            BucketHeader(bucket: bucket, count: docs.count)
                        }
                    }
                }
                .padding(.bottom, 12)
            }
            .refreshable { await model.load() }
        }
    }
}

// MARK: - Bucket header

private struct BucketHeader: View {
    let bucket: TimelineBucket
    let count: Int

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(bucket.label)
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.2)
                .foregroundStyle(Brand.textFaint)
            Spacer()
            Text("\(count)")
                .font(Brand.mono(size: 10))
                .foregroundStyle(Brand.textFaint)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(Brand.background)
    }
}

// MARK: - Row

private struct DocumentRow: View {
    let doc: Document

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            DocStatusIcon(doc: doc, size: 18)
                .frame(width: 24, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                Text(doc.displayTitle)
                    .font(Brand.body(size: 14, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                trailingBadges
            }

            Spacer(minLength: 8)

            Text(doc.compactTime)
                .font(Brand.mono(size: 10))
                .foregroundStyle(Brand.textFaint)
                .lineLimit(1)

            ShareLink(item: doc.publicURL) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 26, height: 26)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Brand.borderDim, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    /// Inline micro chips for source + view count when present.
    @ViewBuilder private var trailingBadges: some View {
        let chips: [(String, String)] = {
            var out: [(String, String)] = []
            if let src = doc.syncedSource { out.append(("arrow.triangle.2.circlepath", src.uppercased())) }
            if let vc = doc.viewCount, vc > 0 { out.append(("eye", "\(vc)")) }
            return out
        }()
        if !chips.isEmpty {
            HStack(spacing: 8) {
                ForEach(0..<chips.count, id: \.self) { idx in
                    HStack(spacing: 3) {
                        Image(systemName: chips[idx].0)
                            .font(.system(size: 8, weight: .medium))
                        Text(chips[idx].1)
                            .font(Brand.mono(size: 9, weight: .medium))
                            .tracking(0.5)
                    }
                    .foregroundStyle(Brand.textFaint)
                }
            }
        } else {
            EmptyView()
        }
    }
}

// MARK: - Bits

private struct HeaderIconButton: View {
    let systemName: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Brand.textMuted)
                .frame(width: 34, height: 34)
                .background(
                    Circle()
                        .fill(.ultraThinMaterial)
                        .overlay(Circle().strokeBorder(Brand.borderDim, lineWidth: 1))
                )
        }
        .buttonStyle(.plain)
    }
}

private struct EmptyState: View {
    let title: String
    let caption: String
    let glyph: String

    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: glyph)
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Brand.textFaint)
            Text(title)
                .font(Brand.body(size: 15, weight: .medium))
                .foregroundStyle(Brand.textPrimary)
            Text(caption)
                .font(Brand.body(size: 13))
                .foregroundStyle(Brand.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    TimelineView()
}
