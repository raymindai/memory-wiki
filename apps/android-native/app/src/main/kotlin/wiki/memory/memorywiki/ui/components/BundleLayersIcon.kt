/*
 * BundleLayersIcon — bundle marker glyph with status color.
 * iOS canvas-draws three stacked diamonds; on Android we use
 * the canonical lucide-react `Layers` mark (same source the
 * web app draws). Colour vocabulary matches iOS / web exactly:
 *
 *   visibility=public            → MicroLime
 *   visibility=restricted | else → MicroInfo (shared)
 *   isDraft=true                 → TextFaint (private)
 */

package wiki.memory.memorywiki.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.Layers
import com.composables.icons.lucide.Lucide
import wiki.memory.memorywiki.ui.theme.Brand

@Composable
fun BundleLayersIcon(
    isDraft: Boolean,
    visibility: String? = null,
    sizeDp: Int = 18,
) {
    val tint: Color = when {
        isDraft -> Brand.TextFaint
        visibility == "public" -> Brand.MicroLime
        visibility == "restricted" -> Brand.MicroInfo
        else -> Brand.MicroInfo
    }
    Icon(Lucide.Layers, null, tint = tint, modifier = Modifier.size(sizeDp.dp))
}
