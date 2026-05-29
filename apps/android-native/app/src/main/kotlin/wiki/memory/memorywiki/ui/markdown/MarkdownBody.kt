/*
 * MarkdownBody — Compose wrapper around Markwon. Mirrors iOS'
 * MarkdownBody.swift: GFM tables, task lists, images, links, strikethrough,
 * inline HTML. Headings use Cal Sans, code blocks use JetBrains Mono +
 * surface background, blockquotes get a left border.
 */

package wiki.memory.memorywiki.ui.markdown

import android.graphics.Typeface
import android.text.style.LineBackgroundSpan
import android.widget.TextView
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Density
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.res.ResourcesCompat
import io.noties.markwon.AbstractMarkwonPlugin
import io.noties.markwon.Markwon
import io.noties.markwon.MarkwonConfiguration
import io.noties.markwon.MarkwonSpansFactory
import io.noties.markwon.core.MarkwonTheme
import io.noties.markwon.core.spans.HeadingSpan
import io.noties.markwon.core.spans.LinkSpan
import io.noties.markwon.html.HtmlPlugin
import org.commonmark.node.Heading
import wiki.memory.memorywiki.R
import wiki.memory.memorywiki.ui.theme.Brand

@Composable
fun MarkdownBody(
    markdown: String,
    modifier: Modifier = Modifier,
    markwon: Markwon,
    accentColor: androidx.compose.ui.graphics.Color = Brand.Accent,
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
