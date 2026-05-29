/*
 * ApiClient — single Ktor-based gateway to apps/web/src/app/api/*.
 * Mirrors apps/ios-native/MemoryWiki/Networking/APIClient.swift.
 *
 * Auth header strategy:
 *   - Bearer  → Supabase access token (when signed in)
 *   - x-user-id, x-user-email → backup headers some endpoints read
 *   - On 401 we don't auto-refresh here; AuthManager's sessionStatus
 *     collector will surface a re-login prompt.
 *
 * Streaming endpoints (chat, URL import) expose Flow<String> chunks
 * instead of suspending until the full response lands.
 */

package wiki.memory.memorywiki.data

import android.net.Uri
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.headers
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.prepareGet
import io.ktor.client.request.prepareRequest
import io.ktor.client.request.setBody
import io.ktor.client.request.url
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.client.statement.HttpStatement
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.utils.io.ByteReadChannel
import io.ktor.utils.io.readUTF8Line
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

sealed class ChatScope(open val title: String) {
    data class Hub(val slug: String, override val title: String) : ChatScope(title) {
        val path = "/api/hub/$slug/chat"
    }
    data class Bundle(val id: String, override val title: String) : ChatScope(title) {
        val path = "/api/bundles/$id/chat"
    }
    data class Doc(val id: String, override val title: String) : ChatScope(title) {
        val path = "/api/docs/$id/chat"
    }
    val path: String get() = when (this) {
        is Hub -> "/api/hub/$slug/chat"
        is Bundle -> "/api/bundles/$id/chat"
        is Doc -> "/api/docs/$id/chat"
    }
}

