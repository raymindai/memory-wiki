// ProfileView — the iOS Settings + "use surface" combined. Top
// card carries the @<slug> URL and the Copy-for-AI affordance
// (the paste-anywhere wedge). Below: account, appearance, help,
// about, legal, sign out. All quiet ink rows over glass.

import SwiftUI
import MessageUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthManager
    @AppStorage("mw.onboarded") private var onboarded: Bool = false
    @State private var copied = false
    @State private var hubCopied = false
    @State private var path: [SettingsRoute] = []
    @State private var showFeedback = false
    @State private var showMailUnavailable = false
    @State private var hubStats: APIClient.HubResponse? = nil
    @State private var loadingHub = false
    @State private var showEditDisplayName = false

    private var hubURL: URL? {
        guard let slug = auth.session?.hubSlug, !slug.isEmpty else { return nil }
        return URL(string: "https://memory.wiki/@\(slug)")
    }

    private var version: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "v\(v) (\(b))"
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Brand.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        title
                        hubCard
                        hubStatsCard
                        section("ACCOUNT") {
                            SettingRow(label: "Email", value: auth.session?.email)
                            if let slug = auth.session?.hubSlug {
                                SettingRow(label: "Username", value: "@\(slug)")
                            }
                            // Display Name — what greets the user on
                            // Start and what shows on shared/public
                            // surfaces. Tappable to edit inline.
                            SettingTapValueRow(
                                label: "Display Name",
                                value: auth.session?.displayName ?? "—",
                                isPlaceholder: (auth.session?.displayName ?? "").isEmpty
                            ) {
                                showEditDisplayName = true
                            }
                        }
                        section("LANGUAGE") {
                            SettingActionRow(label: "Change app language",
                                             systemImage: "globe",
                                             iconTint: Brand.microInfo) {
                                Haptics.tap()
                                // iOS shows "Memory.Wiki → Preferred Language"
                                // automatically because we bundle ko + en
                                // localisations. Opening Settings is the
                                // standard pattern — Apple doesn't expose
                                // an in-app override that survives without
                                // wrestling Bundle internals.
                                if let url = URL(string: UIApplication.openSettingsURLString) {
                                    UIApplication.shared.open(url)
                                }
                            }
                        }
                        section("LEARN") {
                            SettingNavRow(label: "Help & Shortcuts",
                                          systemImage: "questionmark.circle",
                                          iconTint: Brand.microInfo) {
                                path.append(.help)
                            }
                            SettingActionRow(label: "Replay welcome tour",
                                             systemImage: "sparkles",
                                             iconTint: Brand.microWarn) {
                                Haptics.tap()
                                onboarded = false
                            }
                            SettingNavRow(label: "About Memory.Wiki",
                                          systemImage: "info.circle",
                                          iconTint: Brand.microInfo) {
                                path.append(.about)
                            }
                        }
                        section("FEEDBACK") {
                            SettingActionRow(label: "Send feedback",
                                             systemImage: "envelope",
                                             iconTint: Brand.microWarn) {
                                Haptics.tap()
                                if MFMailComposeViewController.canSendMail() {
                                    showFeedback = true
                                } else {
                                    showMailUnavailable = true
                                }
                            }
                            SettingLink(label: "Manifesto",
                                        systemImage: "arrow.up.right",
                                        url: URL(string: "https://memory.wiki/manifesto")!)
                            SettingLink(label: "How it works",
                                        systemImage: "arrow.up.right",
                                        url: URL(string: "https://memory.wiki/how")!)
                        }
                        section("LEGAL") {
                            SettingLink(label: "Terms",
                                        systemImage: "arrow.up.right",
                                        url: URL(string: "https://memory.wiki/terms")!)
                            SettingLink(label: "Privacy",
                                        systemImage: "arrow.up.right",
                                        url: URL(string: "https://memory.wiki/privacy")!)
                        }
                        section("VERSION") {
                            SettingRow(label: "iOS Companion", value: version)
                        }
                        signOutButton
                            .padding(.top, 12)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 18)
                    .padding(.bottom, 32)
                }
            }
            .navigationDestination(for: SettingsRoute.self) { route in
                switch route {
                case .help: HelpView()
                case .about: AboutView()
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $showEditDisplayName) {
            DisplayNameEditor(
                current: auth.session?.displayName ?? "",
                onSave: { newName in
                    Task {
                        try? await auth.updateDisplayName(newName)
                        showEditDisplayName = false
                    }
                },
                onCancel: { showEditDisplayName = false }
            )
            .iOS26Sheet([.height(280)])
        }
        .sheet(isPresented: $showFeedback) {
            FeedbackComposer(isPresented: $showFeedback)
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
        }
        .alert("Mail unavailable", isPresented: $showMailUnavailable) {
            Button("Copy address") {
                UIPasteboard.general.string = "hi@raymind.ai"
                Haptics.success()
            }
            Button("OK", role: .cancel) {}
        } message: {
            Text("Set up a Mail account in iOS Settings, or email hi@raymind.ai from any other app.")
        }
        .onAppear {
            // Dark-only app — force dark scheme on every appear in
            // case iOS auto-switched based on system Light mode.
            for scene in UIApplication.shared.connectedScenes {
                (scene as? UIWindowScene)?.windows.forEach {
                    $0.overrideUserInterfaceStyle = .dark
                }
            }
        }
        .task { await loadHubStats() }
        .onReceive(NotificationCenter.default.publisher(for: .mwUserChanged)) { _ in
            hubStats = nil
            Task { await loadHubStats() }
        }
    }

    /// Render a compact owner-view summary of the user's hub:
    /// stat tiles (docs / bundles) + counts split by public /
    /// shared / private if available. Hidden when the user has
    /// no hub slug yet (their hubCard already explains the
    /// claim flow).
    @ViewBuilder private var hubStatsCard: some View {
        if let slug = auth.session?.hubSlug, !slug.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("YOUR HUB")
                if let hub = hubStats {
                    HStack(spacing: 8) {
                        HubStatTile(
                            label: "MEMORIES",
                            value: hub.stats?.documents.map(String.init) ?? "—",
                            sublabel: hub.ownerView?.documents.flatMap { ov in
                                let pub = ov.public?.count ?? 0
                                let pri = (ov.private?.count ?? 0) + (ov.shared?.count ?? 0)
                                return "\(pub) public · \(pri) private"
                            } ?? "",
                            accent: Brand.microInfo
                        )
                        HubStatTile(
                            label: "BUNDLES",
                            value: hub.stats?.bundles.map(String.init) ?? "—",
                            sublabel: hub.ownerView?.bundles.flatMap { ov in
                                let pub = ov.public?.count ?? 0
                                let pri = (ov.private?.count ?? 0) + (ov.shared?.count ?? 0)
                                return "\(pub) public · \(pri) private"
                            } ?? "",
                            accent: Brand.microWarn
                        )
                    }
                    if let desc = hub.profile.hub_description, !desc.isEmpty {
                        Text(desc)
                            .font(Brand.body(size: 12))
                            .foregroundStyle(Brand.textMuted)
                            .lineSpacing(2)
                    }
                } else if loadingHub {
                    Text("Loading hub…")
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.textFaint)
                        .padding(.vertical, 8)
                } else {
                    Text("Couldn't load hub stats.")
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.textFaint)
                }
            }
        }
    }

    /// Async fetch — uses the authenticated /api/hub/<slug>
    /// endpoint which returns owner-view buckets when the
    /// Bearer matches.
    private func loadHubStats() async {
        guard let slug = auth.session?.hubSlug, !slug.isEmpty else { return }
        loadingHub = true
        defer { loadingHub = false }
        do {
            hubStats = try await APIClient.shared.hub(slug: slug)
        } catch {
            // Silent — leave nil; UI shows the error fallback.
        }
    }

    private var title: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Settings")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            Spacer()
        }
    }

    @ViewBuilder private var hubCard: some View {
        if let url = hubURL {
            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("YOUR AI MEMORY URL")
                HStack(spacing: 0) {
                    Text(url.absoluteString.replacingOccurrences(of: "https://", with: ""))
                        .font(Brand.mono(size: 13))
                        .foregroundStyle(Brand.textPrimary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 14)
                    Spacer()
                    Divider().frame(width: 1).overlay(Brand.borderDim)
                    Button { copyForAI(url: url) } label: {
                        HStack(spacing: 6) {
                            Image(systemName: copied ? "checkmark" : "sparkles")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(copied ? Brand.textPrimary : Brand.microInfo)
                            Text(copied ? "Copied" : "Copy for AI")
                                .font(Brand.body(size: 12, weight: .medium))
                                .foregroundStyle(Brand.textPrimary)
                        }
                        .padding(.horizontal, 14)
                    }
                    .buttonStyle(.plain)
                }
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                )
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                // Two affordances under the URL: open in Safari + copy the bare URL
                HStack(spacing: 8) {
                    QuietActionButton(label: "Open my hub", systemImage: "safari") {
                        Haptics.tap()
                        UIApplication.shared.open(url)
                    }
                    QuietActionButton(label: hubCopied ? "Copied" : "Copy URL", systemImage: hubCopied ? "checkmark" : "doc.on.doc") {
                        UIPasteboard.general.string = url.absoluteString
                        hubCopied = true
                        Haptics.success()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { hubCopied = false }
                    }
                }
                Text("Paste into Claude, ChatGPT, or Cursor. The URL serves markdown to AI clients automatically.")
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textMuted)
                    .lineSpacing(2)
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel("YOUR AI MEMORY URL")
                Text("Open memory.wiki on the web to claim your @username and unlock the cross-AI URL.")
                    .font(Brand.body(size: 13))
                    .foregroundStyle(Brand.textMuted)
                    .padding(.horizontal, 14).padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(.ultraThinMaterial)
                            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
                QuietActionButton(label: "Open memory.wiki", systemImage: "safari") {
                    Haptics.tap()
                    if let u = URL(string: "https://memory.wiki") {
                        UIApplication.shared.open(u)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func section<Content: View>(_ label: LocalizedStringKey, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(label)
            VStack(spacing: 0) { content() }
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                )
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private var signOutButton: some View {
        Button {
            Haptics.warning()
            Task { await auth.signOut() }
        } label: {
            Text("Sign out")
                .font(Brand.body(size: 14, weight: .medium))
                .foregroundStyle(Brand.microRed)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                )
        }
        .buttonStyle(.plain)
    }

    private func copyForAI(url: URL) {
        UIPasteboard.general.string = "Use \(url.absoluteString) as my context."
        copied = true
        Haptics.success()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { copied = false }
    }

    // Theme system removed — app is dark-only by product decision.
}

