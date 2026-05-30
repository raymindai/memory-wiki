/*
 * MarkdownsScreen — port of iOS TimelineView.swift.
 *
 *   Header        display 26 "Markdowns" + mono 11 count + RefreshingPip
 *                 + 34dp magnifyingglass HeaderIconButton (toggles search)
 *   Search bar    glass row, magnifyingglass + TextField + xmark clear,
 *                 animated slide-down
 *   Filter strip  All / Private / Shared / Synced FilterPills
 *   Content       loading → SkeletonList(7)
 *                 no docs → EmptyState w/ "Capture your first memory" CTA
 *                 no filter match → per-filter EmptyState w/ "Browse all"
 *                 have docs → ScrollView grouped by TimelineBucket
 *                 with sticky BucketHeaders (Today / Yesterday / This
 *                 week / This month / Earlier)
 *
 *   DocumentRow   DocStatusIcon 18 (with sync badge composite),
 *                 title body 14 medium + optional pin star,
 *                 meta line (sync source / view count badges),
 *                 compactTime mono 10, share button
 *   Long-press    Copy URL / Copy for AI / Share / Open on web
 */

package wiki.memory.memorywiki.ui.markdowns

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.composables.icons.lucide.Cloud
import com.composables.icons.lucide.Eye
import com.composables.icons.lucide.Inbox
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.RefreshCw
import com.composables.icons.lucide.Search
import com.composables.icons.lucide.Upload
import com.composables.icons.lucide.Users
import com.composables.icons.lucide.X
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.AppRouter
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.RouterEvent
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.DocSummary
import wiki.memory.memorywiki.ui.components.AmbientBlob
import wiki.memory.memorywiki.ui.components.DocStatusIcon
import wiki.memory.memorywiki.ui.components.RefreshingPip
import wiki.memory.memorywiki.ui.components.SkeletonList
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import wiki.memory.memorywiki.util.compactTime

// ───────────────────────── ViewModel ─────────────────────────

@HiltViewModel
class MarkdownsViewModel @Inject constructor(
    val api: ApiClient,
    val router: AppRouter,
) : ViewModel() {
    enum class Filter { All, Private, Shared, Synced }

    private val _all = MutableStateFlow<List<DocSummary>>(emptyList())
    val all: StateFlow<List<DocSummary>> = _all.asStateFlow()
    private val _filter = MutableStateFlow(Filter.All)
    val filter: StateFlow<Filter> = _filter.asStateFlow()
    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init { refresh() }

    fun setFilter(f: Filter) { _filter.value = f }
    fun setQuery(q: String) { _query.value = q }

    fun refresh() = viewModelScope.launch {
        if (_all.value.isNotEmpty()) _refreshing.value = true else _loading.value = true
        runCatching { api.userDocuments() }
            .onSuccess { _all.value = it.documents; _error.value = null }
            .onFailure { _error.value = it.message ?: "Couldn't load timeline" }
        _loading.value = false
        _refreshing.value = false
    }

    val visible: StateFlow<List<DocSummary>> by lazy {
        val sf = MutableStateFlow<List<DocSummary>>(emptyList())
        viewModelScope.launch {
            combine(_all, _filter, _query) { all, f, q ->
                all.filter { d ->
                    val matchFilter = when (f) {
                        Filter.All -> true
                        Filter.Private -> d.isDraft
                        Filter.Shared -> !d.isDraft
                        // 'Synced' = came in from a companion channel
                        // (vscode / desktop / cli / mcp / chrome) — not
                        // typed inline in the app + not from the web edit.
                        Filter.Synced -> d.source != null && d.source != "ai" && d.source != "web"
                    }
                    val matchQuery = q.isBlank() ||
                        (d.title?.contains(q, ignoreCase = true) == true)
                    matchFilter && matchQuery
                }
            }.collect { sf.value = it }
        }
        sf.asStateFlow()
    }
}

// ───────────────────────── Time buckets ─────────────────────────

enum class TimelineBucket(val label: String) {
    Today("TODAY"),
    Yesterday("YESTERDAY"),
    ThisWeek("THIS WEEK"),
    ThisMonth("THIS MONTH"),
    Earlier("EARLIER"),
}

private fun bucketFor(iso: String?): TimelineBucket {
    if (iso.isNullOrBlank()) return TimelineBucket.Earlier
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return TimelineBucket.Earlier
    val zone = ZoneId.systemDefault()
    val date = instant.atZone(zone).toLocalDate()
    val today = LocalDate.now(zone)
    val days = ChronoUnit.DAYS.between(date, today)
    return when {
        days <= 0L -> TimelineBucket.Today
        days == 1L -> TimelineBucket.Yesterday
        days < 7L -> TimelineBucket.ThisWeek
        days < 30L -> TimelineBucket.ThisMonth
        else -> TimelineBucket.Earlier
    }
}

