// SupabaseConfig — single SupabaseClient for the whole app.
//
// Configuration lives in `Config/Secrets.xcconfig` (gitignored)
// which xcodegen wires into the target's build settings. At
// runtime we read the values from Info.plist (xcconfig values are
// substituted at build time). This keeps even "public" anon keys
// out of the committed source tree per the project's secrets
// policy — the values still ship in the binary, which is fine
// since the anon key is bound by RLS, but the repo stays clean.
//
// See apps/ios-native/Config/Secrets.xcconfig.example for the
// expected keys.

import Foundation
import Supabase

enum SupabaseConfig {
    static let url: URL = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "MWSupabaseURL") as? String,
              !raw.isEmpty,
              let url = URL(string: raw) else {
            preconditionFailure(
                "Missing MWSupabaseURL in Info.plist. Copy " +
                "Config/Secrets.xcconfig.example to Config/Secrets.xcconfig " +
                "and fill in MEMORY_WIKI_SUPABASE_URL."
            )
        }
        return url
    }()

    static let anonKey: String = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "MWSupabaseAnonKey") as? String,
              !raw.isEmpty else {
            preconditionFailure(
                "Missing MWSupabaseAnonKey in Info.plist. See " +
                "Config/Secrets.xcconfig.example for setup."
            )
        }
        return raw
    }()

    /// memorywiki://auth-callback — the OAuth redirect URL the
    /// app registers for. Configure the same URL on the Supabase
    /// dashboard (Authentication → URL Configuration → Redirect
    /// URLs allow list) so OAuth providers accept it.
    static let oauthCallbackURL = URL(string: "memorywiki://auth-callback")!

    static let shared: SupabaseClient = SupabaseClient(
        supabaseURL: url,
        supabaseKey: anonKey
    )
}
