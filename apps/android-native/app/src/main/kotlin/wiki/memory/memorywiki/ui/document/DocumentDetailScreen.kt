/*
 * DocumentDetailScreen — read-only viewer for non-owner / signed-out
 * visitors; the editor surface lives on web. Header: title, status
 * icon, URL chip, view count, source badge. Body: MarkdownBody.
 *
 * Owner brand override — non-owner visitors get the owner's accent
 * applied via MemoryWikiTheme(ownerAccentOverride = …) wrapper.
 */

package wiki.memory.memorywiki.ui.document

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.Ellipsis
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Sparkles
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.lifecycle.HiltViewModel
import io.noties.markwon.Markwon
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.DocCache
import wiki.memory.memorywiki.data.model.DocumentDetail
import wiki.memory.memorywiki.di.MarkwonEntryPoint
import wiki.memory.memorywiki.ui.markdown.MarkdownBody
import androidx.compose.ui.platform.LocalContext
import wiki.memory.memorywiki.ui.theme.AccentColorChoice
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import wiki.memory.memorywiki.ui.theme.MemoryWikiTheme
import javax.inject.Inject

@HiltViewModel
class DocumentDetailViewModel @Inject constructor(
    val api: ApiClient,
    val cache: DocCache,
) : ViewModel() {
    private val _detail = MutableStateFlow<DocumentDetail?>(null)
    val detail: StateFlow<DocumentDetail?> = _detail.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    fun load(id: String) = viewModelScope.launch {
        // Stale-while-revalidate via DocCache
        _detail.value = cache.prefetch(id) ?: _detail.value
        _loading.value = _detail.value == null
        runCatching { cache.fetchAndCache(id) }.onSuccess {
            _detail.value = it
            _loading.value = false
        }
    }
}

@Composable
fun DocumentDetailScreen(
    navController: NavController,
    docId: String,
    vm: DocumentDetailViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val markwon = remember(context) {
        EntryPointAccessors.fromApplication(context.applicationContext, MarkwonEntryPoint::class.java).markwon()
    }
    val detail by vm.detail.collectAsState()
    val loading by vm.loading.collectAsState()
    val clipboard = LocalClipboardManager.current
    var menuOpen by remember { mutableStateOf(false) }

    LaunchedEffect(docId) { vm.load(docId) }

    val ownerAccent = detail
        ?.takeIf { !it.isOwner }
        ?.ownerAccent
        ?.let { AccentColorChoice.from(it) }

    MemoryWikiTheme(ownerAccentOverride = ownerAccent) {
        Column(Modifier.fillMaxSize().padding(top = 44.dp)) {
            // Top bar
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Lucide.ArrowLeft, null, tint = Brand.TextPrimary)
                }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = { menuOpen = true }) {
                    Icon(Lucide.Ellipsis, null, tint = Brand.TextPrimary)
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(text = { Text("Chat with this doc") }, onClick = {
                        menuOpen = false
                        val title = detail?.title ?: "Document"
                        navController.navigate("chat/doc/$docId/$title")
                    })
                    DropdownMenuItem(text = { Text("Copy as AI prompt") }, onClick = {
                        menuOpen = false
                        val url = "${BuildConfig.API_BASE}/$docId"
                        clipboard.setText(AnnotatedString("Use $url as my context."))
                    })
                    DropdownMenuItem(text = { Text("Copy URL") }, onClick = {
                        menuOpen = false
                        clipboard.setText(AnnotatedString("${BuildConfig.API_BASE}/$docId"))
                    })
                }
            }

            if (loading && detail == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Brand.TextPrimary, strokeWidth = 1.6.dp)
                }
                return@MemoryWikiTheme
            }
            val d = detail ?: return@MemoryWikiTheme
            val url = "${BuildConfig.API_BASE.removeSuffix("/")}/$docId"

            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 18.dp)
                    .padding(bottom = 140.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(d.title ?: "Untitled", style = BrandType.display(22), color = Brand.TextPrimary)
                Row(
                    Modifier
                        .background(Brand.Surface, RoundedCornerShape(8.dp))
                        .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(url.removePrefix("https://"), style = BrandType.mono(11), color = Brand.TextSecondary)
                    Spacer(Modifier.weight(1f))
                    Pill("Copy for AI", Lucide.Sparkles) {
                        clipboard.setText(AnnotatedString("Use $url as my context."))
                    }
                }
                d.ownerEmail?.takeIf { !d.isOwner }?.let {
                    Text("Shared by $it", style = BrandType.body(11), color = Brand.TextFaint)
                }
                Spacer(Modifier.height(4.dp))
                MarkdownBody(markdown = d.markdown, markwon = markwon)
            }
        }
    }
}

@Composable
private fun Pill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Row(
        Modifier
            .background(Brand.ToggleBg, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = Brand.TextPrimary, modifier = Modifier.size(10.dp))
        Text(label, style = BrandType.body(11, FontWeight.Medium), color = Brand.TextPrimary)
    }
}
