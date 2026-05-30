/*
 * StartScreen — port of iOS StartView.swift.
 *
 *   Hero            display 28 greeting (time-of-day variants ×
 *                   day-of-year rotation) + AI URL strip (mono
 *                   URL + Copy-for-AI button with sparkles → check
 *                   1.6s swap) + Ask-your-hub CTA (bubble +
 *                   chevron, microInfo border)
 *   Pulse row       hairline-bordered editorial 3-column strip
 *                   (display 30 numeral + mono 9 label) — NOT
 *                   card tiles
 *   Quick actions   3 tiles — New capture (ink), Search (info-
 *                   blue), Open hub (warn-amber)
 *   Recent          RECENT label + See all → MDs tab
 *   Starred         star.fill in warn + STARRED label + items
 *   Featured bundle glass card with BundleLayersIcon + meta +
 *                   inner URL pill (sparkles trailing)
 *   Stagger         0.08s delay per block on appear + re-trigger
 */

package wiki.memory.memorywiki.ui.start

import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.composables.icons.lucide.ArrowRight
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.Compass
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.MessageCircle
import com.composables.icons.lucide.Plus
import com.composables.icons.lucide.Search
import com.composables.icons.lucide.Sparkles
import com.composables.icons.lucide.Star
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.Calendar
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.AppRouter
import wiki.memory.memorywiki.AppTab
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.RouterEvent
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.BundleSummary
import wiki.memory.memorywiki.data.model.DocSummary
import wiki.memory.memorywiki.ui.components.BundleLayersIcon
import wiki.memory.memorywiki.ui.components.DocStatusIcon
import wiki.memory.memorywiki.ui.components.SkeletonList
import wiki.memory.memorywiki.ui.components.SkeletonStatStrip
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import wiki.memory.memorywiki.util.compactTime

// ───────────────────────── ViewModel ─────────────────────────

@HiltViewModel
class StartViewModel @Inject constructor(
    val auth: AuthManager,
    val api: ApiClient,
    val router: AppRouter,
) : ViewModel() {
    private val _documents = MutableStateFlow<List<DocSummary>>(emptyList())
    val documents: StateFlow<List<DocSummary>> = _documents.asStateFlow()
    private val _bundles = MutableStateFlow<List<BundleSummary>>(emptyList())
    val bundles: StateFlow<List<BundleSummary>> = _bundles.asStateFlow()
    private val _starredDocs = MutableStateFlow<List<String>>(emptyList())
    val starredDocs: StateFlow<List<String>> = _starredDocs.asStateFlow()
    private val _starredBundles = MutableStateFlow<List<String>>(emptyList())
    val starredBundles: StateFlow<List<String>> = _starredBundles.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init { refresh() }

    fun openSearch() = viewModelScope.launch {
        router.selectTab(AppTab.Markdowns)
        router.emit(RouterEvent.OpenSearch)
    }

    fun openCapture() { router.selectTab(AppTab.Capture) }

    fun refresh() = viewModelScope.launch {
        _loading.value = true
        runCatching { api.pins() }.onSuccess { p ->
            _starredDocs.value = p.pins.filter { it.kind == "document" }.map { it.id }
            _starredBundles.value = p.pins.filter { it.kind == "bundle" }.map { it.id }
        }
        runCatching { api.userDocuments() }.onSuccess { resp ->
            _documents.value = resp.documents
        }
        runCatching { api.userBundles() }.onSuccess { resp ->
            _bundles.value = resp.bundles
        }
        _loading.value = false
    }
}

private fun parseInstantMillis(iso: String?): Long {
    if (iso.isNullOrBlank()) return 0
    return runCatching { java.time.Instant.parse(iso).toEpochMilli() }.getOrDefault(0)
}

// ───────────────────────── Greeting ─────────────────────────

/** Time-of-day greeting variants × day-of-year rotation (matches
 *  iOS StartView.greeting). Stable for the whole day so a single
 *  session doesn't churn; rotates daily so "different day,
 *  different mood" reads as intentional. */
