/*
 * BrandBlob — renders the canonical memory.wiki blob glyph
 * (mwblob_morph.svg) inside a transparent WebView. iOS does the
 * same in AnimatedBlob.swift because the SVG ships with a SMIL
 * <animate> tag on the path's `d` attribute (10.867s morph loop)
 * that no native SVG renderer for Android (Coil-SVG, AndroidSVG)
 * actually plays. WebKit (and Chromium on Android) renders SMIL,
 * so we host the same file the web uses.
 *
 * Cost: one WebView per blob instance. We keep instances small
 * (tab bar centerpiece + auth hero); each WebView is layout-zero,
 * non-scrolling, non-interactive, transparent.
 */

package wiki.memory.memorywiki.ui.components

import android.annotation.SuppressLint
import android.graphics.Color as AColor
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebSettings
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import wiki.memory.memorywiki.R

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun BrandBlob(
    sizeDp: Int = 168,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    // Load + inline the SVG once per process.
    val html = remember {
        val svg = context.resources.openRawResource(R.raw.brand_blob_morph)
            .bufferedReader().use { it.readText() }
        """
        <!doctype html>
        <html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
        <style>
          html,body{margin:0;padding:0;background:transparent;height:100%;width:100%;overflow:hidden}
          svg{display:block;width:100%;height:100%}
        </style></head><body>$svg</body></html>
        """.trimIndent()
    }

    AndroidView(
        modifier = modifier.size(sizeDp.dp),
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                setBackgroundColor(AColor.TRANSPARENT)
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                isClickable = false
                isFocusable = false
                setLayerType(WebView.LAYER_TYPE_HARDWARE, null)
                settings.apply {
                    javaScriptEnabled = false  // SMIL is declarative, no JS
                    loadWithOverviewMode = true
                    useWideViewPort = false
                    cacheMode = WebSettings.LOAD_DEFAULT
                }
                loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
            }
        },
        update = { /* HTML content is static; no rebind needed */ },
    )
}
