/*
 * MemoryWikiMiniWidget — single-cell (1x1) capture-only variant of
 * the main widget. Drag this one out when you want the smallest
 * possible always-visible Capture button without giving up a
 * whole row of grid space.
 *
 * Same deep link as the launcher shortcut + Quick Settings tile +
 * primary button of the larger widget — memorywiki://capture.
 * Glance composables stay tiny so the widget renders cleanly at
 * 1-cell sizes where the larger Glance widget would clip.
 */

package wiki.memory.memorywiki.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.fillMaxSize
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle

private val MINI_BG = Color(0xFFFAFAFA)
private val MINI_INK = Color(0xFF09090B)

object MemoryWikiMiniWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { MiniContent() }
    }

    @Composable
    private fun MiniContent() {
        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(MINI_BG)
                .cornerRadius(18.dp)
                .clickable(
                    actionStartActivity(
                        Intent(Intent.ACTION_VIEW, Uri.parse("memorywiki://capture"))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "+",
                style = TextStyle(
                    color = ColorProvider(day = MINI_INK, night = MINI_INK),
                    fontWeight = FontWeight.Bold,
                    fontSize = 28.sp,
                ),
            )
        }
    }
}

class MemoryWikiMiniWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MemoryWikiMiniWidget
}
