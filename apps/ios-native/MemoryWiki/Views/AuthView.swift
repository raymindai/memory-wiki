// AuthView — sign-in screen. The web auth flow is the canonical
// one; we open it in an in-app browser, the web sends the user
// back via memorywiki:// with the Supabase session token, and
// AuthManager catches that callback in MemoryWikiApp.onOpenURL.
//
// No native sign-in form on purpose: keeping all auth in one place
// (Supabase via the web) means SSO additions ("Sign in with X")
// land in the iOS app the same day they ship on the web.

import SwiftUI
import SafariServices

struct AuthView: View {
    @State private var showSafari = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            VStack(spacing: 12) {
                Image(systemName: "sparkles.rectangle.stack")
                    .font(.system(size: 48, weight: .light))
                    .foregroundStyle(.tint)
                Text("Memory.Wiki")
                    .font(.title.bold())
                Text("Stop re-explaining your context to every AI.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            Spacer()
            Button {
                showSafari = true
            } label: {
                Text("Sign in")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 24)
            Text("Opens memory.wiki in a secure window.")
                .font(.caption)
                .foregroundStyle(.tertiary)
                .padding(.bottom, 24)
        }
        .sheet(isPresented: $showSafari) {
            SafariView(url: APIClient.signInURL)
                .ignoresSafeArea()
        }
    }
}

/// Thin SFSafariViewController wrapper so the web sign-in keeps
/// the user's session cookies and our memorywiki:// callback works.
private struct SafariView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController { SFSafariViewController(url: url) }
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

#Preview {
    AuthView()
}
