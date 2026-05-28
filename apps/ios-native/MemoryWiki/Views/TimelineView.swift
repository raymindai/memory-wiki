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
    @Published private(set) var semanticHits: [APIClient.SemanticHit] = []
    @Published private(set) var semanticLoading = false
    private var semanticTask: Task<Void, Never>?

    /// Debounced (300ms) semantic search. Cancels any pending
    /// previous request so only the latest query lands. The
    /// title-match filter is local + instant; this enriches the
    /// UI with body matches behind it.
    func searchTextChanged(to query: String) {
        searchText = query
        semanticTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 3 else {
            semanticHits = []
            semanticLoading = false
            return
        }
        semanticLoading = true
        semanticTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            do {
                let hits = try await APIClient.shared.semanticSearch(query: q, limit: 8)
                if Task.isCancelled { return }
                await MainActor.run {
                    self?.semanticHits = hits
                    self?.semanticLoading = false
                }
            } catch {
                await MainActor.run {
                    self?.semanticHits = []
                    self?.semanticLoading = false
                }
            }
        }
    }

    func load() async {
        loading = true
        defer { loading = false }
        do {
            let raw = try await APIClient.shared.userDocuments()
            documents = raw.sorted { $0.sortDate > $1.sortDate }
            errorMessage = nil
            // Push latest snapshot into iOS Spotlight so the
            // system search across docs stays in sync. Detached
            // because failures are non-fatal and the user has
            // already seen the timeline by this point.
            let docsSnapshot = documents
            Task.detached { await SpotlightIndexer.sync(docsSnapshot) }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Wipe the in-memory cache. Called on user-change events so
    /// the new account's first paint doesn't briefly show the
    /// previous account's docs (a quick "Untitled" flash). Also
    /// clears the Spotlight index for the same reason.
    func clearForUserChange() {
        documents = []
        semanticHits = []
        semanticTask?.cancel()
        semanticLoading = false
        errorMessage = nil
        searchText = ""
        Task.detached { await SpotlightIndexer.sync([]) }
    }

    /// Filter by search text + group by bucket. The caller
    /// passes pre-filtered docs (e.g. only starred) so the
    /// grouping logic stays small.
    func grouped(from source: [Document]) -> [(TimelineBucket, [Document])] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let visible = q.isEmpty
            ? source
            : source.filter { $0.displayTitle.lowercased().contains(q) }
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
    @EnvironmentObject private var router: AppRouter
    @StateObject private var model = TimelineModel()
    @StateObject private var pinned = PinnedStore.shared
    @State private var showingSearch = false
    @State private var filter: TimelineFilter = .all
    @FocusState private var searchFocused: Bool

    /// Top-level segmented filter — All vs Starred. Future
    /// additions (Public / Synced) plug in here.
    enum TimelineFilter: String, CaseIterable {
        case all, starred
        var label: LocalizedStringKey {
            switch self {
            case .all:     return "All"
            case .starred: return "Starred"
            }
        }
    }

    private var pinnedDocs: [Document] {
        guard !pinned.docIds.isEmpty else { return [] }
        return model.documents.filter { pinned.isPinned($0.id) }
    }

    /// Apply the segmented filter on top of the loaded documents
    /// before grouping. When Starred is active, only pinned docs
    /// show (and the explicit pinned-section gets folded into
    /// the buckets so the user sees them grouped chronologically).
    private func docsForFilter() -> [Document] {
        switch filter {
        case .all:     return model.documents
        case .starred: return model.documents.filter { pinned.isPinned($0.id) }
        }
    }

    var body: some View {
        NavigationStack(path: $router.timelinePath) {
            ZStack {
                Brand.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    header
                    if showingSearch { searchBar }
                    filterStrip
                    content
                }
            }
            .navigationDestination(for: TimelineRoute.self) { route in
                switch route {
                case .docDetail(let doc):
                    DocumentDetailView(seed: doc)
                case .docDetailById(let id):
                    DocumentDetailView(seed: Document(
                        id: id, title: nil, updatedAt: nil, createdAt: nil,
                        isDraft: nil, viewCount: nil, allowedEmails: nil, source: nil
                    ))
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task {
            await model.load()
            await pinned.hydrateFromServer()
        }
        .onReceive(NotificationCenter.default.publisher(for: .mwForegroundRefresh)) { _ in
            Task {
                await model.load()
                await pinned.hydrateFromServer()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .mwOpenSearch)) { _ in
            withAnimation(.snappy(duration: 0.22)) { showingSearch = true }
            searchFocused = true
        }
        .onReceive(NotificationCenter.default.publisher(for: .mwUserChanged)) { _ in
            // Account switch — empty the list immediately, then
            // re-fetch under the new identity.
            model.clearForUserChange()
            Task {
                await model.load()
                await pinned.hydrateFromServer()
            }
        }
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

    /// All / Starred segmented filter strip. Hidden when search
    /// is active to keep the chrome quiet.
    @ViewBuilder
    private var filterStrip: some View {
        if !showingSearch {
            HStack(spacing: 6) {
                ForEach(TimelineFilter.allCases, id: \.self) { f in
                    Button {
                        Haptics.selection()
                        withAnimation(.snappy(duration: 0.18)) { filter = f }
                    } label: {
                        HStack(spacing: 5) {
                            if f == .starred {
                                // Star glyph in micro-warn yellow —
                                // every other star surface uses the
                                // same colour so the brand reads
                                // "starred = warm yellow."
                                Image(systemName: filter == f ? "star.fill" : "star")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(Brand.microWarn)
                            }
                            Text(f.label)
                                .font(Brand.body(size: 12, weight: .medium))
                                .foregroundStyle(filter == f ? Brand.textPrimary : Brand.textMuted)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(filter == f ? Brand.surface : Color.clear)
                                .overlay(Capsule().strokeBorder(filter == f ? Brand.borderDim : .clear, lineWidth: 1))
                        )
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 10)
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Brand.textFaint)
            TextField("Search titles or meaning", text: Binding(
                get: { model.searchText },
                set: { model.searchTextChanged(to: $0) }
            ))
                .focused($searchFocused)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .font(Brand.body(size: 14))
                .foregroundStyle(Brand.textPrimary)
                .tint(Brand.textPrimary)
            if model.semanticLoading {
                ProgressView()
                    .scaleEffect(0.55)
                    .tint(Brand.textFaint)
            }
            if !model.searchText.isEmpty {
                Button { model.searchTextChanged(to: "") } label: {
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
            BrandLoader(variant: .inline)
        } else if let error = model.errorMessage, model.documents.isEmpty {
            EmptyState(
                title: "Couldn't load timeline",
                caption: LocalizedStringKey(error),
                glyph: "wifi.slash",
                action: ("Try again", { Task { await model.load() } })
            )
        } else if model.documents.isEmpty {
            EmptyState(
                title: "Nothing captured yet",
                caption: "Write something, paste a URL from your clipboard, or use the iOS Share Sheet from Safari.",
                glyph: "tray",
                action: ("Capture your first memory", { Haptics.tap(); router.selectedTab = .capture })
            )
        } else if model.grouped(from: docsForFilter()).isEmpty && model.semanticHits.isEmpty {
            EmptyState(
                title: filter == .starred ? "No starred memories" : "No matches",
                caption: filter == .starred
                    ? "Long-press a memory in the All view to star it."
                    : "Try a shorter query — meaning-based search needs at least 3 characters.",
                glyph: filter == .starred ? "star" : "magnifyingglass",
                action: filter == .starred
                    ? ("Browse all", { withAnimation { filter = .all } })
                    : nil
            )
        } else {
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                    // Pinned docs surface above the time buckets
                    // — only shown in All view + no active search,
                    // since the Starred filter already promotes
                    // them to the whole list.
                    if filter == .all && !pinnedDocs.isEmpty && model.searchText.isEmpty {
                        Section {
                            VStack(spacing: 6) {
                                ForEach(pinnedDocs) { doc in
                                    NavigationLink(value: TimelineRoute.docDetail(doc)) {
                                        DocumentRow(doc: doc, isPinned: true)
                                            .contextMenu { docMenu(doc) }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.bottom, 14)
                        } header: {
                            BucketHeader(bucket: .pinned, count: pinnedDocs.count)
                        }
                    }
                    ForEach(model.grouped(from: docsForFilter()), id: \.0) { bucket, docs in
                        Section {
                            VStack(spacing: 6) {
                                ForEach(docs) { doc in
                                    NavigationLink(value: TimelineRoute.docDetail(doc)) {
                                        DocumentRow(doc: doc, isPinned: pinned.isPinned(doc.id))
                                            .contextMenu { docMenu(doc) }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.bottom, 14)
                        } header: {
                            BucketHeader(bucket: bucket, count: docs.count)
                        }
                    }
                    if !model.semanticHits.isEmpty {
                        SemanticSection(hits: model.semanticHits)
                    }
                }
                .padding(.bottom, 12)
            }
            .refreshable { await model.load() }
        }
    }

    /// Long-press menu shared by pinned + bucketed rows. Covers
    /// star/unstar, copy URL, copy AI prompt, share, open on web.
    @ViewBuilder
    private func docMenu(_ doc: Document) -> some View {
        Button {
            Haptics.selection()
            pinned.toggle(doc.id)
        } label: {
            Label(pinned.isPinned(doc.id) ? "Unstar" : "Star",
                  systemImage: pinned.isPinned(doc.id) ? "star.slash" : "star")
        }
        Divider()
        Button {
            UIPasteboard.general.string = doc.publicURL.absoluteString
            Haptics.success()
        } label: {
            Label("Copy URL", systemImage: "doc.on.doc")
        }
        Button {
            UIPasteboard.general.string = "Use \(doc.publicURL.absoluteString) as my context."
            Haptics.success()
        } label: {
            Label("Copy AI prompt", systemImage: "sparkles")
        }
        ShareLink(item: doc.publicURL) {
            Label("Share", systemImage: "square.and.arrow.up")
        }
        Button {
            UIApplication.shared.open(doc.publicURL)
        } label: {
            Label("Open on web", systemImage: "safari")
        }
    }
}

// MARK: - Bucket header

private struct BucketHeader: View {
    let bucket: TimelineBucket
    let count: Int

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(LocalizedStringKey(bucket.label))
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
    var isPinned: Bool = false

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            DocStatusIcon(doc: doc, size: 18)
                .frame(width: 24, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(doc.displayTitle)
                        .font(Brand.body(size: 14, weight: .medium))
                        .foregroundStyle(Brand.textPrimary)
                        .lineLimit(1)
                    if isPinned {
                        // Starred = micro-warn yellow filled star.
                        // Brand convention: lime for public status,
                        // warn yellow for user-curated/personal.
                        Image(systemName: "star.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(Brand.microWarn)
                    }
                }
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
        // Solid zinc surface — was .ultraThinMaterial which on a
        // dark canvas reads as bright glass and made the whole
        // timeline feel washed out. Brand.surface matches the
        // web's row treatment + the rest of the iOS chrome.
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Brand.borderDim, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    /// Inline micro chips for source + view count when present.
    /// Micro-color vocab: sync chip uses info blue (matches web's
    /// data-sidebar sync badge); view count stays faint.
    @ViewBuilder private var trailingBadges: some View {
        HStack(spacing: 8) {
            if let src = doc.syncedSource {
                HStack(spacing: 3) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 8, weight: .medium))
                    Text(src.uppercased())
                        .font(Brand.mono(size: 9, weight: .medium))
                        .tracking(0.5)
                }
                .foregroundStyle(Brand.microInfo)
            }
            if let vc = doc.viewCount, vc > 0 {
                HStack(spacing: 3) {
                    Image(systemName: "eye")
                        .font(.system(size: 8, weight: .medium))
                    Text("\(vc)")
                        .font(Brand.mono(size: 9, weight: .medium))
                        .tracking(0.5)
                }
                .foregroundStyle(Brand.textFaint)
            }
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

/// Semantic results section — body matches behind the title-match
/// bucketed list. Header is mono caption "BY MEANING"; rows reuse
/// the glass card chrome but include a snippet line.
private struct SemanticSection: View {
    let hits: [APIClient.SemanticHit]

    var body: some View {
        Section {
            VStack(spacing: 6) {
                ForEach(hits) { hit in
                    NavigationLink(value: TimelineRoute.docDetailById(hit.id)) {
                        SemanticRow(hit: hit)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 14)
        } header: {
            HStack(alignment: .firstTextBaseline) {
                Text("BY MEANING")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(Brand.textFaint)
                Spacer()
                Text("\(hits.count)")
                    .font(Brand.mono(size: 10))
                    .foregroundStyle(Brand.textFaint)
            }
            .padding(.horizontal, 20).padding(.vertical, 10)
            .background(Brand.background)
        }
    }
}

private struct SemanticRow: View {
    let hit: APIClient.SemanticHit
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "sparkles")
                .font(.system(size: 13))
                .foregroundStyle(Brand.textFaint)
                .frame(width: 24, alignment: .leading)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text(hit.title.isEmpty ? "Untitled" : hit.title)
                    .font(Brand.body(size: 14, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                if !hit.snippet.isEmpty {
                    Text(hit.snippet.trimmingCharacters(in: .whitespacesAndNewlines))
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.textMuted)
                        .lineLimit(2)
                        .lineSpacing(2)
                }
            }
            Spacer(minLength: 4)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct EmptyState: View {
    let title: LocalizedStringKey
    let caption: LocalizedStringKey
    let glyph: String
    /// Optional CTA — first-launch empty state surfaces a route
    /// out (Capture tab); error states surface a retry.
    let action: (LocalizedStringKey, () -> Void)?

    var body: some View {
        ZStack {
            AmbientBlob()
            VStack(spacing: 14) {
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
                    .lineSpacing(3)
                    .padding(.horizontal, 40)
                if let (label, run) = action {
                    Button(action: run) {
                        Text(label)
                            .font(Brand.body(size: 13, weight: .medium))
                            .foregroundStyle(Brand.background)
                            .padding(.horizontal, 18).padding(.vertical, 10)
                            .background(Capsule().fill(Brand.textPrimary))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 4)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity)
        }
    }
}

#Preview {
    TimelineView()
}
