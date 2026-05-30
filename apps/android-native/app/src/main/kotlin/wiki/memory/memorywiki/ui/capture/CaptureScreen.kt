/*
 * CaptureScreen — six mode pills (Write / URL / Photo / OCR /
 * Voice / Import) above a title + body BasicTextField pair. The
 * sticky toolbar pill row sits above the IME using imePadding(),
 * mirroring iOS' UITextView + UIInputAccessoryView trick.
 *
 * Capture-paste deep link: listens for RouterEvent.CapturePaste and
 * fills the body field with the system clipboard contents.
 */

package wiki.memory.memorywiki.ui.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import com.composables.icons.lucide.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
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
import wiki.memory.memorywiki.ui.components.ProcessingBanner
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import javax.inject.Inject

enum class CaptureMode(val label: String, val icon: ImageVector) {
    Write("Write", Lucide.SquarePen),
    URL("URL", Lucide.Link),
    Photo("Photo", Lucide.Camera),
    OCR("OCR", Lucide.ScanText),
    Voice("Voice", Lucide.Mic),
    Import("Import", Lucide.FileText),
}

@HiltViewModel
class CaptureViewModel @Inject constructor(
    val api: ApiClient,
    val router: AppRouter,
) : ViewModel() {
    private val _mode = MutableStateFlow(CaptureMode.Write)
    val mode: StateFlow<CaptureMode> = _mode.asStateFlow()
    private val _title = MutableStateFlow("")
    val title: StateFlow<String> = _title.asStateFlow()
    private val _body = MutableStateFlow("")
    val body: StateFlow<String> = _body.asStateFlow()
    private val _banner = MutableStateFlow<Pair<String, String?>?>(null)
    val banner: StateFlow<Pair<String, String?>?> = _banner.asStateFlow()

    fun setMode(m: CaptureMode) { _mode.value = m }
    fun setTitle(s: String) { _title.value = s }
    fun setBody(s: String) { _body.value = s }
    fun pasteIntoBody(s: String) { _body.value = if (_body.value.isBlank()) s else _body.value + "\n\n" + s }

    private val _publishing = MutableStateFlow(false)
    val publishing: StateFlow<Boolean> = _publishing.asStateFlow()

    fun canPublish(): Boolean = !_publishing.value &&
        (_body.value.isNotBlank() || _title.value.isNotBlank())

    fun publish(onDone: (String?) -> Unit) = viewModelScope.launch {
        if (!canPublish()) { onDone(null); return@launch }
        _publishing.value = true
        runCatching {
            api.createDocument(
                markdown = _body.value.trim(),
                title = _title.value.trim().ifBlank { null },
            )
        }.onSuccess { resp ->
            _title.value = ""
            _body.value = ""
            _publishing.value = false
            onDone(resp.id)
        }.onFailure {
            _publishing.value = false
            _banner.value = "Publish failed" to (it.message ?: "")
            onDone(null)
        }
    }

    fun importUrl(url: String) = viewModelScope.launch {
        _banner.value = "Importing URL…" to "Fetching and converting to markdown"
        api.streamImportUrl(url).collect { evt ->
            when {
                evt.error != null -> _banner.value = "Import failed" to evt.error
                evt.done -> { _banner.value = null }
                evt.stage == "stage" -> _banner.value = "Importing URL…" to evt.payload
                else -> Unit
            }
        }
    }
}