private fun greetingFor(hour: Int, dayOfYear: Int, displayName: String?): String {
    val variants = when (hour) {
        in 5..11 -> listOf("Morning", "Good morning", "Fresh page", "Hey early bird")
        in 12..17 -> listOf("Hey", "Good afternoon", "Mid-day check-in", "Back at it")
        in 18..21 -> listOf("Evening", "Good evening", "Wrapping up?", "Still in the game")
        else -> listOf("Hello", "Welcome back", "Night owl mode", "Still here")
    }
    val base = variants[dayOfYear % variants.size]
    return if (!displayName.isNullOrBlank()) "$base, $displayName" else base
}

// ───────────────────────── Screen ─────────────────────────

@Composable
fun StartScreen(navController: NavController, vm: StartViewModel = hiltViewModel()) {
    val session by vm.auth.session.collectAsState()
    val documents by vm.documents.collectAsState()
    val bundles by vm.bundles.collectAsState()
    val starredDocs by vm.starredDocs.collectAsState()
    val starredBundles by vm.starredBundles.collectAsState()
    val loading by vm.loading.collectAsState()

    val displayName = session?.displayName
    val hubSlug = session?.hubSlug
    val hubUrl = hubSlug?.let { "${BuildConfig.API_BASE.removeSuffix("/")}/@$it" }

    // Greeting computed once per composition. Hour + day-of-year
    // are stable through a session — re-reading from Calendar
    // every recomposition would be cheap but pointless.
    val now = remember { Calendar.getInstance() }
    val greeting = remember(displayName) {
        greetingFor(
            hour = now.get(Calendar.HOUR_OF_DAY),
            dayOfYear = now.get(Calendar.DAY_OF_YEAR),
            displayName = displayName,
        )
    }

    val clipboard = LocalClipboardManager.current
    var aiPromptCopied by remember { mutableStateOf(false) }
    LaunchedEffect(aiPromptCopied) {
        if (aiPromptCopied) {
            delay(1600)
            aiPromptCopied = false
        }
    }

    LaunchedEffect(Unit) {
        vm.router.events.collect { evt ->
            if (evt is RouterEvent.OpenHubChat) {
                val slug = vm.auth.session.value?.hubSlug ?: return@collect
                val title = vm.auth.session.value?.displayName ?: "Your hub"
                navController.navigate("chat/hub/$slug/$title")
            }
        }
    }

    // Stagger entrance: re-trigger on every appear so revisiting
    // the tab plays the cascade again.
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        appeared = false
        delay(40)
        appeared = true
    }

    if (loading && documents.isEmpty() && bundles.isEmpty()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 18.dp)
                .padding(top = 56.dp, bottom = 140.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp),
        ) {
            Box(
                Modifier
                    .size(width = 220.dp, height = 28.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Brand.Surface),
            )
            SkeletonStatStrip()
            SkeletonList(count = 4)
        }
        return
    }

    val todayMs = remember(documents) {
        Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }
    val weekAgo = remember(documents) { System.currentTimeMillis() - 7L * 86_400_000L }
    val todayCount = documents.count { parseInstantMillis(it.updatedAt) >= todayMs }
    val weekCount = documents.count { parseInstantMillis(it.updatedAt) >= weekAgo }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp)
            .padding(top = 56.dp, bottom = 140.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        Stagger(appeared, 0) {
            Hero(
                greeting = greeting,
                hubUrl = hubUrl,
                aiPromptCopied = aiPromptCopied,
                onCopyAi = {
                    if (hubUrl != null) {
                        clipboard.setText(AnnotatedString("Use $hubUrl as my context."))
                        aiPromptCopied = true
                    }
                },
                onAskHub = {
                    val slug = hubSlug ?: return@Hero
                    val title = (displayName ?: "Your") + "'s hub"
                    navController.navigate("chat/hub/$slug/$title")
                },
            )
        }

        Stagger(appeared, 1) {
            PulseRow(today = todayCount, week = weekCount, allTime = documents.size)
        }

        Stagger(appeared, 2) {
            QuickActions(
                onCapture = { vm.openCapture() },
                onSearch = { vm.openSearch() },
                onOpenHub = { /* TODO: open hub URL in browser */ },
                hasHub = hubUrl != null,
            )
        }

        val recent = remember(documents, bundles) {
            mergeRecent(documents, bundles).take(7)
        }
        if (recent.isNotEmpty()) {
            Stagger(appeared, 3) {
                RecentSection(
                    items = recent,
                    onDoc = { navController.navigate("markdowns/doc/${it.id}") },
                    onBundle = { navController.navigate("bundles/${it.id}") },
                    onSeeAll = { vm.router.selectTab(AppTab.Markdowns) },
                )
            }
        }

        val starredItems = remember(documents, bundles, starredDocs, starredBundles) {
            mergeStarred(
                documents.filter { it.id in starredDocs }.map { StartItem.Doc(it) },
                bundles.filter { it.id in starredBundles }.map { StartItem.Bundle(it) },
            ).take(5)
        }
        if (starredItems.isNotEmpty()) {
            Stagger(appeared, 4) {
                StarredSection(
                    items = starredItems,
                    onDoc = { navController.navigate("markdowns/doc/${it.id}") },
                    onBundle = { navController.navigate("bundles/${it.id}") },
                    onSeeAll = { vm.router.selectTab(AppTab.Markdowns) },
                )
            }
        }

        val featured = remember(bundles) {
            bundles.firstOrNull { !it.isDraft } ?: bundles.firstOrNull()
        }
        if (featured != null) {
            Stagger(appeared, 5) {
                FeaturedBundleCard(
                    bundle = featured,
                    onOpen = { navController.navigate("bundles/${featured.id}") },
                    onAllBundles = { vm.router.selectTab(AppTab.Bundles) },
                )
            }
        }
    }
}

