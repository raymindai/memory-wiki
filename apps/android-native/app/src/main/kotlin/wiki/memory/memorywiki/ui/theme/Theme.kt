/*
 * MemoryWikiTheme — single theme provider for the app.
 *
 *  - Dark-only. We DO NOT honour `isSystemInDarkTheme()`; the
 *    product is dark by design (a light-mode pass will arrive in a
 *    later release, separate from system theme tracking).
 *  - Material 3 ColorScheme is built from Brand tokens so accidental
 *    Material component usage stays on-brand.
 *  - Owner accent override (CompositionLocal below) lets a shared-
 *    doc viewer paint chrome in the doc owner's accent without
 *    mutating the visitor's saved preference.
 */

package wiki.memory.memorywiki.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.core.view.WindowCompat

/** The visitor's own saved accent (set from profile / localStorage equivalent). */
val LocalUserAccent = staticCompositionLocalOf<AccentColorChoice> { AccentColorChoice.Lime }

/** Owner-of-active-doc accent override. Null means "use LocalUserAccent." */
val LocalActiveOwnerAccent = staticCompositionLocalOf<AccentColorChoice?> { null }

/** Effective accent — owner override wins when present, else visitor's own. */
val LocalEffectiveAccent = staticCompositionLocalOf<AccentColorChoice> { AccentColorChoice.Lime }

@Composable
fun MemoryWikiTheme(
    userAccent: AccentColorChoice = AccentColorChoice.Lime,
    ownerAccentOverride: AccentColorChoice? = null,
    content: @Composable () -> Unit,
) {
    val effective = ownerAccentOverride ?: userAccent
    val accentColor = effective.dark

    val colorScheme = darkColorScheme(
        primary = Brand.TextPrimary,
        onPrimary = Brand.Background,
        primaryContainer = Brand.Surface,
        onPrimaryContainer = Brand.TextPrimary,
        secondary = accentColor,
        onSecondary = Brand.Background,
        secondaryContainer = accentColor.copy(alpha = 0.12f),
        onSecondaryContainer = accentColor,
        tertiary = Brand.MicroInfo,
        background = Brand.Background,
        onBackground = Brand.TextPrimary,
        surface = Brand.Surface,
        onSurface = Brand.TextPrimary,
        surfaceVariant = Brand.SheetBg,
        onSurfaceVariant = Brand.TextSecondary,
        surfaceContainer = Brand.SheetBg,
        surfaceContainerHigh = Brand.Surface,
        outline = Brand.Border,
        outlineVariant = Brand.BorderDim,
        error = Brand.MicroRed,
        onError = Brand.Background,
    )

    val context = LocalContext.current
    SideEffect {
        (context as? Activity)?.window?.let { win ->
            win.statusBarColor = Brand.Background.toArgb()
            win.navigationBarColor = Brand.Background.toArgb()
            val controller = WindowCompat.getInsetsController(win, win.decorView)
            controller.isAppearanceLightStatusBars = false
            controller.isAppearanceLightNavigationBars = false
        }
    }

    CompositionLocalProvider(
        LocalUserAccent provides userAccent,
        LocalActiveOwnerAccent provides ownerAccentOverride,
        LocalEffectiveAccent provides effective,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = BrandType.Typography,
            shapes = Brand.Shapes,
            content = content,
        )
    }
}