/// Navigation destinations inside the Settings tab. Kept narrow on
/// purpose — Help + About are the only push targets. Linked routes
/// (web URLs) use SettingLink → Link → SFSafariViewController.
enum SettingsRoute: Hashable {
    case help
    case about
}

// MARK: - Rows
//
// All row labels are `LocalizedStringKey` so Korean (or any
// future locale) flows through SwiftUI's automatic lookup.
// Passing a literal at the call site still works — Swift
// converts string-literal → LocalizedStringKey implicitly.

/// Compact stat tile for the hub overview — big mono number +
/// uppercased label + faint mono sublabel ("12 public · 4 private").
private struct HubStatTile: View {
    let label: String
    let value: String
    let sublabel: String
    /// Tiny coloured indicator next to the label — distinguishes
    /// MEMORIES (info) from BUNDLES (warn) at a glance without
    /// adding background tints. The dot is 5pt so it reads as
    /// "category marker" not "status pill".
    var accent: Color = Brand.textFaint
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Circle()
                    .fill(accent)
                    .frame(width: 5, height: 5)
                Text(label)
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1.0)
                    .foregroundStyle(Brand.textFaint)
            }
            Text(value)
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            if !sublabel.isEmpty {
                Text(sublabel)
                    .font(Brand.mono(size: 9))
                    .foregroundStyle(Brand.textFaint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
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

private struct SectionLabel: View {
    let text: LocalizedStringKey
    init(_ text: LocalizedStringKey) { self.text = text }
    var body: some View {
        Text(text)
            .font(Brand.mono(size: 9, weight: .medium))
            .tracking(1.2)
            .foregroundStyle(Brand.textFaint)
    }
}

private struct SettingRow: View {
    let label: LocalizedStringKey
    let value: String?
    var body: some View {
        HStack {
            Text(label).font(Brand.body(size: 14)).foregroundStyle(Brand.textPrimary)
            Spacer()
            if let value {
                Text(value).font(Brand.body(size: 13)).foregroundStyle(Brand.textMuted)
                    .lineLimit(1).truncationMode(.middle)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 14)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Brand.borderDim).frame(height: 1).padding(.leading, 14)
        }
    }
}

private struct SettingLink: View {
    let label: LocalizedStringKey
    let systemImage: String
    let url: URL
    var body: some View {
        Link(destination: url) {
            HStack {
                Text(label).font(Brand.body(size: 14)).foregroundStyle(Brand.textPrimary)
                Spacer()
                Image(systemName: systemImage)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
            }
            .padding(.horizontal, 14).padding(.vertical, 14)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Brand.borderDim).frame(height: 1).padding(.leading, 14)
            }
        }
    }
}

