// ProfileView — the user's "use surface": their /@<slug> URL, a
// big Copy button (the paste-anywhere story), basic account info,
// and Sign Out. This screen is the iOS native answer to "paste my
// hub URL into Claude / ChatGPT / Cursor."

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthManager
    @State private var copied = false

    private var hubURL: URL? {
        guard let slug = auth.session?.hubSlug, !slug.isEmpty else { return nil }
        return URL(string: "https://memory.wiki/@\(slug)")
    }

    var body: some View {
        NavigationStack {
            Form {
                if let url = hubURL {
                    Section("Your AI memory URL") {
                        Text(url.absoluteString)
                            .font(.system(.callout, design: .monospaced))
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Button {
                            UIPasteboard.general.string = "Use \(url.absoluteString) as my context."
                            copied = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { copied = false }
                        } label: {
                            Label(copied ? "Copied as AI prompt" : "Copy for AI", systemImage: copied ? "checkmark" : "sparkles")
                        }
                        ShareLink(item: url) { Label("Share URL", systemImage: "square.and.arrow.up") }
                    }
                } else {
                    Section {
                        Text("Sign in via memory.wiki to claim your @username and unlock the cross-AI URL.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Account") {
                    if let email = auth.session?.email {
                        LabeledContent("Email", value: email)
                    }
                    Button("Sign out", role: .destructive) {
                        Task { await auth.signOut() }
                    }
                }
            }
            .navigationTitle("Profile")
        }
    }
}

#Preview {
    ProfileView().environmentObject(AuthManager.preview())
}
