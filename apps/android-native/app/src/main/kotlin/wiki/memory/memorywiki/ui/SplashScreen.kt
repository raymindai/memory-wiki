/*
 * SplashScreen — brand-led launch surface that sits between the
 * static UI splash (dark zinc canvas) and the live RootShell.
 * Mirrors iOS SplashView: 196dp animated blob fades + scales in,
 * wordmark and tagline cascade beneath, total dwell ≈ 1.0s.
 *
 *   Stagger:
 *     blob  → spring(0.95/0.78)            from t=0
 *     wordmark → easeOut 550ms, delay 160ms
 *     tagline  → easeOut 550ms, delay 280ms
 */

package wiki.memory.memorywiki.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.ui.components.BrandBlob
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

@Composable
fun SplashScreen() {
    val blobAlpha = remember { Animatable(0f) }
    val blobScale = remember { Animatable(0.86f) }
    val wordmarkAlpha = remember { Animatable(0f) }
    val wordmarkOffsetY = remember { Animatable(8f) }
    val taglineAlpha = remember { Animatable(0f) }
    val taglineOffsetY = remember { Animatable(6f) }

    LaunchedEffect(Unit) {
        launch {
            blobAlpha.animateTo(1f, tween(550, easing = LinearOutSlowInEasing))
        }
        launch {
            blobScale.animateTo(
                1f,
                spring(stiffness = Spring.StiffnessMediumLow, dampingRatio = 0.78f),
            )
        }
        launch {
            delay(160)
            launch {
                wordmarkAlpha.animateTo(0.92f, tween(550, easing = LinearOutSlowInEasing))
            }
            wordmarkOffsetY.animateTo(0f, tween(550, easing = LinearOutSlowInEasing))
        }
        launch {
            delay(280)
            launch {
                taglineAlpha.animateTo(1f, tween(550, easing = LinearOutSlowInEasing))
            }
            taglineOffsetY.animateTo(0f, tween(550, easing = LinearOutSlowInEasing))
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brand.Background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Box(
                modifier = Modifier.graphicsLayer {
                    alpha = blobAlpha.value
                    scaleX = blobScale.value
                    scaleY = blobScale.value
                },
                contentAlignment = Alignment.Center,
            ) {
                BrandBlob(sizeDp = 196)
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "memory.wiki",
                    style = BrandType.display(26),
                    color = Brand.TextPrimary,
                    modifier = Modifier.graphicsLayer {
                        alpha = wordmarkAlpha.value
                        translationY = wordmarkOffsetY.value
                    },
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "Knowledge hub for the age of AI",
                    style = BrandType.body(12, FontWeight.Normal),
                    color = Brand.TextMuted,
                    modifier = Modifier.graphicsLayer {
                        alpha = taglineAlpha.value
                        translationY = taglineOffsetY.value
                    },
                )
            }
        }
    }
}