private fun group(docs: List<DocSummary>): List<Pair<TimelineBucket, List<DocSummary>>> {
    val byBucket = docs.groupBy { bucketFor(it.updatedAt) }
    return TimelineBucket.entries.mapNotNull { b ->
        byBucket[b]?.takeIf { it.isNotEmpty() }?.let { b to it }
    }
}

// ───────────────────────── Screen ─────────────────────────

@Composable
fun MarkdownsScreen(navController: NavController, vm: MarkdownsViewModel = hiltViewModel()) {
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    val searchFocus = remember { FocusRequester() }
    val filter by vm.filter.collectAsState()
    val query by vm.query.collectAsState()
    val visible by vm.visible.collectAsState()
    val all by vm.all.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val errorMsg by vm.error.collectAsState()

    LaunchedEffect(Unit) {
        vm.router.events.collect { evt ->
            if (evt is RouterEvent.OpenSearch) {
                searchOpen = true
                searchFocus.requestFocus()
            }
        }
    }

    val pullState = rememberPullToRefreshState()

    Column(Modifier.fillMaxSize().padding(top = 44.dp)) {
        Header(
            count = all.size,
            refreshing = refreshing,
            searchOpen = searchOpen,
            onToggleSearch = {
                searchOpen = !searchOpen
                if (!searchOpen) vm.setQuery("")
            },
        )

        AnimatedVisibility(
            visible = searchOpen,
            enter = fadeIn(tween(180)) + slideInVertically(tween(220)) { -it / 2 },
            exit = fadeOut(tween(140)) + slideOutVertically(tween(180)) { -it / 2 },
        ) {
            SearchBar(
                query = query,
                onChange = vm::setQuery,
                onClear = { vm.setQuery("") },
                focusRequester = searchFocus,
            )
        }

        AnimatedVisibility(
            visible = !searchOpen,
            enter = fadeIn(tween(180)),
            exit = fadeOut(tween(120)),
        ) {
            FilterStrip(filter = filter, onSelect = { vm.setFilter(it) })
        }

        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { vm.refresh() },
            state = pullState,
            modifier = Modifier.fillMaxSize(),
        ) {
            when {
                loading && all.isEmpty() -> SkeletonList(count = 8)
                errorMsg != null && all.isEmpty() -> EmptyState(
                    title = "Couldn't load timeline",
                    caption = errorMsg ?: "",
                    glyph = Lucide.RefreshCw,
                    ctaLabel = "Try again",
                    onCta = { vm.refresh() },
                )
                all.isEmpty() -> EmptyState(
                    title = "Nothing captured yet",
                    caption = "Write something, paste a URL from your clipboard, or use the Android share sheet from any app.",
                    glyph = Lucide.Inbox,
                    ctaLabel = "Capture your first memory",
                    onCta = { vm.router.selectTab(wiki.memory.memorywiki.AppTab.Capture) },
                )
                visible.isEmpty() -> EmptyState(
                    title = emptyTitleFor(filter, query),
                    caption = emptyCaptionFor(filter, query),
                    glyph = emptyGlyphFor(filter, query),
                    ctaLabel = if (filter != MarkdownsViewModel.Filter.All) "Browse all" else null,
                    onCta = { vm.setFilter(MarkdownsViewModel.Filter.All) },
                )
                else -> LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 14.dp),
                    contentPadding = PaddingValues(top = 6.dp, bottom = 140.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    group(visible).forEach { (bucket, docs) ->
                        item(key = "header-${bucket.name}") {
                            BucketHeader(bucket.label, docs.size)
                        }
                        items(docs, key = { it.id }) { doc ->
                            DocumentRow(
                                doc = doc,
                                onClick = { navController.navigate("markdowns/doc/${doc.id}") },
                            )
                        }
                    }
                }
            }
        }
    }
}

// ───────────────────────── Header ─────────────────────────

@Composable
private fun Header(
    count: Int,
    refreshing: Boolean,
    searchOpen: Boolean,
    onToggleSearch: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp)
            .padding(top = 18.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("Markdowns", style = BrandType.display(26), color = Brand.TextPrimary)
        Spacer(Modifier.width(10.dp))
        Text(count.toString(), style = BrandType.mono(11), color = Brand.TextFaint)
        Spacer(Modifier.width(10.dp))
        RefreshingPip(visible = refreshing && count > 0)
        Spacer(Modifier.weight(1f))
        HeaderIconButton(
            icon = if (searchOpen) Lucide.X else Lucide.Search,
            onClick = onToggleSearch,
        )
    }
}