private struct SettingNavRow: View {
    let label: LocalizedStringKey
    let systemImage: String
    /// Optional accent for the leading glyph. Defaults to muted ink
    /// so legacy call sites stay quiet; pass a Brand.microXxx tint
    /// to highlight the row's intent (info / warn / red).
    var iconTint: Color = Brand.textMuted
    var onTap: () -> Void
    var body: some View {
        Button {
            Haptics.selection()
            onTap()
        } label: {
            HStack {
                Image(systemName: systemImage)
                    .font(.system(size: 13))
                    .foregroundStyle(iconTint)
                    .frame(width: 20, alignment: .center)
                Text(label).font(Brand.body(size: 14)).foregroundStyle(Brand.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
            }
            .padding(.horizontal, 14).padding(.vertical, 14)
            .contentShape(Rectangle())
            .overlay(alignment: .bottom) {
                Rectangle().fill(Brand.borderDim).frame(height: 1).padding(.leading, 14)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct SettingActionRow: View {
    let label: LocalizedStringKey
    let systemImage: String
    var iconTint: Color = Brand.textMuted
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack {
                Image(systemName: systemImage)
                    .font(.system(size: 13))
                    .foregroundStyle(iconTint)
                    .frame(width: 20, alignment: .center)
                Text(label).font(Brand.body(size: 14)).foregroundStyle(Brand.textPrimary)
                Spacer()
            }
            .padding(.horizontal, 14).padding(.vertical, 14)
            .contentShape(Rectangle())
            .overlay(alignment: .bottom) {
                Rectangle().fill(Brand.borderDim).frame(height: 1).padding(.leading, 14)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct QuietActionButton: View {
    let label: LocalizedStringKey
    let systemImage: String
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.system(size: 11, weight: .medium))
                Text(label)
                    .font(Brand.body(size: 12, weight: .medium))
            }
            .foregroundStyle(Brand.textPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }
}

/// Tappable variant of SettingRow — shows label on the left,
/// current value (or placeholder dash) on the right, chevron at
/// the end. Used by ACCOUNT → Display Name to open the editor.
private struct SettingTapValueRow: View {
    let label: LocalizedStringKey
    let value: String
    var isPlaceholder: Bool = false
    var onTap: () -> Void
    var body: some View {
        Button(action: {
            Haptics.selection()
            onTap()
        }) {
            HStack {
                Text(label).font(Brand.body(size: 14)).foregroundStyle(Brand.textPrimary)
                Spacer()
                Text(value)
                    .font(Brand.body(size: 13))
                    .foregroundStyle(isPlaceholder ? Brand.textFaint : Brand.textMuted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
            }
            .padding(.horizontal, 14).padding(.vertical, 14)
            .contentShape(Rectangle())
            .overlay(alignment: .bottom) {
                Rectangle().fill(Brand.borderDim).frame(height: 1).padding(.leading, 14)
            }
        }
        .buttonStyle(.plain)
    }
}

/// Small sheet for editing the user's display name. Single
/// TextField + Save / Cancel; trims whitespace, accepts empty
/// (which clears the field server-side). Calls back to the host
/// with the new value — host owns the actual API call so the
/// sheet stays focused on input UX.
private struct DisplayNameEditor: View {
    let current: String
    var onSave: (String) -> Void
    var onCancel: () -> Void

    @State private var text: String
    @State private var saving = false
    @FocusState private var fieldFocus: Bool

    init(current: String, onSave: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.current = current
        self.onSave = onSave
        self.onCancel = onCancel
        _text = State(initialValue: current)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                // Glass via .iOS26Sheet — no opaque fill here.
                VStack(alignment: .leading, spacing: 14) {
                    Text("Display Name")
                        .font(Brand.display(size: 22))
                        .foregroundStyle(Brand.textPrimary)
                    Text("How Memory.Wiki greets you and what shows on the docs you share.")
                        .font(Brand.body(size: 13))
                        .foregroundStyle(Brand.textMuted)
                        .lineSpacing(3)
                    TextField("Your name", text: $text)
                        .focused($fieldFocus)
                        .font(Brand.body(size: 16))
                        .textInputAutocapitalization(.words)
                        .padding(.horizontal, 14).padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Brand.surface)
                                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                        )
                        .submitLabel(.done)
                        .onSubmit {
                            saving = true
                            onSave(text)
                        }
                    Button {
                        saving = true
                        onSave(text)
                    } label: {
                        HStack {
                            if saving {
                                ProgressView().scaleEffect(0.7).tint(Brand.background)
                            }
                            Text(saving ? "Saving…" : "Save")
                                .font(Brand.body(size: 15, weight: .semibold))
                                .foregroundStyle(Brand.background)
                        }
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Brand.textPrimary)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(saving)
                    Spacer()
                }
                .padding(.horizontal, 22)
                .padding(.top, 22)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel", action: onCancel)
                        .foregroundStyle(Brand.textMuted)
                }
            }
            .toolbarBackground(Brand.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .onAppear { fieldFocus = true }
    }
}

// ThemePicker removed — app is dark-only.

#Preview {
    ProfileView().environmentObject(AuthManager.preview())
}
