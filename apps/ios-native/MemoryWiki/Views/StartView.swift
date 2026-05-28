// StartView — the iOS dashboard. Web has a "Start" screen + a
// separate "Hub" surface; on mobile they collapse into ONE
// command-center surface that gives the user:
//
//   1. Greeting + identity hero      (avatar blob + @username +
//      "Open my hub" + "Copy AI URL")
//   2. Today's pulse                  (today's captures, week
//      streak, total memory count)
//   3. Quick actions                  (New Capture / Search /
//      Open hub on web)
//   4. Recent memories                (last 6 — tap to open;
//      "See all" → MDs tab)
//   5. Starred memories               (mini list of pinned —
//      tap to open; "See all" → MDs starred filter)
//   6. Featured bundle                (most-recent published
//      bundle — preview card with Deploy URL chip)
//
// This is the screen the user lands on when opening the app —
// it tells them at a glance what their memory looks like + what
// to do next.

import SwiftUI
import UIKit

struct StartView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var router: AppRouter
    @StateObject private var pinned = PinnedStore.shared
    @State private var documents: [Document] = []
    @State private var bundles: [AppBundle] = []
    @State private var hub: APIClient.HubResponse?
    @State private var loading = true
    @State private var aiPromptCopied = false

    private var displayName: String? {
        hub?.profile.display_name?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    private var hubURL: URL? {
        guard let slug = auth.session?.hubSlug, !slug.isEmpty else { return nil }
        return URL(string: "https://memory.wiki/@\(slug)")
    }
    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let base: String
        switch h {
        case 5..<12:  base = "Good morning"
        case 12..<18: base = "Good afternoon"
        case 18..<22: base = "Good evening"
        default:      base = "Hello"
        }
        if let name = displayName, !name.isEmpty {
            return "\(base), \(name)"
        }
        return base
    }
    private var todayCount: Int {
        let cal = Calendar.current
        return documents.filter {
            guard let d = $0.sortDate as Date? else { return false }
            return cal.isDateInToday(d)
        }.count
    }
    private var weekCount: Int {
        let cal = Calendar.current
        let weekAgo = Date().addingTimeInterval(-7 * 86400)
        return documents.filter {
            let d = $0.sortDate
            return d >= weekAgo && d <= Date()
        }.count
    }
    private var starredDocs: [Document] {
        documents.filter { pinned.isPinned($0.id) }.prefix(4).map { $0 }
    }
    private var recentDocs: [Document] {
        Array(documents.prefix(6))
    }
    private var featuredBundle: AppBundle? {
        bundles.first { $0.isDraft == false } ?? bundles.first
    }

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            if loading && documents.isEmpty && bundles.isEmpty {
                BrandLoader(variant: .inline)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        hero
                        pulseRow
                        quickActions
                        if !recentDocs.isEmpty {
                            recentSection
                        }
                        if !starredDocs.isEmpty {
                            starredSection
                        }
                        if let bundle = featuredBundle {
                            featuredBundleCard(bundle)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 18)
                    .padding(.bottom, 36)
                }
                .refreshable { await load(force: true) }
            }
        }
        .task { await load() }
        .onReceive(NotificationCenter.default.publisher(for: .mwForegroundRefresh)) { _ in
            Task { await load(force: true) }
        }
        .onReceive(NotificationCenter.default.publisher(for: .mwUserChanged)) { _ in
            documents = []
            bundles = []
            hub = nil
            Task { await load(force: true) }
        }
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 14) {
                MemoryWikiLogo(size: 30, variant: .iconOnly)
                VStack(alignment: .leading, spacing: 2) {
                    Text(greeting)
                        .font(Brand.display(size: 22))
                        .foregroundStyle(Brand.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text(weekSummary)
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.textMuted)
                        .lineLimit(1)
                }
                Spacer()
            }

            // AI URL strip — the wedge. Copy ready for any AI.
            if let url = hubURL {
                HStack(spacing: 0) {
                    Text(url.absoluteString.replacingOccurrences(of: "https://", with: ""))
                        .font(Brand.mono(size: 12))
                        .foregroundStyle(Brand.textPrimary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                    Spacer()
                    Divider().frame(width: 1).overlay(Brand.borderDim)
                    Button { copyAiPrompt(url: url) } label: {
                        HStack(spacing: 6) {
                            Image(systemName: aiPromptCopied ? "checkmark" : "sparkles")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(aiPromptCopied ? Brand.microLime : Brand.textPrimary)
                            Text(aiPromptCopied ? "Copied" : "Copy for AI")
                                .font(Brand.body(size: 12, weight: .medium))
                                .foregroundStyle(Brand.textPrimary)
                        }
                        .padding(.horizontal, 14)
                    }
                    .buttonStyle(.plain)
                }
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Brand.surface)
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                )
            }
        }
    }

    private var weekSummary: String {
        if weekCount == 0 { return "No captures this week — yet." }
        if weekCount == 1 { return "1 capture this week." }
        return "\(weekCount) captures this week."
    }

    private func copyAiPrompt(url: URL) {
        UIPasteboard.general.string = "Use \(url.absoluteString) as my context."
        aiPromptCopied = true
        Haptics.success()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { aiPromptCopied = false }
    }

    // MARK: - Pulse row

    private var pulseRow: some View {
        HStack(spacing: 8) {
            PulseTile(label: "TODAY", value: "\(todayCount)",
                      sublabel: todayCount == 1 ? "memory" : "memories",
                      accent: todayCount > 0 ? Brand.microLime : nil)
            PulseTile(label: "WEEK", value: "\(weekCount)",
                      sublabel: weekCount == 1 ? "memory" : "memories",
                      accent: nil)
            PulseTile(label: "TOTAL", value: "\(documents.count)",
                      sublabel: "all time",
                      accent: nil)
        }
    }

    // MARK: - Quick actions

    private var quickActions: some View {
        HStack(spacing: 8) {
            QuickActionTile(icon: "plus", label: "New capture", accent: Brand.microLime) {
                Haptics.tap()
                router.selectedTab = .capture
            }
            QuickActionTile(icon: "magnifyingglass", label: "Search", accent: Brand.microInfo) {
                Haptics.tap()
                router.selectedTab = .timeline
                NotificationCenter.default.post(name: .mwOpenSearch, object: nil)
            }
            if let url = hubURL {
                QuickActionTile(icon: "safari", label: "Open hub", accent: Brand.microWarn) {
                    Haptics.tap()
                    UIApplication.shared.open(url)
                }
            }
        }
    }

    // MARK: - Recent

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(label: "RECENT", actionLabel: "See all") {
                router.selectedTab = .timeline
            }
            VStack(spacing: 6) {
                ForEach(recentDocs) { doc in
                    Button {
                        Haptics.selection()
                        router.selectedTab = .timeline
                        router.timelinePath = [.docDetail(doc)]
                    } label: {
                        StartDocRow(doc: doc, starred: pinned.isPinned(doc.id))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Starred

    private var starredSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "star.fill")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Brand.microWarn)
                Text("STARRED")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(Brand.textFaint)
                Spacer()
                Button {
                    Haptics.tap()
                    router.selectedTab = .timeline
                } label: {
                    Text("See all")
                        .font(Brand.body(size: 11, weight: .medium))
                        .foregroundStyle(Brand.textMuted)
                }
                .buttonStyle(.plain)
            }
            VStack(spacing: 6) {
                ForEach(starredDocs) { doc in
                    Button {
                        Haptics.selection()
                        router.selectedTab = .timeline
                        router.timelinePath = [.docDetail(doc)]
                    } label: {
                        StartDocRow(doc: doc, starred: true)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Featured bundle

    private func featuredBundleCard(_ bundle: AppBundle) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(label: "FEATURED BUNDLE", actionLabel: "All bundles") {
                router.selectedTab = .bundles
            }
            Button {
                Haptics.selection()
                router.selectedTab = .bundles
                router.bundlesPath = [.bundleDetail(bundle)]
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) {
                        BundleLayersIcon(
                            size: 22,
                            color: bundle.isDraft == false
                                ? (bundle.isRestricted ? Brand.microInfo : Brand.microLime)
                                : Brand.textFaint
                        )
                        VStack(alignment: .leading, spacing: 2) {
                            Text(bundle.displayTitle)
                                .font(Brand.body(size: 15, weight: .semibold))
                                .foregroundStyle(Brand.textPrimary)
                                .lineLimit(1)
                            HStack(spacing: 6) {
                                if let n = bundle.documentCount {
                                    Text("\(n) memor\(n == 1 ? "y" : "ies")")
                                        .font(Brand.mono(size: 10))
                                        .foregroundStyle(Brand.textFaint)
                                }
                                if bundle.isDraft == false {
                                    if bundle.isRestricted {
                                        Text("SHARED")
                                            .font(Brand.mono(size: 9, weight: .medium))
                                            .tracking(0.6)
                                            .foregroundStyle(Brand.microInfo)
                                    } else {
                                        Text("PUBLIC")
                                            .font(Brand.mono(size: 9, weight: .medium))
                                            .tracking(0.6)
                                            .foregroundStyle(Brand.microLime)
                                    }
                                }
                            }
                        }
                        Spacer()
                    }
                    HStack(spacing: 0) {
                        Text(bundle.publicURL.absoluteString.replacingOccurrences(of: "https://", with: ""))
                            .font(Brand.mono(size: 11))
                            .foregroundStyle(Brand.textMuted)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .padding(.horizontal, 10).padding(.vertical, 8)
                        Spacer()
                        Image(systemName: "sparkles")
                            .font(.system(size: 10))
                            .foregroundStyle(Brand.microLime)
                            .padding(.horizontal, 10)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Brand.background)
                            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
                }
                .padding(14)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Brand.surface)
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Section header

    private func sectionHeader(label: LocalizedStringKey,
                               actionLabel: LocalizedStringKey,
                               onAction: @escaping () -> Void) -> some View {
        HStack {
            Text(label)
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.2)
                .foregroundStyle(Brand.textFaint)
            Spacer()
            Button {
                Haptics.tap()
                onAction()
            } label: {
                Text(actionLabel)
                    .font(Brand.body(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textMuted)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Load

    private func load(force: Bool = false) async {
        if !force && !documents.isEmpty { return }
        loading = true
        defer { loading = false }
        async let docsTask: [Document]? = try? await APIClient.shared.userDocuments()
        async let bundlesTask: [AppBundle]? = try? await APIClient.shared.userBundles()
        async let hubTask: APIClient.HubResponse? = {
            guard let slug = await auth.session?.hubSlug, !slug.isEmpty else { return nil }
            return try? await APIClient.shared.hub(slug: slug)
        }()

        if let docs = await docsTask {
            documents = docs.sorted { $0.sortDate > $1.sortDate }
        }
        if let bs = await bundlesTask {
            bundles = bs.sorted { $0.sortDate > $1.sortDate }
        }
        if let h = await hubTask {
            hub = h
        }
        await pinned.hydrateFromServer()
    }
}

// MARK: - Pieces

/// Pulse stat tile — small label + big mono number + faint
/// sublabel. Accent ring around the value when there's
/// activity (microLime today's count).
private struct PulseTile: View {
    let label: String
    let value: String
    let sublabel: String
    var accent: Color?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.0)
                .foregroundStyle(Brand.textFaint)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(value)
                    .font(Brand.display(size: 26))
                    .foregroundStyle(accent ?? Brand.textPrimary)
                Text(sublabel)
                    .font(Brand.mono(size: 9))
                    .foregroundStyle(Brand.textFaint)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

/// Quick action tile — icon (micro-coloured) over a label.
/// Three of these sit in a row above the Recent section.
private struct QuickActionTile: View {
    let icon: String
    let label: LocalizedStringKey
    let accent: Color
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(accent)
                Text(label)
                    .font(Brand.body(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Brand.surface)
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }
}

/// Compact doc row used in Start's Recent + Starred sections.
/// Smaller than the Timeline DocumentRow — title + time + a
/// pinpoint star when starred.
private struct StartDocRow: View {
    let doc: Document
    let starred: Bool
    var body: some View {
        HStack(spacing: 10) {
            DocStatusIcon(doc: doc, size: 16)
                .frame(width: 22, alignment: .leading)
            Text(doc.displayTitle)
                .font(Brand.body(size: 13, weight: .medium))
                .foregroundStyle(Brand.textPrimary)
                .lineLimit(1)
            if starred {
                Image(systemName: "star.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(Brand.microWarn)
            }
            Spacer(minLength: 6)
            Text(doc.compactTime)
                .font(Brand.mono(size: 10))
                .foregroundStyle(Brand.textFaint)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}