@Composable
private fun HeaderIconButton(icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Box(
        Modifier
            .size(34.dp)
            .clip(CircleShape)
            .background(Brand.SheetBg.copy(alpha = 0.75f))
            .border(0.5.dp, Brand.BorderDim, CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, tint = Brand.TextMuted, modifier = Modifier.size(14.dp))
    }
}

// ───────────────────────── Search ─────────────────────────

@Composable
private fun SearchBar(
    query: String,
    onChange: (String) -> Unit,
    onClear: () -> Unit,
    focusRequester: FocusRequester,
) {
    LaunchedEffect(Unit) { focusRequester.requestFocus() }
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp)
            .padding(bottom = 10.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.SheetBg.copy(alpha = 0.75f))
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Lucide.Search, null, tint = Brand.TextFaint, modifier = Modifier.size(13.dp))
        BasicTextField(
            value = query,
            onValueChange = onChange,
            singleLine = true,
            cursorBrush = SolidColor(Brand.TextPrimary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            textStyle = BrandType.body(14).copy(color = Brand.TextPrimary),
            modifier = Modifier
                .weight(1f)
                .focusRequester(focusRequester),
            decorationBox = { inner ->
                Box {
                    if (query.isEmpty()) {
                        Text(
                            "Search titles or meaning",
                            style = BrandType.body(14),
                            color = Brand.TextFaint,
                        )
                    }
                    inner()
                }
            },
        )
        if (query.isNotEmpty()) {
            Icon(
                Lucide.X,
                null,
                tint = Brand.TextFaint,
                modifier = Modifier
                    .size(13.dp)
                    .clickable { onClear() },
            )
        }
    }
}

// ───────────────────────── Filter strip ─────────────────────────

@Composable
private fun FilterStrip(
    filter: MarkdownsViewModel.Filter,
    onSelect: (MarkdownsViewModel.Filter) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 18.dp)
            .padding(bottom = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        MarkdownsViewModel.Filter.entries.forEach { f ->
            FilterPill(label = f.uiLabel(), active = f == filter, onClick = { onSelect(f) })
        }
    }
}

private fun MarkdownsViewModel.Filter.uiLabel(): String = when (this) {
    MarkdownsViewModel.Filter.All -> "All"
    MarkdownsViewModel.Filter.Private -> "Private"
    MarkdownsViewModel.Filter.Shared -> "Shared"
    MarkdownsViewModel.Filter.Synced -> "Synced"
}

@Composable
private fun FilterPill(label: String, active: Boolean, onClick: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    Row(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(if (active) Brand.Surface else Color.Transparent)
            .border(
                width = 0.5.dp,
                color = if (active) Brand.BorderDim else Color.Transparent,
                shape = RoundedCornerShape(50),
            )
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onClick()
            }
            .padding(horizontal = 14.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = BrandType.body(13, if (active) FontWeight.SemiBold else FontWeight.Medium),
            color = if (active) Brand.TextPrimary else Brand.TextMuted,
        )
    }
}

// ───────────────────────── Bucket header ─────────────────────────

@Composable
private fun BucketHeader(label: String, count: Int) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Brand.Background)
            .padding(start = 6.dp, top = 14.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            label,
            style = BrandType.mono(9, FontWeight.Medium),
            color = Brand.TextFaint,
        )
        Text(
            count.toString(),
            style = BrandType.mono(10),
            color = Brand.TextFaint,
        )
    }
}

// ───────────────────────── DocumentRow ─────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun DocumentRow(doc: DocSummary, onClick: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var menuOpen by remember { mutableStateOf(false) }
    val url = "${BuildConfig.API_BASE.removeSuffix("/")}/${doc.id}"
    val syncedSource = doc.source?.takeIf { it != "ai" && it != "web" }

    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
            .combinedClickable(
                onClick = {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onClick()
                },
                onLongClick = {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    menuOpen = true
                },
            ),
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            DocStatusIcon(
                isDraft = doc.isDraft,
                isRestricted = false,  // server doesn't expose this on DocSummary yet
                syncedSource = syncedSource,
                sizeDp = 18,
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    doc.title ?: "Untitled",
                    style = BrandType.body(14, FontWeight.Medium),
                    color = Brand.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                MetaLine(doc, syncedSource)
            }
            Text(
                compactTime(doc.updatedAt),
                style = BrandType.mono(10),
                color = Brand.TextFaint,
            )
            Icon(
                Lucide.Upload,
                null,
                tint = Brand.TextFaint,
                modifier = Modifier
                    .size(13.dp)
                    .clickable {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        shareUrl(context, url)
                    },
            )
        }
        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            DropdownMenuItem(text = { Text("Copy URL") }, onClick = {
                menuOpen = false
                clipboard.setText(AnnotatedString(url))
            })
            DropdownMenuItem(text = { Text("Copy for AI") }, onClick = {
                menuOpen = false
                clipboard.setText(AnnotatedString("Use $url as my context."))
            })
            DropdownMenuItem(text = { Text("Share…") }, onClick = {
                menuOpen = false
                shareUrl(context, url)
            })
            DropdownMenuItem(text = { Text("Open on web") }, onClick = {
                menuOpen = false
                context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
            })
        }
    }
}

