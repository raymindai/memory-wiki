// SharedSession — auth handoff between the main app and the
// Share Extension. The extension can't talk to the Supabase SDK
// (separate process, separate binary) so the main app writes the
// access token + user id + email into a Keychain item that's
// scoped to our App Group; the extension reads from the same
// item and uses it for the /api/docs POST.
//
// kSecAttrAccessGroup with the App Group prefix lets the two
// processes touch the same Keychain entry. kSecAttrAccessible
// AfterFirstUnlock means a Share Extension invoked from the
// lock-screen Share Sheet (rare but possible) still works.

import Foundation
import Security

public struct SharedSession: Codable, Equatable {
    public let userId: String
    public let accessToken: String
    public let email: String?
    public let hubSlug: String?

    public init(userId: String, accessToken: String, email: String?, hubSlug: String?) {
        self.userId = userId
        self.accessToken = accessToken
        self.email = email
        self.hubSlug = hubSlug
    }
}

public enum SharedSessionStore {
    /// Keychain access group MUST be prefixed with the team's
    /// $(AppIdentifierPrefix) at runtime; Apple injects the
    /// prefix automatically when you list the group in
    /// keychain-access-groups under entitlements. We pass just
    /// the bare group here.
    public static let accessGroup = "group.wiki.memory.MemoryWiki"
    public static let account = "wiki.memory.MemoryWiki.SharedSession"

    public static func save(_ session: SharedSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        let query: [String: Any] = baseQuery()
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var add = query
            add.merge(attrs) { _, new in new }
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    public static func load() -> SharedSession? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(SharedSession.self, from: data)
    }

    public static func clear() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
    }
}
