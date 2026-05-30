/*
 * BundlesScreen — like MarkdownsScreen but for bundles.
 * Filter chips: All / Private / Shared / Public.
 */

package wiki.memory.memorywiki.ui.bundles

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import com.composables.icons.lucide.Layers
import com.composables.icons.lucide.Lucide
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.BundleSummary
import wiki.memory.memorywiki.ui.components.RefreshingPip
import wiki.memory.memorywiki.ui.components.SkeletonList
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import javax.inject.Inject

@HiltViewModel
class BundlesViewModel @Inject constructor(val api: ApiClient) : ViewModel() {
    enum class Filter { All, Private, Shared, Public }

    private val _all = MutableStateFlow<List<BundleSummary>>(emptyList())
    val all: StateFlow<List<BundleSummary>> = _all.asStateFlow()
    private val _filter = MutableStateFlow(Filter.All)
    val filter: StateFlow<Filter> = _filter.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    init { refresh() }

    fun setFilter(f: Filter) { _filter.value = f }

    fun refresh() = viewModelScope.launch {
        if (_all.value.isNotEmpty()) _refreshing.value = true else _loading.value = true
        runCatching { api.userBundles() }.onSuccess { _all.value = it.bundles }
        _loading.value = false
        _refreshing.value = false
    }

    val visible: StateFlow<List<BundleSummary>> by lazy {
        val sf = MutableStateFlow<List<BundleSummary>>(emptyList())
        viewModelScope.launch {
            combine(_all, _filter) { all, f ->
                all.filter {
                    when (f) {
                        Filter.All -> true
                        Filter.Private -> it.isDraft
                        Filter.Shared -> !it.isDraft && it.visibility == "restricted"
                        Filter.Public -> !it.isDraft && it.visibility == "public"
                    }
                }
            }.collect { sf.value = it }
        }
        sf.asStateFlow()
    }
}

@Composable
fun BundlesScreen(navController: NavController, vm: BundlesViewModel = hiltViewModel()) {
    val all by vm.all.collectAsState()
    val visible by vm.visible.collectAsState()
    val filter by vm.filter.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val pullState = rememberPullToRefreshState()

    Column(Modifier.fillMaxSize().padding(top = 56.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Bundles", style = BrandType.display(22), color = Brand.TextPrimary)
            Spacer(Modifier.width(8.dp))
            Text(all.size.toString(), style = BrandType.mono(12), color = Brand.TextFaint)
            RefreshingPip(visible = refreshing)
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            BundlesViewModel.Filter.entries.forEach { f ->
                FilterChip(
                    selected = filter == f,
                    onClick = { vm.setFilter(f) },
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

        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { vm.refresh() },
            state = pullState,
            modifier = Modifier.fillMaxSize(),
        ) {
            if (loading && all.isEmpty()) {
                SkeletonList(count = 8)
            } else {
                LazyColumn(contentPadding = PaddingValues(bottom = 140.dp)) {
                    items(visible, key = { it.id }) { b ->
                        BundleRow(b) { navController.navigate("bundles/${b.id}") }
                    }
                }
            }
        }
    }
}

@Composable
private fun BundleRow(b: BundleSummary, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Lucide.Layers, null, tint = visibilityColor(b.visibility), modifier = Modifier.size(18.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(b.title ?: "Untitled Bundle", style = BrandType.body(15, FontWeight.Medium), color = Brand.TextPrimary, maxLines = 1)
            Text("${b.documentCount} ${if (b.documentCount == 1) "doc" else "docs"}", style = BrandType.mono(10), color = Brand.TextFaint)
        }
        VisibilityChip(b.visibility, b.isDraft)
    }
}

@Composable
private fun VisibilityChip(visibility: String?, isDraft: Boolean) {
    val (label, color) = when {
        isDraft -> "PRIVATE" to Brand.TextFaint
        visibility == "public" -> "PUBLIC" to Brand.MicroLime
        visibility == "restricted" -> "RESTRICTED" to Brand.MicroInfo
        else -> "SHARED" to Brand.MicroInfo
    }
    Text(
        label,
        style = BrandType.mono(9, FontWeight.Medium),
        color = color,
        modifier = Modifier
            .background(color.copy(alpha = 0.10f), RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

private fun visibilityColor(visibility: String?) = when (visibility) {
    "public" -> Brand.MicroLime
    "restricted" -> Brand.MicroInfo
    else -> Brand.TextMuted
}