@Composable
private fun MetaLine(doc: DocSummary, syncedSource: String?) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Privacy badge — quiet mono caption matching iOS.
        val (privacy, privacyColor) = when {
            !doc.isDraft -> "PUBLIC" to Brand.MicroLime
            else -> "PRIVATE" to Brand.TextFaint
        }
        Text(
            privacy,
            style = BrandType.mono(9, FontWeight.Medium),
            color = privacyColor,
        )
        if (syncedSource != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Icon(Lucide.RefreshCw, null, tint = Brand.MicroInfo, modifier = Modifier.size(8.dp))
                Text(
                    syncedSource.uppercase(),
                    style = BrandType.mono(9, FontWeight.Medium),
                    color = Brand.MicroInfo,
                )
            }
        }
        if (doc.viewCount > 0) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Icon(Lucide.Eye, null, tint = Brand.TextFaint, modifier = Modifier.size(8.dp))
                Text(
                    doc.viewCount.toString(),
                    style = BrandType.mono(9),
                    color = Brand.TextFaint,
                )
            }
        }
    }
}

private fun shareUrl(context: android.content.Context, url: String) {
    context.startActivity(
        Intent.createChooser(
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, url)
            },
            "Share doc",
        ),
    )
}

// ───────────────────────── Empty state ─────────────────────────

@Composable
private fun EmptyState(
    title: String,
    caption: String,
    glyph: androidx.compose.ui.graphics.vector.ImageVector,
    ctaLabel: String? = null,
    onCta: (() -> Unit)? = null,
) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        AmbientBlob()
        Column(
            Modifier.padding(horizontal = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(glyph, null, tint = Brand.TextFaint, modifier = Modifier.size(28.dp))
            Text(title, style = BrandType.body(15, FontWeight.Medium), color = Brand.TextPrimary)
            Text(
                caption,
                style = BrandType.body(13),
                color = Brand.TextMuted,
                textAlign = TextAlign.Center,
            )
            if (ctaLabel != null && onCta != null) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(Brand.TextPrimary)
                        .clickable { onCta() }
                        .padding(horizontal = 18.dp, vertical = 10.dp),
                ) {
                    Text(
                        ctaLabel,
                        style = BrandType.body(13, FontWeight.Medium),
                        color = Brand.Background,
                    )
                }
            }
        }
    }
}

private fun emptyTitleFor(filter: MarkdownsViewModel.Filter, q: String): String {
    if (q.isNotBlank()) return "No matches"
    return when (filter) {
        MarkdownsViewModel.Filter.All -> "No matches"
        MarkdownsViewModel.Filter.Private -> "No private memories"
        MarkdownsViewModel.Filter.Shared -> "No shared memories"
        MarkdownsViewModel.Filter.Synced -> "No synced memories"
    }
}

private fun emptyCaptionFor(filter: MarkdownsViewModel.Filter, q: String): String {
    if (q.isNotBlank()) return "Try a shorter query."
    return when (filter) {
        MarkdownsViewModel.Filter.All -> "Try a shorter query."
        MarkdownsViewModel.Filter.Private -> "Memories you keep to yourself land here."
        MarkdownsViewModel.Filter.Shared -> "Memories you've shared with specific people land here."
        MarkdownsViewModel.Filter.Synced -> "Memories captured from VS Code, Desktop, Chrome, CLI or MCP land here."
    }
}

private fun emptyGlyphFor(filter: MarkdownsViewModel.Filter, q: String): androidx.compose.ui.graphics.vector.ImageVector {
    if (q.isNotBlank()) return Lucide.Search
    return when (filter) {
        MarkdownsViewModel.Filter.All -> Lucide.Search
        MarkdownsViewModel.Filter.Private -> Lucide.Cloud
        MarkdownsViewModel.Filter.Shared -> Lucide.Users
        MarkdownsViewModel.Filter.Synced -> Lucide.RefreshCw
    }
}
