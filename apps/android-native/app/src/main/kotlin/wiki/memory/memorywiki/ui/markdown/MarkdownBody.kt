/*
 * MarkdownBody — Compose wrapper around Markwon. Mirrors iOS'
 * MarkdownBody.swift: GFM tables, task lists, images, links,
 * strikethrough, inline HTML. Inline configuration of fonts +
 * link color lives in MarkwonConfiguration; we pass the
 * Markwon instance from Hilt so the plugin chain is built once
 * per process.
 */

package wiki.memory.memorywiki.ui.markdown

import android.widget.TextView
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.res.ResourcesCompat
import io.noties.markwon.Markwon
import wiki.memory.memorywiki.R
import wiki.memory.memorywiki.ui.theme.Brand

@Composable
fun MarkdownBody(
    markdown: String,
    markwon: Markwon,
    modifier: Modifier = Modifier,
    accentColor: Color = Brand.Accent,
) {
    val context = LocalContext.current
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            TextView(ctx).apply {
                setTextColor(Brand.TextPrimary.toArgb())
                setLinkTextColor(accentColor.toArgb())
                typeface = ResourcesCompat.getFont(ctx, R.font.noto_sans_regular)
                textSize = 15f
                setLineSpacing(0f, 1.5f)
                setTextIsSelectable(true)
                setPadding(0, 0, 0, 0)
            }
        },
        update = { tv ->
            tv.setLinkTextColor(accentColor.toArgb())
            markwon.setMarkdown(tv, markdown)
        },
    )
}
