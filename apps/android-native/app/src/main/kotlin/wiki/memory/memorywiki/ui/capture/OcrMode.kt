/*
 * OcrMode — pick a photo (system PhotoPicker since API 33+), run
 * ML Kit text recognition (Latin + Korean chained), preview the
 * extracted text, append to body on confirm.
 */

package wiki.memory.memorywiki.ui.capture

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import kotlin.coroutines.resume

@Composable
fun OcrMode(onAppend: (String) -> Unit, onError: (String) -> Unit) {
    val context = LocalContext.current
    var extracted by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }

    val pickMedia = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        working = true
        // Run OCR in a coroutine
        kotlinx.coroutines.MainScope().launch {
            runCatching {
                val bytes = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                } ?: error("Couldn't read image")
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: error("Bad image")
                val latin = recognize(bitmap, TextRecognizerOptions.DEFAULT_OPTIONS)
                val korean = recognize(bitmap, KoreanTextRecognizerOptions.Builder().build())
                // Take the longer of the two so the dominant script wins.
                extracted = if (korean.length > latin.length) korean else latin
            }.onFailure { onError(it.message ?: "OCR failed") }
            working = false
        }
    }

    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Pick a photo",
                style = BrandType.body(13, FontWeight.Medium),
                color = Brand.Background,
                modifier = Modifier
                    .background(Brand.TextPrimary, RoundedCornerShape(8.dp))
                    .clickable {
                        pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            )
            if (working) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp).align(Alignment.CenterVertically), color = Brand.TextPrimary, strokeWidth = 1.6.dp)
            }
        }
        if (!extracted.isNullOrBlank()) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Brand.Surface, RoundedCornerShape(12.dp))
                    .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(12.dp))
                    .padding(14.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("EXTRACTED", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
                Text(extracted!!, style = BrandType.body(13), color = Brand.TextPrimary)
                Text(
                    "Append to body",
                    style = BrandType.body(13, FontWeight.Medium),
                    color = Brand.Background,
                    modifier = Modifier
                        .background(Brand.TextPrimary, RoundedCornerShape(8.dp))
                        .clickable {
                            onAppend(extracted!!)
                            extracted = null
                        }
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                )
            }
        }
    }
}

private suspend fun recognize(bitmap: android.graphics.Bitmap, options: com.google.mlkit.vision.text.TextRecognizerOptionsInterface): String =
    suspendCancellableCoroutine { cont ->
        val recognizer = TextRecognition.getClient(options)
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener { vt -> cont.resume(vt.text.orEmpty()) }
            .addOnFailureListener { cont.resume("") }
    }
