/*
 * BundlesScreen — port of iOS BundlesView.swift.
 *
 *   Header           display 26 "Bundles" + mono 11 count + RefreshingPip
 *                    + 34dp magnifyingglass icon button (toggles search)
 *   Search bar       toggleable (slides in), glass row with magnifyingglass
 *                    + TextField + xmark clear
 *   Filter strip     All / Private / Shared / Public (FilterPill, scrolls
 *                    horizontally when crowded)
 *   Content          loading → SkeletonList(6)
 *                    no bundles → EmptyState with AmbientBlob
 *                    no filter match → EmptyState with "Browse all" link
 *                    have bundles → LazyColumn of BundleRow w/
 *                    PullToRefresh
 *
 *   BundleRow        BundleLayersIcon 18 colored by status, title,
 *                    meta line (doc count + visibility badge),
 *                    compactTime, share intent button
 *   Long-press menu  Copy URL, Copy for AI, Share, Open on web
 */

package wiki.memory.memorywiki.ui.bundles

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
import com.composables.icons.lucide.*
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.BundleSummary
import wiki.memory.memorywiki.ui.components.AmbientBlob
import wiki.memory.memorywiki.ui.components.BundleLayersIcon
import wiki.memory.memorywiki.ui.components.RefreshingPip
import wiki.memory.memorywiki.ui.components.SkeletonList
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import wiki.memory.memorywiki.util.compactTime

// ───────────────────────── ViewModel ─────────────────────────

@HiltViewModel
class BundlesViewModel @Inject constructor(
    val api: ApiClient,
    val pinned: wiki.memory.memorywiki.data.PinnedStore,
) : ViewModel() {
    enum class Filter { All, Private, Shared, Public }

    private val _all = MutableStateFlow<List<BundleSummary>>(emptyList())
    val all: StateFlow<List<BundleSummary>> = _all.asStateFlow()
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
        pinned.hydrate()
        runCatching { api.userBundles() }
            .onSuccess { _all.value = it.bundles; _error.value = null }
            .onFailure { _error.value = it.message ?: "Couldn't load bundles" }
        _loading.value = false
        _refreshing.value = false
    }

    val visible: StateFlow<List<BundleSummary>> by lazy {
        val sf = MutableStateFlow<List<BundleSummary>>(emptyList())
        viewModelScope.launch {
            combine(_all, _filter, _query) { all, f, q ->
                val filtered = all.filter {
                    when (f) {
                        Filter.All -> true
                        Filter.Private -> it.isDraft
                        Filter.Shared -> !it.isDraft && it.visibility == "restricted"
                        Filter.Public -> !it.isDraft && it.visibility == "public"
                    }
                }
                if (q.isBlank()) filtered
                else filtered.filter { (it.title ?: "").contains(q, ignoreCase = true) }
            }.collect { sf.value = it }
        }
        sf.asStateFlow()
    }
}

