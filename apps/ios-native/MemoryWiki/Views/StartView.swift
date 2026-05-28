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
    /// Drives the per-block stagger entrance once the data
    /// finishes loading. Each section reads its own delay.
    @State private var appeared = false

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
    private var starredItems: [StartItem] {
        let docs = documents.filter { pinned.isPinned($0.id) }
            .map { StartItem.doc($0) }
        let bs = bundles.filter { pinned.isPinnedBundle($0.id) }
            .map { StartItem.bundle($0) }
        return (docs + bs).sorted { $0.sortDate > $1.sortDate }.prefix(5).map { $0 }
    }
    private var recentItems: [StartItem] {
        let docs = documents.map { StartItem.doc($0) }
        let bs = bundles.map { StartItem.bundle($0) }
        return (docs + bs).sorted { $0.sortDate > $1.sortDate }.prefix(7).map { $0 }
    }
    private var featuredBundle: AppBundle? {
        bundles.first { $0.isDraft == false } ?? bundles.first
    }

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            if loading && documents.isEmpty && bundles.isEmpty {
                BrandLoader(variant: .inline)
                    .transition(.opacity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        staggered(0) { hero }
                        staggered(1) { pulseRow }
                        staggered(2) { quickActions }
                        if !recentItems.isEmpty {
                            staggered(3) { recentSection }
                        }
                        if !starredItems.isEmpty {
                            staggered(4) { starredSection }
                        }
                        if let bundle = featuredBundle {
                            staggered(5) { featuredBundleCard(bundle) }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 18)
                    .padding(.bottom, 36)
                }
                .refreshable { await load(force: true) }
                .transition(.opacity)
                .onAppear {
                    // Reset on every re-appear so revisiting the
                    // tab plays the entrance again.
                    appeared = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.04) {
                        appeared = true
                    }
                }
            }
        }
        .animation(.smooth(duration: 0.36), value: loading)
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
            // No leading blob — the blob already lives in the
            // tab bar as the Start tab's glyph. Repeating it
            // here at the top of the screen was redundant.
            VStack(alignment: .leading, spacing: 4) {
                Text(greeting)
                    .font(Brand.display(size: 28))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                Text(weekSummary)
                    .font(Brand.body(size: 13))
                    .foregroundStyle(Brand.textMuted)
                    .lineLimit(1)
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
                                .foregroundStyle(Brand.textPrimary)
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

    // MARK: - Pulse row (editorial number strip)

    /// Quiet, surface-less number strip — replaces the boxed
    /// stat cards. Each pair stacks the big display numeral
    /// above a mono caption; thin hairlines top + bottom anchor
    /// the row as one band. Less boxy, more "dashboard editorial."
    private var pulseRow: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Brand.borderDim).frame(height: 0.5)
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                pulseStat(value: "\(todayCount)", label: "TODAY")
                pulseDivider
                pulseStat(value: "\(weekCount)", label: "THIS WEEK")
                pulseDivider
                pulseStat(value: "\(documents.count)", label: "ALL TIME")
            }
            .padding(.vertical, 14)
            Rectangle().fill(Brand.borderDim).frame(height: 0.5)
        }
    }
    private func pulseStat(value: String, label: LocalizedStringKey) -> some View {
        VStack(alignment: .center, spacing: 6) {
            Text(value)
                .font(Brand.display(size: 30))
                .foregroundStyle(Brand.textPrimary)
                .tracking(-0.6)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.4)
                .foregroundStyle(Brand.textFaint)
        }
        .frame(maxWidth: .infinity)
    }
    private var pulseDivider: some View {
        Rectangle()
            .fill(Brand.borderDim)
            .frame(width: 0.5, height: 36)
    }

    // MARK: - Quick actions

    private var quickActions: some View {
        HStack(spacing: 8) {
            QuickActionTile(icon: "plus", label: "New capture", accent: Brand.textPrimary) {
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
                ForEach(recentItems) { item in
                    startRow(for: item)
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
                ForEach(starredItems) { item in
                    startRow(for: item)
                }
            }
        }
    }

    /// Renders the appropriate compact row + wires tap to jump
    /// to the right tab + push the detail. Same call site for
    /// doc and bundle so the section ordering by date is clean.
    @ViewBuilder
    private func startRow(for item: StartItem) -> some View {
        switch item {
        case .doc(let doc):
            Button {
                Haptics.selection()
                router.selectedTab = .timeline
                router.timelinePath = [.docDetail(doc)]
            } label: {
                StartDocRow(doc: doc, starred: pinned.isPinned(doc.id))
            }
            .buttonStyle(.plain)
        case .bundle(let bundle):
            Button {
                Haptics.selection()
                router.selectedTab = .bundles
                router.bundlesPath = [.bundleDetail(bundle)]
            } label: {
                StartBundleRow(bundle: bundle, starred: pinned.isPinnedBundle(bundle.id))
            }
            .buttonStyle(.plain)
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

    /// Stagger wrapper — fades + lifts each block in with a
    /// 0.08 s delay per slot. Animation re-triggers on
    /// .onAppear so revisits feel just as composed as the
    /// first load.
    @ViewBuilder
    private func staggered<Content: View>(_ index: Int,
                                          @ViewBuilder _ content: () -> Content) -> some View {
        content()
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 12)
            .animation(.smooth(duration: 0.55).delay(0.08 * Double(index)), value: appeared)
    }

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

/// Unified item wrapper so Recent + Starred sections can render
/// docs + bundles in one date-sorted list. Each case carries
/// its model and exposes a common sortDate for ordering.
enum StartItem: Identifiable {
    case doc(Document)
    case bundle(AppBundle)
    var id: String {
        switch self {
        case .doc(let d):    return "d:\(d.id)"
        case .bundle(let b): return "b:\(b.id)"
        }
    }
    var sortDate: Date {
        switch self {
        case .doc(let d):    return d.sortDate
        case .bundle(let b): return b.sortDate
        }
    }
}

/// Compact bundle row used in Start's Recent + Starred sections.
/// Mirrors StartDocRow's visual rhythm — same height, same
/// trailing time chip — so the mixed list reads as one stream.
private struct StartBundleRow: View {
    let bundle: AppBundle
    let starred: Bool
    var body: some View {
        HStack(spacing: 10) {
            BundleLayersIcon(
                size: 16,
                color: bundle.isDraft == false
                    ? (bundle.isRestricted ? Brand.microInfo : Brand.microLime)
                    : Brand.textFaint
            )
            .frame(width: 22, alignment: .leading)
            Text(bundle.displayTitle)
                .font(Brand.body(size: 13, weight: .medium))
                .foregroundStyle(Brand.textPrimary)
                .lineLimit(1)
            if starred {
                Image(systemName: "star.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(Brand.microWarn)
            }
            // Tiny BUNDLE caption so the user can tell at a
            // glance which item is a doc vs bundle in a mixed
            // list — same visual weight as the timestamp.
            Text("BUNDLE")
                .font(Brand.mono(size: 8, weight: .medium))
                .tracking(0.7)
                .foregroundStyle(Brand.textFaint)
            Spacer(minLength: 6)
            Text(bundle.compactTime)
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
