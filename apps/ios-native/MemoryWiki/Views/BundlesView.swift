// BundlesView — list of the user's bundles. Same row style as
// the timeline (glass card + status icon + mono time chip) so
// the iOS surface reads consistently between docs and bundles,
// just like the web sidebar's MDs / MD Bundles sections.

import SwiftUI

@MainActor
final class BundlesModel: ObservableObject {
    @Published private(set) var bundles: [AppBundle] = []
    @Published private(set) var loading = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    private var lastLoaded: Date?

    /// Same cache logic as TimelineModel — skip network when
    /// cached <30s ago unless caller forces.
    func load(force: Bool = false) async {
        if !force, !bundles.isEmpty,
           let last = lastLoaded, Date().timeIntervalSince(last) < 30 {
            return
        }
        if bundles.isEmpty { loading = true }
        defer { loading = false }
        do {
            bundles = try await APIClient.shared.userBundles()
                .sorted { $0.sortDate > $1.sortDate }
            lastLoaded = Date()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearForUserChange() {
        bundles = []
        lastLoaded = nil
        searchText = ""
        errorMessage = nil
    }

    var visible: [AppBundle] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return bundles }
        return bundles.filter { $0.displayTitle.lowercased().contains(q) }
    }
}

struct BundlesView: View {
    @EnvironmentObject private var router: AppRouter
    @StateObject private var model = BundlesModel()
    @StateObject private var pinned = PinnedStore.shared
    @State private var showingSearch = false
    @State private var filter: BundleFilter = .all
    @FocusState private var searchFocused: Bool

    /// Web-parity segmented filter — All / Private / Shared /
    /// Public. Bundles don't have a "synced" source like docs do,
    /// so the fourth chip is Public (published, non-restricted).
    enum BundleFilter: String, CaseIterable {
        case all, `private`, shared, `public`
        var label: LocalizedStringKey {
            switch self {
            case .all:     return "All"
            case .private: return "Private"
            case .shared:  return "Shared"
            case .public:  return "Public"
            }
        }
    }

    private var visibleBundles: [AppBundle] {
        switch filter {
        case .all:
            return model.visible
        case .private:
            return model.visible.filter { $0.isDraft == true }
        case .shared:
            return model.visible.filter { $0.isDraft == false && $0.isRestricted }
        case .public:
            return model.visible.filter { $0.isDraft == false && !$0.isRestricted }
        }
    }

