/*
 * VoiceMode — press-and-hold microphone with live partial results.
 * Mirrors iOS DictationController: append final transcript to body,
 * surface interim text under the mic so the user sees recognition
 * working.
 */

package wiki.memory.memorywiki.ui.capture

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Mic
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import java.util.Locale

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun VoiceMode(onAppend: (String) -> Unit, onError: (String) -> Unit) {
    val micPerm = rememberPermissionState(android.Manifest.permission.RECORD_AUDIO)
    if (!micPerm.status.isGranted) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Microphone access is off.", style = BrandType.body(14, FontWeight.Medium), color = Brand.TextPrimary)
            Text(
                "Used only while you hold the mic button. Transcribed locally by the system speech service.",
                style = BrandType.body(12), color = Brand.TextMuted,
            )
            Text(
                "Allow microphone",
                style = BrandType.body(13, FontWeight.Medium),
                color = Brand.Background,
                modifier = Modifier
                    .background(Brand.TextPrimary, RoundedCornerShape(8.dp))
                    .clickable { micPerm.launchPermissionRequest() }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            )
        }
        return
    }

    val context = LocalContext.current
    var interim by remember { mutableStateOf("") }
    var listening by remember { mutableStateOf(false) }
    val recognizer = remember {
        SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onResults(results: Bundle) {
                    val texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = texts?.firstOrNull().orEmpty()
                    if (text.isNotBlank()) onAppend(text)
                    interim = ""
                    listening = false
                }
                override fun onPartialResults(partialResults: Bundle) {
                    val texts = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    interim = texts?.firstOrNull().orEmpty()
                }
                override fun onError(error: Int) {
                    // Silence benign codes (no match, speech timeout) — same
                    // as iOS' DictationController.benignErrorCodes.
                    val benign = setOf(
                        SpeechRecognizer.ERROR_NO_MATCH,
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                        SpeechRecognizer.ERROR_CLIENT,
                    )
                    if (error !in benign) onError("Speech error $error")
                    interim = ""
                    listening = false
                }
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
    }

    DisposableEffect(Unit) {
        onDispose { recognizer.destroy() }
    }

    Column(
        Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Spacer(Modifier.weight(1f))
        Box(
            Modifier
                .size(80.dp)
                .background(if (listening) Brand.MicroRed else Brand.TextPrimary, CircleShape)
                .clickable {
                    if (listening) {
                        recognizer.stopListening()
                    } else {
                        listening = true
                        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
                            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                        }
                        recognizer.startListening(intent)
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.Mic, null, tint = if (listening) Brand.TextPrimary else Brand.Background, modifier = Modifier.size(36.dp))
        }
        Text(
            if (listening) "Listening… tap to stop" else "Tap to start",
            style = BrandType.body(13), color = Brand.TextMuted,
        )
        if (interim.isNotBlank()) {
            Text(
                interim,
                style = BrandType.body(14),
                color = Brand.TextSecondary,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brand.Surface, RoundedCornerShape(10.dp))
                    .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
                    .padding(14.dp),
            )
        }
        Spacer(Modifier.weight(2f))
    }
}
