/*
 * BrandBlob — renders the canonical memory.wiki blob glyph
 * (mwblob_morph_dark.svg) via Coil-SVG. iOS uses an animated
 * morph; we render the static composite here. The morph
 * animation will come in v0.2 (it adds ~140KB of Lottie/raw
 * frame data we don't want in v0.1).
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

@Composable
fun BrandBlob(
    sizeDp: Int = 168,
    modifier: Modifier = Modifier,
) {
    val ctx = LocalContext.current
    AsyncImage(
        model = ImageRequest.Builder(ctx)
            .data(R.raw.brand_blob_static)
            .decoderFactory(SvgDecoder.Factory())
            .build(),
        contentDescription = null,
        modifier = modifier.size(sizeDp.dp),
    )
}
