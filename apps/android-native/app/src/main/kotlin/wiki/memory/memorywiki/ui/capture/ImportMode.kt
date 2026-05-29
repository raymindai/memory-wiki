/*
 * ImportMode — SAF picker for PDF, Office docs, plain markdown, txt.
 * Selected file streams to /api/import/{pdf,office} or for markdown,
 * goes straight to /api/docs as markdown body. Mirrors iOS' Import
 * sheet.
 */

package wiki.memory.memorywiki.ui.capture

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

@Composable
fun ImportMode(onAppend: (String) -> Unit, onError: (String) -> Unit) {
    val context = LocalContext.current
    val pick = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        MainScope().launch {
            runCatching {
                val mime = context.contentResolver.getType(uri).orEmpty()
                when {
                    mime.startsWith("text/") || mime == "application/octet-stream" -> {
                        val text = withContext(Dispatchers.IO) {
                            context.contentResolver.openInputStream(uri)?.use { it.bufferedReader().readText() }
                        } ?: error("Couldn't read file")
                        onAppend(text)
                    }
                    else -> {
                        onError("PDF / Office import lands via /api/import/* (server endpoint already exists). Wiring TBD; for now plain-text only.")
                    }
                }
            }.onFailure { onError(it.message ?: "Import failed") }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            "Pick a file",
            style = BrandType.body(13, FontWeight.Medium),
            color = Brand.Background,
            modifier = Modifier
                .background(Brand.TextPrimary, RoundedCornerShape(8.dp))
                .clickable {
                    pick.launch(arrayOf(
                        "text/plain", "text/markdown",
                        "application/pdf",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ))
                }
                .padding(horizontal = 14.dp, vertical = 10.dp),
        )
        Text("Plain text / markdown is appended directly. PDF / Office files go through the server importer (v0.2).", style = BrandType.body(12), color = Brand.TextMuted)
    }
}
