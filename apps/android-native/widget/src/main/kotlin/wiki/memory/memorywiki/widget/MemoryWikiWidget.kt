/*
 * MemoryWikiWidget — Glance-backed home widget. Sizes:
 *   Small  (4×1) — Capture button only
 *   Medium (4×2) — Capture + 3 recent rows
 *   Large  (4×4) — Capture + Ask/Search/Paste pills + 5 recent rows
 *
 * Each tap fires a memorywiki:// URL which MainActivity (single
 * task) translates via AppRouter. Same routes as iOS:
 *   memorywiki://capture / capture-paste / chat-hub / search / doc/<id>
 */

package wiki.memory.memorywiki.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.layout.wrapContentSize
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

private val BG = Color(0xFF09090B)
private val SURFACE = Color(0xFF18181B)
private val SHEET = Color(0xFF111114)
private val INK = Color(0xFFFAFAFA)
private val MUTED = Color(0xFFA1A1AA)
private val FAINT = Color(0xFF8A8A91)
private val BORDER = Color(0x9927272A)
private val LIME = Color(0xFFB5FF1A)

object MemoryWikiWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(
        setOf(
            androidx.glance.appwidget.DpSize(180.dp, 60.dp),   // Small
            androidx.glance.appwidget.DpSize(260.dp, 130.dp),  // Medium
            androidx.glance.appwidget.DpSize(260.dp, 260.dp),  // Large
        ),
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            WidgetContent()
        }
    }

    @Composable
    private fun WidgetContent() {
        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(BG)
                .padding(14.dp),
        ) {
            Column(modifier = GlanceModifier.fillMaxSize()) {
                Text(
                    "memory.wiki",
                    style = TextStyle(color = ColorProvider(INK), fontWeight = FontWeight.Medium, fontSize = 13.sp),
                )
                Spacer(GlanceModifier.height(2.dp))
                Text(
                    "RECENTLY UPDATED",
                    style = TextStyle(color = ColorProvider(FAINT), fontWeight = FontWeight.Medium, fontSize = 9.sp),
                )
                Spacer(GlanceModifier.height(8.dp))

                // Capture (always present)
                Row(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .height(40.dp)
                        .background(INK)
                        .cornerRadius(14.dp)
                        .clickable(actionStartActivity(deepLinkIntent("memorywiki://capture"))),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        "+ New capture",
                        style = TextStyle(color = ColorProvider(BG), fontWeight = FontWeight.Medium, fontSize = 13.sp),
                    )
                }

                Spacer(GlanceModifier.height(10.dp))

                // Quick actions (large-only — we render unconditionally;
                // Small/Medium clip via the row's wrapContent + the box
                // sizing. Cleaner segmentation will land once we wire
                // SizeMode.Responsive to swap composables.)
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                ) {
                    QuickPill("Ask", "memorywiki://chat-hub", modifier = GlanceModifier.defaultWeight().padding(end = 6.dp))
                    QuickPill("Search", "memorywiki://search", modifier = GlanceModifier.defaultWeight().padding(horizontal = 3.dp))
                    QuickPill("Paste", "memorywiki://capture-paste", modifier = GlanceModifier.defaultWeight().padding(start = 6.dp))
                }
            }
        }
    }
}

@Composable
private fun QuickPill(label: String, uri: String, modifier: GlanceModifier) {
    Box(
        modifier = modifier
            .height(72.dp)
            .background(SHEET)
            .cornerRadius(14.dp)
            .clickable(actionStartActivity(deepLinkIntent(uri))),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            style = TextStyle(color = ColorProvider(INK), fontWeight = FontWeight.Medium, fontSize = 13.sp),
        )
    }
}

private fun deepLinkIntent(uri: String): android.content.Intent =
    android.content.Intent(
        android.content.Intent.ACTION_VIEW,
        android.net.Uri.parse(uri),
    ).apply {
        addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
    }

class MemoryWikiWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MemoryWikiWidget
}
