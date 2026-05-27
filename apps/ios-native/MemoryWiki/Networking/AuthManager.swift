// AuthManager — single source of truth for the user's signed-in
// state. Stores the Supabase session in the Keychain so it
// survives reinstalls of the app (deliberately not in
// UserDefaults). Published `session` drives UI; the in-app
// browser hands the session back via memorywiki://auth-callback
// and handleCallback() parses and persists it.

import Foundation
import Security
import Combine

struct UserSession: Codable, Equatable {
    let userId: String
    let email: String?
    let accessToken: String
    let refreshToken: String?
    let hubSlug: String?
}

@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published private(set) var session: UserSession?

    var isSignedIn: Bool { session != nil }

    private let keychainKey = "wiki.memory.MemoryWiki.session"

    init() {
        session = readFromKeychain()
    }

    // MARK: - Callback from the in-app browser

    /// Called from `App.onOpenURL` when the web sign-in flow
    /// redirects back to memorywiki://auth-callback?... The web
    /// page is responsible for encoding the Supabase session
    /// fields onto the callback URL.
    func handleCallback(url: URL) async {
        guard url.scheme == "memorywiki",
              let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let items = comps.queryItems else {
            return
        }
        func value(_ name: String) -> String? { items.first(where: { $0.name == name })?.value }
        guard let userId = value("user_id"),
              let token = value("access_token") else {
            return
        }
        let next = UserSession(
            userId: userId,
            email: value("email"),
            accessToken: token,
            refreshToken: value("refresh_token"),
            hubSlug: value("hub_slug")
        )
        session = next
        writeToKeychain(next)
    }

    func signOut() async {
        session = nil
        deleteFromKeychain()
    }

    // MARK: - Keychain helpers
    // Generic-password class. We never sync the access token to
    // iCloud — kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    // makes it device-bound but available to background fetches.

    private func keychainQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
    }

    private func readFromKeychain() -> UserSession? {
        var query = keychainQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(UserSession.self, from: data)
    }

    private func writeToKeychain(_ session: UserSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        let query = keychainQuery()
        let attrs: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var add = query
            add[kSecValueData as String] = data
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    private func deleteFromKeychain() {
        SecItemDelete(keychainQuery() as CFDictionary)
    }
}

extension AuthManager {
    /// Preview helper — fake session so SwiftUI previews can render
    /// the signed-in UI without poking the Keychain.
    static func preview() -> AuthManager {
        let mgr = AuthManager()
        mgr.session = UserSession(
            userId: "preview-user-id",
            email: "preview@memory.wiki",
            accessToken: "preview-token",
            refreshToken: nil,
            hubSlug: "preview"
        )
        return mgr
    }
}
