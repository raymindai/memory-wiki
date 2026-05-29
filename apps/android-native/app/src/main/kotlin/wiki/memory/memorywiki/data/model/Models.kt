/*
 * Models — wire format for the memory.wiki API.
 *
 * Field names mirror what `apps/web/src/app/api/*` returns. Optional
 * fields are nullable; rare-but-present ones use defaults so the JSON
 * decoder doesn't choke on a missing key.
 */

package wiki.memory.memorywiki.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserSession(
    val userId: String,
    val email: String?,
    val accessToken: String,
    val refreshToken: String? = null,
    val hubSlug: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val accentColor: String? = null,
    val colorScheme: String? = null,
    val plan: String? = null,
)

@Serializable
data class ProfileRow(
    val id: String,
    @SerialName("hub_slug") val hubSlug: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("avatar_style") val avatarStyle: String? = null,
    @SerialName("accent_color") val accentColor: String? = null,
    @SerialName("color_scheme") val colorScheme: String? = null,
    val plan: String? = null,
)

@Serializable
data class DocSummary(
    val id: String,
    val title: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("is_draft") val isDraft: Boolean = true,
    @SerialName("view_count") val viewCount: Int = 0,
    val intent: String? = null,
    val source: String? = null,
)

@Serializable
data class UserDocumentsResponse(
    val documents: List<DocSummary> = emptyList(),
)

@Serializable
data class BundleSummary(
    val id: String,
    val title: String? = null,
    val description: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("is_draft") val isDraft: Boolean = true,
    val visibility: String? = null,
    @SerialName("document_count") val documentCount: Int = 0,
    @SerialName("creator_type") val creatorType: String? = null,
    @SerialName("folder_id") val folderId: String? = null,
)

@Serializable
data class UserBundlesResponse(
    val bundles: List<BundleSummary> = emptyList(),
)

@Serializable
data class DocumentDetail(
    val id: String,
    val markdown: String = "",
    val title: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("is_draft") val isDraft: Boolean = true,
    @SerialName("edit_mode") val editMode: String? = null,
    @SerialName("view_count") val viewCount: Int = 0,
    val source: String? = null,
    val intent: String? = null,
    val isOwner: Boolean = false,
    val isEditor: Boolean = false,
    val ownerEmail: String? = null,
    val ownerAccent: String? = null,
    val ownerScheme: String? = null,
    val allowedEmails: List<String> = emptyList(),
    val allowedEditors: List<String> = emptyList(),
)

@Serializable
data class BundleDetail(
    val id: String,
    val title: String? = null,
    val description: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("is_draft") val isDraft: Boolean = true,
    val visibility: String? = null,
    val isOwner: Boolean = false,
    val ownerEmail: String? = null,
    val ownerAccent: String? = null,
    val ownerScheme: String? = null,
    val documents: List<DocSummary> = emptyList(),
)

@Serializable
data class HubResponse(
    val hub: HubInfo,
    val counts: HubCounts,
)

@Serializable
data class HubInfo(
    val slug: String,
    val title: String? = null,
    val description: String? = null,
    val owner: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
)

@Serializable
data class HubCounts(
    @SerialName("documents_total") val docsTotal: Int = 0,
    @SerialName("documents_public") val docsPublic: Int = 0,
    @SerialName("bundles_total") val bundlesTotal: Int = 0,
    @SerialName("bundles_public") val bundlesPublic: Int = 0,
)

@Serializable
data class DemoSignInResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("user") val user: AuthUser? = null,
)

@Serializable
data class AuthUser(
    val id: String,
    val email: String? = null,
)

@Serializable
data class SearchHit(
    @SerialName("document_id") val documentId: String,
    val title: String? = null,
    val snippet: String? = null,
    val score: Double? = null,
)

@Serializable
data class SearchResponse(
    val results: List<SearchHit> = emptyList(),
)

@Serializable
data class UploadResponse(
    val url: String,
    @SerialName("size_bytes") val sizeBytes: Long? = null,
)

@Serializable
data class CreateBundleResponse(
    val id: String,
    val title: String? = null,
)

@Serializable
data class ChatMessage(
    val role: String,                // "user" | "assistant" | "system"
    val content: String,
)

@Serializable
data class ChatRequest(
    val message: String,
    val history: List<ChatMessage> = emptyList(),
)
