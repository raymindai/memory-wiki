/*
 * TableOfContentsSheet — quick orientation for long docs.
 *
 *   Header  mono 9 'TABLE OF CONTENTS' label
 *   Body    one row per ATX heading (#, ##, ###…). Row layout:
 *             'H<level>' mono 10 rail (20dp wide, faint) +
 *             body text scaled down per level, indented
 *             14dp per level (matches iOS TableOfContentsSheet).
 *   onPick  fires when a heading is tapped; caller dismisses.
 *
 * Scroll-to integration is a follow-up (Compose ScrollState +
 * heading offset map). For now the sheet's job is summary +
 * dismiss.
 */

package wiki.memory.memorywiki.ui.document

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

data class MarkdownHeading(val level: Int, val text: String)

/** Pulls every ATX heading (#…###### through 6) out of a doc
 *  body. Skips empty headings + ignores `#` inside fenced code
 *  blocks (toggles on ``` lines). */
fun extractHeadings(markdown: String): List<MarkdownHeading> {
    val out = mutableListOf<MarkdownHeading>()
    var inFence = false
    val rx = Regex("^(#{1,6})\\s+(.+?)\\s*#*\\s*$")
    markdown.lineSequence().forEach { line ->
        if (line.trimStart().startsWith("```")) {
            inFence = !inFence
            return@forEach
        }
        if (inFence) return@forEach
        rx.matchEntire(line.trimEnd())?.let { m ->
            val level = m.groupValues[1].length
            val text = m.groupValues[2].trim()
            if (text.isNotEmpty()) out.add(MarkdownHeading(level, text))
        }
    }
    return out
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TableOfContentsSheet(
    headings: List<MarkdownHeading>,
    onDismiss: () -> Unit,
    onPick: (MarkdownHeading) -> Unit = { onDismiss() },
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Brand.SheetBg,
        contentColor = Brand.TextPrimary,
        dragHandle = null,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 18.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                "TABLE OF CONTENTS",
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.TextFaint,
                modifier = Modifier.padding(bottom = 6.dp),
            )
            if (headings.isEmpty()) {
                Text(
                    "This doc has no headings yet.",
                    style = BrandType.body(13),
                    color = Brand.TextMuted,
                    modifier = Modifier.padding(vertical = 18.dp),
                )
                return@Column
            }
            headings.forEach { h ->
                TocRow(h, onClick = { onPick(h) })
            }
        }
    }
}

@Composable
private fun TocRow(h: MarkdownHeading, onClick: () -> Unit) {
    val indentDp = (h.level - 1).coerceAtLeast(0) * 14
    // Shrink body size for nested headings, capped at 2 levels of
    // shrink so H4+ all read the same.
    val bodySize = (14 - minOf(h.level - 1, 2)).coerceAtLeast(11)
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(start = indentDp.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            "H${h.level}",
            style = BrandType.mono(10, FontWeight.Medium),
            color = Brand.TextFaint,
            modifier = Modifier.width(20.dp),
        )
        Text(
            h.text,
            style = BrandType.body(bodySize),
            color = Brand.TextPrimary,
        )
    }
}
