/*
 * ProcessingBanner — sticky banner above the IME and the floating
 * tab bar. Used by Capture for "Importing URL…", "OCR running…",
 * "Uploading photo…". Mirrors iOS ProcessingBanner.
 */

package wiki.memory.memorywiki.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

@Composable
fun ProcessingBanner(
    title: String?,
    detail: String? = null,
    modifier: Modifier = Modifier,
) {
    AnimatedVisibility(
        visible = !title.isNullOrBlank(),
        enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
    ) {
        Row(
            modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .background(Brand.SheetBg, RoundedCornerShape(14.dp))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(14.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(14.dp),
                color = Brand.TextPrimary,
                strokeWidth = 1.6.dp,
            )
            Column(Modifier.weight(1f)) {
                Text(title ?: "", style = BrandType.body(13), color = Brand.TextPrimary)
                if (!detail.isNullOrBlank()) {
                    Text(detail, style = BrandType.body(11), color = Brand.TextMuted)
                }
            }
        }
    }
}
