/*
 * v3.0 unified renderer for Android — WebView hybrid that wraps the
 * @mdcore/editor UMD bundle from app/src/main/assets/memorywiki/.
 * Same source-of-truth as web / desktop / vscode / quicklook / iOS,
 * so output is byte-identical to opening the doc on memory.wiki.
 *
 * Markwon-based MarkdownBody.kt stays as a fast native fallback for
 * surfaces that don't need full parity. Switch callers to this view
 * surface by surface as we verify each one renders cleanly.
 *
 * Assets refreshed by apps/android-native/scripts/vendor-editor.sh
 * (runs from packages/editor's latest build).
 */

package wiki.memory.memorywiki.ui.markdown

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView

@Composable
@SuppressLint("SetJavaScriptEnabled")
fun MarkdownBodyV3(
    markdown: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                setBackgroundColor(0x00000000)
                settings.javaScriptEnabled = true
                settings.allowFileAccess = true
                settings.allowContentAccess = true
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        val uri = request.url
                        if (uri.scheme == "http" || uri.scheme == "https") {
                            // Open external links in the system browser
                            view.context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                            return true
                        }
                        return false
                    }
                }
            }
        },
        update = { webView ->
            val html = buildHtml(markdown)
            webView.loadDataWithBaseURL(
                "file:///android_asset/memorywiki/",
                html,
                "text/html",
                "utf-8",
                null,
            )
        },
    )
}

private fun buildHtml(markdown: String): String {
    // JS-escape so the markdown can sit inside a template literal
    val escaped = markdown
        .replace("\\", "\\\\")
        .replace("`", "\\`")
        .replace("\$", "\\\$")
    return """
        <!DOCTYPE html>
        <html><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="github-dark.min.css">
        <link rel="stylesheet" href="katex.min.css">
        <style>
          body { margin: 0; padding: 12px 16px; font: 15px system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1c1c1e; }
          @media (prefers-color-scheme: dark) { body { color: #f2f2f7; background: transparent; } }
          pre { overflow-x: auto; }
          img, table { max-width: 100%; }
        </style>
        <script src="render.umd.js"></script>
        </head><body>
        <div id="preview"></div>
        <script>
        (function() {
          const md = `$escaped`;
          try {
            const out = window.MemoryWikiRender.render(md);
            document.getElementById('preview').innerHTML = out.html;
          } catch (e) {
            document.getElementById('preview').textContent = md;
          }
        })();
        </script>
        </body></html>
    """.trimIndent()
}