    var body: some View {
        NavigationStack(path: $router.bundlesPath) {
            ZStack {
                Brand.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    header
                    if showingSearch { searchBar }
                    filterStrip
                    content
                }
            }
            .navigationDestination(for: BundlesRoute.self) { route in
                switch route {
                case .bundleDetail(let b):
                    BundleDetailView(seed: b)
                case .bundleDetailById(let id):
                    BundleDetailView(seed: AppBundle(
                        id: id, title: nil, description: nil, documentCount: nil,
                        updatedAt: nil, createdAt: nil, isDraft: nil,
                        visibility: nil, allowedEmailsCount: nil
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
                await model.load(force: true)
                await pinned.hydrateFromServer()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .mwUserChanged)) { _ in
            model.clearForUserChange()
            Task {
                await model.load(force: true)
                await pinned.hydrateFromServer()
            }
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("Bundles")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            Text("\(model.bundles.count)")
                .font(Brand.mono(size: 11))
                .foregroundStyle(Brand.textFaint)
            Spacer()
            Button {
                withAnimation(.snappy(duration: 0.22)) { showingSearch.toggle() }
                if showingSearch { searchFocused = true }
            } label: {
                Image(systemName: "magnifyingglass")
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
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private var filterStrip: some View {
        if !showingSearch {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(BundleFilter.allCases, id: \.self) { f in
                        FilterChip(label: f.label, isActive: filter == f) {
                            Haptics.selection()
                            withAnimation(.snappy(duration: 0.18)) { filter = f }
                        }
                    }
                }
                .padding(.horizontal, 18)
            }
            .padding(.bottom, 10)
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13))
                .foregroundStyle(Brand.textFaint)
            TextField("Search bundles", text: $model.searchText)
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
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    @ViewBuilder private var content: some View {
        contentInner
            .animation(.smooth(duration: 0.55), value: model.loading)
            .animation(.smooth(duration: 0.55), value: model.bundles.count)
    }

    @ViewBuilder private var contentInner: some View {
        if model.loading && model.bundles.isEmpty {
            BrandLoader(variant: .inline)
                .transition(.opacity)
        } else if let err = model.errorMessage, model.bundles.isEmpty {
            EmptyBundleState(
                title: "Couldn't load bundles",
                caption: LocalizedStringKey(err),
                glyph: "wifi.slash",
                action: ("Try again", { Task { await model.load() } })
            )
        } else if model.bundles.isEmpty {
            EmptyBundleState(
                title: "No bundles yet",
                caption: "Bundles group docs that share a topic. Create one on memory.wiki — each bundle gets its own URL you can deploy to AI.",
                glyph: "square.stack.3d.up",
                action: ("What's a bundle?", {
                    Haptics.tap()
                    if let url = URL(string: "https://memory.wiki/how#bundles") {
                        UIApplication.shared.open(url)
                    }
                })
            )
        } else if visibleBundles.isEmpty {
            EmptyBundleState(
                title: bundleEmptyTitle,
                caption: bundleEmptyCaption,
                glyph: bundleEmptyGlyph,
                action: filter == .all ? nil : ("Browse all", { withAnimation { filter = .all } })
            )
        } else {
            ScrollView {
                LazyVStack(spacing: 6) {
                    ForEach(visibleBundles) { bundle in
                        NavigationLink(value: BundlesRoute.bundleDetail(bundle)) {
                            BundleRow(bundle: bundle, isPinned: pinned.isPinnedBundle(bundle.id))
                                .contextMenu { bundleMenu(bundle) }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
            }
            .refreshable {
                await model.load(force: true)
                await pinned.hydrateFromServer()
            }
        }
    }

    private var bundleEmptyTitle: LocalizedStringKey {
        switch filter {
        case .all:     return "No matches"
        case .private: return "No private bundles"
        case .shared:  return "No shared bundles"
        case .public:  return "No public bundles"
        }
    }
    private var bundleEmptyCaption: LocalizedStringKey {
        switch filter {
        case .all:     return "Try a different search."
        case .private: return "Bundles you keep to yourself land here."
        case .shared:  return "Bundles you've shared with specific people land here."
        case .public:  return "Published bundles anyone can read land here."
        }
    }
    private var bundleEmptyGlyph: String {
        switch filter {
        case .all:     return "magnifyingglass"
        case .private: return "cloud"
        case .shared:  return "person.2"
        case .public:  return "globe"
        }
    }

    @ViewBuilder
    private func bundleMenu(_ bundle: AppBundle) -> some View {
        let isPinned = pinned.isPinnedBundle(bundle.id)
        Button {
            Haptics.selection()
            pinned.toggleBundle(bundle.id)
        } label: {
            Label(isPinned ? "Unstar" : "Star",
                  systemImage: isPinned ? "star.slash" : "star")
        }
        Divider()
        Button {
            UIPasteboard.general.string = bundle.publicURL.absoluteString
            Haptics.success()
        } label: {
            Label("Copy URL", systemImage: "doc.on.doc")
        }
        Button {
            UIPasteboard.general.string = "Use \(bundle.publicURL.absoluteString) as my context bundle."
            Haptics.success()
        } label: {
            Label("Copy AI prompt", systemImage: "sparkles")
        }
        ShareLink(item: bundle.publicURL) {
            Label("Share", systemImage: "square.and.arrow.up")
        }
        Button {
            UIApplication.shared.open(bundle.publicURL)
        } label: {
            Label("Open on web", systemImage: "safari")
        }
    }
}

private struct BundleRow: View {
    let bundle: AppBundle
    var isPinned: Bool = false

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // Layers glyph — matches the lucide-react `Layers`
            // icon the web uses in every bundle row, with the
            // same colour vocabulary (lime for public, info
            // blue for restricted, faint ink for private).
            BundleLayersIcon(
                size: 18,
                color: bundle.isDraft == false
                    ? (bundle.isRestricted ? Brand.microInfo : Brand.microLime)
                    : Brand.textFaint
            )
            .frame(width: 24, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(bundle.displayTitle)
                        .font(Brand.body(size: 14, weight: .medium))
                        .foregroundStyle(Brand.textPrimary)
                        .lineLimit(1)
                    if isPinned {
                        Image(systemName: "star.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(Brand.microWarn)
                    }
                }
                metaLine
            }

            Spacer(minLength: 8)
            Text(bundle.compactTime)
                .font(Brand.mono(size: 10))
                .foregroundStyle(Brand.textFaint)

            ShareLink(item: bundle.publicURL) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 26, height: 26)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
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

    private var metaLine: some View {
        HStack(spacing: 8) {
            if let n = bundle.documentCount {
                HStack(spacing: 3) {
                    Image(systemName: "doc.text").font(.system(size: 8, weight: .medium))
                    // Inflect.localized() in iOS 15+ handles plural
                    // form per-locale; Korean has no plural so it
                    // renders "12개" via the strings file.
                    Text("^[\(n) doc](inflect: true)")
                        .font(Brand.mono(size: 9, weight: .medium))
                        .tracking(0.4)
                }
                .foregroundStyle(Brand.textFaint)
            }
            if bundle.isDraft == false && bundle.isRestricted {
                Text("RESTRICTED")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(0.6)
                    .foregroundStyle(Brand.microInfo)
            } else if bundle.isDraft == false {
                Text("PUBLIC")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(0.6)
                    .foregroundStyle(Brand.microLime)
            } else {
                Text("PRIVATE")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(0.6)
                    .foregroundStyle(Brand.textFaint)
            }
        }
    }
}

private struct EmptyBundleState: View {
    let title: LocalizedStringKey
    let caption: LocalizedStringKey
    let glyph: String
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

/// Pure SwiftUI port of the web's `lucide-react` <Layers /> glyph
/// — three stacked diamonds — so the iOS bundle vocabulary
/// matches the web sidebar's bundle row exactly.
struct BundleLayersIcon: View {
    var size: CGFloat = 18
    var color: Color = .white
    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width
            let h = sz.height
            let strokeWidth: CGFloat = max(1.2, size * 0.08)
            // Top diamond
            var top = Path()
            top.move(to: CGPoint(x: w * 0.5, y: h * 0.10))
            top.addLine(to: CGPoint(x: w * 0.92, y: h * 0.32))
            top.addLine(to: CGPoint(x: w * 0.5, y: h * 0.54))
            top.addLine(to: CGPoint(x: w * 0.08, y: h * 0.32))
            top.closeSubpath()
            ctx.stroke(top, with: .color(color), lineWidth: strokeWidth)
            // Middle diamond
            var mid = Path()
            mid.move(to: CGPoint(x: w * 0.08, y: h * 0.50))
            mid.addLine(to: CGPoint(x: w * 0.5, y: h * 0.72))
            mid.addLine(to: CGPoint(x: w * 0.92, y: h * 0.50))
            ctx.stroke(mid, with: .color(color), lineWidth: strokeWidth)
            // Bottom diamond
            var bot = Path()
            bot.move(to: CGPoint(x: w * 0.08, y: h * 0.68))
            bot.addLine(to: CGPoint(x: w * 0.5, y: h * 0.90))
            bot.addLine(to: CGPoint(x: w * 0.92, y: h * 0.68))
            ctx.stroke(bot, with: .color(color), lineWidth: strokeWidth)
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    BundlesView().environmentObject(AppRouter.shared)
}
