/*
 * OnboardingScreen — port of iOS OnboardingView.swift.
 *
 *   Three swipe-able cards introducing the iOS-companion thesis:
 *     01 / CAPTURE          Save anything in one tap
 *     02 / FEED YOUR AI     Stop re-explaining yourself
 *     03 / ALWAYS WITHIN REACH  Your hub follows you everywhere
 *
 *   Surfaces only on the first signed-in session. SharedPreferences
 *   key 'mw.onboarded' flips when the user dismisses or finishes.
 *
 *   Chrome:
 *     - Top bar: tiny wordmark + Skip
 *     - HorizontalPager body (no indicator from pager)
 *     - Capsule page dots (4dp tall; active 18dp wide, inactive 6dp)
 *     - Bottom CTA: Next / Start capturing (52dp ink-filled)
 *     - Ambient blob backdrop at 6% alpha
 */

package wiki.memory.memorywiki.ui.onboarding

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.*
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.ui.components.AmbientBlob
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

private data class OnboardCard(
    val label: String,
    val title: String,
    val body: String,
    val glyph: ImageVector,
)

private val cards = listOf(
    OnboardCard(
        label = "01 / CAPTURE",
        title = "Save anything, in one tap.",
        body = "From the browser, Notes, a photo, a thought spoken out loud. Every input becomes a memory in your hub. Never lose an idea to 'I'll write that down later.'",
        glyph = Lucide.Upload,
    ),
    OnboardCard(
        label = "02 / FEED YOUR AI",
        title = "Stop re-explaining yourself.",
        body = "Paste memory.wiki/@you into Claude, ChatGPT, or Cursor. They all read the same memory. One link, every model already knows who you are and what you've learned.",
        glyph = Lucide.Sparkles,
    ),
    OnboardCard(
        label = "03 / ALWAYS WITHIN REACH",
        title = "Your hub follows you everywhere.",
        body = "Home-screen widget, voice capture, system share sheet. Android keeps your memory one tap away. Full editor + collaboration + bundles live on the web.",
        glyph = Lucide.Smartphone,
    ),
)

private const val PREF = "memorywiki.prefs"
private const val KEY_ONBOARDED = "mw.onboarded"

@Composable
fun shouldShowOnboarding(): Boolean {
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences(PREF, android.content.Context.MODE_PRIVATE) }
    return remember { !prefs.getBoolean(KEY_ONBOARDED, false) }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(onDismiss: () -> Unit) {
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences(PREF, android.content.Context.MODE_PRIVATE) }
    val pagerState = rememberPagerState(pageCount = { cards.size })
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    val finish: () -> Unit = {
        prefs.edit().putBoolean(KEY_ONBOARDED, true).apply()
        onDismiss()
    }
    val advance: () -> Unit = {
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        if (pagerState.currentPage < cards.size - 1) {
            scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
        } else {
            finish()
        }
    }

    Box(Modifier.fillMaxSize().background(Brand.Background)) {
        AmbientBlob(alpha = 0.06f, blurRadius = 10)
        Column(Modifier.fillMaxSize().padding(top = 22.dp, bottom = 28.dp)) {
            // Top bar
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "memory.wiki",
                    style = BrandType.display(18),
                    color = Brand.TextPrimary,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "Skip",
                    style = BrandType.body(13, FontWeight.Medium),
                    color = Brand.TextMuted,
                    modifier = Modifier.clickable { finish() },
                )
            }

            HorizontalPager(
                state = pagerState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
            ) { i ->
                CardBody(cards[i])
            }

            // Page dots
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 18.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    cards.indices.forEach { i ->
                        val active = i == pagerState.currentPage
                        val width by animateDpAsState(
                            if (active) 18.dp else 6.dp,
                            animationSpec = tween(220),
                            label = "dot-width-$i",
                        )
                        Box(
                            Modifier
                                .height(4.dp)
                                .width(width)
                                .clip(RoundedCornerShape(2.dp))
                                .background(if (active) Brand.TextPrimary else Brand.Border),
                        )
                    }
                }
            }

            // CTA
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 22.dp)
                    .height(52.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Brand.TextPrimary)
                    .clickable { advance() },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (pagerState.currentPage < cards.size - 1) "Next" else "Start capturing",
                    style = BrandType.body(15, FontWeight.SemiBold),
                    color = Brand.Background,
                )
            }
        }
    }
}

@Composable
private fun CardBody(card: OnboardCard) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Spacer(Modifier.weight(1f))
        Icon(
            card.glyph,
            null,
            tint = Brand.TextPrimary,
            modifier = Modifier
                .size(44.dp)
                .padding(bottom = 8.dp),
        )
        Spacer(Modifier.height(14.dp))
        Text(
            card.label,
            style = BrandType.mono(10, FontWeight.Medium),
            color = Brand.TextFaint,
        )
        Spacer(Modifier.height(14.dp))
        Text(
            card.title,
            style = BrandType.display(30),
            color = Brand.TextPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 14.dp),
        )
        Spacer(Modifier.height(18.dp))
        Text(
            card.body,
            style = BrandType.body(15),
            color = Brand.TextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 18.dp),
        )
        Spacer(Modifier.weight(2f))
    }
}
