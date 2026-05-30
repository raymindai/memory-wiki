/*
 * PhotoMode — full-bleed CameraX preview + capture button. Captured
 * image runs through WebPEncoder (matches iOS ladder) and uploads
 * via /api/upload. Result URL gets pasted into the body draft.
 *
 * Permission gate is inline: if CAMERA isn't granted yet, the
 * surface swaps to a small "Allow camera" affordance.
 */

package wiki.memory.memorywiki.ui.capture

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import com.composables.icons.lucide.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import wiki.memory.memorywiki.util.WebPEncoder
import kotlin.coroutines.resume

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun PhotoMode(api: ApiClient, onCaptured: (String) -> Unit, onError: (String) -> Unit) {
    val cameraPerm = rememberPermissionState(android.Manifest.permission.CAMERA)
    if (!cameraPerm.status.isGranted) {
        Column(
            Modifier
                .fillMaxSize()
                .background(Brand.Surface, RoundedCornerShape(14.dp))
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Camera access is off.", style = BrandType.body(14, FontWeight.Medium), color = Brand.TextPrimary)
            Text(
                "Memory.wiki uses the camera only when you tap Photo or OCR. Nothing is captured in the background.",
                style = BrandType.body(12), color = Brand.TextMuted,
            )
            Text(
                "Allow camera",
                style = BrandType.body(13, FontWeight.Medium),
                color = Brand.Background,
                modifier = Modifier
                    .background(Brand.TextPrimary, RoundedCornerShape(8.dp))
                    .clickable { cameraPerm.launchPermissionRequest() }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            )
        }
        return
    }

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember { PreviewView(context) }
    val imageCapture = remember { ImageCapture.Builder().setTargetRotation(previewView.display?.rotation ?: android.view.Surface.ROTATION_0).build() }
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        bindCamera(context, lifecycleOwner, previewView, imageCapture)
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView(
            factory = {
                previewView.apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(14.dp)),
        )

        // Shutter
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 36.dp)
                .size(68.dp)
                .background(Brand.TextPrimary, CircleShape)
                .border(2.dp, Brand.Background, CircleShape)
                .clickable(enabled = !busy) {
                    busy = true
                    scope.launch {
                        runCatching {
                            val bitmap = captureToBitmap(context, imageCapture)
                            val payload = WebPEncoder.encode(bitmap) ?: error("Encode failed")
                            val res = api.uploadImage(payload.bytes, payload.fileExtension, payload.contentType)
                            onCaptured(res.url)
                        }.onFailure { onError(it.message ?: "Photo failed") }
                        busy = false
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.Camera, null, tint = Brand.Background, modifier = Modifier.size(28.dp))
        }
    }
}

private suspend fun bindCamera(
    context: Context,
    lifecycleOwner: androidx.lifecycle.LifecycleOwner,
    previewView: PreviewView,
    imageCapture: ImageCapture,
) = withContext(Dispatchers.Main) {
    val provider = suspendCancellableCoroutine<ProcessCameraProvider> { cont ->
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({ cont.resume(future.get()) }, ContextCompat.getMainExecutor(context))
    }
    val preview = Preview.Builder().build().also {
        it.setSurfaceProvider(previewView.surfaceProvider)
    }
    provider.unbindAll()
    provider.bindToLifecycle(
        lifecycleOwner,
        CameraSelector.DEFAULT_BACK_CAMERA,
        preview,
        imageCapture,
    )
}

private suspend fun captureToBitmap(context: Context, imageCapture: ImageCapture): Bitmap =
    suspendCancellableCoroutine { cont ->
        imageCapture.takePicture(
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(image: ImageProxy) {
                    try {
                        val buffer = image.planes[0].buffer
                        val bytes = ByteArray(buffer.remaining()).also { buffer.get(it) }
                        var bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        if (image.imageInfo.rotationDegrees != 0) {
                            val mtx = Matrix().apply { postRotate(image.imageInfo.rotationDegrees.toFloat()) }
                            bitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, mtx, true)
                        }
                        cont.resume(bitmap)
                    } catch (t: Throwable) {
                        cont.resumeWith(Result.failure(t))
                    } finally {
                        image.close()
                    }
                }
                override fun onError(exc: ImageCaptureException) {
                    cont.resumeWith(Result.failure(exc))
                }
            },
        )
    }
