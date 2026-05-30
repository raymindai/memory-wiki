/*
 * ChatScreen — port of iOS ChatSheet.swift.
 *
 *   Header        2-line: mono 9 SCOPE label (HUB / BUNDLE /
 *                 DOCUMENT) in microInfo + display 20 title +
 *                 30dp glass xmark close
 *   Empty hint    'Try' label + 3 prompts as Sparkles + body 14
 *                 buttons that fill the input
 *   User bubble   right-aligned 44dp leading spacer, body 14,
 *                 ultraThinMaterial Capsule + borderDim
 *   Assistant     'ASSISTANT' mono 8 caption above markdown body
 *                 with [doc:id] citation chips on a separate row
 *   Thinking      ProgressView 0.6x microInfo + 'Thinking…' mono 10
 *                 0.6 tracking while sending && partial empty
 *   Composer      vertical TextField in Brand.surface capsule,
 *                 keyboard dismiss button (only when focused),
 *                 42dp ink Send circle, top hairline divider
 */

package wiki.memory.memorywiki.ui.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.composables.icons.lucide.*
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.lifecycle.HiltViewModel
import io.noties.markwon.Markwon
import javax.inject.Inject
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

data class ChatScopeId(val kind: String, val id: String, val title: String) {
    fun toScope(): ChatScope = when (kind) {
        "hub" -> ChatScope.Hub(id, title)
        "bundle" -> ChatScope.Bundle(id, title)
        else -> ChatScope.Doc(id, title)
    }

    fun scopeLabel(): String = when (kind) {
        "hub" -> "HUB"
        "bundle" -> "BUNDLE"
        else -> "DOCUMENT"
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
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun send(scope: ChatScope, prompt: String) = viewModelScope.launch {
        val history = _messages.value
        _messages.value = history + ChatMessage("user", prompt) + ChatMessage("assistant", "")
        _streaming.value = true
        _error.value = null
        var partial = ""
        runCatching {
            api.streamChat(scope, prompt, history).collect { chunk ->
                partial += chunk
                _messages.value = _messages.value.dropLast(1) + ChatMessage("assistant", partial)
            }
        }.onFailure {
            _error.value = it.message ?: "Chat failed"
            _messages.value = _messages.value.dropLast(1)
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
    val error by vm.error.collectAsState()
    var input by remember { mutableStateOf("") }
    val ime = LocalSoftwareKeyboardController.current
    val haptics = LocalHapticFeedback.current
    val listState = rememberLazyListState()
    var focused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }
    LaunchedEffect(messages.lastOrNull()?.content?.length) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Brand.Background)
            .padding(top = 44.dp),
    ) {
        Header(
            scopeLabel = scopeId.scopeLabel(),
            title = scopeId.title,
            onClose = { navController.popBackStack() },
        )

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            if (messages.isEmpty() && !streaming) {
                item {
                    EmptyHint(onPick = {
                        input = it
                        focusRequester.requestFocus()
                    })
                }
            }
            items(messages.size) { idx ->
                val m = messages[idx]
                if (m.role == "user") UserBubble(m.content)
                else AssistantBubble(
                    content = m.content,
                    markwon = markwon,
                    docCache = vm.docCache,
                    onCitationClick = { docId ->
                        navController.navigate("markdowns/doc/$docId")
                    },
                )
            }
            if (streaming && messages.lastOrNull()?.content?.isBlank() == true) {
                item { ThinkingIndicator() }
            }
            error?.let { msg ->
                item { ErrorRow(msg) }
            }
        }

        Composer(
            input = input,
            onChange = { input = it },
            focused = focused,
            focusRequester = focusRequester,
            onFocusChanged = { focused = it },
            streaming = streaming,
            onSend = {
                val p = input.trim()
                if (p.isNotEmpty()) {
                    input = ""
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    vm.send(scopeId.toScope(), p)
                }
            },
            onDismissKeyboard = { ime?.hide() },
        )
    }
}

// ─────────────────────── Header ───────────────────────

@Composable
private fun Header(scopeLabel: String, title: String, onClose: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(top = 18.dp, bottom = 14.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                scopeLabel,
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.MicroInfo,
            )
            Text(
                title,
                style = BrandType.display(20),
                color = Brand.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(Brand.SheetBg.copy(alpha = 0.75f))
                .clickable { onClose() },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.X, null, tint = Brand.TextFaint, modifier = Modifier.size(12.dp))
        }
    }
}

// ─────────────────────── Empty hint ───────────────────────

@Composable
private fun EmptyHint(onPick: (String) -> Unit) {
    val haptics = LocalHapticFeedback.current
    Column(
        Modifier.fillMaxWidth().padding(top = 32.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            "Try",
            style = BrandType.mono(9, FontWeight.Medium),
            color = Brand.TextFaint,
        )
        listOf(
            "What have I been thinking about lately?",
            "Summarise this in three bullets.",
            "What's the strongest argument across these notes?",
        ).forEach { prompt ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Brand.SheetBg.copy(alpha = 0.75f))
                    .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(14.dp))
                    .clickable {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onPick(prompt)
                    }
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(Lucide.Sparkles, null, tint = Brand.MicroInfo, modifier = Modifier.size(11.dp))
                Text(prompt, style = BrandType.body(14), color = Brand.TextPrimary)
            }
        }
    }
}