// ───────────────────────── Stagger helper ─────────────────────────

@Composable
private fun Stagger(appeared: Boolean, index: Int, content: @Composable () -> Unit) {
    val alpha by animateFloatAsState(
        if (appeared) 1f else 0f,
        animationSpec = tween(550, delayMillis = 80 * index),
        label = "stagger-alpha-$index",
    )
    val offsetY by animateFloatAsState(
        if (appeared) 0f else 12f,
        animationSpec = tween(550, delayMillis = 80 * index),
        label = "stagger-offset-$index",
    )
    Box(
        Modifier.graphicsLayer {
            this.alpha = alpha
            translationY = offsetY
        },
    ) {
        content()
    }
}

// ───────────────────────── Hero ─────────────────────────

@Composable
private fun Hero(
    greeting: String,
    hubUrl: String?,
    aiPromptCopied: Boolean,
    onCopyAi: () -> Unit,
    onAskHub: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(
            greeting,
            style = BrandType.display(28),
            color = Brand.TextPrimary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (hubUrl != null) {
            HubUrlStrip(
                url = hubUrl,
                aiPromptCopied = aiPromptCopied,
                onCopyAi = onCopyAi,
            )
            AskYourHub(onClick = onAskHub)
        }
    }
}

@Composable
private fun HubUrlStrip(url: String, aiPromptCopied: Boolean, onCopyAi: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            url.removePrefix("https://"),
            style = BrandType.mono(12),
            color = Brand.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 14.dp, vertical = 12.dp),
        )
        Box(
            Modifier
                .width(0.5.dp)
                .height(28.dp)
                .background(Brand.BorderDim),
        )
        Row(
            Modifier
                .clickable {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    onCopyAi()
                }
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(
                if (aiPromptCopied) Lucide.Check else Lucide.Sparkles,
                null,
                tint = Brand.TextPrimary,
                modifier = Modifier.size(11.dp),
            )
            Text(
                if (aiPromptCopied) "Copied" else "Copy for AI",
                style = BrandType.body(12, FontWeight.Medium),
                color = Brand.TextPrimary,
            )
        }
    }
}

