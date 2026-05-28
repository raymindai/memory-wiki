// ProfileView — the iOS Settings + "use surface" combined. Top
// card carries the @<slug> URL and the Copy-for-AI affordance
// (the paste-anywhere wedge). Below: account, appearance, help,
// about, legal, sign out. All quiet ink rows over glass.

import SwiftUI
import MessageUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthManager
    @AppStorage("mw.theme") private var themePref: String = "dark"
    @AppStorage("mw.onboarded") private var onboarded: Bool = false
    @State private var copied = false
    @State private var hubCopied = false
    @State private var path: [SettingsRoute] = []
    @State private var showFeedback = false
    @State private var showMailUnavailable = false

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
                        section("ACCOUNT") {
                            SettingRow(label: "Email", value: auth.session?.email)
                            if let slug = auth.session?.hubSlug {
                                SettingRow(label: "Username", value: "@\(slug)")
                            }
                        }
                        section("APPEARANCE") {
                            ThemePicker(themePref: $themePref)
                        }
                        section("LEARN") {
                            SettingNavRow(label: "Help & Shortcuts", systemImage: "questionmark.circle") {
                                path.append(.help)
                            }
                            SettingActionRow(label: "Replay welcome tour", systemImage: "sparkles") {
                                Haptics.tap()
                                onboarded = false
                            }
                            SettingNavRow(label: "About Memory.Wiki", systemImage: "info.circle") {
                                path.append(.about)
                            }
                        }
                        section("FEEDBACK") {
                            SettingActionRow(label: "Send feedback", systemImage: "envelope") {
                                Haptics.tap()
                                if MFMailComposeViewController.canSendMail() {
                                    showFeedback = true
                                } else {
                                    showMailUnavailable = true
                                }
                            }
                            SettingLink(label: "Manifesto", systemImage: "arrow.up.right", url: URL(string: "https://memory.wiki/manifesto")!)
                            SettingLink(label: "How it works", systemImage: "arrow.up.right", url: URL(string: "https://memory.wiki/how")!)
                        }
                        section("LEGAL") {
                            SettingLink(label: "Terms", systemImage: "arrow.up.right", url: URL(string: "https://memory.wiki/terms")!)
                            SettingLink(label: "Privacy", systemImage: "arrow.up.right", url: URL(string: "https://memory.wiki/privacy")!)
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
        .onChange(of: themePref) { _, new in
            applyTheme(new)
        }
        .onAppear { applyTheme(themePref) }
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
                            Text(copied ? "Copied" : "Copy for AI")
                                .font(Brand.body(size: 12, weight: .medium))
                        }
                        .foregroundStyle(Brand.textPrimary)
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

    private func applyTheme(_ pref: String) {
        // Walk the connected scenes and override style. SwiftUI's
        // .preferredColorScheme is per-view; we want global.
        let style: UIUserInterfaceStyle = {
            switch pref {
            case "light": return .light
            case "system": return .unspecified
            default:       return .dark
            }
        }()
        for scene in UIApplication.shared.connectedScenes {
            (scene as? UIWindowScene)?.windows.forEach { $0.overrideUserInterfaceStyle = style }
        }
    }
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
    var onTap: () -> Void
    var body: some View {
        Button {
            Haptics.selection()
            onTap()
        } label: {
            HStack {
                Image(systemName: systemImage)
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.textMuted)
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
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack {
                Image(systemName: systemImage)
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.textMuted)
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

private struct ThemePicker: View {
    @Binding var themePref: String
    private let options: [(id: String, label: LocalizedStringKey, icon: String)] = [
        ("dark",   "Dark",   "moon.fill"),
        ("light",  "Light",  "sun.max.fill"),
        ("system", "System", "circle.lefthalf.filled"),
    ]
    var body: some View {
        HStack(spacing: 6) {
            ForEach(options, id: \.id) { opt in
                Button {
                    Haptics.selection()
                    themePref = opt.id
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: opt.icon).font(.system(size: 11, weight: .regular))
                        Text(opt.label).font(Brand.body(size: 12, weight: .medium))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .foregroundStyle(themePref == opt.id ? Brand.textPrimary : Brand.textMuted)
                    .background(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(themePref == opt.id ? Brand.surface : Color.clear)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
    }
}

#Preview {
    ProfileView().environmentObject(AuthManager.preview())
}
