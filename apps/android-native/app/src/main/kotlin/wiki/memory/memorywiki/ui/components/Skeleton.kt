/*
 * Skeleton — shimmer placeholders that mirror iOS Skeleton.swift.
 *
 *  - SkeletonRow: short caption + long line, used in MDs / Bundles lists
 *  - SkeletonStatStrip: TODAY / WEEK / ALL TIME 3-column placeholder
 *  - RefreshingPip: tiny dot pulsing in the corner when background
 *    revalidate runs over already-painted data
 */

package wiki.memory.memorywiki.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import wiki.memory.memorywiki.ui.theme.Brand

@Composable
fun ShimmerBlock(modifier: Modifier = Modifier, corner: Int = 6) {
    val transition = rememberInfiniteTransition(label = "skel")
    val phase by transition.animateFloat(
        initialValue = -300f, targetValue = 1100f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Restart),
        label = "phase",
    )
    Box(
        modifier
            .clip(RoundedCornerShape(corner.dp))
            .background(Brand.Surface)
            .drawWithCache {
                val brush = Brush.horizontalGradient(
                    colors = listOf(
                        Color.Transparent,
                        Color.White.copy(alpha = 0.06f),
                        Color.Transparent,
                    ),
                    startX = phase,
                    endX = phase + 220f,
                )
                onDrawBehind { drawRect(brush) }
            },
    )
}

@Composable
fun SkeletonRow(modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ShimmerBlock(Modifier.size(14.dp), corner = 4)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            ShimmerBlock(Modifier.height(12.dp).fillMaxWidth(fraction = 0.65f))
            ShimmerBlock(Modifier.height(9.dp).fillMaxWidth(fraction = 0.35f))
        }
        ShimmerBlock(Modifier.width(28.dp).height(10.dp))
    }
}

@Composable
fun SkeletonList(count: Int = 8) {
    Column { repeat(count) { SkeletonRow() } }
}

@Composable
fun SkeletonStatStrip() {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(28.dp),
    ) {
        repeat(3) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ShimmerBlock(Modifier.height(22.dp).fillMaxWidth(fraction = 0.40f))
                ShimmerBlock(Modifier.height(8.dp).fillMaxWidth(fraction = 0.55f))
            }
        }
    }
}

/** Inline 10dp progress indicator + mono 8 'REFRESHING' caption.
 *  Sits next to a list header title while background revalidate
 *  runs over data already on screen — mirrors iOS RefreshingPip. */
@Composable
fun RefreshingPip(visible: Boolean) {
    if (!visible) return
    androidx.compose.foundation.layout.Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        androidx.compose.material3.CircularProgressIndicator(
            modifier = Modifier.size(10.dp),
            color = Brand.TextMuted,
            strokeWidth = 1.2.dp,
        )
        androidx.compose.material3.Text(
            "REFRESHING",
            fontSize = androidx.compose.ui.unit.TextUnit(8f, androidx.compose.ui.unit.TextUnitType.Sp),
            color = Brand.TextFaint,
            style = wiki.memory.memorywiki.ui.theme.BrandType.mono(
                8, androidx.compose.ui.text.font.FontWeight.Medium,
            ),
        )
    }
}
