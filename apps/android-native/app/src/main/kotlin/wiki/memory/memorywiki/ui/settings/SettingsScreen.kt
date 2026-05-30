/*
 * SettingsScreen — port of iOS ProfileView.
 *   - Hub card with AI URL + Copy for AI / Copy URL / Open my hub
 *   - Hub stats card (Memories / Bundles)
 *   - Account (Email / Username / Display Name editor)
 *   - Brand (accent picker)
 *   - Sign out
 */

package wiki.memory.memorywiki.ui.settings

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.composables.icons.lucide.*
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.BuildConfig
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.data.model.BundleSummary
import wiki.memory.memorywiki.data.model.DocSummary
import wiki.memory.memorywiki.ui.theme.AccentColorChoice
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@HiltViewModel
class SettingsViewModel @Inject constructor(
    val auth: AuthManager,
    val api: wiki.memory.memorywiki.data.ApiClient,
) : ViewModel() {
    private val _docs = MutableStateFlow<List<DocSummary>>(emptyList())
    val docs: StateFlow<List<DocSummary>> = _docs.asStateFlow()
    private val _bundles = MutableStateFlow<List<BundleSummary>>(emptyList())
    val bundles: StateFlow<List<BundleSummary>> = _bundles.asStateFlow()

    init { loadHubStats() }

    fun loadHubStats() = viewModelScope.launch {
        runCatching { api.userDocuments() }.onSuccess { _docs.value = it.documents }
        runCatching { api.userBundles() }.onSuccess { _bundles.value = it.bundles }
    }

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
    val docs by vm.docs.collectAsState()
    val bundles by vm.bundles.collectAsState()
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    val displayName = session?.displayName ?: session?.email?.substringBefore("@") ?: "—"
    val email = session?.email ?: "—"
    val slug = session?.hubSlug ?: "yourname"
    val baseUrl = BuildConfig.API_BASE.removeSuffix("/")
    val url = "$baseUrl/@$slug"

    var nameSheetOpen by remember { mutableStateOf(false) }

    val openUrl: (String) -> Unit = { target ->
        context.startActivity(Intent(Intent.ACTION_VIEW, target.toUri()))
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp)
            .padding(top = 56.dp, bottom = 140.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Text("Settings", style = BrandType.display(26), color = Brand.TextPrimary)

        // Hub URL card (unchanged structure, with Open hub now functional)
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
                Pill("Copy for AI", Lucide.Sparkles, Brand.MicroLime) {
                    clipboard.setText(AnnotatedString("Use $url as my context."))
                }
                Pill("Copy URL", Lucide.Copy, Brand.TextPrimary) {
                    clipboard.setText(AnnotatedString(url))
                }
                Pill("Open hub", Lucide.ExternalLink, Brand.TextPrimary) { openUrl(url) }
            }
        }

        // Hub stats: memories + bundles tiles
        HubStatsCard(
            memories = docs.size,
            publicMemories = docs.count { !it.isDraft },
            bundles = bundles.size,
            publicBundles = bundles.count { !it.isDraft },
        )

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

        // Language — opens Android system per-app locale picker
        // (Settings.ACTION_APP_LOCALE_SETTINGS, API 33+). Falls
        // back to the global language picker on older devices.
        SectionLabel("LANGUAGE")
        LinkCardGroup(
            rows = listOf(
                LinkRow(Lucide.Globe, "Change app language", Brand.MicroInfo) {
                    val intent = if (android.os.Build.VERSION.SDK_INT >= 33) {
                        Intent(android.provider.Settings.ACTION_APP_LOCALE_SETTINGS).apply {
                            data = "package:${context.packageName}".toUri()
                        }
                    } else {
                        Intent(android.provider.Settings.ACTION_LOCALE_SETTINGS)
                    }
                    runCatching { context.startActivity(intent) }
                },
            ),
        )

        // Learn
        SectionLabel("LEARN")
        LinkCardGroup(
            rows = listOf(
                LinkRow(Lucide.Info, "About Memory.Wiki", Brand.MicroInfo) {
                    navController.navigate("about")
                },
                LinkRow(Lucide.BookOpen, "How it works", Brand.MicroWarn) {
                    openUrl("$baseUrl/how")
                },
                LinkRow(Lucide.RotateCcw, "Replay welcome tour", Brand.TextMuted) {
                    // Clears mw.onboarded so RootShell shows the
                    // 3-card pager again on next cold start.
                    val prefs = context.getSharedPreferences(
                        "memorywiki.prefs",
                        android.content.Context.MODE_PRIVATE,
                    )
                    prefs.edit().putBoolean("mw.onboarded", false).apply()
                    android.widget.Toast.makeText(
                        context,
                        "Onboarding will play next launch",
                        android.widget.Toast.LENGTH_SHORT,
                    ).show()
                },
            ),
        )

        // Feedback
        SectionLabel("FEEDBACK")
        LinkCardGroup(
            rows = listOf(
                LinkRow(Lucide.Mail, "Send feedback", Brand.MicroInfo) {
                    val intent = Intent(Intent.ACTION_SENDTO).apply {
                        data = "mailto:hi@raymind.ai".toUri()
                        putExtra(Intent.EXTRA_SUBJECT, "Memory.Wiki Android feedback")
                        putExtra(
                            Intent.EXTRA_TEXT,
                            "\n\n— sent from Android v${BuildConfig.VERSION_NAME}",
                        )
                    }
                    context.startActivity(intent)
                },
            ),
        )

        // Legal
        SectionLabel("LEGAL")
        LinkCardGroup(
            rows = listOf(
                LinkRow(Lucide.FileText, "Terms", Brand.TextFaint) { openUrl("$baseUrl/terms") },
                LinkRow(Lucide.Shield, "Privacy", Brand.TextFaint) { openUrl("$baseUrl/privacy") },
            ),
        )

        // Version footer
        Text(
            "Android Companion v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            style = BrandType.mono(9, FontWeight.Medium),
            color = Brand.TextFaint,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )

        Spacer(Modifier.height(2.dp))

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
            Icon(Lucide.LogOut, null, tint = Brand.MicroRed, modifier = Modifier.size(16.dp))
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

