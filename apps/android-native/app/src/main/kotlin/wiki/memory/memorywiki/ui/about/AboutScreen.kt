/*
 * AboutScreen — port of iOS AboutView. Quiet in-app About surface
 * so the user can see version + scan cross-platform channels
 * without leaving the app.
 *
 *   Hero          memory.wiki wordmark display 26 + body 14 muted
 *                 tagline + 2 mono Tag pills (ANDROID COMPANION /
 *                 v<x> (<code>))
 *   WHAT'S NEW    bulleted glass card
 *   ON THE WEB    link rows opening the web product surfaces
 *   ACROSS        cross-platform channel rows (iOS / Chrome / VS
 *   PLATFORMS     Code / Desktop / CLI / MCP)
 *   LEGAL         Terms / Privacy
 *   Credits       email + url line
 */

package wiki.memory.memorywiki.ui.about

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.navigation.NavController
import com.composables.icons.lucide.*
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

@Composable
fun AboutScreen(navController: NavController) {
    val context = LocalContext.current
    val open: (String) -> Unit = { url ->
        context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Brand.Background)
            .padding(top = 44.dp),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Lucide.ArrowLeft, null, tint = Brand.TextPrimary)
            }
            Spacer(Modifier.weight(1f))
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 6.dp, bottom = 80.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp),
        ) {
            // Hero
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "memory.wiki",
                    style = BrandType.display(30),
                    color = Brand.TextPrimary,
                )
                Text(
                    "Your knowledge hub for the AI age. Capture anywhere, paste one URL into any model.",
                    style = BrandType.body(14),
                    color = Brand.TextMuted,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Tag("ANDROID COMPANION")
                    Tag("v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
                }
            }

            SectionLabel("WHAT'S NEW")
            BulletCard(
                listOf(
                    "iOS-parity pass across every surface (Start, MDs, Bundles, Detail, Chat, Settings)",
                    "Pinning, edit/delete/visibility, Add-to-bundle, TOC, semantic search",
                    "Share sheet routes into Capture; widget Quick capture / Ask / Search / Paste",
                ),
            )

            SectionLabel("ON THE WEB")
            LinkGroup(
                rows = listOf(
                    AboutLink(Lucide.Globe, "Open Memory.Wiki", "https://memory.wiki"),
                    AboutLink(Lucide.BookOpen, "How it works", "https://memory.wiki/how"),
                    AboutLink(Lucide.Info, "About + roadmap", "https://memory.wiki/about"),
                ),
                onOpen = open,
            )

            SectionLabel("ACROSS PLATFORMS")
            LinkGroup(
                rows = listOf(
                    AboutLink(Lucide.Apple, "iOS app", "https://memory.wiki/install#ios"),
                    AboutLink(Lucide.Chrome, "Chrome extension", "https://memory.wiki/install#chrome"),
                    AboutLink(Lucide.Code, "VS Code extension", "https://memory.wiki/install#vscode"),
                    AboutLink(Lucide.Monitor, "Desktop app", "https://memory.wiki/install#desktop"),
                    AboutLink(Lucide.Terminal, "CLI + MCP server", "https://memory.wiki/install#cli"),
                ),
                onOpen = open,
            )

            SectionLabel("LEGAL")
            LinkGroup(
                rows = listOf(
                    AboutLink(Lucide.FileText, "Terms", "https://memory.wiki/terms"),
                    AboutLink(Lucide.Shield, "Privacy", "https://memory.wiki/privacy"),
                ),
                onOpen = open,
            )

            // Credits
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(top = 6.dp),
            ) {
                Text(
                    "Built by Raymind AI",
                    style = BrandType.body(12),
                    color = Brand.TextMuted,
                )
                Text(
                    "hi@raymind.ai",
                    style = BrandType.mono(11),
                    color = Brand.TextFaint,
                )
            }
        }
    }
}

@Composable
private fun Tag(text: String) {
    Text(
        text,
        style = BrandType.mono(9, FontWeight.Medium),
        color = Brand.TextMuted,
        modifier = Modifier
            .clip(CircleShape)
            .border(0.5.dp, Brand.BorderDim, CircleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = BrandType.mono(9, FontWeight.Medium),
        color = Brand.TextFaint,
        modifier = Modifier.padding(start = 4.dp),
    )
}

@Composable
private fun BulletCard(items: List<String>) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items.forEach { item ->
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    Modifier
                        .padding(top = 7.dp)
                        .size(4.dp)
                        .clip(CircleShape)
                        .background(Brand.TextFaint),
                )
                Text(
                    item,
                    style = BrandType.body(13),
                    color = Brand.TextSecondary,
                )
            }
        }
    }
}

private data class AboutLink(
    val icon: ImageVector,
    val label: String,
    val url: String,
)

@Composable
private fun LinkGroup(rows: List<AboutLink>, onOpen: (String) -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(14.dp)),
    ) {
        rows.forEachIndexed { i, row ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { onOpen(row.url) }
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                    Icon(row.icon, null, tint = Brand.TextMuted, modifier = Modifier.size(13.dp))
                }
                Text(
                    row.label,
                    style = BrandType.body(14),
                    color = Brand.TextPrimary,
                    modifier = Modifier.weight(1f),
                )
                Icon(Lucide.ArrowUpRight, null, tint = Brand.TextFaint, modifier = Modifier.size(11.dp))
            }
            if (i < rows.size - 1) {
                Box(Modifier.fillMaxWidth().height(0.5.dp).background(Brand.BorderDim))
            }
        }
    }
}