@Composable
private fun AskYourHub(onClick: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.SheetBg.copy(alpha = 0.75f))
            .border(1.dp, Brand.MicroInfo.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onClick()
            }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Lucide.MessageCircle, null, tint = Brand.MicroInfo, modifier = Modifier.size(12.dp))
        Text(
            "Ask your hub",
            style = BrandType.body(13, FontWeight.SemiBold),
            color = Brand.TextPrimary,
        )
        Spacer(Modifier.weight(1f))
        Icon(Lucide.ArrowRight, null, tint = Brand.TextFaint, modifier = Modifier.size(10.dp))
    }
}

// ───────────────────────── Pulse row ─────────────────────────

@Composable
private fun PulseRow(today: Int, week: Int, allTime: Int) {
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(Brand.BorderDim))
        Row(
            Modifier.fillMaxWidth().padding(vertical = 14.dp),
            verticalAlignment = Alignment.Top,
        ) {
            PulseStat(value = today.toString(), label = "TODAY", modifier = Modifier.weight(1f))
            PulseDivider()
            PulseStat(value = week.toString(), label = "THIS WEEK", modifier = Modifier.weight(1f))
            PulseDivider()
            PulseStat(value = allTime.toString(), label = "ALL TIME", modifier = Modifier.weight(1f))
        }
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(Brand.BorderDim))
    }
}

@Composable
private fun PulseStat(value: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(value, style = BrandType.display(30), color = Brand.TextPrimary, maxLines = 1)
        Text(label, style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
    }
}

@Composable
private fun PulseDivider() {
    Box(Modifier.width(0.5.dp).height(36.dp).background(Brand.BorderDim))
}

// ───────────────────────── Quick actions ─────────────────────────

@Composable
private fun QuickActions(
    onCapture: () -> Unit,
    onSearch: () -> Unit,
    onOpenHub: () -> Unit,
    hasHub: Boolean,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        ActionTile("New capture", Lucide.Plus, Brand.TextPrimary, Modifier.weight(1f), onCapture)
        ActionTile("Search", Lucide.Search, Brand.MicroInfo, Modifier.weight(1f), onSearch)
        if (hasHub) {
            ActionTile("Open hub", Lucide.Compass, Brand.MicroWarn, Modifier.weight(1f), onOpenHub)
        }
    }
}

@Composable
private fun ActionTile(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accent: Color,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    Column(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(12.dp))
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onClick()
            }
            .padding(vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(icon, null, tint = accent, modifier = Modifier.size(18.dp))
        Text(label, style = BrandType.body(11, FontWeight.Medium), color = Brand.TextPrimary)
    }
}

// ───────────────────────── Recent / Starred sections ─────────────────────────

private sealed class StartItem(val sortMillis: Long, val id: String) {
    class Doc(val doc: DocSummary) : StartItem(parseInstantMillis(doc.updatedAt), doc.id)
    class Bundle(val bundle: BundleSummary) : StartItem(parseInstantMillis(bundle.updatedAt), bundle.id)
}

private fun mergeRecent(docs: List<DocSummary>, bundles: List<BundleSummary>): List<StartItem> =
    (docs.map { StartItem.Doc(it) } + bundles.map { StartItem.Bundle(it) })
        .sortedByDescending { it.sortMillis }

private fun mergeStarred(docs: List<StartItem.Doc>, bundles: List<StartItem.Bundle>): List<StartItem> =
    (docs + bundles).sortedByDescending { it.sortMillis }

@Composable
private fun RecentSection(
    items: List<StartItem>,
    onDoc: (DocSummary) -> Unit,
    onBundle: (BundleSummary) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionHeader(label = "RECENT", actionLabel = "See all", onAction = onSeeAll)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items.forEach { item ->
                when (item) {
                    is StartItem.Doc -> StartDocRow(item.doc, starred = false) { onDoc(item.doc) }
                    is StartItem.Bundle -> StartBundleRow(item.bundle, starred = false) { onBundle(item.bundle) }
                }
            }
        }
    }
}

