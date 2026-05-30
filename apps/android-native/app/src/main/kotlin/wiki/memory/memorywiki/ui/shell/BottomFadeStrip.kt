/*
 * BottomFadeStrip — soft gradient from transparent at the top to
 * the page background at the home indicator. Sits BEHIND the
 * floating tab bar so scrolled content fades out cleanly instead
 * of crashing into the capsule. Matches iOS BottomFadeStrip.
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
fun BottomFadeStrip(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .height(130.dp)
            .background(
                Brush.verticalGradient(
                    0.00f to Brand.Background.copy(alpha = 0f),
                    0.30f to Brand.Background.copy(alpha = 0.30f),
                    0.55f to Brand.Background.copy(alpha = 0.65f),
                    1.00f to Brand.Background,
                ),
            ),
    )
}
