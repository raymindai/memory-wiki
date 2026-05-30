/*
 * ProviderLogo — renders Google / GitHub / Apple brand marks.
 * The SVGs come from apps/ios-native/.../Providers/ — same files
 * the iOS app uses, so the marks read identically across surfaces.
 * Apple's apple-logo glyph isn't shipped as a separate asset on
 * either side; the iOS app uses SF Symbols "applelogo" and we use
 * the unicode  variant here (Apple HIG permits the glyph for
 * "Sign in with Apple" CTAs).
 */

package wiki.memory.memorywiki.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.svg.SvgDecoder
import com.composables.icons.lucide.Apple
import com.composables.icons.lucide.Lucide
import wiki.memory.memorywiki.R
import wiki.memory.memorywiki.ui.theme.Brand

enum class AuthProvider { Google, GitHub, Apple, Email }

@Composable
fun ProviderLogo(provider: AuthProvider, sizeDp: Int = 18) {
    val ctx = LocalContext.current
    when (provider) {
        AuthProvider.Google -> AsyncImage(
            model = ImageRequest.Builder(ctx)
                .data(R.raw.provider_google)
                .decoderFactory(SvgDecoder.Factory())
                .build(),
            contentDescription = null,
            modifier = Modifier.size(sizeDp.dp),
        )
        AuthProvider.GitHub -> AsyncImage(
            model = ImageRequest.Builder(ctx)
                .data(R.raw.provider_github)
                .decoderFactory(SvgDecoder.Factory())
                .build(),
            contentDescription = null,
            modifier = Modifier.size(sizeDp.dp),
        )
        AuthProvider.Apple -> Box(Modifier.size(sizeDp.dp), contentAlignment = Alignment.Center) {
            // Lucide ships an Apple mark (it's MIT, same one the web
            // app uses via lucide-react).
            Icon(Lucide.Apple, null, tint = Brand.TextPrimary, modifier = Modifier.size(sizeDp.dp))
        }
        AuthProvider.Email -> Box(Modifier.size(sizeDp.dp)) {
            // Renders via a Lucide icon at the call site.
        }
    }
}
