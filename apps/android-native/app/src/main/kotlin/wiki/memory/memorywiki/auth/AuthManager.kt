/*
 * AuthManager — wraps Supabase auth + the memory.wiki demo passwordless
 * flow. Mirrors apps/ios-native/MemoryWiki/Networking/AuthManager.swift.
 *
 *  - Google: Credential Manager API delivers an ID token + nonce; we
 *    hand both to Supabase via `signInWith(IDToken)`.
 *  - Apple: Custom Tabs OAuth, deeplink back via memorywiki://auth-callback.
 *  - GitHub: same Custom Tabs OAuth flow.
 *  - Email/password: native Supabase signInWith(Email).
 *  - Demo allowlist: server-mints a magic-link session via
 *    /api/auth/demo-signin and we importAuthToken it.
 */

package wiki.memory.memorywiki.auth

import android.content.Context
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.providers.Apple
import io.github.jan.supabase.auth.providers.Github
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.from
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.headers
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.data.model.ProfileRow
import wiki.memory.memorywiki.data.model.UserSession
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val supabase: SupabaseClient,
    private val http: HttpClient,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _session = MutableStateFlow<UserSession?>(null)
    val session: StateFlow<UserSession?> = _session.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init {
        // Hydrate immediately + listen for changes.
        scope.launch {
            supabase.auth.sessionStatus.collect { status ->
                android.util.Log.i("MW-Auth", "sessionStatus → ${status.javaClass.simpleName}")
                when (status) {
                    is SessionStatus.Authenticated -> hydrate()
                    is SessionStatus.NotAuthenticated -> {
                        _session.value = null
                        _loading.value = false
                    }
                    is SessionStatus.RefreshFailure -> {
                        _session.value = null
                        _loading.value = false
                    }
                    else -> Unit
                }
            }
        }
    }

    // ─── Sign-in providers ───

    suspend fun signInWithEmail(email: String, password: String) {
        supabase.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signUpWithEmail(email: String, password: String) {
        supabase.auth.signUpWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signInWithGoogleIdToken(idToken: String, rawNonce: String) {
        supabase.auth.signInWith(IDToken) {
            provider = Google
            this.idToken = idToken
            nonce = rawNonce
        }
    }

    /** Launches Custom Tabs to the provider's OAuth start URL; the
     *  deep link back to memorywiki://auth-callback completes the
     *  flow via handleOAuthCallback below. */
    fun beginAppleOAuth() = scope.launch {
        supabase.auth.signInWith(Apple)
    }

    fun beginGithubOAuth() = scope.launch {
        supabase.auth.signInWith(Github)
    }

    suspend fun handleOAuthCallback(uri: Uri) {
        supabase.handleDeeplinks(
            intent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri),
        )
    }

    // ─── Demo passwordless ───

    /** Server-side allowlist mirrors the iOS app. */
    private val demoEmails = setOf("demo@memory.wiki", "demo@mdfy.app", "yc@mdfy.app")
    fun isDemoEmail(email: String): Boolean =
        email.trim().lowercase() in demoEmails

    suspend fun signInDemo(email: String) {
        val normalized = email.trim().lowercase()
        android.util.Log.i("MW-Auth", "signInDemo: POST /api/auth/demo-signin for $normalized")
        require(isDemoEmail(normalized)) { "Demo allowlist refused $normalized" }
        val resp = http.post("${BuildConfig.API_BASE}/api/auth/demo-signin") {
            contentType(ContentType.Application.Json)
            setBody(DemoSignInRequest(normalized))
        }
        android.util.Log.i("MW-Auth", "signInDemo: server returned HTTP ${resp.status.value}")
        if (!resp.status.isSuccess()) error("Demo sign-in HTTP ${resp.status.value}")
        val body: DemoSignInWire = resp.body()
        android.util.Log.i("MW-Auth", "signInDemo: importing session, token len=${body.access_token.length}")
        supabase.auth.importSession(
            io.github.jan.supabase.auth.user.UserSession(
                accessToken = body.access_token,
                refreshToken = body.refresh_token,
                expiresIn = body.expires_in?.toLong() ?: 3600,
                tokenType = "bearer",
                user = null,
            ),
        )
        android.util.Log.i("MW-Auth", "signInDemo: importSession returned, forcing hydrate")
        hydrate()
    }

    // ─── Mutations ───

    suspend fun updateDisplayName(name: String) {
        val uid = supabase.auth.currentUserOrNull()?.id ?: return
        supabase.from("profiles").update({ set("display_name", name) }) {
            filter { eq("id", uid) }
        }
        hydrate()
    }

    suspend fun signOut() {
        supabase.auth.signOut()
        _session.value = null
    }

    /** Force-rehydrate from supabase + profiles. Called after a
     *  profile mutation (display name, accent, scheme) so the
     *  session flow re-emits with the fresh values. */
    suspend fun refresh() = hydrate()

    // ─── Internal ───

    private suspend fun hydrate() {
        val auth = supabase.auth.currentSessionOrNull()
        android.util.Log.i("MW-Auth", "hydrate: currentSessionOrNull=${auth != null}, user=${auth?.user?.id}")
        if (auth == null) { _session.value = null; _loading.value = false; return }
        // The demo signin path imports a session with user=null and
        // GET /auth/v1/user with that bearer fails (Supabase considers
        // demo sessions service-role-minted, not interactive). The JWT
        // itself carries everything we need (`sub`, `email`,
        // `user_metadata.display_name`) — decode it directly instead.
        val userId: String
        val userEmail: String?
        val userMetaDisplayName: String?
        val auth0User = auth.user
        if (auth0User != null) {
            userId = auth0User.id
            userEmail = auth0User.email
            userMetaDisplayName = null
        } else {
            val claims = decodeJwtClaims(auth.accessToken)
            userId = claims?.optString("sub") ?: ""
            userEmail = claims?.optString("email")?.takeIf { it.isNotBlank() }
            userMetaDisplayName = claims?.optJSONObject("user_metadata")
                ?.optString("display_name")?.takeIf { it.isNotBlank() }
        }
        if (userId.isEmpty()) {
            android.util.Log.w("MW-Auth", "hydrate: couldn't extract user id from session")
            _session.value = UserSession(
                userId = "", email = userEmail,
                accessToken = auth.accessToken, refreshToken = auth.refreshToken,
            )
            _loading.value = false
            return
        }
        android.util.Log.i("MW-Auth", "hydrate: user resolved id=$userId email=$userEmail")
        val profile = runCatching {
            supabase.from("profiles")
                .select(columns = io.github.jan.supabase.postgrest.query.Columns.list(
                    "id", "hub_slug", "display_name", "avatar_url",
                    "avatar_style", "accent_color", "color_scheme", "plan",
                )) {
                    filter { eq("id", userId) }
                    limit(1)
                }
                .decodeSingleOrNull<ProfileRow>()
        }.onFailure {
            android.util.Log.e("MW-Auth", "profile fetch failed: ${it.message}")
        }.getOrNull()
        android.util.Log.i("MW-Auth", "hydrate: profile=${profile?.hubSlug} displayName=${profile?.displayName}")

        _session.value = UserSession(
            userId = userId,
            email = userEmail,
            accessToken = auth.accessToken,
            refreshToken = auth.refreshToken,
            hubSlug = profile?.hubSlug,
            displayName = profile?.displayName?.trim()?.takeUnless { it.isEmpty() } ?: userMetaDisplayName,
            avatarUrl = profile?.avatarUrl?.takeIf { profile.avatarStyle == "upload" },
            accentColor = profile?.accentColor,
            colorScheme = profile?.colorScheme,
            plan = profile?.plan,
        )
        _loading.value = false
    }

    /** Decode the payload of a base64url-encoded JWT and return its
     *  claims as a JSONObject. Returns null on parse failure. */
    private fun decodeJwtClaims(token: String): org.json.JSONObject? = runCatching {
        val parts = token.split(".")
        if (parts.size < 2) return@runCatching null
        val payload = parts[1]
        val padded = payload + "=".repeat((4 - payload.length % 4) % 4)
        val json = String(android.util.Base64.decode(padded, android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP))
        org.json.JSONObject(json)
    }.getOrNull()

    @Serializable
    private data class DemoSignInRequest(val email: String)

    @Serializable
    private data class DemoSignInWire(
        val access_token: String,
        val refresh_token: String,
        val expires_in: Int? = null,
    )
}
