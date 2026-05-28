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

    func load() async {
        loading = true
        defer { loading = false }
        do {
            bundles = try await APIClient.shared.userBundles()
                .sorted { $0.sortDate > $1.sortDate }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearForUserChange() {
        bundles = []
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
    @State private var showingSearch = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        NavigationStack(path: $router.bundlesPath) {
            ZStack {
                Brand.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    header
                    if showingSearch { searchBar }
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
        .task { await model.load() }
        .onReceive(NotificationCenter.default.publisher(for: .mwForegroundRefresh)) { _ in
            Task { await model.load() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .mwUserChanged)) { _ in
            model.clearForUserChange()
            Task { await model.load() }
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
        if model.loading && model.bundles.isEmpty {
            BrandLoader(variant: .inline)
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
        } else if model.visible.isEmpty {
            EmptyBundleState(
                title: "No matches",
                caption: "Try a different search.",
                glyph: "magnifyingglass",
                action: nil
            )
        } else {
            ScrollView {
                LazyVStack(spacing: 6) {
                    ForEach(model.visible) { bundle in
                        NavigationLink(value: BundlesRoute.bundleDetail(bundle)) {
                            BundleRow(bundle: bundle)
                                .contextMenu { bundleMenu(bundle) }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
            }
            .refreshable { await model.load() }
        }
    }

    @ViewBuilder
    private func bundleMenu(_ bundle: AppBundle) -> some View {
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

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // Stacked-sheets glyph — bundle's identity
            Image(systemName: "square.stack.3d.up.fill")
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(bundle.isDraft == false ? Brand.textPrimary : Brand.textFaint)
                .frame(width: 24, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                Text(bundle.displayTitle)
                    .font(Brand.body(size: 14, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
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

#Preview {
    BundlesView().environmentObject(AppRouter.shared)
}
