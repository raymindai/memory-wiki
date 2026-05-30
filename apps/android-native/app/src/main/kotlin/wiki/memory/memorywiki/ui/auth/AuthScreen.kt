/*
 * AuthScreen — mirror of iOS AuthView composition.
 *
 *   - 168dp brand blob hero (centred, fades in)
 *   - Cal Sans 36 wordmark "memory.wiki"
 *   - Tagline "Your knowledge hub for the AI age."
 *   - Provider stack: Google · GitHub · Email · Apple
 *     Each button is the same outlined surface + 18dp glyph + label
 *   - Email opens a bottom sheet (EmailAuthSheet) with the actual
 *     email + password form — the inline form was visual noise on
 *     the hero surface.
 *   - Footer: "Android 0.1.0 · memory.wiki ↗ · terms & privacy"
 */

package wiki.memory.memorywiki.ui.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Mail
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
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
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
    // Hero stagger flag — flips true on first composition so each
    // layer fades + lifts in on its own delay (mirrors iOS spring).
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }

    Column(
        Modifier
            .fillMaxSize()
            .background(Brand.Background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(top = 60.dp, bottom = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // ─── Hero ───
        AnimatedVisibility(
            visible = appeared,
            enter = fadeIn(tween(700)) + slideInVertically(tween(700)) { it / 6 },
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                BrandBlob(sizeDp = 168)
                Spacer(Modifier.height(8.dp))
                Text(
                    "memory.wiki",
                    style = BrandType.display(36),
                    color = Brand.TextPrimary,
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    "Your knowledge hub for the AI age.",
                    style = BrandType.body(15),
                    color = Brand.TextMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )
            }
        }

        Spacer(Modifier.height(56.dp))

        // ─── Provider stack ───
        AnimatedVisibility(
            visible = appeared,
            enter = fadeIn(tween(700, delayMillis = 220)) + slideInVertically(tween(700, delayMillis = 220)) { it / 8 },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                ProviderRow(
                    label = "Continue with Google",
                    provider = AuthProvider.Google,
                    onClick = { /* TODO Credential Manager wiring */ },
                )
                ProviderRow(
                    label = "Continue with GitHub",
                    provider = AuthProvider.GitHub,
                    onClick = { vm.auth.beginGithubOAuth() },
                )
                ProviderRow(
                    label = "Continue with email",
                    provider = AuthProvider.Email,
                    onClick = { vm.emailSheetOpen = true },
                )
                ProviderRow(
                    label = "Continue with Apple",
                    provider = AuthProvider.Apple,
                    onClick = { vm.auth.beginAppleOAuth() },
                )
            }
        }

        Spacer(Modifier.weight(1f, fill = false))
        Spacer(Modifier.height(40.dp))

        // ─── Footer ───
        Column(
            Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Android ${BuildConfig.VERSION_NAME ?: "0.1.0"}",
                    style = BrandType.mono(9, FontWeight.Medium),
                    color = Brand.TextMuted,
                )
                Spacer(Modifier.width(8.dp))
                Text("/", style = BrandType.mono(9), color = Brand.TextFaint)
                Spacer(Modifier.width(8.dp))
                Text(
                    "memory.wiki ↗",
                    style = BrandType.mono(9, FontWeight.Medium),
                    color = Brand.TextMuted,
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("By continuing you agree to our ", style = BrandType.body(10), color = Brand.TextFaint)
                Text("terms", style = BrandType.body(10, FontWeight.Medium), color = Brand.TextMuted)
                Text(" & ", style = BrandType.body(10), color = Brand.TextFaint)
                Text("privacy", style = BrandType.body(10, FontWeight.Medium), color = Brand.TextMuted)
            }
        }
    }

    if (vm.emailSheetOpen) {
        EmailAuthSheet(
            vm = vm,
            onDismiss = { vm.emailSheetOpen = false },
        )
    }
}

@Composable
private fun ProviderRow(
    label: String,
    provider: AuthProvider,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(52.dp)
            .background(Brand.Surface, RoundedCornerShape(10.dp))
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 20.dp),
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
        Text(label, style = BrandType.body(14, FontWeight.Medium), color = Brand.TextPrimary)
    }
}

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
                Text("EMAIL", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
                OutlinedTextField(
                    value = vm.email,
                    onValueChange = { vm.email = it; vm.error = null },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                    colors = brandedFieldColors(),
                )
            }

            if (!vm.isDemo()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("PASSWORD", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
                    OutlinedTextField(
                        value = vm.password,
                        onValueChange = { vm.password = it; vm.error = null },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
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
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Brand.TextPrimary,
                    contentColor = Brand.Background,
                    disabledContainerColor = Brand.Surface,
                    disabledContentColor = Brand.TextMuted,
                ),
                border = if (!vm.canSubmit()) BorderStroke(0.5.dp, Brand.Border) else null,
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
                        vm.mode = if (vm.mode == AuthViewModel.Mode.SignIn) AuthViewModel.Mode.SignUp else AuthViewModel.Mode.SignIn
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
