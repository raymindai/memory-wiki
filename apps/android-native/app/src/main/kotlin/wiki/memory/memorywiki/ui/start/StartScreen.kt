/*
 * StartScreen — daily greeting + hub URL + Ask-your-hub +
 * editorial stat strip + recent / starred / featured bundle.
 *
 * Listens for RouterEvent.OpenHubChat (from widget Ask button or
 * memorywiki://chat-hub deep link) and surfaces the chat sheet
 * over its own surface.
 */

package wiki.memory.memorywiki.ui.start

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
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
import wiki.memory.memorywiki.AppRouter
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.RouterEvent
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.DocSummary
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import java.util.Calendar
import javax.inject.Inject

@HiltViewModel
class StartViewModel @Inject constructor(
    val auth: AuthManager,
    val api: ApiClient,
    val router: AppRouter,
) : ViewModel() {
    private val _recent = MutableStateFlow<List<DocSummary>>(emptyList())
    val recent: StateFlow<List<DocSummary>> = _recent.asStateFlow()
    private val _starredIds = MutableStateFlow<List<String>>(emptyList())
    val starredIds: StateFlow<List<String>> = _starredIds.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()
    private val _todayCount = MutableStateFlow(0)
    val todayCount: StateFlow<Int> = _todayCount.asStateFlow()
    private val _weekCount = MutableStateFlow(0)
    val weekCount: StateFlow<Int> = _weekCount.asStateFlow()
    private val _allTime = MutableStateFlow(0)
    val allTime: StateFlow<Int> = _allTime.asStateFlow()

    init { refresh() }

    fun openSearch() = viewModelScope.launch {
        router.selectTab(wiki.memory.memorywiki.AppTab.Markdowns)
        router.emit(RouterEvent.OpenSearch)
    }

    fun openCapture() { router.selectTab(wiki.memory.memorywiki.AppTab.Capture) }

    fun refresh() = viewModelScope.launch {
        _loading.value = true
        runCatching { api.pins() }.onSuccess { p ->
            _starredIds.value = p.pins.filter { it.kind == "document" }.map { it.id }
        }
        runCatching { api.userDocuments() }.onSuccess { resp ->
            _recent.value = resp.documents.take(7)
            val now = System.currentTimeMillis()
            val cal = Calendar.getInstance()
            cal.timeInMillis = now
            cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0)
            val todayMs = cal.timeInMillis
            val weekAgo = now - 7L * 24 * 3600 * 1000
            _todayCount.value = resp.documents.count { parseInstantMillis(it.updatedAt) >= todayMs }
            _weekCount.value = resp.documents.count { parseInstantMillis(it.updatedAt) >= weekAgo }
            _allTime.value = resp.documents.size
        }
        _loading.value = false
    }
}

private fun parseInstantMillis(iso: String?): Long {
    if (iso.isNullOrBlank()) return 0
    return runCatching { java.time.Instant.parse(iso).toEpochMilli() }.getOrDefault(0)
}

