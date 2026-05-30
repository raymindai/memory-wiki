/*
 * BundleDetailScreen — port of iOS BundleDetailView.swift.
 *
 *   Top bar       back + ellipsis overflow Menu (Chat / Copy AI /
 *                 Copy URL / Share / Open on web)
 *   Header        22dp stack glyph + display 26 title
 *   Description   body 14 muted lineHeight 4 when present
 *   Deploy card   "DEPLOY THIS BUNDLE TO ANY AI" mono header +
 *                 explainer + inner mono URL pill with vertical
 *                 divider + Copy-for-AI swap (sparkles → check
 *                 1.4s). All wrapped in surface@50% + borderDim
 *                 outer card.
 *   Members       "MEMBERS" mono label + count + MemberRow per doc
 *                 (DocStatusIcon + title + compactTime + chevron)
 *   Pull-to-refresh + bottom 50dp safe inset
 */

package wiki.memory.memorywiki.ui.bundles

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.BundleDetail
import wiki.memory.memorywiki.data.model.DocSummary
import wiki.memory.memorywiki.ui.components.DocStatusIcon
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import wiki.memory.memorywiki.util.compactTime

@HiltViewModel
class BundleDetailViewModel @Inject constructor(val api: ApiClient) : ViewModel() {
    private val _detail = MutableStateFlow<BundleDetail?>(null)
    val detail: StateFlow<BundleDetail?> = _detail.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    fun load(id: String, force: Boolean = false) = viewModelScope.launch {
        if (!force && _detail.value?.id == id) return@launch
        if (_detail.value == null) _loading.value = true else _refreshing.value = true
        runCatching { api.bundleDetail(id) }.onSuccess { _detail.value = it }
        _loading.value = false
        _refreshing.value = false
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
    val refreshing by vm.refreshing.collectAsState()
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    val pullState = rememberPullToRefreshState()
    var menuOpen by remember { mutableStateOf(false) }
    var copied by remember { mutableStateOf(false) }
    LaunchedEffect(copied) {
        if (copied) { delay(1400); copied = false }
    }

    LaunchedEffect(bundleId) { vm.load(bundleId) }

    val url = "${BuildConfig.API_BASE.removeSuffix("/")}/b/$bundleId"

    Column(Modifier.fillMaxSize().padding(top = 44.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Lucide.ArrowLeft, null, tint = Brand.TextPrimary)
            }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { menuOpen = true }) {
                Icon(Lucide.Ellipsis, null, tint = Brand.TextPrimary)
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                DropdownMenuItem(
                    text = { Text("Chat with this bundle") },
                    onClick = {
                        menuOpen = false
                        val title = detail?.title ?: "Bundle"
                        navController.navigate("chat/bundle/$bundleId/$title")
                    },
                )
                DropdownMenuItem(text = { Text("Copy as AI prompt") }, onClick = {
                    menuOpen = false
                    clipboard.setText(AnnotatedString("Use $url as my context bundle."))
                })
                DropdownMenuItem(text = { Text("Copy URL") }, onClick = {
                    menuOpen = false
                    clipboard.setText(AnnotatedString(url))
                })
                DropdownMenuItem(text = { Text("Share…") }, onClick = {
                    menuOpen = false
                    shareBundleUrl(context, url)
                })
                DropdownMenuItem(text = { Text("Open on memory.wiki") }, onClick = {
                    menuOpen = false
                    context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
                })
            }
        }

        if (loading && detail == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                wiki.memory.memorywiki.ui.components.BrandBlob(sizeDp = 96)
            }
            return@Column
        }
        val d = detail ?: return@Column

        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { vm.load(bundleId, force = true) },
            state = pullState,
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 18.dp)
                    .padding(top = 12.dp, bottom = 140.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                Header(title = d.title ?: "Untitled Bundle")
                d.description?.takeIf { it.isNotBlank() }?.let { desc ->
                    Text(
                        desc,
                        style = BrandType.body(14),
                        color = Brand.TextMuted,
                    )
                }
                DeployCard(
                    url = url,
                    copied = copied,
                    onCopyAi = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        clipboard.setText(AnnotatedString("Use $url as my context."))
                        copied = true
                    },
                )
                Box(Modifier.fillMaxWidth().height(0.5.dp).background(Brand.BorderDim))
                MembersSection(
                    docs = d.documents,
                    onTap = { doc ->
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        navController.navigate("bundles/doc/${doc.id}")
                    },
                )
            }
        }
    }
}

@Composable
private fun Header(title: String) {
    Row(
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            Lucide.Layers,
            null,
            tint = Brand.TextPrimary,
            modifier = Modifier
                .padding(top = 4.dp)
                .size(22.dp),
        )
        Text(
            title,
            style = BrandType.display(26),
            color = Brand.TextPrimary,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun DeployCard(url: String, copied: Boolean, onCopyAi: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Brand.Surface.copy(alpha = 0.5f))
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(Lucide.Sparkles, null, tint = Brand.TextPrimary, modifier = Modifier.size(11.dp))
            Text(
                "DEPLOY THIS BUNDLE TO ANY AI",
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.TextFaint,
            )
        }
        Text(
            "Paste the URL into Claude, ChatGPT, or Cursor. The bundle serves a structured digest that links to every member doc.",
            style = BrandType.body(13),
            color = Brand.TextMuted,
        )
        // Inner URL pill with vertical divider and Copy-for-AI swap.
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Brand.SheetBg.copy(alpha = 0.75f))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(8.dp)),
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
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            )
            Box(Modifier.width(0.5.dp).height(24.dp).background(Brand.BorderDim))
            Row(
                Modifier
                    .clickable { onCopyAi() }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    if (copied) Lucide.Check else Lucide.Sparkles,
                    null,
                    tint = Brand.TextPrimary,
                    modifier = Modifier.size(11.dp),
                )
                Text(
                    if (copied) "Copied" else "Copy for AI",
                    style = BrandType.body(12, FontWeight.Medium),
                    color = Brand.TextPrimary,
                )
            }
        }
    }
}

@Composable
private fun MembersSection(docs: List<DocSummary>, onTap: (DocSummary) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "MEMBERS",
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.TextFaint,
            )
            Spacer(Modifier.weight(1f))
            Text(
                docs.size.toString(),
                style = BrandType.mono(10),
                color = Brand.TextFaint,
            )
        }
        if (docs.isEmpty()) {
            Text(
                "This bundle is empty.",
                style = BrandType.body(13),
                color = Brand.TextFaint,
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                docs.forEach { doc ->
                    MemberRow(doc = doc, onClick = { onTap(doc) })
                }
            }
        }
    }
}

@Composable
private fun MemberRow(doc: DocSummary, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        DocStatusIcon(isDraft = doc.isDraft, sizeDp = 16)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                doc.title ?: "Untitled",
                style = BrandType.body(14, FontWeight.Medium),
                color = Brand.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                compactTime(doc.updatedAt),
                style = BrandType.mono(9),
                color = Brand.TextFaint,
            )
        }
        Icon(
            Lucide.ChevronRight,
            null,
            tint = Brand.TextFaint,
            modifier = Modifier.size(11.dp),
        )
    }
}

private fun shareBundleUrl(context: android.content.Context, url: String) {
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
