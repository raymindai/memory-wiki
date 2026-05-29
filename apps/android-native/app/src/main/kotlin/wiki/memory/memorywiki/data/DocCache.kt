/*
 * DocCache — process-wide LRU for DocumentDetail.
 *
 * Same shape as iOS DocCache.swift. 80-entry cap; clears on user
 * change so a logged-out anon can't see the previous account's docs.
 * Stale-while-revalidate reads through `getOrFetch`.
 */

package wiki.memory.memorywiki.data

import androidx.collection.LruCache
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.data.model.DocumentDetail
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DocCache @Inject constructor(
    private val api: ApiClient,
) {
    private val cache = LruCache<String, DocumentDetail>(80)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _changes = MutableStateFlow(0L)
    val changes: StateFlow<Long> = _changes.asStateFlow()

    fun clearOnUserChange() {
        cache.evictAll()
        bump()
    }

    fun snapshot(id: String): DocumentDetail? = cache[id]

    /** Returns cached value immediately (or null) and kicks off a
     *  background refetch that replaces the entry. UI binds to
     *  [changes] to know when to re-read snapshot. */
    fun prefetch(id: String): DocumentDetail? {
        val cached = cache[id]
        scope.launch {
            runCatching { api.documentDetail(id) }.onSuccess { fresh ->
                cache.put(id, fresh)
                bump()
            }
        }
        return cached
    }

    suspend fun fetchAndCache(id: String): DocumentDetail {
        val fresh = api.documentDetail(id)
        cache.put(id, fresh)
        bump()
        return fresh
    }

    private fun bump() { _changes.value = _changes.value + 1 }
}
