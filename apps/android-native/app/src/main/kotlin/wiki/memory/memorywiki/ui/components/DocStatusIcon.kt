/*
 * DocStatusIcon — single glyph that encodes a doc's privacy +
 * sync state. Mirrors iOS DocStatusIcon.swift exactly.
 *
 *   isDraft == false && isRestricted → person.2.fill (info blue)
 *   isDraft == false                 → globe         (lime)
 *   else                             → cloud.fill    (faint)
 *
 * When syncedSource is non-null, a small badge composite (ink
 * ring + info-blue circle + white checkmark) overlaps the
 * bottom-trailing corner — same as the web's sidebar sync badge.
 */

package wiki.memory.memorywiki.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.*
import wiki.memory.memorywiki.ui.theme.Brand

@Composable
fun DocStatusIcon(
    isDraft: Boolean,
    isRestricted: Boolean = false,
    syncedSource: String? = null,
    sizeDp: Int = 18,
) {
    val (icon, tint) = when {
        !isDraft && isRestricted -> Lucide.Users to Brand.MicroInfo
        !isDraft -> Lucide.Globe to Brand.MicroLime
        else -> Lucide.Cloud to Brand.TextFaint
    }
    val glyphFraction = when {
        !isDraft && isRestricted -> 0.70f
        else -> 0.78f
    }
    val glyphSize = (sizeDp * glyphFraction).toInt()
    Box(Modifier.size(sizeDp.dp), contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(glyphSize.dp))
        if (syncedSource != null) {
            // Badge: bottom-trailing 12dp Background ring + 10dp
            // microInfo fill + 6dp white check. Sized 12dp so it
            // reads at 14-18dp host sizes without crowding.
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(Brand.Background),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(Brand.MicroInfo),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Lucide.Check, null, tint = Color.White, modifier = Modifier.size(7.dp))
                }
            }
        }
    }
}
