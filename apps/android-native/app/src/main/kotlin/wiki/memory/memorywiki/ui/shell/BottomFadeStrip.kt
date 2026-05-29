/*
 * BottomFadeStrip — soft gradient from transparent to Brand.Background
 * sitting just under the floating tab bar. Mirrors iOS' BottomFadeStrip:
 * scroll content fades into the bar instead of clipping abruptly.
 */

package wiki.memory.memorywiki.ui.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import wiki.memory.memorywiki.ui.theme.Brand

@Composable
fun BottomFadeStrip() {
    Box(
        Modifier
            .fillMaxWidth()
            .height(96.dp)
            .background(
                Brush.verticalGradient(
                    0f to Brand.Background.copy(alpha = 0f),
                    0.55f to Brand.Background.copy(alpha = 0.65f),
                    1f to Brand.Background,
                ),
            ),
    )
}
