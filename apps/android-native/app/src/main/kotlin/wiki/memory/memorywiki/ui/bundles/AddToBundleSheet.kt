/*
 * AddToBundleSheet — bottom sheet that lets the user file a doc
 * into an existing bundle or spin up a new one inline. Port of
 * iOS AddToBundleSheet.
 *
 *   Anatomy:
 *     Header  display 20 'Add to bundle' + 28dp xmark close
 *     NEW BUNDLE section
 *       Collapsed → '+ Create new bundle' row, tap expands
 *       Expanded  → inline TextField + Create capsule button
 *     YOUR BUNDLES section
 *       BundleLayersIcon 18 + title body 14 medium + 'N
 *       memor(y|ies)' mono 9 + check.fill mark when adding
 *
 *   Flow:
 *     - Picks the existing bundle → addDocumentsToBundle, swap
 *       the row to a microLime checkmark for 700ms, dismiss
 *     - Creates a new bundle → createBundle (with this doc as
 *       the seed), dismiss
 */

package wiki.memory.memorywiki.ui.bundles

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Plus
import com.composables.icons.lucide.X
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.data.ApiClient
import wiki.memory.memorywiki.data.model.BundleSummary
import wiki.memory.memorywiki.ui.components.BundleLayersIcon
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.BrandType

@HiltViewModel
class AddToBundleViewModel @Inject constructor(val api: ApiClient) : ViewModel() {
    private val _bundles = MutableStateFlow<List<BundleSummary>>(emptyList())
    val bundles: StateFlow<List<BundleSummary>> = _bundles.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()
    private val _workingId = MutableStateFlow<String?>(null)
    val workingId: StateFlow<String?> = _workingId.asStateFlow()
    private val _addedId = MutableStateFlow<String?>(null)
    val addedId: StateFlow<String?> = _addedId.asStateFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        _loading.value = true
        runCatching { api.userBundles() }.onSuccess { _bundles.value = it.bundles }
        _loading.value = false
    }

    fun addDocToBundle(bundleId: String, docId: String, onDone: () -> Unit) =
        viewModelScope.launch {
            _workingId.value = bundleId
            runCatching { api.addDocumentsToBundle(bundleId, listOf(docId)) }
                .onSuccess {
                    _addedId.value = bundleId
                    _workingId.value = null
                    delay(700)
                    onDone()
                }
                .onFailure { _workingId.value = null }
        }

    fun createBundleWithDoc(title: String, docId: String, onDone: () -> Unit) =
        viewModelScope.launch {
            _workingId.value = "__new__"
            runCatching { api.createBundle(title = title, documentIds = listOf(docId)) }
                .onSuccess {
                    _workingId.value = null
                    onDone()
                }
                .onFailure { _workingId.value = null }
        }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddToBundleSheet(
    docId: String,
    onDismiss: () -> Unit,
    vm: AddToBundleViewModel = hiltViewModel(),
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val bundles by vm.bundles.collectAsState()
    val loading by vm.loading.collectAsState()
    val workingId by vm.workingId.collectAsState()
    val addedId by vm.addedId.collectAsState()
    val haptics = LocalHapticFeedback.current
    var expanded by remember { mutableStateOf(false) }
    var newTitle by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Brand.SheetBg,
        contentColor = Brand.TextPrimary,
        dragHandle = null,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp)
                .padding(top = 18.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Add to bundle",
                    style = BrandType.display(20),
                    color = Brand.TextPrimary,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(Brand.Surface)
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Lucide.X, null, tint = Brand.TextFaint, modifier = Modifier.size(12.dp))
                }
            }

            // NEW BUNDLE section
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "NEW BUNDLE",
                    style = BrandType.mono(9, FontWeight.Medium),
                    color = Brand.TextFaint,
                )
                if (!expanded) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Brand.Surface)
                            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
                            .clickable {
                                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                expanded = true
                            }
                            .padding(horizontal = 14.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Icon(Lucide.Plus, null, tint = Brand.TextPrimary, modifier = Modifier.size(13.dp))
                        Text(
                            "Create new bundle",
                            style = BrandType.body(14, FontWeight.Medium),
                            color = Brand.TextPrimary,
                        )
                    }
                } else {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Brand.Surface)
                            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        BasicTextField(
                            value = newTitle,
                            onValueChange = { newTitle = it },
                            singleLine = true,
                            textStyle = BrandType.body(14).copy(color = Brand.TextPrimary),
                            cursorBrush = SolidColor(Brand.TextPrimary),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                            modifier = Modifier.weight(1f),
                            decorationBox = { inner ->
                                if (newTitle.isEmpty()) {
                                    Text(
                                        "Bundle title",
                                        style = BrandType.body(14),
                                        color = Brand.TextFaint,
                                    )
                                }
                                inner()
                            },
                        )
                        val canCreate = newTitle.isNotBlank() && workingId == null
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (canCreate) Brand.TextPrimary else Brand.Surface)
                                .border(
                                    if (canCreate) 0.dp else 0.5.dp,
                                    Brand.BorderDim,
                                    RoundedCornerShape(50),
                                )
                                .clickable(enabled = canCreate) {
                                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    vm.createBundleWithDoc(newTitle.trim(), docId, onDismiss)
                                }
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                        ) {
                            Text(
                                if (workingId == "__new__") "Creating…" else "Create",
                                style = BrandType.body(12, FontWeight.Medium),
                                color = if (canCreate) Brand.Background else Brand.TextFaint,
                            )
                        }
                    }
                }
            }

            // YOUR BUNDLES section
            Text(
                "YOUR BUNDLES",
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.TextFaint,
            )
            if (loading && bundles.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(vertical = 22.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        color = Brand.TextMuted,
                        strokeWidth = 1.6.dp,
                    )
                }
            } else if (bundles.isEmpty()) {
                Text(
                    "No bundles yet. Create one above to file this doc into.",
                    style = BrandType.body(13),
                    color = Brand.TextMuted,
                )
            } else {
                LazyColumn(
                    Modifier.heightIn(max = 360.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(bundles, key = { it.id }) { b ->
                        BundlePickRow(
                            bundle = b,
                            working = workingId == b.id,
                            added = addedId == b.id,
                            onClick = {
                                if (workingId == null && addedId == null) {
                                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                    vm.addDocToBundle(b.id, docId, onDismiss)
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BundlePickRow(
    bundle: BundleSummary,
    working: Boolean,
    added: Boolean,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Brand.Surface)
            .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(10.dp))
            .clickable(enabled = !working && !added) { onClick() }
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        BundleLayersIcon(
            isDraft = bundle.isDraft,
            visibility = bundle.visibility,
            sizeDp = 18,
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                bundle.title ?: "Untitled Bundle",
                style = BrandType.body(14, FontWeight.Medium),
                color = Brand.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${bundle.documentCount} memor${if (bundle.documentCount == 1) "y" else "ies"}",
                style = BrandType.mono(9, FontWeight.Medium),
                color = Brand.TextFaint,
            )
        }
        if (working) {
            CircularProgressIndicator(
                modifier = Modifier.size(14.dp),
                color = Brand.TextMuted,
                strokeWidth = 1.4.dp,
            )
        }
        AnimatedVisibility(visible = added) {
            Box(
                Modifier
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(Brand.MicroLime),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Lucide.Check, null, tint = Brand.Background, modifier = Modifier.size(10.dp))
            }
        }
    }
}
