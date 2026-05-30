/*
 * BrandLoader — canonical loading affordance. Port of iOS
 * MemoryWiki/Views/BrandLoader.swift.
 *
 * The brand blob (same SMIL-animated SVG the splash + auth hero
 * use) over a tracked mono "LOADING" caption in JetBrains Mono.
 * Replaces every full-screen CircularProgressIndicator so wait
 * states read as the brand instead of Material chrome.
 *
 * Variants:
 *   Inline — 96dp blob, list / body in flight
 *   Full   — 140dp blob, app boot
 *
 * Sits inside a fill-the-available-space Box so the caller can
 * give it any frame (e.g. .fillMaxSize() or a fixed minHeight).
 */

package wiki.memory.memorywiki.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

enum class BrandLoaderVariant { Inline, Full }

@Composable
fun BrandLoader(
    variant: BrandLoaderVariant = BrandLoaderVariant.Inline,
    caption: String = "LOADING",
    modifier: Modifier = Modifier,
) {
    val sizeDp = if (variant == BrandLoaderVariant.Full) 140 else 96
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            BrandBlob(sizeDp = sizeDp)
            Text(
                caption,
                style = BrandType.mono(10, FontWeight.Medium).copy(letterSpacing = 1.4.sp),
                color = Brand.TextFaint,
            )
        }
    }
}
