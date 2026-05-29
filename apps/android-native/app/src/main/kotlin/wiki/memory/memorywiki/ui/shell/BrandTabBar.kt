/*
 * BrandTabBar — floating glass tab bar that mirrors iOS BrandTabBar.
 * Five tabs: Start, MDs, Capture (centerpiece with the blob glyph),
 * Bundles, Settings. Active tab gets ink ring + ink glyph; inactive
 * stays muted. Re-tap fires a tiny shake offset + haptic.
 */

package wiki.memory.memorywiki.ui.shell

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.ViewModule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import wiki.memory.memorywiki.AppTab
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

private data class TabSpec(val tab: AppTab, val icon: ImageVector, val label: String)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun BrandTabBar(
    selected: AppTab,
    onSelect: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val specs = remember {
        listOf(
            TabSpec(AppTab.Start,     Icons.Outlined.AutoAwesome, "Start"),
            TabSpec(AppTab.Markdowns, Icons.Outlined.Notes,       "MDs"),
            TabSpec(AppTab.Capture,   Icons.Outlined.Add,         "Capture"),
            TabSpec(AppTab.Bundles,   Icons.Outlined.Layers,      "Bundles"),
            TabSpec(AppTab.Settings,  Icons.Outlined.Person,      "Settings"),
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
private fun RowScopeShim(content: @Composable () -> Unit) = content() // pure helper; not used

@Composable
private fun TabItem(spec: TabSpec, selected: Boolean, onClick: () -> Unit) {
    val ringSize by animateDpAsState(if (selected) 40.dp else 36.dp, spring(Spring.DampingRatioMediumBouncy), label = "ring")
    Box(
        Modifier
            .width(64.dp)
            .height(50.dp)
            .pointerInput(spec.tab) { detectTapGesturesCompat { onClick() } },
        contentAlignment = Alignment.Center,
    ) {
        if (spec.tab == AppTab.Capture) {
            // Centerpiece blob glyph
            Box(
                Modifier
                    .size(ringSize)
                    .background(if (selected) Brand.TextPrimary else Brand.Surface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    spec.icon,
                    contentDescription = spec.label,
                    tint = if (selected) Brand.Background else Brand.TextPrimary,
                    modifier = Modifier.size(22.dp),
                )
            }
        } else {
            Box(
                Modifier
                    .size(ringSize)
                    .background(if (selected) Brand.Surface else Color.Transparent, CircleShape)
                    .border(if (selected) 0.5.dp else 0.dp, Brand.TextPrimary.copy(alpha = if (selected) 0.6f else 0f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    spec.icon,
                    contentDescription = spec.label,
                    tint = if (selected) Brand.TextPrimary else Brand.TextMuted,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

// Tiny tap-detector wrapper so callers don't pull in Foundation gestures.
private suspend fun androidx.compose.ui.input.pointer.PointerInputScope.detectTapGesturesCompat(onTap: () -> Unit) {
    androidx.compose.foundation.gestures.detectTapGestures(onTap = { onTap() })
}
