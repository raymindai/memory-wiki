/*
 * HelpScreen — port of iOS HelpView. In-app reference for every
 * Android-only flow the user might miss otherwise: share intent,
 * widget, app shortcuts, deep links, markdown syntax, FAQ.
 *
 * Pattern: expandable sections (Compose AnimatedVisibility on a
 * boolean per section). Each section opens to a short "what / how
 * / why" triple with the matching Lucide glyph.
 *
 * Reachable from Settings LEARN → How it works.
 */

package wiki.memory.memorywiki.ui.help

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.composables.icons.lucide.*
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

private data class HelpItem(
    val icon: ImageVector,
    val title: String,
    val body: String,
)

private data class HelpSection(
    val title: String,
    val items: List<HelpItem>,
)

private val sections: List<HelpSection> = listOf(
    HelpSection(
        title = "Capture",
        items = listOf(
            HelpItem(
                icon = Lucide.Plus,
                title = "Six ways to capture",
                body = "Capture tab gives you Write / URL / Photo / OCR / Voice / Files. Each one ends in a draft you can title + edit before publishing.",
            ),
            HelpItem(
                icon = Lucide.Clipboard,
                title = "Clipboard sniffer",
                body = "Copy a URL anywhere on Android, then open the Capture tab and tap the Paste shortcut (or use the long-press App Shortcut). Memory.Wiki drops the URL into the body.",
            ),
            HelpItem(
                icon = Lucide.Zap,
                title = "App Shortcuts",
                body = "Long-press the memory.wiki launcher icon to jump straight to Capture, Ask hub, Search, or Paste — the four most-used flows.",
            ),
        ),
    ),
    HelpSection(
        title = "Share from any app",
        items = listOf(
            HelpItem(
                icon = Lucide.Share,
                title = "Save from Chrome / any app",
                body = "Tap the system Share button → pick memory.wiki from the share sheet. Shared text + URL land in the Capture screen as a pre-filled draft.",
            ),
            HelpItem(
                icon = Lucide.Image,
                title = "Share an image",
                body = "Share any image (from Photos, screenshots, web) to memory.wiki. The image is encoded to WebP, uploaded, and saved as a one-line memory referencing the upload URL.",
            ),
            HelpItem(
                icon = Lucide.Globe,
                title = "What gets saved",
                body = "Whatever the sending app passes: URL, title, selected text. The original page isn't re-uploaded — we keep the link.",
            ),
        ),
    ),
    HelpSection(
        title = "Home-screen widget",
        items = listOf(
            HelpItem(
                icon = Lucide.LayoutGrid,
                title = "Add the widget",
                body = "Long-press an empty home-screen spot → Widgets → search 'memory.wiki' → drag it out. Four quick actions: Capture, Ask, Search, Paste.",
            ),
            HelpItem(
                icon = Lucide.RefreshCw,
                title = "When it refreshes",
                body = "Every time the app comes back to the foreground, and roughly every 30 minutes via Glance's background tick.",
            ),
        ),
    ),
    HelpSection(
        title = "Deep links",
        items = listOf(
            HelpItem(
                icon = Lucide.Link,
                title = "URL scheme",
                body = "memorywiki://doc/<id> opens a doc · memorywiki://bundle/<id> opens a bundle · memorywiki://capture opens the Capture tab · memorywiki://chat-hub opens the hub chat sheet. Useful for Tasker / Shortcuts apps.",
            ),
            HelpItem(
                icon = Lucide.ExternalLink,
                title = "App Links",
                body = "Tapping any memory.wiki/<id> URL in Chrome opens the doc reader inside this app — auto-verified via /.well-known/assetlinks.json once Android first launches it.",
            ),
        ),
    ),
    HelpSection(
        title = "Markdown shortcuts",
        items = listOf(
            HelpItem(
                icon = Lucide.Hash,
                title = "Headings",
                body = "# Heading 1 · ## Heading 2 · ### Heading 3. The pill toolbar above the keyboard in Write mode has buttons for the common ones.",
            ),
            HelpItem(
                icon = Lucide.Bold,
                title = "Inline format",
                body = "**bold** · *italic* · `code` · [link text](https://…). Rendered in the reader; preserved as-is in the saved doc.",
            ),
            HelpItem(
                icon = Lucide.List,
                title = "Lists, quotes, rules",
                body = "- bullet · 1. numbered · - [ ] task · > blockquote · --- thematic rule · ``` fenced code block (optional language label after the backticks).",
            ),
        ),
    ),
    HelpSection(
        title = "Frequently asked",
        items = listOf(
            HelpItem(
                icon = Lucide.User,
                title = "What's my @username?",
                body = "Open Settings → 'Open hub'. The first time you visit your hub on the web, you claim your username. Settings then shows your canonical URL — the one you paste into AI.",
            ),
            HelpItem(
                icon = Lucide.Shield,
                title = "Public vs private",
                body = "Docs are private by default. Open one → ellipsis → Make public to publish at memory.wiki/<short-id>. Private docs are visible only to you.",
            ),
            HelpItem(
                icon = Lucide.LogOut,
                title = "Why sign out then back in?",
                body = "If sync breaks or the widget shows stale data, sign out from Settings and sign back in. Local data is cleared and rebuilt from the server.",
            ),
            HelpItem(
                icon = Lucide.CircleHelp,
                title = "Found a bug?",
                body = "Settings → Send feedback opens an email pre-filled with version + device info. We read every one.",
            ),
        ),
    ),
)

