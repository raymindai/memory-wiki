/*
 * BundleDetailScreen — title / description / visibility chip,
 * DeployCard (Copy AI / Copy URL / Open hub), members list,
 * overflow menu (Chat / Copy URL / Open on web).
 */

package wiki.memory.memorywiki.ui.bundles

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.Copy
import com.composables.icons.lucide.ExternalLink
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.MessageCircle
import com.composables.icons.lucide.Sparkles
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.BundleDetail
import wiki.memory.memorywiki.data.model.DocSummary
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import javax.inject.Inject

@HiltViewModel
class BundleDetailViewModel @Inject constructor(
    val api: ApiClient,
) : ViewModel() {
    private val _detail = MutableStateFlow<BundleDetail?>(null)
    val detail: StateFlow<BundleDetail?> = _detail.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    fun load(id: String) = viewModelScope.launch {
        _loading.value = true
        runCatching { api.bundleDetail(id) }.onSuccess { _detail.value = it }
        _loading.value = false
    }
}

@Composable
fun BundleDetailScreen(
    navController: NavController,
    bundleId: String,
    vm: BundleDetailViewModel = hiltViewModel(),
) {
    val detail by vm.detail.collectAsState()
    val loading by vm.loading.collectAsState()
    val clipboard = LocalClipboardManager.current

    LaunchedEffect(bundleId) { vm.load(bundleId) }

    Column(Modifier.fillMaxSize().padding(top = 44.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Lucide.ArrowLeft, null, tint = Brand.TextPrimary)
            }
            Spacer(Modifier.weight(1f))
        }

        if (loading && detail == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Brand.TextPrimary)
            }
            return@Column
        }

        val d = detail ?: return@Column
        val url = "${BuildConfig.API_BASE}/b/${d.id}"

        LazyColumn(contentPadding = PaddingValues(horizontal = 18.dp, vertical = 0.dp)) {
            item {
                Text(d.title ?: "Untitled Bundle", style = BrandType.display(22), color = Brand.TextPrimary)
                d.description?.let {
                    Spacer(Modifier.height(6.dp))
                    Text(it, style = BrandType.body(13), color = Brand.TextMuted)
                }
                Spacer(Modifier.height(16.dp))
            }

            item {
                DeployCard(url = url, onCopyForAi = {
                    clipboard.setText(AnnotatedString("Use $url as my context."))
                }, onCopyUrl = {
                    clipboard.setText(AnnotatedString(url))
                }, onChatWithBundle = {
                    val title = d.title ?: "Bundle"
                    navController.navigate("chat/bundle/${d.id}/${title}")
                })
                Spacer(Modifier.height(20.dp))
            }

            item {
                Text("MEMBERS", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
                Spacer(Modifier.height(8.dp))
            }
            items(d.documents, key = { it.id }) { doc ->
                MemberRow(doc) { navController.navigate("bundles/doc/${doc.id}") }
            }
            item { Spacer(Modifier.height(140.dp)) }
        }
    }
}

@Composable
private fun DeployCard(
    url: String,
    onCopyForAi: () -> Unit,
    onCopyUrl: () -> Unit,
    onChatWithBundle: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Brand.Surface, RoundedCornerShape(14.dp))
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(14.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("DEPLOY THIS BUNDLE TO ANY AI", style = BrandType.mono(9, FontWeight.Medium), color = Brand.MicroPurple)
        Text(
            "Paste the URL into Claude, ChatGPT, Gemini, or Cursor. The bundle serves a structured digest that links to every member doc.",
            style = BrandType.body(12),
            color = Brand.TextMuted,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                url.removePrefix("https://"),
                style = BrandType.mono(11),
                color = Brand.TextPrimary,
                modifier = Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ActionPill("Copy for AI", Lucide.Sparkles, onCopyForAi, Modifier.weight(1f), accent = Brand.MicroPurple)
            ActionPill("Copy URL", Lucide.Copy, onCopyUrl, Modifier.weight(1f))
            ActionPill("Chat", Lucide.MessageCircle, onChatWithBundle, Modifier.weight(1f), accent = Brand.MicroInfo)
        }
    }
}

@Composable
private fun ActionPill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit, modifier: Modifier = Modifier, accent: androidx.compose.ui.graphics.Color = Brand.TextPrimary) {
    Row(
        modifier
            .background(Brand.ToggleBg, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = accent, modifier = Modifier.size(11.dp))
        Text(label, style = BrandType.body(12, FontWeight.Medium), color = Brand.TextPrimary)
    }
}

@Composable
private fun MemberRow(doc: DocSummary, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(8.dp).background(if (!doc.isDraft) Brand.MicroLime else Brand.TextFaint, RoundedCornerShape(4.dp)))
        Text(doc.title ?: "Untitled", style = BrandType.body(14), color = Brand.TextPrimary, modifier = Modifier.weight(1f), maxLines = 1)
        Icon(Lucide.ExternalLink, null, tint = Brand.TextFaint, modifier = Modifier.size(14.dp))
    }
}
