/*
 * PinnedStore — central pin/unpin state. Hydrates from the
 * server (api.pins()) once per session and exposes a live
 * StateFlow so every list / row / detail can react to changes
 * without re-fetching.
 *
 * Mirrors iOS PinnedStore.shared. Optimistic local update on
 * toggle — UI flips immediately, server call runs in
 * background; rolls back on failure.
 */

package wiki.memory.memorywiki.data

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@Singleton
class PinnedStore @Inject constructor(private val api: ApiClient) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _docIds = MutableStateFlow<Set<String>>(emptySet())
    val docIds: StateFlow<Set<String>> = _docIds.asStateFlow()

    private val _bundleIds = MutableStateFlow<Set<String>>(emptySet())
    val bundleIds: StateFlow<Set<String>> = _bundleIds.asStateFlow()

    private val _hydrated = MutableStateFlow(false)
    val hydrated: StateFlow<Boolean> = _hydrated.asStateFlow()

    fun isPinnedDoc(id: String): Boolean = id in _docIds.value
    fun isPinnedBundle(id: String): Boolean = id in _bundleIds.value

    suspend fun hydrate() {
        runCatching { api.pins() }.onSuccess { resp ->
            _docIds.value = resp.pins.filter { it.kind == "document" }.map { it.id }.toSet()
            _bundleIds.value = resp.pins.filter { it.kind == "bundle" }.map { it.id }.toSet()
            _hydrated.value = true
        }
    }

    /** Optimistic toggle. Flip local state first so the UI
     *  responds immediately; on server error, revert. */
    fun toggleDoc(id: String) {
        val wasPinned = id in _docIds.value
        _docIds.value = if (wasPinned) _docIds.value - id else _docIds.value + id
        scope.launch {
            runCatching { api.togglePin("document", id, on = !wasPinned) }
                .onFailure {
                    // Revert on failure so the UI doesn't lie.
                    _docIds.value = if (wasPinned) _docIds.value + id else _docIds.value - id
                }
        }
    }

    fun toggleBundle(id: String) {
        val wasPinned = id in _bundleIds.value
        _bundleIds.value = if (wasPinned) _bundleIds.value - id else _bundleIds.value + id
        scope.launch {
            runCatching { api.togglePin("bundle", id, on = !wasPinned) }
                .onFailure {
                    _bundleIds.value = if (wasPinned) _bundleIds.value + id else _bundleIds.value - id
                }
        }
    }

    /** Wipe local cache on user-change. The next hydrate() call
     *  will refill with the new account's pins. */
    fun clearForUserChange() {
        _docIds.value = emptySet()
        _bundleIds.value = emptySet()
        _hydrated.value = false
    }
}