@Composable
fun HelpScreen(navController: NavController) {
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
            Text(
                "Help",
                style = BrandType.body(15, FontWeight.Medium),
                color = Brand.TextMuted,
                modifier = Modifier.padding(end = 16.dp),
            )
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp)
                .padding(top = 6.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp),
        ) {
            Intro()
            sections.forEach { section ->
                HelpSectionCard(section)
            }
            Footer()
        }
    }
}

@Composable
private fun Intro() {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            "QUICK START",
            style = BrandType.mono(9, FontWeight.Medium),
            color = Brand.TextFaint,
        )
        Text(
            "Capture anywhere → AI organises → paste one URL.",
            style = BrandType.display(22),
            color = Brand.TextPrimary,
        )
        Text(
            "This companion app focuses on three things: fast capture, instant access to anything you've ever saved, and a one-tap URL you can paste into any AI.",
            style = BrandType.body(13),
            color = Brand.TextMuted,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
private fun HelpSectionCard(section: HelpSection) {
    var expanded by remember { mutableStateOf(false) }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.SheetBg.copy(alpha = 0.75f))
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp)),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(horizontal = 14.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                section.title,
                style = BrandType.body(15, FontWeight.Medium),
                color = Brand.TextPrimary,
                modifier = Modifier.weight(1f),
            )
            Icon(
                if (expanded) Lucide.ChevronUp else Lucide.ChevronDown,
                null,
                tint = Brand.TextMuted,
                modifier = Modifier.size(16.dp),
            )
        }
        AnimatedVisibility(
            visible = expanded,
            enter = fadeIn(tween(180)) + expandVertically(tween(220)),
            exit = fadeOut(tween(120)) + shrinkVertically(tween(180)),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp)
                    .padding(top = 4.dp, bottom = 14.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                section.items.forEach { item ->
                    HelpItemRow(item)
                }
            }
        }
    }
}

@Composable
private fun HelpItemRow(item: HelpItem) {
    Row(
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            item.icon,
            null,
            tint = Brand.TextFaint,
            modifier = Modifier
                .padding(top = 2.dp)
                .size(13.dp),
        )
        Column(
            Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                item.title,
                style = BrandType.body(13, FontWeight.Medium),
                color = Brand.TextPrimary,
            )
            Text(
                item.body,
                style = BrandType.body(12),
                color = Brand.TextMuted,
            )
        }
    }
}

@Composable
private fun Footer() {
    Column(
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.padding(top = 8.dp),
    ) {
        Text(
            "Still stuck?",
            style = BrandType.body(13, FontWeight.Medium),
            color = Brand.TextPrimary,
        )
        Text(
            "Email hi@raymind.ai or open Memory.Wiki to read the manifesto.",
            style = BrandType.body(12),
            color = Brand.TextMuted,
        )
    }
}
