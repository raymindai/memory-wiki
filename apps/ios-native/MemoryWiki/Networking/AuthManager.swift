// AuthManager — Supabase-SDK-backed auth state. Owns the
// SupabaseClient (via SupabaseConfig.shared) and a published
// `session` for SwiftUI to drive UI off.
//
// Sign-in surfaces:
//   - Apple   — native ASAuthorizationController, posts the
//               identityToken to signInWithIdToken(.apple, ...)
//   - Google  — signInWithOAuth(.google, redirectTo: memorywiki://)
//   - GitHub  — signInWithOAuth(.github, redirectTo: memorywiki://)
//   - Email   — signIn(email:password:) and signUp(...)
//
// All flows funnel into Supabase's local Session, which the SDK
// auto-persists to the Keychain. Our published `session` is just
// a thin view onto it that SwiftUI can render off.

import Foundation
import AuthenticationServices
import Supabase
import Combine
import UIKit

struct UserSession: Equatable {
    let userId: String
    let email: String?
    let hubSlug: String?
    let accessToken: String
}

@MainActor
final class AuthManager: NSObject, ObservableObject {
    static let shared = AuthManager()

    @Published private(set) var session: UserSession?

    var isSignedIn: Bool { session != nil }

    private let client = SupabaseConfig.shared
    private var authListenerTask: Task<Void, Never>?

    private override init() {
        super.init()
        // Hydrate from the SDK's cached session immediately so the
        // SwiftUI shell doesn't flash AuthView between launch and
        // the async listener attaching.
        Task { await hydrate() }
        startListening()
    }

    // MARK: - Public actions

    func signInWithApple(idToken: String, nonce: String) async throws {
        try await client.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
        )
        await hydrate()
    }

    func signInWithOAuth(provider: Provider) async throws {
        try await client.auth.signInWithOAuth(
            provider: provider,
            redirectTo: SupabaseConfig.oauthCallbackURL,
            launchFlow: { url in
                try await self.openOAuth(url: url)
            }
        )
        await hydrate()
    }

    func signInWithEmail(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
        await hydrate()
    }

    func signUpWithEmail(email: String, password: String) async throws {
        try await client.auth.signUp(email: email, password: password)
        await hydrate()
    }

    func signOut() async {
        try? await client.auth.signOut()
        session = nil
    }

    /// memorywiki://auth-callback — invoked from MemoryWikiApp.onOpenURL
    /// for the OAuth redirect. The SDK's session() call below picks
    /// it up automatically once we re-hydrate.
    func handleCallback(url: URL) async {
        try? await client.auth.session(from: url)
        await hydrate()
    }

    // MARK: - Plumbing

    private func startListening() {
        authListenerTask?.cancel()
        authListenerTask = Task { [weak self] in
            guard let self else { return }
            for await _ in client.auth.authStateChanges {
                await self.hydrate()
            }
        }
    }

    private func hydrate() async {
        guard let auth = try? await client.auth.session else {
            session = nil
            return
        }
        // Hub slug lives on profiles row, not on the auth user.
        // Best-effort lookup; tolerate missing rows (RLS may hide
        // it for fresh accounts that haven't run the bootstrap).
        var hubSlug: String?
        if let profile: ProfileSlugRow = try? await client
            .from("profiles")
            .select("hub_slug")
            .eq("id", value: auth.user.id)
            .single()
            .execute()
            .value {
            hubSlug = profile.hub_slug
        }
        session = UserSession(
            userId: auth.user.id.uuidString.lowercased(),
            email: auth.user.email,
            hubSlug: hubSlug,
            accessToken: auth.accessToken
        )
    }

    /// ASWebAuthenticationSession launcher used by the Supabase
    /// SDK for OAuth flows that pop a browser tab.
    private func openOAuth(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "memorywiki"
            ) { callback, error in
                if let error { cont.resume(throwing: error); return }
                if let callback { cont.resume(returning: callback); return }
                cont.resume(throwing: NSError(domain: "MemoryWiki", code: -1))
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }
}

extension AuthManager: ASWebAuthenticationPresentationContextProviding {
    /// ASWebAuthenticationSession guarantees this is invoked on the
    /// main thread. The previous `DispatchQueue.main.sync` from a
    /// nonisolated method DEADLOCKED when called from main — the
    /// system thread blocked waiting for itself, crash. Use
    /// MainActor.assumeIsolated to read window state without a
    /// dispatch hop.
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow }
                .first ?? ASPresentationAnchor()
        }
    }
}

private struct ProfileSlugRow: Decodable {
    let hub_slug: String?
}

extension AuthManager {
    /// Preview helper — fake session so SwiftUI previews can render
    /// the signed-in UI without poking the network.
    static func preview() -> AuthManager {
        let mgr = AuthManager()
        mgr.session = UserSession(
            userId: "preview-user-id",
            email: "preview@memory.wiki",
            hubSlug: "preview",
            accessToken: "preview-token"
        )
        return mgr
    }
}