@Composable
private fun StarredSection(
    items: List<StartItem>,
    onDoc: (DocSummary) -> Unit,
    onBundle: (BundleSummary) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(Lucide.Star, null, tint = Brand.MicroWarn, modifier = Modifier.size(10.dp))
            Text(
                "STARRED",
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.TextFaint,
            )
            Spacer(Modifier.weight(1f))
            val haptics = LocalHapticFeedback.current
            Text(
                "See all",
                style = BrandType.body(11, FontWeight.Medium),
                color = Brand.TextMuted,
                modifier = Modifier.clickable {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onSeeAll()
                },
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items.forEach { item ->
                when (item) {
                    is StartItem.Doc -> StartDocRow(item.doc, starred = true) { onDoc(item.doc) }
                    is StartItem.Bundle -> StartBundleRow(item.bundle, starred = true) { onBundle(item.bundle) }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(label: String, actionLabel: String, onAction: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
        Spacer(Modifier.weight(1f))
        Text(
            actionLabel,
            style = BrandType.body(11, FontWeight.Medium),
            color = Brand.TextMuted,
            modifier = Modifier.clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onAction()
            },
        )
    }
}

@Composable
private fun StartDocRow(doc: DocSummary, starred: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        DocStatusIcon(isDraft = doc.isDraft, sizeDp = 16)
        Text(
            doc.title ?: "Untitled",
            style = BrandType.body(13, FontWeight.Medium),
            color = Brand.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (starred) {
            Icon(Lucide.Star, null, tint = Brand.MicroWarn, modifier = Modifier.size(10.dp))
        }
        Text(
            compactTime(doc.updatedAt),
            style = BrandType.mono(10),
            color = Brand.TextFaint,
        )
    }
}

@Composable
private fun StartBundleRow(bundle: BundleSummary, starred: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        BundleLayersIcon(isDraft = bundle.isDraft, visibility = bundle.visibility, sizeDp = 16)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                bundle.title ?: "Untitled Bundle",
                style = BrandType.body(13, FontWeight.Medium),
                color = Brand.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "BUNDLE",
                style = BrandType.mono(8, FontWeight.Medium),
                color = Brand.TextFaint,
            )
        }
        if (starred) {
            Icon(Lucide.Star, null, tint = Brand.MicroWarn, modifier = Modifier.size(10.dp))
        }
        Text(
            compactTime(bundle.updatedAt),
            style = BrandType.mono(10),
            color = Brand.TextFaint,
        )
    }
}

// ───────────────────────── Featured bundle ─────────────────────────

@Composable
private fun FeaturedBundleCard(
    bundle: BundleSummary,
    onOpen: () -> Unit,
    onAllBundles: () -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionHeader(label = "FEATURED BUNDLE", actionLabel = "All bundles", onAction = onAllBundles)
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Brand.Surface)
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(12.dp))
                .clickable {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onOpen()
                }
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                BundleLayersIcon(isDraft = bundle.isDraft, visibility = bundle.visibility, sizeDp = 22)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        bundle.title ?: "Untitled Bundle",
                        style = BrandType.body(15, FontWeight.SemiBold),
                        color = Brand.TextPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(
                            "${bundle.documentCount} memor${if (bundle.documentCount == 1) "y" else "ies"}",
                            style = BrandType.mono(10),
                            color = Brand.TextFaint,
                        )
                        if (!bundle.isDraft) {
                            val (badge, color) = when (bundle.visibility) {
                                "restricted" -> "SHARED" to Brand.MicroInfo
                                else -> "PUBLIC" to Brand.MicroLime
                            }
                            Text(
                                badge,
                                style = BrandType.mono(9, FontWeight.Medium),
                                color = color,
                            )
                        }
                    }
                }
            }
            // Inner URL pill (sparkles trailing)
            val url = "${BuildConfig.API_BASE.removeSuffix("/")}/b/${bundle.id}"
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Brand.Background)
                    .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(8.dp)),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    url.removePrefix("https://"),
                    style = BrandType.mono(11),
                    color = Brand.TextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                )
                Icon(
                    Lucide.Sparkles,
                    null,
                    tint = Brand.MicroLime,
                    modifier = Modifier
                        .padding(horizontal = 10.dp)
                        .size(10.dp),
                )
            }
        }
    }
}