@Composable
fun CaptureScreen(navController: NavController, vm: CaptureViewModel = hiltViewModel()) {
    val mode by vm.mode.collectAsState()
    val title by vm.title.collectAsState()
    val body by vm.body.collectAsState()
    val banner by vm.banner.collectAsState()
    val clipboard = LocalClipboardManager.current
    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current

    // Local TextFieldValue so the markdown pill bar can do
    // selection-aware inserts (wrap selection, prepend line,
    // place caret inside link template).
    var bodyValue by remember(body) {
        mutableStateOf(
            androidx.compose.ui.text.input.TextFieldValue(
                text = body,
                selection = androidx.compose.ui.text.TextRange(body.length),
            ),
        )
    }
    // Track whether the body field is focused so the pill bar
    // only appears when the user is actively editing.
    var bodyFocused by remember { mutableStateOf(false) }

    // Clipboard paste + share-sheet hand-off
    LaunchedEffect(Unit) {
        vm.router.events.collect { evt ->
            when (evt) {
                is RouterEvent.CapturePaste -> {
                    val text = clipboard.getText()?.text
                    if (!text.isNullOrBlank()) vm.pasteIntoBody(text)
                }
                is RouterEvent.CaptureWithBody -> {
                    vm.setMode(CaptureMode.Write)
                    evt.title?.let { vm.setTitle(it) }
                    vm.setBody(evt.body)
                }
                else -> Unit
            }
        }
    }

    val publishing by vm.publishing.collectAsState()
    val canPublish = (title.isNotBlank() || body.isNotBlank()) && !publishing

    Column(Modifier.fillMaxSize().padding(top = 56.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Capture",
                style = BrandType.display(26),
                color = Brand.TextPrimary,
                modifier = Modifier.weight(1f),
            )
            // Publish action — visible in every mode. Disabled
            // until title or body has content.
            Row(
                Modifier
                    .background(
                        color = if (canPublish) Brand.TextPrimary else Brand.Surface,
                        shape = RoundedCornerShape(50),
                    )
                    .border(
                        width = 0.5.dp,
                        color = if (canPublish) Brand.TextPrimary else Brand.BorderDim,
                        shape = RoundedCornerShape(50),
                    )
                    .clickable(enabled = canPublish) {
                        haptics.performHapticFeedback(
                            androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove,
                        )
                        vm.publish { newId ->
                            if (newId != null) {
                                // Strong tick on success so the user feels
                                // the publish landed before the screen swaps.
                                haptics.performHapticFeedback(
                                    androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress,
                                )
                                vm.router.selectTab(wiki.memory.memorywiki.AppTab.Markdowns)
                                vm.viewModelScope.launch {
                                    vm.router.emit(RouterEvent.PushDocDetail(newId))
                                }
                            }
                        }
                    }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (publishing) "Publishing…" else "Publish",
                    style = BrandType.body(13, FontWeight.Medium),
                    color = if (canPublish) Brand.Background else Brand.TextFaint,
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        ModePillRow(mode = mode, onChange = vm::setMode)
        Spacer(Modifier.height(20.dp))

        // Title (always-on)
        BasicTextField(
            value = title,
            onValueChange = vm::setTitle,
            singleLine = true,
            textStyle = BrandType.display(28).copy(color = Brand.TextPrimary),
            cursorBrush = SolidColor(Brand.TextPrimary),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
            decorationBox = { inner ->
                if (title.isEmpty()) Text(
                    "What's on your mind?",
                    style = BrandType.display(28),
                    color = Brand.TextFaint,
                )
                inner()
            },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next, keyboardType = KeyboardType.Text),
        )

        Spacer(Modifier.height(8.dp))

        // Mode-specific surface
        Box(Modifier.weight(1f).padding(horizontal = 18.dp)) {
            when (mode) {
                CaptureMode.Write -> WriteBody(
                    value = bodyValue,
                    onChange = { newValue ->
                        bodyValue = newValue
                        vm.setBody(newValue.text)
                    },
                    onFocusChanged = { bodyFocused = it },
                )
                CaptureMode.URL -> UrlMode(onSubmit = vm::importUrl)
                CaptureMode.Photo -> PhotoMode(api = vm.api, onCaptured = { url ->
                    vm.pasteIntoBody("![photo]($url)")
                    vm.setMode(CaptureMode.Write)
                }, onError = { /* TODO surface via banner */ })
                CaptureMode.OCR -> OcrMode(onAppend = { vm.pasteIntoBody(it) }, onError = { /* TODO banner */ })
                CaptureMode.Voice -> VoiceMode(onAppend = { vm.pasteIntoBody(it) }, onError = { /* TODO banner */ })
                CaptureMode.Import -> ImportMode(onAppend = { vm.pasteIntoBody(it) }, onError = { /* TODO banner */ })
            }
        }

        // Markdown pill bar — only when body field is focused +
        // we're in Write mode. Docks above the soft keyboard via
        // imePadding(). When keyboard is dismissed the bar sits
        // above the floating tab bar (extra 80dp bottom clearance).
        // Mirrors iOS UIInputAccessoryView behaviour.
        if (mode == CaptureMode.Write && bodyFocused) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .imePadding()
                    .padding(bottom = 80.dp),
            ) {
                MarkdownPillBar(
                    value = bodyValue,
                    onChange = { newValue ->
                        bodyValue = newValue
                        vm.setBody(newValue.text)
                    },
                )
            }
        }

        ProcessingBanner(
            title = banner?.first,
            detail = banner?.second,
            modifier = Modifier.imePadding().padding(bottom = 80.dp),
        )
    }
}

@Composable
private fun ModePillRow(mode: CaptureMode, onChange: (CaptureMode) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CaptureMode.entries.forEach { m ->
            val selected = m == mode
            Row(
                Modifier
                    .background(
                        color = if (selected) Brand.TextPrimary else Brand.Surface,
                        shape = RoundedCornerShape(20.dp),
                    )
                    .clickable { onChange(m) }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(m.icon, null, tint = if (selected) Brand.Background else Brand.TextMuted, modifier = Modifier.size(13.dp))
                Text(m.label, style = BrandType.body(12, FontWeight.Medium), color = if (selected) Brand.Background else Brand.TextPrimary)
            }
        }
    }
}

@Composable
private fun WriteBody(
    value: androidx.compose.ui.text.input.TextFieldValue,
    onChange: (androidx.compose.ui.text.input.TextFieldValue) -> Unit,
    onFocusChanged: (Boolean) -> Unit,
) {
    BasicTextField(
        value = value,
        onValueChange = onChange,
        textStyle = BrandType.body(15).copy(color = Brand.TextPrimary),
        cursorBrush = SolidColor(Brand.TextPrimary),
        modifier = Modifier
            .fillMaxSize()
            .onFocusChanged { onFocusChanged(it.isFocused) },
        decorationBox = { inner ->
            if (value.text.isEmpty()) {
                Text("Add more details…", style = BrandType.body(15), color = Brand.TextFaint)
            }
            inner()
        },
    )
}

@Composable
private fun UrlMode(onSubmit: (String) -> Unit) {
    val clipboard = LocalClipboardManager.current
    var url by remember { mutableStateOf(clipboard.getText()?.text.orEmpty()) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BasicTextField(
            value = url,
            onValueChange = { url = it },
            textStyle = BrandType.mono(14).copy(color = Brand.TextPrimary),
            cursorBrush = SolidColor(Brand.TextPrimary),
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .background(Brand.Surface, RoundedCornerShape(10.dp))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
                .padding(horizontal = 14.dp, vertical = 14.dp),
            decorationBox = { inner ->
                if (url.isEmpty()) Text("https://…", style = BrandType.mono(14), color = Brand.TextFaint)
                inner()
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
        )
        Text(
            "Import",
            style = BrandType.body(14, FontWeight.Medium),
            color = Brand.Background,
            modifier = Modifier
                .background(Brand.TextPrimary, RoundedCornerShape(10.dp))
                .clickable(enabled = url.isNotBlank()) { onSubmit(url) }
                .padding(horizontal = 20.dp, vertical = 12.dp),
        )
    }
}

