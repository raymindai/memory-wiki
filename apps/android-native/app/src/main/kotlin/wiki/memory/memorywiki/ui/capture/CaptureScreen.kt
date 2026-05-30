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
import com.composables.icons.lucide.Camera
import com.composables.icons.lucide.FileText
import com.composables.icons.lucide.Link
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Mic
import com.composables.icons.lucide.ScanText
import com.composables.icons.lucide.SquarePen
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

    // Clipboard paste on demand
    LaunchedEffect(Unit) {
        vm.router.events.collect { evt ->
            if (evt is RouterEvent.CapturePaste) {
                val text = clipboard.getText()?.text
                if (!text.isNullOrBlank()) vm.pasteIntoBody(text)
            }
        }
    }

    Column(Modifier.fillMaxSize().padding(top = 56.dp)) {
        Text("Capture", style = BrandType.display(22), color = Brand.TextPrimary, modifier = Modifier.padding(horizontal = 18.dp))
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
                CaptureMode.Write -> WriteBody(body, vm::setBody)
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

        ProcessingBanner(title = banner?.first, detail = banner?.second, modifier = Modifier.imePadding().padding(bottom = 80.dp))
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
private fun WriteBody(body: String, onChange: (String) -> Unit) {
    BasicTextField(
        value = body,
        onValueChange = onChange,
        textStyle = BrandType.body(15).copy(color = Brand.TextPrimary, lineHeight = androidx.compose.ui.unit.TextUnit.Unspecified),
        cursorBrush = SolidColor(Brand.TextPrimary),
        modifier = Modifier.fillMaxSize(),
        decorationBox = { inner ->
            if (body.isEmpty()) Text("Add more details…", style = BrandType.body(15), color = Brand.TextFaint)
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