@Composable
fun StartScreen(navController: NavController, vm: StartViewModel = hiltViewModel()) {
    val session by vm.auth.session.collectAsState()
    val displayName = session?.displayName ?: session?.email?.substringBefore("@") ?: "you"
    val hubUrl = session?.hubSlug?.let { "${BuildConfig.API_BASE.removeSuffix("/")}/@$it" }
        ?: "${BuildConfig.API_BASE}/@yourname"
    val clipboard = LocalClipboardManager.current
    val recent by vm.recent.collectAsState()
    val starredIds by vm.starredIds.collectAsState()
    val loading by vm.loading.collectAsState()
    val today by vm.todayCount.collectAsState()
    val week by vm.weekCount.collectAsState()
    val allTime by vm.allTime.collectAsState()

    // Open hub chat from widget Ask
    LaunchedEffect(Unit) {
        vm.router.events.collect { evt ->
            if (evt is RouterEvent.OpenHubChat) {
                val slug = vm.auth.session.value?.hubSlug ?: return@collect
                val title = vm.auth.session.value?.displayName ?: "Your hub"
                navController.navigate("chat/hub/${slug}/${title}")
            }
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp)
            .padding(top = 56.dp, bottom = 140.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Greeting(displayName)

        HubUrlCard(url = hubUrl, onCopyForAi = {
            clipboard.setText(AnnotatedString("Use $hubUrl as my context."))
        })

        AskYourHubButton(onClick = {
            val slug = session?.hubSlug ?: return@AskYourHubButton
            val title = displayName + "'s hub"
            navController.navigate("chat/hub/${slug}/${title}")
        })

        EditorialStatStrip(today = today, week = week, allTime = allTime)

        QuickActions(
            onCapture = { vm.openCapture() },
            onSearch = { vm.openSearch() },
            onOpenHub = { /* hub viewer wired in v0.2 */ },
        )

        if (starredIds.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text("STARRED", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
            // Cross-reference the recent set; titles for unseen docs
            // will land once DocCache prefetches.
            starredIds.take(5).forEach { id ->
                val doc = recent.firstOrNull { it.id == id }
                if (doc != null) {
                    RecentRow(doc) { navController.navigate("markdowns/doc/${doc.id}") }
                } else {
                    PlainRow(id) { navController.navigate("markdowns/doc/$id") }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        Text("RECENT", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
        recent.forEach { doc ->
            RecentRow(doc) {
                navController.navigate("markdowns/doc/${doc.id}")
            }
        }
        if (loading && recent.isEmpty()) {
            wiki.memory.memorywiki.ui.components.SkeletonList(count = 5)
        }
    }
}

@Composable
private fun PlainRow(id: String, onClick: () -> Unit) {
    androidx.compose.foundation.layout.Row(
        Modifier
            .fillMaxWidth()
            .background(Brand.Surface, androidx.compose.foundation.shape.RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(8.dp).background(Brand.MicroWarn, androidx.compose.foundation.shape.RoundedCornerShape(4.dp)))
        Text(id, style = BrandType.mono(11), color = Brand.TextSecondary)
    }
}

@Composable
private fun Greeting(name: String) {
    val hour = remember { Calendar.getInstance().get(Calendar.HOUR_OF_DAY) }
    val greeting = when (hour) {
        in 5..11 -> "Good morning"
        in 12..16 -> "Good afternoon"
        in 17..21 -> "Good evening"
        else -> "Welcome back"
    }
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text("$greeting,", style = BrandType.display(22), color = Brand.TextPrimary)
        Text(name, style = BrandType.display(22), color = Brand.TextPrimary)
    }
}

@Composable
private fun HubUrlCard(url: String, onCopyForAi: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Brand.Surface, RoundedCornerShape(12.dp))
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = url.removePrefix("https://"),
            style = BrandType.mono(12),
            color = Brand.TextPrimary,
            modifier = Modifier.weight(1f),
        )
        Row(
            Modifier
                .background(Brand.ToggleBg, RoundedCornerShape(8.dp))
                .clickable { onCopyForAi() }
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(Icons.Outlined.AutoAwesome, null, tint = Brand.TextPrimary, modifier = Modifier.size(11.dp))
            Text("Copy for AI", style = BrandType.body(12, FontWeight.Medium), color = Brand.TextPrimary)
        }
    }
}

@Composable
private fun AskYourHubButton(onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Brand.MicroInfo.copy(alpha = 0.10f), RoundedCornerShape(12.dp))
            .border(0.5.dp, Brand.MicroInfo.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Outlined.AutoAwesome, null, tint = Brand.MicroInfo, modifier = Modifier.size(16.dp))
        Text("Ask your hub", style = BrandType.body(14, FontWeight.Medium), color = Brand.TextPrimary)
        Spacer(Modifier.weight(1f))
        Text("→", style = BrandType.body(14), color = Brand.TextMuted)
    }
}

@Composable
private fun EditorialStatStrip(today: Int, week: Int, allTime: Int) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        StatCell("TODAY", today, Modifier.weight(1f))
        Box(Modifier.fillMaxHeight().width(0.5.dp).background(Brand.BorderDim))
        StatCell("THIS WEEK", week, Modifier.weight(1f))
        Box(Modifier.fillMaxHeight().width(0.5.dp).background(Brand.BorderDim))
        StatCell("ALL TIME", allTime, Modifier.weight(1f))
    }
}

@Composable
private fun StatCell(label: String, value: Int, modifier: Modifier = Modifier) {
    Column(modifier.padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value.toString(), style = BrandType.display(22), color = Brand.TextPrimary)
        Text(label, style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
    }
}

@Composable
private fun QuickActions(onCapture: () -> Unit, onSearch: () -> Unit, onOpenHub: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        ActionTile("New capture", Icons.Outlined.Add, Modifier.weight(1f), onCapture)
        ActionTile("Search", Icons.Outlined.Search, Modifier.weight(1f), onSearch, accent = Brand.MicroInfo)
        ActionTile("Open hub", Icons.Outlined.AutoAwesome, Modifier.weight(1f), onOpenHub, accent = Brand.MicroWarn)
    }
}

@Composable
private fun ActionTile(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier, onClick: () -> Unit, accent: androidx.compose.ui.graphics.Color = Brand.TextPrimary) {
    Column(
        modifier
            .background(Brand.Surface, RoundedCornerShape(12.dp))
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = accent, modifier = Modifier.size(18.dp))
        Text(label, style = BrandType.body(12, FontWeight.Medium), color = Brand.TextPrimary)
    }
}

@Composable
private fun RecentRow(doc: DocSummary, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Brand.Surface, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier
                .size(8.dp)
                .background(
                    color = if (!doc.isDraft) Brand.MicroLime else Brand.TextFaint,
                    shape = RoundedCornerShape(4.dp),
                ),
        )
        Text(
            doc.title ?: "Untitled",
            style = BrandType.body(14, FontWeight.Medium),
            color = Brand.TextPrimary,
            modifier = Modifier.weight(1f),
        )
    }
}
