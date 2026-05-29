/*
 * ChatScreen — streaming chat over Hub / Bundle / Doc scope.
 * Backed by Claude Haiku 4.5 (server-side model choice).
 *
 *  - Scope chip top-left (HUB / BUNDLE / DOC) + title + close
 *  - Lazy column transcript with user / assistant bubbles
 *  - Assistant bubbles render markdown via MarkdownBody
 *  - [doc:<id>] citation chips resolve titles via DocCache
 *  - Glass capsule composer + ink Send + keyboard dismiss
 */

package wiki.memory.memorywiki.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.KeyboardHide
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
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
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.ChatScope
import wiki.memory.memorywiki.data.DocCache
import wiki.memory.memorywiki.data.model.ChatMessage
import wiki.memory.memorywiki.di.MarkwonEntryPoint
import wiki.memory.memorywiki.ui.markdown.MarkdownBody
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import javax.inject.Inject

data class ChatScopeId(val kind: String, val id: String, val title: String) {
    fun toScope(): ChatScope = when (kind) {
        "hub" -> ChatScope.Hub(id, title)
        "bundle" -> ChatScope.Bundle(id, title)
        else -> ChatScope.Doc(id, title)
    }
}

@HiltViewModel
class ChatViewModel @Inject constructor(
    val api: ApiClient,
    val docCache: DocCache,
) : ViewModel() {
    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()
    private val _streaming = MutableStateFlow(false)
    val streaming: StateFlow<Boolean> = _streaming.asStateFlow()

    fun send(scope: ChatScope, prompt: String) = viewModelScope.launch {
        val history = _messages.value
        _messages.value = history + ChatMessage("user", prompt) + ChatMessage("assistant", "")
        _streaming.value = true
        var partial = ""
        runCatching {
            api.streamChat(scope, prompt, history).collect { chunk ->
                partial += chunk
                _messages.value = _messages.value.dropLast(1) + ChatMessage("assistant", partial)
            }
        }.onFailure {
            _messages.value = _messages.value.dropLast(1) + ChatMessage("assistant", "[Error: ${it.message}]")
        }
        _streaming.value = false
    }
}

@Composable
fun ChatScreen(
    navController: NavController,
    scopeId: ChatScopeId,
    vm: ChatViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val markwon = remember(context) {
        EntryPointAccessors.fromApplication(context.applicationContext, MarkwonEntryPoint::class.java).markwon()
    }
    val messages by vm.messages.collectAsState()
    val streaming by vm.streaming.collectAsState()
    var input by remember { mutableStateOf("") }
    val ime = LocalSoftwareKeyboardController.current
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Column(Modifier.fillMaxSize().background(Brand.Background).padding(top = 44.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                scopeId.kind.uppercase(),
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.MicroInfo,
                modifier = Modifier
                    .background(Brand.MicroInfo.copy(alpha = 0.10f), RoundedCornerShape(4.dp))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
            Text(scopeId.title, style = BrandType.display(18), color = Brand.TextPrimary, modifier = Modifier.weight(1f))
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Icons.Outlined.Close, null, tint = Brand.TextMuted)
            }
        }

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (messages.isEmpty()) {
                item { Suggestions(onPick = { input = it }) }
            }
            items(messages.size) { idx ->
                val m = messages[idx]
                if (m.role == "user") UserBubble(m.content)
                else AssistantBubble(m.content, markwon, vm.docCache, onCitationClick = { docId ->
                    navController.navigate("markdowns/doc/$docId")
                })
            }
            if (streaming && messages.lastOrNull()?.content?.isBlank() == true) {
                item { Text("Thinking…", style = BrandType.body(13), color = Brand.TextFaint) }
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .imePadding()
                .padding(bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                Modifier
                    .weight(1f)
                    .background(Brand.Surface, RoundedCornerShape(22.dp))
                    .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(22.dp))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                BasicTextField(
                    value = input,
                    onValueChange = { input = it },
                    textStyle = BrandType.body(14).copy(color = Brand.TextPrimary),
                    cursorBrush = SolidColor(Brand.TextPrimary),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Send),
                    decorationBox = { inner ->
                        if (input.isBlank()) Text("Ask anything…", style = BrandType.body(14), color = Brand.TextFaint)
                        inner()
                    },
                )
            }
            IconButton(onClick = { ime?.hide() }) {
                Icon(Icons.Outlined.KeyboardHide, null, tint = Brand.TextMuted)
            }
            IconButton(
                onClick = {
                    val p = input.trim()
                    if (p.isNotEmpty()) {
                        input = ""
                        vm.send(scopeId.toScope(), p)
                    }
                },
                enabled = input.isNotBlank() && !streaming,
                modifier = Modifier
                    .size(42.dp)
                    .background(
                        color = if (input.isBlank()) Brand.Surface else Brand.TextPrimary,
                        shape = RoundedCornerShape(21.dp),
                    ),
            ) {
                Icon(
                    Icons.Outlined.ArrowUpward,
                    null,
                    tint = if (input.isBlank()) Brand.TextFaint else Brand.Background,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

@Composable
private fun UserBubble(content: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Text(
            content,
            style = BrandType.body(14),
            color = Brand.Background,
            modifier = Modifier
                .background(Brand.TextPrimary, RoundedCornerShape(18.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun AssistantBubble(
    content: String,
    markwon: Markwon,
    docCache: DocCache,
    onCitationClick: (String) -> Unit,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        MarkdownBody(markdown = stripCitations(content), markwon = markwon, modifier = Modifier.fillMaxWidth())
        val citationIds = citationRegex.findAll(content).map { it.groupValues[1] }.toList().distinct()
        if (citationIds.isNotEmpty()) {
            Row(
                Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                citationIds.forEach { id ->
                    DocCitationChip(id, docCache, onClick = { onCitationClick(id) })
                }
            }
        }
    }
}

private val citationRegex = Regex("""\[doc:([A-Za-z0-9_-]{6,16})]""")
private fun stripCitations(s: String) = s.replace(citationRegex, "")

@Composable
fun DocCitationChip(id: String, docCache: DocCache, onClick: () -> Unit) {
    // Resolve title via DocCache snapshot; fall back to id while
    // the prefetch fetch is in flight. The prefetch call kicks off a
    // background refetch so the chip's title updates a beat later
    // (DocCache bumps `changes` which the surrounding LazyColumn
    // observes through its own state — for chat we accept a brief
    // id-as-title fallback rather than ladder another state hop).
    val title = docCache.snapshot(id)?.title ?: id
    LaunchedEffect(id) { docCache.prefetch(id) }
    Row(
        Modifier
            .background(Brand.Surface, RoundedCornerShape(8.dp))
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.size(6.dp).background(Brand.MicroInfo, RoundedCornerShape(3.dp)))
        Text(title, style = BrandType.mono(10), color = Brand.TextPrimary, maxLines = 1)
    }
}

@Composable
private fun Suggestions(onPick: (String) -> Unit) {
    val items = listOf(
        "What have I been thinking about lately?",
        "Summarise this in three bullets.",
        "What's the strongest argument across these notes?",
    )
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 20.dp)) {
        Text("Try", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
        items.forEach { item ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Brand.Surface, RoundedCornerShape(10.dp))
                    .clickable { onPick(item) }
                    .padding(horizontal = 12.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Box(Modifier.size(8.dp).background(Brand.MicroInfo, RoundedCornerShape(4.dp)))
                Text(item, style = BrandType.body(13), color = Brand.TextPrimary)
            }
        }
    }
}
