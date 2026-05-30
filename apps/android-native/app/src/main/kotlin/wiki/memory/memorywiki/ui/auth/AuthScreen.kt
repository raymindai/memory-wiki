/*
 * AuthScreen — Android port of iOS AuthView.
 *
 * Anatomy (top → bottom):
 *   ┌─ BrandBackdrop  (ambient morph blob bled off-canvas, 0.07 alpha)
 *   │
 *   │   AnimatedBlob 168dp              ┐
 *   │   wordmark "memory.wiki" 36dp     │  Hero (staggered fade-up)
 *   │   tagline body 15                 │
 *   │   "ANDROID COMPANION" chip        ┘
 *   │
 *   │   Google / GitHub / Email / Apple ┐  Provider stack
 *   │   (glass 52dp rows, 12dp corner,  │  (gradient stroke, press = scale 0.985
 *   │    gradient white→white border)   ┘   + brightness dim)
 *   │
 *   │   error banner (body 11 microRed) — only when error set
 *   │
 *   │   Android v0.1.0 / memory.wiki ↗   ┐
 *   │   terms & privacy                  ┘  Footer
 *   └─
 *
 * Stagger delays mirror iOS exactly:
 *   blob      0.00s spring(0.9, 0.85)
 *   wordmark  0.18s easeOut 600ms
 *   tagline   0.28s easeOut 600ms
 *   chip      0.38s easeOut 550ms
 *   providers 0.45s easeOut 600ms
 *   footer    0.70s easeOut 500ms
 *
 * App Store / Play Store HIG: when offering Google/GitHub SSO we
 * must also offer Sign in with Apple — Apple is here, last in the
 * stack, with the real Apple Inc. glyph (NOT the fruit emoji).
 */

package wiki.memory.memorywiki.ui.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.composables.icons.lucide.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.ui.components.AuthProvider
import wiki.memory.memorywiki.ui.components.BrandBlob
import wiki.memory.memorywiki.ui.components.ProviderLogo
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    val auth: AuthManager,
) : ViewModel() {
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var mode by mutableStateOf(Mode.SignIn)
    var working by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var emailSheetOpen by mutableStateOf(false)

    fun isDemo() = auth.isDemoEmail(email)
    fun canSubmit(): Boolean {
        if (working) return false
        if (!email.contains("@")) return false
        return isDemo() || password.length >= 6
    }

    fun submit(onDone: () -> Unit = {}) = viewModelScope.launch {
        if (!canSubmit()) return@launch
        working = true; error = null
        runCatching {
            when {
                isDemo() -> auth.signInDemo(email)
                mode == Mode.SignIn -> auth.signInWithEmail(email, password)
                else -> auth.signUpWithEmail(email, password)
            }
        }.onSuccess { onDone() }
            .onFailure { error = it.message ?: "Sign-in failed" }
        working = false
    }

    enum class Mode { SignIn, SignUp }
}

@Composable
fun AuthScreen(vm: AuthViewModel = hiltViewModel()) {
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        // 40ms post-paint kick so the canvas + backdrop have a frame
        // to settle before the stagger ignites (matches iOS).
        delay(40)
        appeared = true
    }

    Box(Modifier.fillMaxSize().background(Brand.Background)) {
        BrandBackdrop()

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 28.dp, bottom = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(24.dp))
            Hero(appeared = appeared)
            Spacer(Modifier.height(48.dp))
            ProviderStack(appeared = appeared, vm = vm)
            vm.error?.let { msg ->
                Spacer(Modifier.height(12.dp))
                Text(
                    msg,
                    style = BrandType.body(11),
                    color = Brand.MicroRed,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 28.dp),
                )
            }
            Spacer(Modifier.height(28.dp))
            Footer(appeared = appeared)
            Spacer(Modifier.height(20.dp))
        }
    }

    if (vm.emailSheetOpen) {
        EmailAuthSheet(vm = vm, onDismiss = { vm.emailSheetOpen = false })
    }
}

// ───────────────────── Hero ─────────────────────

