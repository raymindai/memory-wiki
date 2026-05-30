/*
 * MarkdownsScreen — flat list of every doc in the user's library,
 * grouped by time bucket. Filter chips (All / Private / Shared /
 * Synced), morphing search bar, pull-to-refresh, skeleton on first
 * paint, RefreshingPip on background revalidate.
 */

package wiki.memory.memorywiki.ui.markdowns

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.AppRouter
import wiki.memory.memorywiki.RouterEvent
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.DocSummary
import wiki.memory.memorywiki.ui.components.RefreshingPip
import wiki.memory.memorywiki.ui.components.SkeletonList
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject

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

    init { refresh() }

    fun setFilter(f: Filter) { _filter.value = f }
    fun setQuery(q: String) { _query.value = q }

    fun refresh() = viewModelScope.launch {
        if (_all.value.isNotEmpty()) _refreshing.value = true else _loading.value = true
        runCatching { api.userDocuments() }.onSuccess { _all.value = it.documents }
        _loading.value = false
        _refreshing.value = false
    }

    val visible: StateFlow<List<DocSummary>> by lazy {
        kotlinx.coroutines.flow.combine(_all, _filter, _query) { all, f, q ->
            all.filter { d ->
                val matchFilter = when (f) {
                    Filter.All -> true
                    Filter.Private -> d.isDraft
                    Filter.Shared -> !d.isDraft
                    Filter.Synced -> d.source == "web" || d.source == "mcp"
                }
                val matchQuery = q.isBlank() || (d.title?.contains(q, ignoreCase = true) == true)
                matchFilter && matchQuery
            }
        }.let { flow ->
            // Materialise as StateFlow to read from Composable.
            val sf = MutableStateFlow<List<DocSummary>>(emptyList())
            viewModelScope.launch { flow.collect { sf.value = it } }
            sf.asStateFlow()
        }
    }
}

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

    LaunchedEffect(Unit) {
        vm.router.events.collect { evt ->
            if (evt is RouterEvent.OpenSearch) {
                searchOpen = true
                searchFocus.requestFocus()
            }
        }
    }

    val pullState = rememberPullToRefreshState()

    Column(
        Modifier.fillMaxSize().padding(top = 56.dp),
    ) {
        // Header — title + count + RefreshingPip + Search icon
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Markdowns", style = BrandType.display(22), color = Brand.TextPrimary)
            Spacer(Modifier.width(8.dp))
            Text(all.size.toString(), style = BrandType.mono(12), color = Brand.TextFaint)
            RefreshingPip(visible = refreshing)
            Spacer(Modifier.weight(1f))
            Icon(
                if (searchOpen) Icons.Outlined.Close else Icons.Outlined.Search,
                contentDescription = if (searchOpen) "Close search" else "Search",
                tint = Brand.TextMuted,
                modifier = Modifier
                    .size(28.dp)
                    .clickable { searchOpen = !searchOpen; if (searchOpen) searchFocus.requestFocus() else vm.setQuery("") }
                    .padding(4.dp),
            )
        }

        AnimatedContent(searchOpen, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "search") { open ->
            if (open) {
                OutlinedTextField(
                    value = query,
                    onValueChange = vm::setQuery,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 8.dp)
                        .focusRequester(searchFocus),
                    singleLine = true,
                    placeholder = { Text("Search titles or meaning", color = Brand.TextFaint, style = BrandType.body(14)) },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Brand.Surface, unfocusedContainerColor = Brand.Surface,
                        focusedTextColor = Brand.TextPrimary, unfocusedTextColor = Brand.TextPrimary,
                        cursorColor = Brand.TextPrimary,
                        focusedBorderColor = Brand.Border, unfocusedBorderColor = Brand.BorderDim,
                    ),
                )
            } else {
                FilterChipRow(filter = filter, onChange = vm::setFilter)
            }
        }

        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { vm.refresh() },
            state = pullState,
            modifier = Modifier.fillMaxSize(),
        ) {
            if (loading && all.isEmpty()) {
                SkeletonList(count = 10)
            } else if (visible.isEmpty()) {
                EmptyState(filter)
            } else {
                LazyColumn(contentPadding = PaddingValues(bottom = 140.dp)) {
                    items(visible, key = { it.id }) { doc ->
                        DocumentRow(doc) { navController.navigate("markdowns/doc/${doc.id}") }
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterChipRow(filter: MarkdownsViewModel.Filter, onChange: (MarkdownsViewModel.Filter) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        MarkdownsViewModel.Filter.entries.forEach { f ->
            FilterChip(
                selected = filter == f,
                onClick = { onChange(f) },
                label = { Text(f.name, style = BrandType.body(12, FontWeight.Medium)) },
                colors = FilterChipDefaults.filterChipColors(
                    containerColor = Brand.Surface,
                    selectedContainerColor = Brand.TextPrimary,
                    labelColor = Brand.TextMuted,
                    selectedLabelColor = Brand.Background,
                ),
                border = FilterChipDefaults.filterChipBorder(
                    enabled = true, selected = filter == f,
                    borderColor = Brand.BorderDim, selectedBorderColor = Brand.TextPrimary,
                ),
            )
        }
    }
}

@Composable
private fun DocumentRow(doc: DocSummary, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        val dotColor = when {
            !doc.isDraft -> Brand.MicroLime
            doc.source == "ai" -> Brand.MicroInfo
            else -> Brand.TextFaint
        }
        Box(
            Modifier.size(8.dp).background(dotColor, RoundedCornerShape(4.dp)),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                doc.title ?: "Untitled",
                style = BrandType.body(15, FontWeight.Medium),
                color = Brand.TextPrimary,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
            doc.updatedAt?.let { iso ->
                Text(
                    formatRelative(iso),
                    style = BrandType.mono(10),
                    color = Brand.TextFaint,
                )
            }
        }
        if (doc.viewCount > 0) {
            Text("👁 ${doc.viewCount}", style = BrandType.mono(10), color = Brand.TextFaint)
        }
    }
}

@Composable
private fun EmptyState(filter: MarkdownsViewModel.Filter) {
    Box(Modifier.fillMaxSize().padding(40.dp), contentAlignment = Alignment.Center) {
        Text(
            when (filter) {
                MarkdownsViewModel.Filter.All -> "No memories yet. Use Capture to add one."
                MarkdownsViewModel.Filter.Private -> "No private docs."
                MarkdownsViewModel.Filter.Shared -> "Nothing shared yet."
                MarkdownsViewModel.Filter.Synced -> "Nothing synced from web / MCP yet."
            },
            color = Brand.TextMuted,
            style = BrandType.body(13),
        )
    }
}

private fun formatRelative(iso: String): String {
    val instant = runCatching { Instant.parse(iso) }.getOrElse { return "" }
    val diff = System.currentTimeMillis() - instant.toEpochMilli()
    return when {
        diff < 60_000 -> "now"
        diff < 3_600_000 -> "${diff / 60_000}m"
        diff < 86_400_000 -> "${diff / 3_600_000}h"
        diff < 7L * 86_400_000 -> "${diff / 86_400_000}d"
        else -> instant.atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("MMM d"))
    }
}