// ───────────────────── Hub stats card ─────────────────────

@Composable
private fun HubStatsCard(memories: Int, publicMemories: Int, bundles: Int, publicBundles: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("YOUR HUB")
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            HubStatTile(
                label = "MEMORIES",
                dotColor = Brand.MicroInfo,
                value = memories.toString(),
                sublabel = "$publicMemories public · ${memories - publicMemories} private",
                modifier = Modifier.weight(1f),
            )
            HubStatTile(
                label = "BUNDLES",
                dotColor = Brand.MicroWarn,
                value = bundles.toString(),
                sublabel = "$publicBundles public · ${bundles - publicBundles} private",
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun HubStatTile(
    label: String,
    dotColor: androidx.compose.ui.graphics.Color,
    value: String,
    sublabel: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Box(
                Modifier
                    .size(5.dp)
                    .clip(CircleShape)
                    .background(dotColor),
            )
            Text(
                label,
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.TextFaint,
            )
        }
        Text(
            value,
            style = BrandType.display(26),
            color = Brand.TextPrimary,
        )
        Text(
            sublabel,
            style = BrandType.mono(9),
            color = Brand.TextFaint,
        )
    }
}

// ───────────────────── Link card group ─────────────────────

private data class LinkRow(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val label: String,
    val tint: androidx.compose.ui.graphics.Color,
    val onClick: () -> Unit,
)

@Composable
private fun LinkCardGroup(rows: List<LinkRow>) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(14.dp)),
    ) {
        rows.forEachIndexed { i, row ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { row.onClick() }
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                    Icon(row.icon, null, tint = row.tint, modifier = Modifier.size(13.dp))
                }
                Text(
                    row.label,
                    style = BrandType.body(14),
                    color = Brand.TextPrimary,
                    modifier = Modifier.weight(1f),
                )
                Icon(Lucide.ChevronRight, null, tint = Brand.TextFaint, modifier = Modifier.size(11.dp))
            }
            if (i < rows.size - 1) Divider()
        }
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
                colors = OutlinedTextFieldDefaults.colors(
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
