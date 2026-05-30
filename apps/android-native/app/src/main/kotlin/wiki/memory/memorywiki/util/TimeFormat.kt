/*
 * TimeFormat — shared compact "time since X" formatter. Mirrors
 * iOS AppBundle.compactTime / Document.compactTime so the same
 * thumbnail string ("3m", "2h", "Tue", "Apr 12") appears in every
 * row on every surface.
 */

package wiki.memory.memorywiki.util

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val MONTH_DAY: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d")
private val WEEKDAY: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE")

/** "now", "12m", "3h", "Tue", "Apr 12". Empty string on null/garbage. */
fun compactTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val instant = runCatching { Instant.parse(iso) }.getOrElse { return "" }
    val diff = System.currentTimeMillis() - instant.toEpochMilli()
    val zoned = instant.atZone(ZoneId.systemDefault())
    return when {
        diff < 60_000L -> "now"
        diff < 3_600_000L -> "${diff / 60_000L}m"
        diff < 86_400_000L -> "${diff / 3_600_000L}h"
        diff < 7L * 86_400_000L -> zoned.format(WEEKDAY)
        else -> zoned.format(MONTH_DAY)
    }
}
