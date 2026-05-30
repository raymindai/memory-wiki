/*
 * BrandTabBar — port of iOS RootView.swift BrandTabBar.
 *
 *   Layout per tab (top → bottom):
 *     - Glyph        (16dp non-center, 38dp animated blob centerpiece)
 *     - Label        (9sp mono, .5sp tracking, UPPERCASE) — center omits
 *     - Indicator    (14×1dp rectangle, ink when active, transparent otherwise)
 *
 *   Bar chrome:
 *     - Capsule with translucent SheetBg fill + 0.5dp BorderDim stroke
 *     - 18dp shadow under the capsule
 *     - 12dp horizontal inset from screen edges, 4dp from bottom
 *     - On selected re-tap: if tab has a nav stack to pop, pop; else
 *       shake horizontally + warning haptic (matches Mail / Settings)
 */

package wiki.memory.memorywiki.ui.shell

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.composables.icons.lucide.*
import kotlin.math.PI
import kotlin.math.sin
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.AppTab
import wiki.memory.memorywiki.ui.components.BrandBlob
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import androidx.compose.material3.Text
import androidx.compose.foundation.shape.RoundedCornerShape

private sealed class TabGlyph {
    data class Lucide(val icon: ImageVector) : TabGlyph()
    data object BrandCentre : TabGlyph()
    data object ProfileAvatar : TabGlyph()
}

private data class TabSpec(val tab: AppTab, val glyph: TabGlyph, val label: String)

@Composable
fun BrandTabBar(
    selected: AppTab,
    onSelect: (AppTab) -> Unit,
    avatarUrl: String? = null,
    onReselect: (AppTab) -> Boolean = { false },
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val shake = remember { Animatable(0f) }

    val specs = remember(avatarUrl) {
        listOf(
            TabSpec(AppTab.Markdowns, TabGlyph.Lucide(Lucide.List),    "MDs"),
            TabSpec(AppTab.Bundles,   TabGlyph.Lucide(Lucide.Layers),  "Bundles"),
            TabSpec(AppTab.Start,     TabGlyph.BrandCentre,            "Start"),
            TabSpec(AppTab.Capture,   TabGlyph.Lucide(Lucide.Plus),    "Capture"),
            TabSpec(AppTab.Settings,  TabGlyph.ProfileAvatar,          "Settings"),
        )
    }

    Box(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier
                .graphicsLayer { translationX = shakeOffset(shake.value) }
                .shadow(
                    elevation = 18.dp,
                    shape = RoundedCornerShape(50),
                    ambientColor = Color.Black,
                    spotColor = Color.Black,
                )
                .clip(RoundedCornerShape(50))
                .background(Brand.SheetBg)
                .border(width = 0.5.dp, color = Brand.BorderDim, shape = RoundedCornerShape(50))
                .padding(horizontal = 10.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            specs.forEach { spec ->
                TabItem(
                    spec = spec,
                    selected = spec.tab == selected,
                    avatarUrl = avatarUrl,
                    onTap = {
                        if (spec.tab == selected) {
                            val popped = onReselect(spec.tab)
                            if (popped) {
                                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            } else {
                                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                scope.launch {
                                    shake.snapTo(0f)
                                    shake.animateTo(
                                        1f,
                                        animationSpec = tween(durationMillis = 320, easing = LinearEasing),
                                    )
                                }
                            }
                        } else {
                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onSelect(spec.tab)
                        }
                    },
                )
            }
        }
    }
}

private fun shakeOffset(progress: Float): Float {
    // 3 oscillations across the animation, ±6px peak amplitude.
    return (6f * sin(progress * PI.toFloat() * 3f))
}

@Composable
private fun TabItem(
    spec: TabSpec,
    selected: Boolean,
    avatarUrl: String?,
    onTap: () -> Unit,
) {
    val isCentre = spec.glyph is TabGlyph.BrandCentre
    val interaction = remember { MutableInteractionSource() }
    Column(
        Modifier
            .width(if (isCentre) 64.dp else 60.dp)
            .clickable(
                interactionSource = interaction,
                indication = null,
                onClick = onTap,
            )
            .padding(vertical = if (isCentre) 4.dp else 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(if (isCentre) 1.dp else 3.dp),
    ) {
        // Glyph slot — fixed height so labels and indicators line up
        // across center vs non-center tabs.
        Box(
            modifier = Modifier.height(if (isCentre) 38.dp else 22.dp),
            contentAlignment = Alignment.Center,
        ) {
            when (val g = spec.glyph) {
                is TabGlyph.BrandCentre -> {
                    BrandBlob(sizeDp = 38)
                }
                is TabGlyph.Lucide -> {
                    Icon(
                        g.icon,
                        contentDescription = spec.label,
                        tint = if (selected) Brand.TextPrimary else Brand.TextFaint,
                        modifier = Modifier.size(20.dp),
                    )
                }
                is TabGlyph.ProfileAvatar -> {
                    ProfileTabAvatar(avatarUrl = avatarUrl, isActive = selected)
                }
            }
        }

        // Label — center tab has none (the blob is the brand mark).
        if (!isCentre) {
            Text(
                text = spec.label.uppercase(),
                style = BrandType.mono(9, FontWeight.Medium),
                color = if (selected) Brand.TextPrimary else Brand.TextFaint,
                textAlign = TextAlign.Center,
                modifier = Modifier.wrapContentWidth(),
            )
        } else {
            Spacer(Modifier.height(0.dp))
        }

        // Indicator — 14×1dp rectangle, ink when active.
        Box(
            Modifier
                .width(14.dp)
                .height(1.dp)
                .background(if (selected) Brand.TextPrimary else Color.Transparent),
        )
    }
}

@Composable
private fun ProfileTabAvatar(avatarUrl: String?, isActive: Boolean) {
    val ringWidth = if (isActive) 1.5.dp else 0.5.dp
    val ringColor = if (isActive) Brand.TextPrimary else Brand.BorderDim
    Box(
        Modifier
            .size(22.dp)
            .clip(CircleShape)
            .border(ringWidth, ringColor, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (avatarUrl != null) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(22.dp).clip(CircleShape),
            )
        } else {
            Box(
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(Brand.Surface),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Lucide.User,
                    null,
                    tint = if (isActive) Brand.TextPrimary else Brand.TextMuted,
                    modifier = Modifier.size(11.dp),
                )
            }
        }
    }
}
