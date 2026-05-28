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
    /// Optional profile avatar — used by the tab bar's Settings
    /// slot so the user sees themselves rather than a generic
    /// person glyph. Loaded best-effort during hydrate().
    let avatarURL: URL?
    /// Profile display name (`profiles.display_name`) — what we
    /// greet the user with in Start hero + the editable field on
    /// the Settings tab.
    let displayName: String?
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

    /// Passwordless email-only demo sign-in. Hits /api/auth/demo-signin
    /// on the web app, which only accepts the small server-side
    /// allowlist (yc@mdfy.app / demo@mdfy.app / demo@memory.wiki).
    /// Server uses service-role to mint a magiclink, redeems the OTP
    /// server-side, and returns a real Supabase access/refresh
    /// token pair we plug into the SDK via setSession.
    func signInDemo(email: String) async throws {
        struct DemoResp: Decodable {
            let access_token: String
            let refresh_token: String
        }
        var req = URLRequest(url: APIClient.baseURL.appendingPathComponent("/api/auth/demo-signin"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email])
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw APIError.http(
                (response as? HTTPURLResponse)?.statusCode ?? -1,
                msg ?? "Demo sign-in failed"
            )
        }
        let body = try JSONDecoder().decode(DemoResp.self, from: data)
        try await client.auth.setSession(
            accessToken: body.access_token,
            refreshToken: body.refresh_token
        )
        await hydrate()
    }

    func signUpWithEmail(email: String, password: String) async throws {
        try await client.auth.signUp(email: email, password: password)
        await hydrate()
    }

    func signOut() async {
        let previousUserId = session?.userId
        try? await client.auth.signOut()
        session = nil
        SharedSessionStore.clear()
        // Broadcast so TimelineModel / BundlesModel / PinnedStore
        // can drop their cached state immediately. Otherwise the
        // previous account's docs flash in the next sign-in.
        NotificationCenter.default.post(
            name: .mwUserChanged,
            object: nil,
            userInfo: ["previousUserId": previousUserId ?? ""]
        )
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

    /// Public refresh — used after the user edits their display
    /// name (or any other profile field) in Settings so the new
    /// value flows back into UserSession and the dependent views
    /// (Start greeting, tab-bar avatar) repaint.
    func refresh() async { await hydrate() }

    /// Direct write to `profiles.display_name`. RLS lets a user
    /// update their own row, so we don't need a separate API
    /// endpoint just for this. Returns silently; the next
    /// `refresh()` picks up the new value.
    func updateDisplayName(_ newValue: String) async throws {
        let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
        struct Body: Encodable { let display_name: String? }
        let body = Body(display_name: trimmed.isEmpty ? nil : trimmed)
        guard let userId = session?.userId else { return }
        _ = try await client
            .from("profiles")
            .update(body)
            .eq("id", value: userId)
            .execute()
        await refresh()
    }

    private func hydrate() async {
        let previousUserId = session?.userId
        guard let auth = try? await client.auth.session else {
            if previousUserId != nil {
                NotificationCenter.default.post(
                    name: .mwUserChanged,
                    object: nil,
                    userInfo: ["previousUserId": previousUserId ?? ""]
                )
            }
            session = nil
            return
        }
        // Hub slug lives on profiles row, not on the auth user.
        // Best-effort lookup; tolerate missing rows (RLS may hide
        // it for fresh accounts that haven't run the bootstrap).
        var hubSlug: String?
        var avatarURL: URL?
        var displayName: String?
        if let profile: ProfileSlugRow = try? await client
            .from("profiles")
            .select("hub_slug, avatar_url, avatar_style, display_name")
            .eq("id", value: auth.user.id)
            .single()
            .execute()
            .value {
            hubSlug = profile.hub_slug
            displayName = profile.display_name?.trimmingCharacters(in: .whitespacesAndNewlines)
            if (displayName ?? "").isEmpty { displayName = nil }
            // Only honour an explicit user-uploaded image — synthetic
            // DiceBear styles are too generic for the tab-bar slot
            // and would defeat the personalisation point.
            if (profile.avatar_style ?? "") == "upload",
               let raw = profile.avatar_url, let u = URL(string: raw) {
                avatarURL = u
            }
        }
        let newUserId = auth.user.id.uuidString.lowercased()
        let userChanged = previousUserId != nil && previousUserId != newUserId
        session = UserSession(
            userId: newUserId,
            email: auth.user.email,
            hubSlug: hubSlug,
            accessToken: auth.accessToken,
            avatarURL: avatarURL,
            displayName: displayName
        )
        // Switching accounts mid-process — broadcast so cached
        // doc lists / pinned IDs from the old account get wiped
        // before the new account's data starts loading.
        if userChanged {
            NotificationCenter.default.post(
                name: .mwUserChanged,
                object: nil,
                userInfo: [
                    "previousUserId": previousUserId ?? "",
                    "newUserId": newUserId,
                ]
            )
        }
        // Mirror the access token + identity into the App Group
        // Keychain so the Share Extension (different process) can
        // POST /api/docs without re-doing the OAuth round-trip.
        SharedSessionStore.save(SharedSession(
            userId: auth.user.id.uuidString.lowercased(),
            accessToken: auth.accessToken,
            email: auth.user.email,
            hubSlug: hubSlug
        ))
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
    let avatar_url: String?
    let avatar_style: String?
    let display_name: String?
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
            accessToken: "preview-token",
            avatarURL: nil,
            displayName: "Preview"
        )
        return mgr
    }
}
