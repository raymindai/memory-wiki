/*
 * ShareReceiverActivity — translucent activity that handles ACTION_SEND
 * (text + image) from the system share sheet. Mirrors iOS Share
 * Extension: silent POST, toast, finish. No UI of its own.
 */

package wiki.memory.memorywiki.share

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import io.ktor.client.HttpClient
import io.ktor.client.request.headers
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.util.WebPEncoder
import javax.inject.Inject

@AndroidEntryPoint
class ShareReceiverActivity : Activity() {
    @Inject lateinit var auth: AuthManager
    @Inject lateinit var http: HttpClient
    @Inject lateinit var api: ApiClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val intent = intent ?: run { finish(); return }
        if (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_SEND_MULTIPLE) {
            finish(); return
        }
        if (auth.session.value == null) {
            toast("Sign in to memory.wiki first")
            finish(); return
        }

        lifecycleScope.launch {
            try {
                when {
                    intent.type == "text/plain" -> handleText(intent)
                    intent.type?.startsWith("image/") == true -> handleImage(intent)
                    else -> toast("Unsupported share type")
                }
            } catch (t: Throwable) {
                toast("Share failed: ${t.message}")
            } finally {
                finish()
            }
        }
    }

    private suspend fun handleText(intent: Intent) {
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
        val title = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim().orEmpty()
        if (text.isBlank()) { toast("Nothing to share"); return }

        val body = buildString {
            if (title.isNotBlank()) appendLine("# $title").appendLine()
            append(text)
        }
        withContext(Dispatchers.IO) {
            val res = http.post("${BuildConfig.API_BASE}/api/docs") {
                authHeaders()
                contentType(ContentType.Application.Json)
                setBody(NewDocRequest(markdown = body, title = title.ifBlank { null }))
            }
            if (res.status.isSuccess()) toast("Saved to memory.wiki")
            else toast("Save failed (${res.status.value})")
        }
    }

    private suspend fun handleImage(intent: Intent) {
        val uri: Uri = intent.getParcelableExtra(Intent.EXTRA_STREAM)
            ?: run { toast("No image"); return }
        val bytes = withContext(Dispatchers.IO) {
            contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } ?: run { toast("Couldn't read image"); return }
        val bitmap = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: run { toast("Bad image"); return }
        val payload = WebPEncoder.encode(bitmap)
            ?: run { toast("Encode failed"); return }
        val upload = api.uploadImage(payload.bytes, payload.fileExtension, payload.contentType)
        toast("Uploaded: ${upload.url}")
    }

    private fun io.ktor.client.request.HttpRequestBuilder.authHeaders() {
        val session = auth.session.value ?: return
        headers {
            append("Authorization", "Bearer ${session.accessToken}")
            append("x-user-id", session.userId)
            session.email?.let { append("x-user-email", it) }
        }
    }

    private fun toast(msg: String) {
        Toast.makeText(this@ShareReceiverActivity, msg, Toast.LENGTH_SHORT).show()
    }

    @Serializable
    private data class NewDocRequest(val markdown: String, val title: String? = null)
}
