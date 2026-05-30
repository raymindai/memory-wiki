/*
 * BrandTabBar — floating glass tab bar mirroring iOS BrandTabBar.
 * Order: [MDs, Bundles, Start★, Capture, Settings]. Start tab gets
 * the brand blob glyph as the centre anchor; the other four use
 * Lucide icons (same shape language as web `lucide-react`).
 */

package wiki.memory.memorywiki.ui.shell

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.Layers
import com.composables.icons.lucide.List
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Plus
import com.composables.icons.lucide.User
import wiki.memory.memorywiki.AppTab
import wiki.memory.memorywiki.ui.components.BrandBlob
import wiki.memory.memorywiki.ui.theme.Brand

private sealed class TabGlyph {
    data class Lucide(val icon: ImageVector) : TabGlyph()
    data object BrandCentre : TabGlyph()
}

private data class TabSpec(val tab: AppTab, val glyph: TabGlyph, val label: String)

@Composable
fun BrandTabBar(
    selected: AppTab,
    onSelect: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val specs = remember {
        listOf(
            TabSpec(AppTab.Markdowns, TabGlyph.Lucide(Lucide.List),  "MDs"),
            TabSpec(AppTab.Bundles,   TabGlyph.Lucide(Lucide.Layers), "Bundles"),
            TabSpec(AppTab.Start,     TabGlyph.BrandCentre,           "Start"),
            TabSpec(AppTab.Capture,   TabGlyph.Lucide(Lucide.Plus),  "Capture"),
            TabSpec(AppTab.Settings,  TabGlyph.Lucide(Lucide.User),  "Settings"),
        )
    }
    val haptics = LocalHapticFeedback.current
    Box(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier
                .shadow(elevation = 18.dp, shape = RoundedCornerShape(30.dp), ambientColor = Color.Black, spotColor = Color.Black)
                .background(Brand.SheetBg, RoundedCornerShape(30.dp))
                .border(width = 0.5.dp, color = Brand.BorderDim, shape = RoundedCornerShape(30.dp))
                .height(58.dp)
                .padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            specs.forEach { spec ->
                TabItem(
                    spec = spec,
                    selected = spec.tab == selected,
                    onClick = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        onSelect(spec.tab)
                    },
                )
            }
        }
    }
}

@Composable
private fun TabItem(spec: TabSpec, selected: Boolean, onClick: () -> Unit) {
    val isCentre = spec.glyph is TabGlyph.BrandCentre
    val ringSize by animateDpAsState(
        targetValue = when {
            isCentre -> if (selected) 46.dp else 42.dp
            else -> if (selected) 40.dp else 36.dp
        },
        animationSpec = spring(Spring.DampingRatioMediumBouncy),
        label = "ring",
    )
    Box(
        Modifier
            .width(if (isCentre) 72.dp else 60.dp)
            .height(50.dp)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        when (val g = spec.glyph) {
            is TabGlyph.BrandCentre -> {
                // No surrounding ring — the brand blob IS the
                // affordance. Selected state lifts the glyph and
                // dims unselected to muted lime per the v8 rule
                // (lime is reserved for status, but the brand mark
                // earned an exception as the centre anchor).
                BrandBlob(sizeDp = if (selected) 40 else 32)
            }
            is TabGlyph.Lucide -> {
                Box(
                    Modifier
                        .size(ringSize)
                        .background(if (selected) Brand.Surface else Color.Transparent, CircleShape)
                        .border(
                            if (selected) 0.5.dp else 0.dp,
                            Brand.TextPrimary.copy(alpha = if (selected) 0.6f else 0f),
                            CircleShape,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        g.icon,
                        contentDescription = spec.label,
                        tint = if (selected) Brand.TextPrimary else Brand.TextMuted,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
    }
}
