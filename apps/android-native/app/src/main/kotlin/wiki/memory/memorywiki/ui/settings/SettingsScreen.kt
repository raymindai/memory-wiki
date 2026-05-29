/*
 * SettingsScreen — port of iOS ProfileView.
 *   - Hub card with AI URL + Copy for AI / Copy URL / Open my hub
 *   - Hub stats card (Memories / Bundles)
 *   - Account (Email / Username / Display Name editor)
 *   - Brand (accent picker)
 *   - Sign out
 */

package wiki.memory.memorywiki.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.LogOut
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.ui.theme.AccentColorChoice
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    val auth: AuthManager,
    val api: wiki.memory.memorywiki.data.ApiClient,
) : ViewModel() {
    fun updateDisplayName(name: String) = viewModelScope.launch { auth.updateDisplayName(name) }
    fun setAccent(choice: AccentColorChoice) = viewModelScope.launch {
        runCatching { api.updateProfile(accent = choice.key) }
        // Force a session re-hydrate so RootShell picks up the new accent.
        auth.refresh()
    }
    fun signOut() = viewModelScope.launch { auth.signOut() }
}

@Composable
fun SettingsScreen(navController: NavController, vm: SettingsViewModel = hiltViewModel()) {
    val session by vm.auth.session.collectAsState()
    val clipboard = LocalClipboardManager.current
    val displayName = session?.displayName ?: session?.email?.substringBefore("@") ?: "—"
    val email = session?.email ?: "—"
    val slug = session?.hubSlug ?: "yourname"
    val url = "${BuildConfig.API_BASE}/@$slug"

    var nameSheetOpen by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp)
            .padding(top = 56.dp, bottom = 140.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Text("Settings", style = BrandType.display(22), color = Brand.TextPrimary)

        // Hub card
        Column(
            Modifier
                .fillMaxWidth()
                .background(Brand.Surface, RoundedCornerShape(14.dp))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(14.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("YOUR AI MEMORY URL", style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint)
            Text(url.removePrefix("https://"), style = BrandType.mono(13), color = Brand.TextPrimary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Pill("Copy for AI", Icons.Outlined.AutoAwesome, Brand.MicroLime) {
                    clipboard.setText(AnnotatedString("Use $url as my context."))
                }
                Pill("Copy URL", Icons.Outlined.ContentCopy, Brand.TextPrimary) {
                    clipboard.setText(AnnotatedString(url))
                }
                Pill("Open hub", Icons.Outlined.OpenInNew, Brand.TextPrimary) { /* TODO open browser */ }
            }
        }

        // Account
        SectionLabel("ACCOUNT")
        Column(
            Modifier
                .fillMaxWidth()
                .background(Brand.Surface, RoundedCornerShape(14.dp))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(14.dp)),
        ) {
            AccountRow("Email", email)
            Divider()
            AccountRow("Username", "@$slug")
            Divider()
            AccountRow("Display Name", displayName, onClick = { nameSheetOpen = true })
        }

        // Brand accent
        SectionLabel("KEY COLOR")
        AccentPicker(
            selected = AccentColorChoice.from(session?.accentColor),
            onSelect = { vm.setAccent(it) },
        )

        Spacer(Modifier.height(8.dp))

        Row(
            Modifier
                .fillMaxWidth()
                .background(Brand.Surface, RoundedCornerShape(10.dp))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
                .clickable { vm.signOut() }
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Outlined.LogOut, null, tint = Brand.MicroRed, modifier = Modifier.size(16.dp))
            Text("Sign out", style = BrandType.body(14, FontWeight.Medium), color = Brand.MicroRed)
        }
    }

    if (nameSheetOpen) {
        DisplayNameSheet(
            initial = displayName,
            onDismiss = { nameSheetOpen = false },
            onSave = { vm.updateDisplayName(it); nameSheetOpen = false },
        )
    }
}

@Composable
private fun Pill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, tint: androidx.compose.ui.graphics.Color, onClick: () -> Unit) {
    Row(
        Modifier
            .background(Brand.ToggleBg, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(11.dp))
        Text(label, style = BrandType.body(12, FontWeight.Medium), color = Brand.TextPrimary)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, style = BrandType.mono(9, FontWeight.Medium), color = Brand.TextFaint, modifier = Modifier.padding(start = 4.dp))
}

@Composable
private fun AccountRow(label: String, value: String, onClick: (() -> Unit)? = null) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = BrandType.body(13), color = Brand.TextMuted)
        Spacer(Modifier.weight(1f))
        Text(value, style = BrandType.body(13, FontWeight.Medium), color = Brand.TextPrimary)
    }
}

@Composable
private fun Divider() {
    Box(Modifier.fillMaxWidth().height(0.5.dp).background(Brand.BorderDim))
}

@Composable
private fun AccentPicker(selected: AccentColorChoice, onSelect: (AccentColorChoice) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        AccentColorChoice.entries.forEach { choice ->
            Box(
                Modifier
                    .size(36.dp)
                    .background(choice.dark, CircleShape)
                    .border(
                        width = if (choice == selected) 2.dp else 0.5.dp,
                        color = if (choice == selected) Brand.TextPrimary else Brand.BorderDim,
                        shape = CircleShape,
                    )
                    .clickable { onSelect(choice) },
            )
        }
    }
}

@Composable
private fun DisplayNameSheet(initial: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember { mutableStateOf(initial) }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = state,
        containerColor = Brand.SheetBg,
        contentColor = Brand.TextPrimary,
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Display name", style = BrandType.display(20))
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Brand.Surface, unfocusedContainerColor = Brand.Surface,
                    focusedTextColor = Brand.TextPrimary, unfocusedTextColor = Brand.TextPrimary,
                    cursorColor = Brand.TextPrimary,
                    focusedBorderColor = Brand.Border, unfocusedBorderColor = Brand.BorderDim,
                ),
            )
            Text(
                "Save",
                style = BrandType.body(14, FontWeight.Medium),
                color = Brand.Background,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brand.TextPrimary, RoundedCornerShape(10.dp))
                    .clickable { onSave(name.trim()) }
                    .padding(vertical = 14.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Spacer(Modifier.height(20.dp))
        }
    }
}
