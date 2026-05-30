/*
 * ShareReceiverActivity — translucent receiver for ACTION_SEND
 * from the system share sheet.
 *
 *   text/plain  →  forward into Capture (Write mode) so the user
 *                  can edit + title before publishing. Mirrors the
 *                  iOS Share Extension preview sheet.
 *   image/...   →  encode to WebP, upload, create a one-line doc
 *                  referencing the uploaded URL. Silent + toast.
 *                  (Photo-share usually means "save this for
 *                  later", not "let me write about it now.")
 */

package wiki.memory.memorywiki.share

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import io.ktor.client.HttpClient
import io.ktor.client.request.headers
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.MainActivity
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.util.WebPEncoder

@AndroidEntryPoint
class ShareReceiverActivity : ComponentActivity() {
    @Inject lateinit var auth: AuthManager
    @Inject lateinit var http: HttpClient
    @Inject lateinit var api: ApiClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val src = intent ?: run { finish(); return }
        if (src.action != Intent.ACTION_SEND && src.action != Intent.ACTION_SEND_MULTIPLE) {
            finish(); return
        }
        if (auth.session.value == null) {
            toast("Sign in to memory.wiki first")
            finish(); return
        }

        when {
            src.type == "text/plain" -> {
                forwardToCapture(src)
                finish()
            }
            src.type?.startsWith("image/") == true -> {
                lifecycleScope.launch {
                    runCatching { handleImage(src) }
                        .onFailure { toast("Share failed: ${it.message}") }
                    finish()
                }
            }
            else -> {
                toast("Unsupported share type")
                finish()
            }
        }
    }

    /** Hands the shared text off to MainActivity via an explicit
     *  Intent carrying memorywiki://capture + EXTRA_TEXT/SUBJECT.
     *  MainActivity reads the extras and emits CaptureWithBody so
     *  the user lands on Write mode with the text pre-filled. */
    private fun forwardToCapture(src: Intent) {
        val text = src.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
        if (text.isBlank()) { toast("Nothing to share"); return }
        val forward = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("memorywiki://capture")
            putExtra(Intent.EXTRA_TEXT, text)
            src.getStringExtra(Intent.EXTRA_SUBJECT)?.let {
                putExtra(Intent.EXTRA_SUBJECT, it)
            }
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        startActivity(forward)
    }

    private suspend fun handleImage(intent: Intent) {
        val uri: Uri = extractStream(intent) ?: run { toast("No image"); return }
        val bytes = withContext(Dispatchers.IO) {
            contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } ?: run { toast("Couldn't read image"); return }
        val bitmap = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: run { toast("Bad image"); return }
        val payload = WebPEncoder.encode(bitmap)
            ?: run { toast("Encode failed"); return }
        val upload = api.uploadImage(payload.bytes, payload.fileExtension, payload.contentType)
        val markdown = "![shared image](${upload.url})"
        withContext(Dispatchers.IO) {
            val res = http.post("${BuildConfig.API_BASE}/api/docs") {
                authHeaders()
                contentType(ContentType.Application.Json)
                setBody(NewDocRequest(markdown = markdown, title = null))
            }
            withContext(Dispatchers.Main) {
                if (res.status.isSuccess()) toast("Image saved to memory.wiki")
                else toast("Save failed (${res.status.value})")
            }
        }
    }

    /** API 33+ requires the typed overload of getParcelableExtra. */
    @Suppress("DEPRECATION")
    private fun extractStream(intent: Intent): Uri? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        else
            intent.getParcelableExtra(Intent.EXTRA_STREAM)

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
