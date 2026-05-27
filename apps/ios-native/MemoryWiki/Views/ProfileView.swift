// ProfileView — the use surface. Mono URL display, prominent
// "Copy for AI" affordance (paste-anywhere story), then quiet
// account rows. Matches the web /hub/<slug> "Deploy this hub to
// any AI" card vocabulary.

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthManager
    @State private var copied = false

    private var hubURL: URL? {
        guard let slug = auth.session?.hubSlug, !slug.isEmpty else { return nil }
        return URL(string: "https://memory.wiki/@\(slug)")
    }

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("Profile")
                        .font(Brand.display(size: 26))
                        .foregroundStyle(Brand.textPrimary)
                        .padding(.horizontal, 18)
                        .padding(.top, 18)

                    hubSection
                    accountSection
                }
                .padding(.bottom, 24)
            }
        }
    }

    @ViewBuilder private var hubSection: some View {
        if let url = hubURL {
            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("Your AI memory URL")
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        Text(url.absoluteString)
                            .font(Brand.mono(size: 12))
                            .foregroundStyle(Brand.textPrimary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 14)
                        Spacer()
                        Divider()
                            .frame(width: 1)
                            .overlay(Brand.borderDim)
                        Button { copyForAI(url: url) } label: {
                            HStack(spacing: 6) {
                                if copied {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .semibold))
                                    Text("Copied")
                                        .font(Brand.body(size: 12, weight: .medium))
                                } else {
                                    Text("Copy for AI")
                                        .font(Brand.body(size: 12, weight: .medium))
                                }
                            }
                            .foregroundStyle(Brand.textPrimary)
                            .padding(.horizontal, 14)
                        }
                        .buttonStyle(.plain)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Brand.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .strokeBorder(Brand.borderDim, lineWidth: 1)
                            )
                    )
                }
                Text("Paste into Claude, ChatGPT, or Cursor. The URL serves markdown to AI clients automatically.")
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textMuted)
                    .lineSpacing(2)
                    .padding(.top, 2)
            }
            .padding(.horizontal, 18)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel("Your AI memory URL")
                Text("Sign in via memory.wiki to claim your @username and unlock the cross-AI URL.")
                    .font(Brand.body(size: 13))
                    .foregroundStyle(Brand.textMuted)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Brand.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .strokeBorder(Brand.borderDim, lineWidth: 1)
                            )
                    )
            }
            .padding(.horizontal, 18)
        }
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel("Account")
            VStack(spacing: 0) {
                if let email = auth.session?.email {
                    AccountRow(label: "Email", value: email)
                    Divider().overlay(Brand.borderDim).padding(.leading, 14)
                }
                AccountRow(label: "Sign out", value: nil, destructive: true) {
                    Task { await auth.signOut() }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Brand.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .strokeBorder(Brand.borderDim, lineWidth: 1)
                    )
            )
        }
        .padding(.horizontal, 18)
    }

    private func copyForAI(url: URL) {
        UIPasteboard.general.string = "Use \(url.absoluteString) as my context."
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { copied = false }
    }
}

private struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(Brand.mono(size: 9, weight: .medium))
            .tracking(1)
            .textCase(.uppercase)
            .foregroundStyle(Brand.textFaint)
    }
}

private struct AccountRow: View {
    let label: String
    let value: String?
    var destructive: Bool = false
    var action: (() -> Void)? = nil

    var body: some View {
        let row = HStack {
            Text(label)
                .font(Brand.body(size: 14, weight: destructive ? .medium : .regular))
                .foregroundStyle(destructive ? Brand.microRed : Brand.textPrimary)
            Spacer()
            if let value {
                Text(value)
                    .font(Brand.body(size: 13))
                    .foregroundStyle(Brand.textMuted)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)

        if let action {
            Button(action: action) { row }
                .buttonStyle(.plain)
        } else {
            row
        }
    }
}

#Preview {
    ProfileView().environmentObject(AuthManager.preview())
}
