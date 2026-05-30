/*
 * DocumentDetailScreen — port of iOS DocumentDetailView.swift.
 *
 *   Top bar       back + ellipsis overflow Menu
 *                   - Chat with this doc
 *                   - Copy as AI prompt
 *                   - Copy URL
 *                   - Share…
 *                   - Open on memory.wiki
 *   Header        display 26 title (no leading glyph) + URL strip
 *                 with DocStatusIcon + mono URL + Copy-for-AI pill
 *                 (sparkles → check 1.4s)
 *   Meta strip    14dp-spaced row of (icon 9 + mono 10 medium 0.3
 *                 tracking) pairs: clock+compactTime, lock/globe,
 *                 sync source, eye+viewCount
 *   Body          MarkdownBody via Markwon
 *
 *   Owner brand override — non-owner visitors see the doc rendered
 *   with the OWNER's accent so their @-mention chrome is honored.
 */

package wiki.memory.memorywiki.ui.document

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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
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
import com.composables.icons.lucide.ArrowLeft
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.Clock
import com.composables.icons.lucide.Ellipsis
import com.composables.icons.lucide.Eye
import com.composables.icons.lucide.Globe
import com.composables.icons.lucide.Lock
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.RefreshCw
import com.composables.icons.lucide.Sparkles
import com.composables.icons.lucide.Users
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.DocCache
import wiki.memory.memorywiki.data.model.DocumentDetail
import wiki.memory.memorywiki.di.MarkwonEntryPoint
import wiki.memory.memorywiki.ui.components.DocStatusIcon
import wiki.memory.memorywiki.ui.markdown.MarkdownBody
import wiki.memory.memorywiki.ui.theme.AccentColorChoice
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import wiki.memory.memorywiki.ui.theme.MemoryWikiTheme
import wiki.memory.memorywiki.util.compactTime

@HiltViewModel
class DocumentDetailViewModel @Inject constructor(
    val api: ApiClient,
    val cache: DocCache,
    val pinned: wiki.memory.memorywiki.data.PinnedStore,
) : ViewModel() {
    private val _detail = MutableStateFlow<DocumentDetail?>(null)
    val detail: StateFlow<DocumentDetail?> = _detail.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    private val _saving = MutableStateFlow(false)
    val saving: StateFlow<Boolean> = _saving.asStateFlow()

    fun load(id: String) = viewModelScope.launch {
        _detail.value = cache.prefetch(id) ?: _detail.value
        _loading.value = _detail.value == null
        runCatching { cache.fetchAndCache(id) }
            .onSuccess { _detail.value = it; _loading.value = false; _error.value = null }
            .onFailure {
                _loading.value = false
                if (_detail.value == null) _error.value = it.message ?: "Couldn't load this doc."
            }
    }

    fun save(id: String, markdown: String, onDone: (Boolean) -> Unit) = viewModelScope.launch {
        _saving.value = true
        val ok = runCatching { api.updateDocument(id, markdown) }.isSuccess
        if (ok) {
            _detail.value = _detail.value?.copy(markdown = markdown)
        }
        _saving.value = false
        onDone(ok)
    }

    fun setVisibility(id: String, makePublic: Boolean) = viewModelScope.launch {
        runCatching { api.setDocumentVisibility(id, makePublic) }.onSuccess {
            _detail.value = _detail.value?.copy(isDraft = !makePublic)
        }
    }

    fun delete(id: String, onDone: (Boolean) -> Unit) = viewModelScope.launch {
        val ok = runCatching { api.deleteDocument(id) }.isSuccess
        onDone(ok)
    }
}

