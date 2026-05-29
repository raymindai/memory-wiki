/*
 * AuthScreen — sign in / sign up entry. Mirrors iOS AuthView +
 * EmailAuthSheet:
 *   - Brand wordmark + tagline at top
 *   - Email + password (password hides for demo allowlist emails)
 *   - Primary Sign in / Create account button (disabled state has
 *     contrasting TextMuted text, NOT bg-on-bg — same fix iOS
 *     shipped this week)
 *   - Provider buttons: Google, Apple, GitHub
 *   - "No account? / Create one." toggle
 */

package wiki.memory.memorywiki.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.auth.AuthManager
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

    fun isDemo() = auth.isDemoEmail(email)
    fun canSubmit(): Boolean {
        if (working) return false
        if (!email.contains("@")) return false
        return isDemo() || password.length >= 6
    }

    fun submit() = viewModelScope.launch {
        if (!canSubmit()) return@launch
        working = true; error = null
        runCatching {
            when {
                isDemo() -> auth.signInDemo(email)
                mode == Mode.SignIn -> auth.signInWithEmail(email, password)
                else -> auth.signUpWithEmail(email, password)
            }
        }.onFailure { error = it.message ?: "Sign-in failed" }
        working = false
    }

    enum class Mode { SignIn, SignUp }
}

@Composable
fun AuthScreen(vm: AuthViewModel = hiltViewModel()) {
    val ime = LocalSoftwareKeyboardController.current
    Column(
        Modifier.fillMaxSize().padding(horizontal = 24.dp).padding(top = 80.dp),
    ) {
        Text(
            text = "memory.wiki",
            style = BrandType.display(28),
            color = Brand.TextPrimary,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Personal knowledge hub for the AI era.",
            style = BrandType.body(14),
            color = Brand.TextMuted,
        )

        Spacer(Modifier.height(48.dp))

        Text("EMAIL", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(
            value = vm.email,
            onValueChange = { vm.email = it; vm.error = null },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Brand.Surface,
                unfocusedContainerColor = Brand.Surface,
                focusedTextColor = Brand.TextPrimary,
                unfocusedTextColor = Brand.TextPrimary,
                cursorColor = Brand.TextPrimary,
                focusedBorderColor = Brand.Border,
                unfocusedBorderColor = Brand.BorderDim,
            ),
        )

        AnimatedContentBlock(visible = !vm.isDemo()) {
            Spacer(Modifier.height(14.dp))
            Text("PASSWORD", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = vm.password,
                onValueChange = { vm.password = it; vm.error = null },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Brand.Surface,
                    unfocusedContainerColor = Brand.Surface,
                    focusedTextColor = Brand.TextPrimary,
                    unfocusedTextColor = Brand.TextPrimary,
                    cursorColor = Brand.TextPrimary,
                    focusedBorderColor = Brand.Border,
                    unfocusedBorderColor = Brand.BorderDim,
                ),
            )
        }

        if (vm.isDemo()) {
            Spacer(Modifier.height(10.dp))
            Text(
                "Demo account · no password needed.",
                style = BrandType.body(12),
                color = Brand.MicroInfo,
            )
        }

        vm.error?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, style = BrandType.body(12), color = Brand.MicroRed)
        }

        Spacer(Modifier.height(20.dp))

        Button(
            onClick = { ime?.hide(); vm.submit() },
            enabled = vm.canSubmit(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = Brand.Shapes.small,
            colors = ButtonDefaults.buttonColors(
                containerColor = Brand.TextPrimary,
                contentColor = Brand.Background,
                disabledContainerColor = Brand.Surface,
                disabledContentColor = Brand.TextMuted,
            ),
        ) {
            Text(
                if (vm.working) "Working…"
                else if (vm.mode == AuthViewModel.Mode.SignIn) "Sign in"
                else "Create account",
                style = BrandType.body(15, FontWeight.Medium),
            )
        }

        Spacer(Modifier.height(18.dp))
        TextButton(
            onClick = {
                vm.mode = if (vm.mode == AuthViewModel.Mode.SignIn) AuthViewModel.Mode.SignUp else AuthViewModel.Mode.SignIn
                vm.error = null
            },
            modifier = Modifier.align(Alignment.CenterHorizontally),
        ) {
            val left = if (vm.mode == AuthViewModel.Mode.SignIn) "No account?" else "Already have an account?"
            val right = if (vm.mode == AuthViewModel.Mode.SignIn) "Create one." else "Sign in."
            Text("$left  ", color = Brand.TextFaint, style = BrandType.body(12))
            Text(right, color = Brand.TextPrimary, style = BrandType.body(12, FontWeight.Medium))
        }

        Spacer(Modifier.height(28.dp))
        Row(
            Modifier.fillMaxWidth().align(Alignment.CenterHorizontally),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            ProviderButton("Apple",  Modifier.weight(1f)) { vm.auth.beginAppleOAuth() }
            ProviderButton("GitHub", Modifier.weight(1f)) { vm.auth.beginGithubOAuth() }
        }
    }
}

@Composable
private fun ProviderButton(label: String, modifier: Modifier, onClick: () -> Unit) {
    androidx.compose.material3.OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(46.dp),
        shape = Brand.Shapes.small,
        colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
            containerColor = Brand.Surface,
            contentColor = Brand.TextPrimary,
        ),
        border = androidx.compose.foundation.BorderStroke(0.5.dp, Brand.BorderDim),
    ) {
        Text(label, style = BrandType.body(13, FontWeight.Medium))
    }
}

@Composable
private fun AnimatedContentBlock(visible: Boolean, content: @Composable ColumnScope.() -> Unit) {
    Column { if (visible) content() }
}
