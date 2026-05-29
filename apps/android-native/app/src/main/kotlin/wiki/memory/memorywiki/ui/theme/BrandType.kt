/*
 * BrandType — typography mirror of iOS BrandTheme.
 *
 *  - Cal Sans (display) for app-name + H1
 *  - Noto Sans (body) for prose, list rows, form labels
 *  - JetBrains Mono (mono) for URL display, faint uppercase captions
 *
 * Korean weight parity note: Cal Sans only covers Latin glyphs.
 * Compose falls through to the system Korean font automatically, but
 * the default weight is regular. Wrap CJK runs in a separate Text
 * with `weight = SemiBold` when they need to read as one unit with
 * adjacent Cal Sans text (same problem as iOS).
 */

package wiki.memory.memorywiki.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import wiki.memory.memorywiki.R

object BrandType {
    val Display = FontFamily(
        Font(R.font.cal_sans, FontWeight.SemiBold),
    )
    val Body = FontFamily(
        Font(R.font.noto_sans_regular, FontWeight.Normal),
        Font(R.font.noto_sans_medium, FontWeight.Medium),
        Font(R.font.noto_sans_semibold, FontWeight.SemiBold),
    )
    val Mono = FontFamily(
        Font(R.font.jetbrains_mono_regular, FontWeight.Normal),
        Font(R.font.jetbrains_mono_medium, FontWeight.Medium),
    )

    // Custom call-style helpers (mirror iOS Brand.display / body / mono)
    fun display(size: Int) = TextStyle(
        fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = size.sp,
    )

    fun body(size: Int = 15, weight: FontWeight = FontWeight.Normal) = TextStyle(
        fontFamily = Body, fontWeight = weight, fontSize = size.sp,
    )

    fun mono(size: Int = 11, weight: FontWeight = FontWeight.Normal) = TextStyle(
        fontFamily = Mono, fontWeight = weight, fontSize = size.sp, letterSpacing = 0.6.sp,
    )

    // Material 3 typography slot map — Compose uses these tokens for
    // out-of-the-box Material components (BottomAppBar labels,
    // TextField placeholder, etc.). We map them to Noto Sans so
    // accidental Material usage doesn't introduce Roboto.
    val Typography = Typography(
        displayLarge = body(36, FontWeight.SemiBold).copy(fontFamily = Display),
        displayMedium = body(28, FontWeight.SemiBold).copy(fontFamily = Display),
        displaySmall = body(22, FontWeight.SemiBold).copy(fontFamily = Display),
        headlineLarge = body(22, FontWeight.SemiBold),
        headlineMedium = body(18, FontWeight.SemiBold),
        headlineSmall = body(16, FontWeight.SemiBold),
        titleLarge = body(17, FontWeight.SemiBold),
        titleMedium = body(15, FontWeight.Medium),
        titleSmall = body(13, FontWeight.Medium),
        bodyLarge = body(15, FontWeight.Normal),
        bodyMedium = body(13, FontWeight.Normal),
        bodySmall = body(11, FontWeight.Normal),
        labelLarge = body(14, FontWeight.Medium),
        labelMedium = body(12, FontWeight.Medium),
        labelSmall = mono(10, FontWeight.Medium),
    )
}