@Composable
private fun Hero(appeared: Boolean) {
    // Each layer gets its own state-driven Animatable so the
    // entrance reads as "settling in," not "snapping open."
    val blobScale by animateFloatAsState(
        targetValue = if (appeared) 1f else 0.92f,
        animationSpec = spring(stiffness = Spring.StiffnessMediumLow, dampingRatio = 0.85f),
        label = "blob-scale",
    )
    val blobAlpha by animateFloatAsState(
        if (appeared) 1f else 0f, tween(600, easing = LinearOutSlowInEasing), label = "blob-alpha",
    )
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier.graphicsLayer {
                alpha = blobAlpha
                scaleX = blobScale
                scaleY = blobScale
            },
        ) {
            BrandBlob(sizeDp = 168)
        }
        Spacer(Modifier.height(10.dp))

        StaggeredFade(appeared = appeared, delayMs = 180) {
            Text(
                "memory.wiki",
                style = BrandType.display(36),
                color = Brand.TextPrimary,
            )
        }
        Spacer(Modifier.height(10.dp))
        StaggeredFade(appeared = appeared, delayMs = 280) {
            Text(
                "Your knowledge hub for the AI age.",
                style = BrandType.body(15),
                color = Brand.TextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 30.dp),
            )
        }
        Spacer(Modifier.height(14.dp))
        StaggeredFade(appeared = appeared, delayMs = 380) {
            CompanionChip()
        }
    }
}

@Composable
private fun CompanionChip() {
    // The chip tells users this is the satellite, not the canonical
    // surface. Quiet capsule, mono label, no colour. Identity, not
    // accent.
    Text(
        "ANDROID COMPANION",
        style = BrandType.mono(10, FontWeight.Medium),
        fontSize = 10.sp,
        color = Brand.TextMuted,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(50))
            .padding(horizontal = 11.dp, vertical = 6.dp),
    )
}

// ─────────────────── Provider stack ───────────────────

@Composable
private fun ProviderStack(appeared: Boolean, vm: AuthViewModel) {
    StaggeredFade(
        appeared = appeared,
        delayMs = 450,
        durationMs = 600,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            ProviderButton(
                label = "Continue with Google",
                provider = AuthProvider.Google,
                enabled = !vm.working,
                onClick = { /* Credential Manager wiring TODO */ },
            )
            ProviderButton(
                label = "Continue with GitHub",
                provider = AuthProvider.GitHub,
                enabled = !vm.working,
                onClick = { vm.auth.beginGithubOAuth() },
            )
            ProviderButton(
                label = "Continue with email",
                provider = AuthProvider.Email,
                enabled = !vm.working,
                onClick = { vm.emailSheetOpen = true },
            )
            ProviderButton(
                label = "Continue with Apple",
                provider = AuthProvider.Apple,
                enabled = !vm.working,
                onClick = { vm.auth.beginAppleOAuth() },
            )
        }
    }
}

@Composable
private fun ProviderButton(
    label: String,
    provider: AuthProvider,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        if (pressed) 0.985f else 1f,
        animationSpec = tween(120, easing = LinearOutSlowInEasing),
        label = "press-scale",
    )
    Row(
        Modifier
            .fillMaxWidth()
            .height(52.dp)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                alpha = if (enabled) (if (pressed) 0.88f else 1f) else 0.45f
            }
            .clip(RoundedCornerShape(12.dp))
            .background(Brand.Surface.copy(alpha = 0.55f))
            .background(Color.White.copy(alpha = 0.03f))
            .border(
                width = 1.dp,
                brush = Brush.verticalGradient(
                    listOf(
                        Color.White.copy(alpha = 0.18f),
                        Color.White.copy(alpha = 0.04f),
                    ),
                ),
                shape = RoundedCornerShape(12.dp),
            )
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = onClick,
            )
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(18.dp), contentAlignment = Alignment.Center) {
            if (provider == AuthProvider.Email) {
                Icon(Lucide.Mail, null, tint = Brand.TextPrimary, modifier = Modifier.size(18.dp))
            } else {
                ProviderLogo(provider, sizeDp = 18)
            }
        }
        Text(label, style = BrandType.body(15, FontWeight.Medium), color = Brand.TextPrimary)
    }
}

// ───────────────────── Footer ─────────────────────

@Composable
private fun Footer(appeared: Boolean) {
    StaggeredFade(
        appeared = appeared,
        delayMs = 700,
        durationMs = 500,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Android v${BuildConfig.VERSION_NAME ?: "0.1.0"}",
                    style = BrandType.mono(9, FontWeight.Medium),
                    fontSize = 9.sp,
                    color = Brand.TextMuted,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "memory.wiki",
                    style = BrandType.mono(9, FontWeight.Medium),
                    fontSize = 9.sp,
                    color = Brand.TextMuted,
                )
                Spacer(Modifier.width(3.dp))
                Icon(
                    Lucide.ArrowUpRight,
                    null,
                    tint = Brand.TextMuted,
                    modifier = Modifier.size(8.dp),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "By continuing you agree to our ",
                    style = BrandType.body(11),
                    color = Brand.TextFaint,
                )
                Text(
                    "terms",
                    style = BrandType.body(11, FontWeight.Medium),
                    color = Brand.TextMuted,
                )
                Text(
                    " & ",
                    style = BrandType.body(11),
                    color = Brand.TextFaint,
                )
                Text(
                    "privacy",
                    style = BrandType.body(11, FontWeight.Medium),
                    color = Brand.TextMuted,
                )
            }
        }
    }
}

