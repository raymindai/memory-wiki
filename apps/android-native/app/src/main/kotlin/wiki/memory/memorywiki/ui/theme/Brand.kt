/*
 * Brand — single source of truth for colors, spacing, and shape
 * tokens on Android. Mirrors apps/ios-native/MemoryWiki/BrandTheme.swift
 * so the two surfaces read as one product.
 *
 * Rules of thumb (from v8 color-balance feedback):
 *   - Body, chips, buttons stay INK (textPrimary on background or
 *     surface). Lime accent only in small dots, badges, micro-icons.
 *   - No Material You dynamic color. App is dark-only.
 *   - microLime is reserved for public-status badges and tiny dots —
 *     it is NOT the brand key color. The brand key color is the
 *     user's `profiles.accent_color` choice; the app provides the
 *     palette but the visitor (and the doc owner) decides which one
 *     paints chrome.
 */

package wiki.memory.memorywiki.ui.theme

import androidx.compose.foundation.shape.CornerSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object Brand {
    // ─── Surface tokens (mirror globals.css [data-theme="dark"]) ───

    /** Page background — zinc-950. */
    val Background = Color(0xFF09090B)

    /** Even darker — used by the bundle viewer's split-pane canvas
     *  on web. Reserved here for top-of-fold chrome that needs to
     *  read as one layer back from the body. */
    val Canvas = Color(0xFF070708)

    /** Card / row fill — zinc-900. */
    val Surface = Color(0xFF18181B)

    /** Sheet container — one tone above Background. Settled on this
     *  shade after `Background` read too flat and `.regularMaterial`
     *  bled the parent through. */
    val SheetBg = Color(0xFF111114)

    /** Hairline borders + the quiet ring around inactive controls. */
    val Border = Color(0xFF2D2D31)
    val BorderDim = Color(0x9927272A) // ~60% alpha over the row fill

    /** Toggle hover / pressed background. */
    val ToggleBg = Color(0xCC18181B)

    // ─── Text tokens ───
    val TextPrimary = Color(0xFFFAFAFA)
    val TextSecondary = Color(0xFFC4C4C9)
    val TextMuted = Color(0xFFA1A1AA)
    val TextFaint = Color(0xFF8A8A91)

    // ─── Default accent palette ───

    /** Lime — the v8 default accent. Use ONLY for small dots, micro-
     *  badges, status indicators. Body text, buttons, and chips stay
     *  ink per the v8 color-balance rule. */
    val Accent = Color(0xFFB5FF1A)
    val AccentDim = Color(0x26B5FF1A) // ~15% alpha

    // ─── Micro-color tokens (mirrors --micro-*) ───
    val MicroInfo = Color(0xFF60A5FA)   // blue
    val MicroWarn = Color(0xFFFBBF24)   // amber
    val MicroRed = Color(0xFFEF4444)    // red
    val MicroLime = Color(0xFFB5FF1A)   // lime — public-status badges
    val MicroPurple = Color(0xFFA78BFA) // purple — bundle deploy

    // ─── Shape ───
    val Shapes = Shapes(
        extraSmall = RoundedCornerShape(6.dp),
        small = RoundedCornerShape(10.dp),
        medium = RoundedCornerShape(14.dp),
        large = RoundedCornerShape(20.dp),
        extraLarge = RoundedCornerShape(28.dp),
    )

    val SheetCorner: CornerSize = CornerSize(28.dp)
}

/** Optional accent palette (matches the web SettingsEmbed picker). */
enum class AccentColorChoice(val key: String, val dark: Color, val light: Color) {
    Lime("lime", Color(0xFFB5FF1A), Color(0xFF5BC700)),
    Orange("orange", Color(0xFFFB923C), Color(0xFFEA580C)),
    Blue("blue", Color(0xFF60A5FA), Color(0xFF2563EB)),
    Purple("purple", Color(0xFFA78BFA), Color(0xFF7C3AED)),
    Pink("pink", Color(0xFFF472B6), Color(0xFFDB2777)),
    Gray("gray", Color(0xFFA1A1AA), Color(0xFF52525B));

    companion object {
        fun from(key: String?): AccentColorChoice =
            entries.firstOrNull { it.key.equals(key, ignoreCase = true) } ?: Lime
    }
}