@Composable
fun DocumentDetailScreen(
    navController: NavController,
    docId: String,
    vm: DocumentDetailViewModel = hiltViewModel(),
) {
    val ctx = LocalContext.current
    val markwon = remember(ctx) {
        EntryPointAccessors
            .fromApplication(ctx.applicationContext, MarkwonEntryPoint::class.java)
            .markwon()
    }
    val detail by vm.detail.collectAsState()
    val loading by vm.loading.collectAsState()
    val errorMsg by vm.error.collectAsState()
    val saving by vm.saving.collectAsState()
    val pinnedIds by vm.pinned.docIds.collectAsState()
    val clipboard = LocalClipboardManager.current
    val haptics = LocalHapticFeedback.current
    var menuOpen by remember { mutableStateOf(false) }
    var copied by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var editedMarkdown by remember { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }
    LaunchedEffect(copied) {
        if (copied) { delay(1400); copied = false }
    }

    LaunchedEffect(docId) { vm.load(docId) }
    val isPinnedHere = docId in pinnedIds

    val ownerAccent = detail
        ?.takeIf { !it.isOwner }
        ?.ownerAccent
        ?.let { AccentColorChoice.from(it) }

    MemoryWikiTheme(ownerAccentOverride = ownerAccent) {
        Column(Modifier.fillMaxSize().padding(top = 44.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (editing) {
                    Text(
                        "Cancel",
                        style = BrandType.body(14, FontWeight.Medium),
                        color = Brand.TextMuted,
                        modifier = Modifier
                            .clickable { editing = false }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        if (saving) "Saving…" else "Save",
                        style = BrandType.body(14, FontWeight.SemiBold),
                        color = if (saving) Brand.TextFaint else Brand.TextPrimary,
                        modifier = Modifier
                            .clickable(enabled = !saving) {
                                vm.save(docId, editedMarkdown) { ok ->
                                    if (ok) editing = false
                                }
                            }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    )
                } else {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Lucide.ArrowLeft, null, tint = Brand.TextPrimary)
                    }
                    Spacer(Modifier.weight(1f))
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Lucide.Ellipsis, null, tint = Brand.TextPrimary)
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        val url = "${BuildConfig.API_BASE.removeSuffix("/")}/$docId"
                        val d = detail
                        if (d?.isOwner == true) {
                            DropdownMenuItem(text = { Text("Edit") }, onClick = {
                                menuOpen = false
                                editedMarkdown = d.markdown
                                editing = true
                            })
                        }
                        DropdownMenuItem(
                            text = { Text(if (isPinnedHere) "Unstar" else "Star") },
                            onClick = { menuOpen = false; vm.pinned.toggleDoc(docId) },
                        )
                        DropdownMenuItem(
                            text = { Text("Chat with this doc") },
                            onClick = {
                                menuOpen = false
                                val title = detail?.title ?: "Document"
                                navController.navigate("chat/doc/$docId/$title")
                            },
                        )
                        DropdownMenuItem(text = { Text("Copy as AI prompt") }, onClick = {
                            menuOpen = false
                            clipboard.setText(AnnotatedString("Use $url as my context."))
                        })
                        DropdownMenuItem(text = { Text("Copy URL") }, onClick = {
                            menuOpen = false
                            clipboard.setText(AnnotatedString(url))
                        })
                        DropdownMenuItem(text = { Text("Share…") }, onClick = {
                            menuOpen = false
                            shareDocUrl(ctx, url)
                        })
                        if (d?.isOwner == true) {
                            DropdownMenuItem(
                                text = {
                                    Text(if (d.isDraft) "Make public" else "Make private")
                                },
                                onClick = { menuOpen = false; vm.setVisibility(docId, makePublic = d.isDraft) },
                            )
                        }
                        DropdownMenuItem(text = { Text("Open on memory.wiki") }, onClick = {
                            menuOpen = false
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
                        })
                        if (d?.isOwner == true) {
                            DropdownMenuItem(
                                text = { Text("Delete", color = Brand.MicroRed) },
                                onClick = { menuOpen = false; confirmDelete = true },
                            )
                        }
                    }
                }
            }

            if (loading && detail == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Brand.TextPrimary, strokeWidth = 1.6.dp)
                }
                return@MemoryWikiTheme
            }
            if (errorMsg != null && detail == null) {
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(horizontal = 22.dp, vertical = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        "Couldn't load this doc.",
                        style = BrandType.body(14, FontWeight.Medium),
                        color = Brand.TextPrimary,
                    )
                    Text(errorMsg ?: "", style = BrandType.body(12), color = Brand.TextMuted)
                    Text(
                        "Retry",
                        style = BrandType.body(13, FontWeight.Medium),
                        color = Brand.TextPrimary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(Brand.Surface)
                            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(50))
                            .clickable { vm.load(docId) }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                    )
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
                    .padding(top = 12.dp, bottom = 140.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    d.title ?: "Untitled",
                    style = BrandType.display(26),
                    color = Brand.TextPrimary,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
                UrlStrip(
                    url = url,
                    detail = d,
                    copied = copied,
                    onCopyAi = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        clipboard.setText(AnnotatedString("Use $url as my context."))
                        copied = true
                    },
                )
                MetaStrip(d)
                Box(Modifier.fillMaxWidth().height(0.5.dp).background(Brand.BorderDim))

                d.ownerEmail?.takeIf { !d.isOwner }?.let {
                    Text(
                        "Shared by $it",
                        style = BrandType.body(11),
                        color = Brand.TextFaint,
                    )
                }

                if (editing) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            "EDITING (MARKDOWN)",
                            style = BrandType.mono(9, FontWeight.Medium),
                            color = Brand.TextFaint,
                        )
                        androidx.compose.foundation.text.BasicTextField(
                            value = editedMarkdown,
                            onValueChange = { editedMarkdown = it },
                            textStyle = BrandType.mono(13).copy(color = Brand.TextPrimary),
                            cursorBrush = androidx.compose.ui.graphics.SolidColor(Brand.TextPrimary),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 360.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Brand.SheetBg.copy(alpha = 0.75f))
                                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
                                .padding(12.dp),
                        )
                    }
                } else if (d.markdown.isBlank()) {
                    Text(
                        "This doc is empty.",
                        style = BrandType.body(14),
                        color = Brand.TextFaint,
                    )
                } else {
                    MarkdownBody(markdown = d.markdown, markwon = markwon)
                }
            }

            // Delete confirmation dialog
            if (confirmDelete) {
                androidx.compose.material3.AlertDialog(
                    onDismissRequest = { confirmDelete = false },
                    title = { Text("Delete this doc?") },
                    text = {
                        Text(
                            "It moves to Trash on memory.wiki — recoverable for 30 days.",
                            style = BrandType.body(13),
                            color = Brand.TextMuted,
                        )
                    },
                    confirmButton = {
                        Text(
                            "Delete",
                            style = BrandType.body(14, FontWeight.SemiBold),
                            color = Brand.MicroRed,
                            modifier = Modifier
                                .clickable {
                                    confirmDelete = false
                                    vm.delete(docId) { ok ->
                                        if (ok) navController.popBackStack()
                                    }
                                }
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                        )
                    },
                    dismissButton = {
                        Text(
                            "Cancel",
                            style = BrandType.body(14, FontWeight.Medium),
                            color = Brand.TextMuted,
                            modifier = Modifier
                                .clickable { confirmDelete = false }
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                        )
                    },
                    containerColor = Brand.SheetBg,
                )
            }
        }
    }
}

