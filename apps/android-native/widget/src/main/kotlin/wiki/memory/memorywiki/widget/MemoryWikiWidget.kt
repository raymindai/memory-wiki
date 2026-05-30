/*
 * MemoryWikiWidget — Glance-backed home widget. Sizes:
 *   Small  (4×1) — Capture button only
 *   Medium (4×2) — Capture + 3 recent rows (TBD)
 *   Large  (4×4) — Capture + Ask/Search/Paste pills + recent rows
 *
 * Each tap fires a memorywiki:// URL which MainActivity (single
 * task) translates via AppRouter. Same routes as iOS:
 *   memorywiki://capture / capture-paste / chat-hub / search / doc/<id>
 */

package wiki.memory.memorywiki.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
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
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle

private val BG = Color(0xFF09090B)
private val SHEET = Color(0xFF111114)
private val INK = Color(0xFFFAFAFA)
private val FAINT = Color(0xFF8A8A91)

object MemoryWikiWidget : GlanceAppWidget() {
    // Glance uses androidx.compose.ui.unit.DpSize for responsive
    // sizing breakpoints. Larger sizes inherit from smaller ones
    // unless the layout swaps content based on LocalSize.
    override val sizeMode = SizeMode.Responsive(
        setOf(
            DpSize(180.dp, 60.dp),   // Small
            DpSize(260.dp, 130.dp),  // Medium
            DpSize(260.dp, 260.dp),  // Large
        ),
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { WidgetContent() }
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

                // Quick action pills (Ask / Search / Paste). Render
                // unconditionally; SizeMode breakpoints will clip the
                // pill row on Small/Medium sizes via the wrapping Box.
                Row(modifier = GlanceModifier.fillMaxWidth()) {
                    QuickPill("Ask",    "memorywiki://chat-hub",      modifier = GlanceModifier.defaultWeight().padding(end = 6.dp))
                    QuickPill("Search", "memorywiki://search",        modifier = GlanceModifier.defaultWeight().padding(horizontal = 3.dp))
                    QuickPill("Paste",  "memorywiki://capture-paste", modifier = GlanceModifier.defaultWeight().padding(start = 6.dp))
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

private fun deepLinkIntent(uri: String): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(uri))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

class MemoryWikiWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MemoryWikiWidget
}