// ───────────────────────── Screen ─────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun BundlesScreen(navController: NavController, vm: BundlesViewModel = hiltViewModel()) {
    val all by vm.all.collectAsState()
    val visible by vm.visible.collectAsState()
    val filter by vm.filter.collectAsState()
    val query by vm.query.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val errorMsg by vm.error.collectAsState()

    var searchOpen by remember { mutableStateOf(false) }
    val pullState = rememberPullToRefreshState()

    Column(
        Modifier
            .fillMaxSize()
            .padding(top = 44.dp),
    ) {
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
                onChange = { vm.setQuery(it) },
                onClear = { vm.setQuery("") },
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
                loading && all.isEmpty() -> SkeletonList(count = 6)
                errorMsg != null && all.isEmpty() -> EmptyState(
                    title = "Couldn't load bundles",
                    caption = errorMsg ?: "",
                    glyph = Lucide.Globe,
                    ctaLabel = "Try again",
                    onCta = { vm.refresh() },
                )
                all.isEmpty() -> EmptyState(
                    title = "No bundles yet",
                    caption = "Bundles group docs that share a topic. Create one on memory.wiki — each bundle gets its own URL you can deploy to AI.",
                    glyph = Lucide.Layers,
                )
                visible.isEmpty() -> EmptyState(
                    title = emptyTitle(filter, query),
                    caption = emptyCaption(filter, query),
                    glyph = emptyGlyph(filter, query),
                    ctaLabel = if (filter != BundlesViewModel.Filter.All) "Browse all" else null,
                    onCta = { vm.setFilter(BundlesViewModel.Filter.All) },
                )
                else -> {
                    val pinnedIds by vm.pinned.bundleIds.collectAsState()
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 14.dp),
                        contentPadding = PaddingValues(top = 6.dp, bottom = 140.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        items(visible, key = { it.id }) { b ->
                            BundleRow(
                                bundle = b,
                                pinned = b.id in pinnedIds,
                                onClick = { navController.navigate("bundles/${b.id}") },
                                onTogglePin = { vm.pinned.toggleBundle(b.id) },
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
        Text("Bundles", style = BrandType.display(26), color = Brand.TextPrimary)
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
private fun SearchBar(query: String, onChange: (String) -> Unit, onClear: () -> Unit) {
    val focusRequester = remember { FocusRequester() }
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
                            "Search bundles",
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
private fun FilterStrip(filter: BundlesViewModel.Filter, onSelect: (BundlesViewModel.Filter) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 18.dp)
            .padding(bottom = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        BundlesViewModel.Filter.entries.forEach { f ->
            FilterPill(label = f.uiLabel(), active = f == filter, onClick = { onSelect(f) })
        }
    }
}

private fun BundlesViewModel.Filter.uiLabel(): String = when (this) {
    BundlesViewModel.Filter.All -> "All"
    BundlesViewModel.Filter.Private -> "Private"
    BundlesViewModel.Filter.Shared -> "Shared"
    BundlesViewModel.Filter.Public -> "Public"
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

// ───────────────────────── BundleRow ─────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BundleRow(
    bundle: BundleSummary,
    pinned: Boolean,
    onClick: () -> Unit,
    onTogglePin: () -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var menuOpen by remember { mutableStateOf(false) }
    val url = "${BuildConfig.API_BASE.removeSuffix("/")}/b/${bundle.id}"

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
            BundleLayersIcon(
                isDraft = bundle.isDraft,
                visibility = bundle.visibility,
                sizeDp = 18,
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        bundle.title ?: "Untitled Bundle",
                        style = BrandType.body(14, FontWeight.Medium),
                        color = Brand.TextPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (pinned) {
                        Icon(Lucide.Star, null, tint = Brand.MicroWarn, modifier = Modifier.size(10.dp))
                    }
                }
                MetaLine(bundle)
            }
            Text(
                compactTime(bundle.updatedAt),
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
        DropdownMenu(
            expanded = menuOpen,
            onDismissRequest = { menuOpen = false },
        ) {
            DropdownMenuItem(
                text = { Text(if (pinned) "Unstar" else "Star") },
                onClick = { menuOpen = false; onTogglePin() },
            )
            DropdownMenuItem(text = { Text("Copy URL") }, onClick = {
                menuOpen = false
                clipboard.setText(AnnotatedString(url))
            })
            DropdownMenuItem(text = { Text("Copy for AI") }, onClick = {
                menuOpen = false
                clipboard.setText(AnnotatedString("Use $url as my context bundle."))
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

private fun shareUrl(context: android.content.Context, url: String) {
    context.startActivity(
        Intent.createChooser(
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, url)
            },
            "Share bundle",
        ),
    )
}

@Composable
private fun MetaLine(bundle: BundleSummary) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "${bundle.documentCount} ${if (bundle.documentCount == 1) "doc" else "docs"}",
            style = BrandType.mono(9, FontWeight.Medium),
            color = Brand.TextFaint,
        )
        val (badge, color) = when {
            !bundle.isDraft && bundle.visibility == "restricted" -> "RESTRICTED" to Brand.MicroInfo
            !bundle.isDraft -> "PUBLIC" to Brand.MicroLime
            else -> "PRIVATE" to Brand.TextFaint
        }
        Text(
            badge,
            style = BrandType.mono(9, FontWeight.Medium),
            color = color,
        )
    }
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
    Box(
        Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
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

private fun emptyTitle(filter: BundlesViewModel.Filter, q: String): String {
    if (q.isNotBlank()) return "No matches"
    return when (filter) {
        BundlesViewModel.Filter.All -> "No matches"
        BundlesViewModel.Filter.Private -> "No private bundles"
        BundlesViewModel.Filter.Shared -> "No shared bundles"
        BundlesViewModel.Filter.Public -> "No public bundles"
    }
}

private fun emptyCaption(filter: BundlesViewModel.Filter, q: String): String {
    if (q.isNotBlank()) return "Try a different search."
    return when (filter) {
        BundlesViewModel.Filter.All -> "Try a different search."
        BundlesViewModel.Filter.Private -> "Bundles you keep to yourself land here."
        BundlesViewModel.Filter.Shared -> "Bundles you've shared with specific people land here."
        BundlesViewModel.Filter.Public -> "Published bundles anyone can read land here."
    }
}

private fun emptyGlyph(filter: BundlesViewModel.Filter, q: String): androidx.compose.ui.graphics.vector.ImageVector {
    if (q.isNotBlank()) return Lucide.Search
    return when (filter) {
        BundlesViewModel.Filter.All -> Lucide.Search
        BundlesViewModel.Filter.Private -> Lucide.Layers
        BundlesViewModel.Filter.Shared -> Lucide.Users
        BundlesViewModel.Filter.Public -> Lucide.Globe
    }
}