@Composable
private fun UrlStrip(url: String, detail: DocumentDetail, copied: Boolean, onCopyAi: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        DocStatusIcon(
            isDraft = detail.isDraft,
            isRestricted = detail.allowedEmails.isNotEmpty(),
            syncedSource = detail.source?.takeIf { it != "ai" && it != "web" },
            sizeDp = 14,
        )
        Text(
            url.removePrefix("https://"),
            style = BrandType.mono(11),
            color = Brand.TextMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Row(
            Modifier
                .clip(RoundedCornerShape(50))
                .background(Brand.SheetBg.copy(alpha = 0.75f))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(50))
                .clickable { onCopyAi() }
                .padding(horizontal = 10.dp, vertical = 6.dp),
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
                style = BrandType.body(11, FontWeight.Medium),
                color = Brand.TextPrimary,
            )
        }
    }
}

@Composable
private fun MetaStrip(d: DocumentDetail) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        MetaBit(Lucide.Clock, compactTime(d.updatedAt), Brand.TextFaint)
        val (visIcon, visText) = when {
            !d.isDraft && d.allowedEmails.isNotEmpty() -> Lucide.Users to "shared"
            !d.isDraft -> Lucide.Globe to "public"
            else -> Lucide.Lock to "private"
        }
        MetaBit(visIcon, visText, Brand.TextFaint)
        d.source?.takeIf { it != "ai" && it != "web" }?.let { src ->
            MetaBit(Lucide.RefreshCw, src.uppercase(), Brand.MicroInfo)
        }
        if (d.viewCount > 0) {
            MetaBit(Lucide.Eye, d.viewCount.toString(), Brand.TextFaint)
        }
        Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun MetaBit(icon: ImageVector, text: String, tint: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(9.dp))
        Text(text, style = BrandType.mono(10, FontWeight.Medium), color = tint)
    }
}

private fun shareDocUrl(context: android.content.Context, url: String) {
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