// ───────────────────── Backdrop ─────────────────────

@Composable
private fun BrandBackdrop() {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        // Same morph SVG as the hero, scaled to ~95% of the larger
        // dimension and pinned to centre. Opacity 7% + 8dp blur so
        // it reads as "the canvas is breathing," not "image".
        val dim = maxOf(maxWidth, maxHeight).value * 0.95f
        Box(
            Modifier
                .align(Alignment.Center)
                .graphicsLayer { alpha = 0.07f }
                .blur(8.dp),
            contentAlignment = Alignment.Center,
        ) {
            BrandBlob(sizeDp = dim.toInt())
        }
    }
}

// ───────────────────── Stagger helper ─────────────────────

@Composable
private fun StaggeredFade(
    appeared: Boolean,
    delayMs: Int,
    durationMs: Int = 600,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    AnimatedVisibility(
        visible = appeared,
        enter = fadeIn(tween(durationMs, delayMs, LinearOutSlowInEasing)) +
            slideInVertically(tween(durationMs, delayMs, LinearOutSlowInEasing)) { it / 8 },
        modifier = modifier,
    ) {
        content()
    }
}

// ───────────────────── Email sheet ─────────────────────

@Composable
private fun EmailAuthSheet(vm: AuthViewModel, onDismiss: () -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val ime = LocalSoftwareKeyboardController.current

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = state,
        containerColor = Brand.SheetBg,
        contentColor = Brand.TextPrimary,
        dragHandle = null,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp)
                .padding(top = 22.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                if (vm.mode == AuthViewModel.Mode.SignIn) "Sign in" else "Create account",
                style = BrandType.display(22),
            )

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "EMAIL",
                    style = BrandType.mono(9, FontWeight.Medium),
                    color = Brand.TextFaint,
                )
                OutlinedTextField(
                    value = vm.email,
                    onValueChange = { vm.email = it; vm.error = null },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next,
                    ),
                    colors = brandedFieldColors(),
                )
            }

            if (!vm.isDemo()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "PASSWORD",
                        style = BrandType.mono(9, FontWeight.Medium),
                        color = Brand.TextFaint,
                    )
                    OutlinedTextField(
                        value = vm.password,
                        onValueChange = { vm.password = it; vm.error = null },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done,
                        ),
                        colors = brandedFieldColors(),
                    )
                }
            } else {
                Text(
                    "Demo account — no password needed.",
                    style = BrandType.body(12),
                    color = Brand.MicroInfo,
                )
            }

            vm.error?.let {
                Text(it, style = BrandType.body(12), color = Brand.MicroRed)
            }

            Button(
                onClick = { ime?.hide(); vm.submit(onDone = { onDismiss() }) },
                enabled = vm.canSubmit(),
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Brand.TextPrimary,
                    contentColor = Brand.Background,
                    disabledContainerColor = Brand.Surface,
                    disabledContentColor = Brand.TextMuted,
                ),
                border = if (!vm.canSubmit())
                    BorderStroke(0.5.dp, Brand.Border) else null,
            ) {
                Text(
                    when {
                        vm.working -> "Working…"
                        vm.mode == AuthViewModel.Mode.SignIn -> "Sign in"
                        else -> "Create account"
                    },
                    style = BrandType.body(15, FontWeight.Medium),
                )
            }

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (vm.mode == AuthViewModel.Mode.SignIn) "No account? " else "Already have an account? ",
                    style = BrandType.body(12),
                    color = Brand.TextFaint,
                )
                Text(
                    if (vm.mode == AuthViewModel.Mode.SignIn) "Create one." else "Sign in.",
                    style = BrandType.body(12, FontWeight.Medium),
                    color = Brand.TextPrimary,
                    modifier = Modifier.clickable {
                        vm.mode = if (vm.mode == AuthViewModel.Mode.SignIn)
                            AuthViewModel.Mode.SignUp else AuthViewModel.Mode.SignIn
                        vm.error = null
                    },
                )
            }
        }
    }
}

@Composable
private fun brandedFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = Brand.Surface,
    unfocusedContainerColor = Brand.Surface,
    focusedTextColor = Brand.TextPrimary,
    unfocusedTextColor = Brand.TextPrimary,
    cursorColor = Brand.TextPrimary,
    focusedBorderColor = Brand.Border,
    unfocusedBorderColor = Brand.BorderDim,
)
