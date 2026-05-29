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
                when (status) {
                    is SessionStatus.Authenticated -> hydrate()
                    is SessionStatus.NotAuthenticated -> {
                        _session.value = null
                        _loading.value = false
                    }
                    SessionStatus.LoadingFromStorage -> { /* keep loading=true */ }
                    is SessionStatus.RefreshFailure -> {
                        _session.value = null
                        _loading.value = false
                    }
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
        require(isDemoEmail(normalized)) { "Demo allowlist refused $normalized" }
        val resp = http.post("${BuildConfig.API_BASE}/api/auth/demo-signin") {
            contentType(ContentType.Application.Json)
            setBody(DemoSignInRequest(normalized))
        }
        if (!resp.status.isSuccess()) error("Demo sign-in HTTP ${resp.status.value}")
        val body: DemoSignInWire = resp.body()
        supabase.auth.importSession(
            io.github.jan.supabase.auth.user.UserSession(
                accessToken = body.access_token,
                refreshToken = body.refresh_token,
                expiresIn = body.expires_in?.toLong() ?: 3600,
                tokenType = "bearer",
                user = null,
            ),
        )
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

    // ─── Internal ───

    private suspend fun hydrate() {
        val auth = supabase.auth.currentSessionOrNull() ?: run {
            _session.value = null; _loading.value = false; return
        }
        val user = auth.user ?: run {
            _loading.value = false; return
        }
        val profile = runCatching {
            supabase.from("profiles")
                .select(columns = io.github.jan.supabase.postgrest.query.Columns.list(
                    "id", "hub_slug", "display_name", "avatar_url",
                    "avatar_style", "accent_color", "color_scheme", "plan",
                )) {
                    filter { eq("id", user.id) }
                    limit(1)
                }
                .decodeSingleOrNull<ProfileRow>()
        }.getOrNull()

        _session.value = UserSession(
            userId = user.id,
            email = user.email,
            accessToken = auth.accessToken,
            refreshToken = auth.refreshToken,
            hubSlug = profile?.hubSlug,
            displayName = profile?.displayName?.trim().takeUnless { it.isNullOrEmpty() },
            avatarUrl = profile?.avatarUrl?.takeIf { profile.avatarStyle == "upload" },
            accentColor = profile?.accentColor,
            colorScheme = profile?.colorScheme,
            plan = profile?.plan,
        )
        _loading.value = false
    }

    @Serializable
    private data class DemoSignInRequest(val email: String)

    @Serializable
    private data class DemoSignInWire(
        val access_token: String,
        val refresh_token: String,
        val expires_in: Int? = null,
    )
}
