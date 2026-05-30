/*
 * AppRouter — single source of truth for cross-tab navigation +
 * deep-link targets. Lives at the App level so onNewIntent in the
 * Activity can route to any tab + push detail without prop-drilling
 * through Composables.
 *
 * URL grammar (mirror of iOS):
 *   memorywiki://auth-callback?...  → AuthManager
 *   memorywiki://doc/<id>           → Markdowns + push DocumentDetail
 *   memorywiki://bundle/<id>        → Bundles + push BundleDetail
 *   memorywiki://capture            → Capture tab
 *   memorywiki://capture-paste      → Capture tab + paste clipboard
 *   memorywiki://chat-hub           → Start tab + open hub chat sheet
 *   memorywiki://search             → Markdowns tab + focus search
 *   memorywiki://profile            → Settings tab
 *   memorywiki://demo-signin        → Auth signInDemo(demo@memory.wiki)
 *   https://memory.wiki/<id>        → /{id} doc URL — same as ://doc/<id>
 */

package wiki.memory.memorywiki

import android.net.Uri
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Enum declaration order = tab-bar render order. iOS uses
 *  [MDs, Bundles, Start★, Capture, Settings] with Start as the
 *  centre brand-glyph anchor; we match exactly so the muscle
 *  memory carries across surfaces. */
enum class AppTab(val route: String) {
    Markdowns("markdowns"),
    Bundles("bundles"),
    Start("start"),
    Capture("capture"),
    Settings("settings"),
}

/**
 * Events the router emits to in-screen composables (focus search bar,
 * paste clipboard into capture, open hub chat sheet). Same shape as
 * the iOS NotificationCenter.Name set.
 */
sealed class RouterEvent {
    data object OpenSearch : RouterEvent()
    data object CapturePaste : RouterEvent()
    data object OpenHubChat : RouterEvent()
    /** Fired when the app returns to the foreground. Lists +
     *  dashboard collect this to re-pull from the server so the
     *  user lands on fresh state instead of cached. */
    data object ForegroundRefresh : RouterEvent()
    /** Carries a body (and optional title) into the Capture screen
     *  pre-filled. Used by ShareReceiverActivity to land system
     *  share-sheet text/URL into Write mode so the user can edit
     *  + title before publishing. */
    data class CaptureWithBody(val body: String, val title: String? = null) : RouterEvent()
    data class PushDocDetail(val docId: String) : RouterEvent()
    data class PushBundleDetail(val bundleId: String) : RouterEvent()
}

@Singleton
class AppRouter @Inject constructor() {
    private val _selectedTab = MutableStateFlow(AppTab.Start)
    val selectedTab: StateFlow<AppTab> = _selectedTab.asStateFlow()

    private val _events = MutableSharedFlow<RouterEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<RouterEvent> = _events.asSharedFlow()

    fun selectTab(tab: AppTab) { _selectedTab.value = tab }

    suspend fun emit(event: RouterEvent) { _events.emit(event) }

    /**
     * Parses a deep link URI and routes accordingly. Called from
     * MainActivity.onCreate (initial intent) and onNewIntent
     * (singleTask re-launch).
     */
    suspend fun handle(uri: Uri) {
        val scheme = uri.scheme ?: return
        when {
            scheme == "memorywiki" -> handleCustomScheme(uri)
            scheme == "https" && uri.host == "memory.wiki" -> handleHttps(uri)
        }
    }

    private suspend fun handleCustomScheme(uri: Uri) {
        // Custom-scheme URIs use the `host` slot for the verb and
        // pathSegments[0] for the id, e.g. memorywiki://doc/abc.
        val verb = uri.host ?: return
        val first = uri.pathSegments.firstOrNull()
        when (verb) {
            "doc" -> first?.takeIf { it.isNotBlank() }?.let {
                _selectedTab.value = AppTab.Markdowns
                _events.emit(RouterEvent.PushDocDetail(it))
            }
            "bundle" -> first?.takeIf { it.isNotBlank() }?.let {
                _selectedTab.value = AppTab.Bundles
                _events.emit(RouterEvent.PushBundleDetail(it))
            }
            "capture" -> _selectedTab.value = AppTab.Capture
            "capture-paste" -> {
                _selectedTab.value = AppTab.Capture
                _events.emit(RouterEvent.CapturePaste)
            }
            "chat-hub" -> {
                _selectedTab.value = AppTab.Start
                _events.emit(RouterEvent.OpenHubChat)
            }
            "search" -> {
                _selectedTab.value = AppTab.Markdowns
                _events.emit(RouterEvent.OpenSearch)
            }
            "profile" -> _selectedTab.value = AppTab.Settings
            "auth-callback" -> { /* AuthManager handles in its own collector */ }
            "demo-signin" -> { /* Handled by AuthManager via DI binding */ }
            else -> Unit
        }
    }

    private suspend fun handleHttps(uri: Uri) {
        // https://memory.wiki/<id> — bare doc URL. Validate id shape
        // before routing (nanoid charset, 6-16 chars).
        val seg = uri.pathSegments.firstOrNull() ?: return
        if (!seg.matches(Regex("^[A-Za-z0-9_-]{6,16}$"))) return
        val RESERVED = setOf(
            "settings", "galaxy", "discover", "install", "shared",
            "hubs", "manifesto", "plugins", "spec", "privacy", "terms",
            "about", "auth", "admin", "trending", "bookmarklet",
        )
        if (seg.lowercase() in RESERVED) return
        _selectedTab.value = AppTab.Markdowns
        _events.emit(RouterEvent.PushDocDetail(seg))
    }
}
