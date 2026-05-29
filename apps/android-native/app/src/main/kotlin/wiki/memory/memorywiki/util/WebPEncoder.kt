/*
 * WebPEncoder — ladder-based bitmap → WebP byte encoder. Mirrors
 * iOS WebPEncoder: target ≤ 500KB soft cap, ≤ 3.5MB hard cap. Server
 * (/api/upload via sharp) re-encodes anyway; client ladder exists
 * to keep us under Vercel's 4.5MB function body cap.
 */

package wiki.memory.memorywiki.util

import android.graphics.Bitmap
import java.io.ByteArrayOutputStream
import kotlin.math.roundToInt

data class UploadPayload(val bytes: ByteArray, val contentType: String, val fileExtension: String)

object WebPEncoder {
    private const val SOFT = 500_000
    private const val CEILING = 3_500_000

    private val attempts = listOf(
        1280 to 50, 1024 to 45, 900 to 40, 800 to 35, 640 to 30,
    )

    fun encode(bitmap: Bitmap): UploadPayload? {
        var last: ByteArray? = null
        for ((maxEdge, quality) in attempts) {
            val scaled = scale(bitmap, maxEdge)
            val out = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.WEBP_LOSSY, quality, out)
            val bytes = out.toByteArray()
            last = bytes
            if (bytes.size <= SOFT) return UploadPayload(bytes, "image/webp", "webp")
        }
        return last?.takeIf { it.size <= CEILING }
            ?.let { UploadPayload(it, "image/webp", "webp") }
    }

    private fun scale(src: Bitmap, maxEdge: Int): Bitmap {
        val longest = maxOf(src.width, src.height)
        if (longest <= maxEdge) return src
        val ratio = maxEdge.toFloat() / longest
        val w = (src.width * ratio).roundToInt()
        val h = (src.height * ratio).roundToInt()
        return Bitmap.createScaledBitmap(src, w, h, true)
    }
}