@Singleton
class ApiClient @Inject constructor(
    private val http: HttpClient,
    private val auth: AuthManager,
    private val json: Json,
) {
    private val base = BuildConfig.API_BASE

    private fun HttpRequestBuilder.authHeaders() {
        val session = auth.session.value ?: return
        headers {
            session.accessToken.let { append("Authorization", "Bearer $it") }
            append("x-user-id", session.userId)
            session.email?.let { append("x-user-email", it) }
        }
    }

    // ─── User content ───

    suspend fun userDocuments(includeDeleted: Boolean = false): UserDocumentsResponse {
        val url = "$base/api/user/documents" +
            if (includeDeleted) "?includeDeleted=1" else ""
        val res = http.get(url) { authHeaders() }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} userDocuments")
        return json.decodeFromString(res.bodyAsText())
    }

    suspend fun userBundles(): UserBundlesResponse {
        val res = http.get("$base/api/user/bundles") { authHeaders() }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} userBundles")
        return json.decodeFromString(res.bodyAsText())
    }

    suspend fun documentDetail(id: String): DocumentDetail {
        val res = http.get("$base/api/docs/$id") { authHeaders() }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} documentDetail $id")
        return json.decodeFromString(res.bodyAsText())
    }

    suspend fun bundleDetail(id: String): BundleDetail {
        val res = http.get("$base/api/bundles/$id") { authHeaders() }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} bundleDetail $id")
        return json.decodeFromString(res.bodyAsText())
    }

    suspend fun updateDocument(id: String, markdown: String) {
        val res = http.patch("$base/api/docs/$id") {
            authHeaders()
            contentType(ContentType.Application.Json)
            setBody(mapOf("markdown" to markdown, "action" to "auto-save"))
        }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} updateDocument $id")
    }

    suspend fun semanticSearch(query: String, limit: Int = 8): SearchResponse {
        val res = http.post("$base/api/search") {
            authHeaders()
            contentType(ContentType.Application.Json)
            setBody(mapOf("query" to query, "limit" to limit))
        }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} semanticSearch")
        return json.decodeFromString(res.bodyAsText())
    }

    // ─── Hub ───

    suspend fun hub(slug: String): HubResponse {
        val res = http.get("$base/api/hub/$slug") { authHeaders() }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} hub $slug")
        return json.decodeFromString(res.bodyAsText())
    }

    suspend fun reanalyzeHub() {
        val res = http.post("$base/api/user/hub/reanalyze") { authHeaders() }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} reanalyzeHub")
    }

    // ─── Pins ───

    @Serializable data class Pin(val kind: String, val id: String)
    @Serializable data class PinsResponse(val pins: List<Pin> = emptyList())

    suspend fun pins(): PinsResponse {
        val res = http.get("$base/api/user/pins") { authHeaders() }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} pins")
        return json.decodeFromString(res.bodyAsText())
    }

    suspend fun togglePin(kind: String, id: String, on: Boolean) {
        val res = if (on) {
            http.post("$base/api/user/pins") {
                authHeaders()
                contentType(ContentType.Application.Json)
                setBody(mapOf("kind" to kind, "id" to id))
            }
        } else {
            http.prepareRequest {
                method = HttpMethod.Delete
                url("$base/api/user/pins?kind=$kind&id=$id")
                authHeaders()
            }.execute()
        }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} togglePin")
    }

    // ─── Bundles CRUD ───

    suspend fun createBundle(title: String, description: String? = null): CreateBundleResponse {
        val res = http.post("$base/api/bundles") {
            authHeaders()
            contentType(ContentType.Application.Json)
            setBody(buildMap {
                put("title", title)
                description?.let { put("description", it) }
            })
        }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} createBundle")
        return json.decodeFromString(res.bodyAsText())
    }

    suspend fun addDocumentsToBundle(bundleId: String, docIds: List<String>) {
        val res = http.post("$base/api/bundles/$bundleId/documents") {
            authHeaders()
            contentType(ContentType.Application.Json)
            setBody(mapOf("documentIds" to docIds))
        }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} addDocumentsToBundle")
    }

    // ─── Streaming: chat (raw text, NOT SSE-framed) ───

    fun streamChat(
        scope: ChatScope,
        message: String,
        history: List<ChatMessage> = emptyList(),
    ): Flow<String> = flow {
        val statement = http.prepareRequest {
            method = HttpMethod.Post
            url("$base${scope.path}")
            this@prepareRequest.authHeaders()
            contentType(ContentType.Application.Json)
            setBody(ChatRequest(message, history))
        }
        statement.execute { response ->
            if (!response.status.isSuccess()) {
                emit("\n\n[Error ${response.status.value}]")
                return@execute
            }
            val channel: ByteReadChannel = response.bodyAsChannel()
            val buf = ByteArray(2 * 1024)
            while (!channel.isClosedForRead) {
                val n = channel.readAvailable(buf, 0, buf.size)
                if (n <= 0) continue
                emit(buf.copyOfRange(0, n).toString(Charsets.UTF_8))
            }
        }
    }

    // ─── Streaming: URL import (SSE-framed: event:/data: lines) ───

    data class UrlImportEvent(val stage: String, val payload: String? = null, val done: Boolean = false, val error: String? = null)

    fun streamImportUrl(url: String): Flow<UrlImportEvent> = flow {
        val statement = http.prepareRequest {
            method = HttpMethod.Post
            this.url("$base/api/import/url")
            this@prepareRequest.authHeaders()
            contentType(ContentType.Application.Json)
            setBody(mapOf("url" to url))
        }
        statement.execute { response ->
            if (!response.status.isSuccess()) {
                emit(UrlImportEvent("error", error = "HTTP ${response.status.value}"))
                return@execute
            }
            val channel = response.bodyAsChannel()
            var currentEvent = "message"
            while (!channel.isClosedForRead) {
                val line = channel.readUTF8Line() ?: break
                when {
                    line.startsWith("event:") -> currentEvent = line.removePrefix("event:").trim()
                    line.startsWith("data:") -> {
                        val data = line.removePrefix("data:").trim()
                        when (currentEvent) {
                            "stage" -> emit(UrlImportEvent("stage", data))
                            "done" -> emit(UrlImportEvent("done", data, done = true))
                            "error" -> emit(UrlImportEvent("error", error = data))
                            else -> emit(UrlImportEvent(currentEvent, data))
                        }
                    }
                }
            }
        }
    }

    // ─── Upload ───

    /** Single WebP upload. Caller produces the WebP bytes via
     *  WebPEncoder before this. */
    suspend fun uploadImage(bytes: ByteArray, fileExtension: String = "webp", contentType: String = "image/webp"): UploadResponse {
        val boundary = "MWBoundary${System.nanoTime()}"
        val crlf = "\r\n"
        val preamble = buildString {
            append("--").append(boundary).append(crlf)
            append("Content-Disposition: form-data; name=\"file\"; filename=\"capture.").append(fileExtension).append('"').append(crlf)
            append("Content-Type: ").append(contentType).append(crlf).append(crlf)
        }.toByteArray(Charsets.US_ASCII)
        val postamble = (crlf + "--" + boundary + "--" + crlf).toByteArray(Charsets.US_ASCII)
        val full = preamble + bytes + postamble

        val res = http.post("$base/api/upload") {
            authHeaders()
            headers { append("Content-Type", "multipart/form-data; boundary=$boundary") }
            setBody(full)
        }
        if (!res.status.isSuccess()) error("HTTP ${res.status.value} uploadImage")
        return json.decodeFromString(res.bodyAsText())
    }
}
