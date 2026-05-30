/*
 * AmbientBlob — full-bleed faint morph blob backdrop. Same SVG
 * the brand mark uses, scaled to the larger dimension of the
 * canvas, opacity 4.5%, blurred. iOS uses this behind every
 * empty state (Timeline / Bundles) and the Capture canvas so the
 * surface has texture instead of pure black.
 *
 * Costs one WebView per instance; only mount inside the empty
 * states (the blob is GPU-cached after the first frame).
 */

package wiki.memory.memorywiki.ui.components

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp

@Composable
fun AmbientBlob(modifier: Modifier = Modifier, alpha: Float = 0.045f, blurRadius: Int = 12) {
    BoxWithConstraints(modifier.fillMaxSize()) {
        val dim = maxOf(maxWidth, maxHeight).value * 0.95f
        androidx.compose.foundation.layout.Box(
            Modifier
                .align(Alignment.Center)
                .graphicsLayer { this.alpha = alpha }
                .blur(blurRadius.dp),
            contentAlignment = Alignment.Center,
        ) {
            BrandBlob(sizeDp = dim.toInt())
        }
    }
}