// ─────────────────────── Bubbles ───────────────────────

@Composable
private fun UserBubble(content: String) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End,
    ) {
        Spacer(Modifier.width(44.dp))
        Text(
            content,
            style = BrandType.body(14),
            color = Brand.TextPrimary,
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(Brand.SheetBg.copy(alpha = 0.75f))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(50))
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
    Column(
        Modifier.fillMaxWidth().padding(end = 24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "ASSISTANT",
            style = BrandType.mono(8, FontWeight.Medium),
            color = Brand.TextFaint,
        )
        MarkdownBody(
            markdown = stripCitations(content),
            markwon = markwon,
            modifier = Modifier.fillMaxWidth(),
        )
        val citationIds = citationRegex.findAll(content).map { it.groupValues[1] }.toList().distinct()
        if (citationIds.isNotEmpty()) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                citationIds.take(4).forEach { id ->
                    DocCitationChip(id, docCache, onClick = { onCitationClick(id) })
                }
            }
        }
    }
}

@Composable
private fun ThinkingIndicator() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(10.dp),
            color = Brand.MicroInfo,
            strokeWidth = 1.4.dp,
        )
        Text(
            "Thinking…",
            style = BrandType.mono(10, FontWeight.Medium),
            color = Brand.TextFaint,
        )
    }
}

@Composable
private fun ErrorRow(msg: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.MicroRed.copy(alpha = 0.10f))
            .border(1.dp, Brand.MicroRed.copy(alpha = 0.40f), RoundedCornerShape(10.dp))
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Lucide.TriangleAlert, null, tint = Brand.MicroRed, modifier = Modifier.size(11.dp))
        Text(msg, style = BrandType.body(12), color = Brand.TextPrimary)
    }
}

private val citationRegex = Regex("""\[doc:([A-Za-z0-9_-]{6,16})]""")
private fun stripCitations(s: String) = s.replace(citationRegex, "")

@Composable
fun DocCitationChip(id: String, docCache: DocCache, onClick: () -> Unit) {
    val title = docCache.snapshot(id)?.title ?: id
    LaunchedEffect(id) { docCache.prefetch(id) }
    Row(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.MicroInfo.copy(alpha = 0.4f), RoundedCornerShape(50))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(Lucide.FileText, null, tint = Brand.MicroInfo, modifier = Modifier.size(10.dp))
        Text(
            title,
            style = BrandType.body(12, FontWeight.Medium),
            color = Brand.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// ─────────────────────── Composer ───────────────────────

@Composable
private fun Composer(
    input: String,
    onChange: (String) -> Unit,
    focused: Boolean,
    focusRequester: FocusRequester,
    onFocusChanged: (Boolean) -> Unit,
    streaming: Boolean,
    onSend: () -> Unit,
    onDismissKeyboard: () -> Unit,
) {
    val canSend = input.isNotBlank() && !streaming
    val haptics = LocalHapticFeedback.current
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(Brand.BorderDim))
        Row(
            Modifier
                .fillMaxWidth()
                .background(Brand.Background.copy(alpha = 0.85f))
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .imePadding(),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(50))
                    .background(Brand.Surface)
                    .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(50))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                BasicTextField(
                    value = input,
                    onValueChange = onChange,
                    maxLines = 6,
                    textStyle = BrandType.body(14).copy(color = Brand.TextPrimary),
                    cursorBrush = SolidColor(Brand.TextPrimary),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Send,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(focusRequester)
                        .onFocusChanged { onFocusChanged(it.isFocused) },
                    decorationBox = { inner ->
                        Box {
                            if (input.isBlank()) {
                                Text(
                                    "Ask anything…",
                                    style = BrandType.body(14),
                                    color = Brand.TextFaint,
                                )
                            }
                            inner()
                        }
                    },
                )
            }
            // Keyboard dismiss only when input is focused.
            AnimatedVisibility(
                visible = focused,
                enter = fadeIn(tween(180)) + scaleIn(tween(180)),
                exit = fadeOut(tween(120)) + scaleOut(tween(120)),
            ) {
                Box(
                    Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Brand.Surface)
                        .clickable {
                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onDismissKeyboard()
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Lucide.ChevronDown,
                        null,
                        tint = Brand.TextMuted,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
            val sendBg = if (canSend || streaming) Brand.TextPrimary else Brand.Surface
            val sendTint = if (canSend || streaming) Brand.Background else Brand.TextFaint
            Box(
                Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(sendBg)
                    .clickable(
                        enabled = canSend,
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onSend,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Lucide.ArrowUp,
                    null,
                    tint = sendTint,
                    modifier = Modifier.size(15.dp),
                )
            }
        }
    }
}
