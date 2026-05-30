/*
 * ProviderLogo — renders Google / GitHub / Apple brand marks via
 * the canonical SVG for each. Apple Inc.'s logo (NOT a fruit
 * glyph) is required by App Store / Play Store HIG when offering
 * "Sign in with Apple". iOS uses SF Symbol "applelogo"; Android
 * has no system equivalent, so we ship the same outline-fidelity
 * vector that the web `lucide-react` set + Apple HIG examples
 * use.
 */

package wiki.memory.memorywiki.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.svg.SvgDecoder
import wiki.memory.memorywiki.R

enum class AuthProvider { Google, GitHub, Apple, Email }

@Composable
fun ProviderLogo(provider: AuthProvider, sizeDp: Int = 18) {
    val ctx = LocalContext.current
    val resId = when (provider) {
        AuthProvider.Google -> R.raw.provider_google
        AuthProvider.GitHub -> R.raw.provider_github
        AuthProvider.Apple  -> R.raw.provider_apple
        AuthProvider.Email  -> return  // call site renders a Lucide.Mail glyph
    }
    AsyncImage(
        model = ImageRequest.Builder(ctx)
            .data(resId)
            .decoderFactory(SvgDecoder.Factory())
            .build(),
        contentDescription = null,
        modifier = Modifier.size(sizeDp.dp),
    )
}
