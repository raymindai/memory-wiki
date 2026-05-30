/*
 * MarkdownPillBar — Notes-style horizontally scrolling accessory
 * bar that sits above the soft keyboard while the Capture body
 * field has focus. Port of iOS MarkdownPillBar in MarkdownEditor.
 *
 *   Layout:
 *     56dp tall bar, 48dp inner pill (24dp corner), SheetBg fill,
 *     hairline border. Horizontal ScrollView of 40dp icon buttons.
 *
 *   Actions (left → right):
 *     # heading · B bold · I italic · ul list · ol list · task
 *     · code fence · link · quote · — hr · | divider · keyboard
 *     dismiss
 *
 *   Each tap fires selection haptic + transforms the current
 *   TextFieldValue (cursor + selection aware) and emits the result.
 */

package wiki.memory.memorywiki.ui.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.composables.icons.lucide.*
import wiki.memory.memorywiki.ui.theme.Brand

@Composable
fun MarkdownPillBar(
    value: TextFieldValue,
    onChange: (TextFieldValue) -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    val ime = LocalSoftwareKeyboardController.current
    val act: (PillAction) -> Unit = { action ->
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        when (action) {
            PillAction.Heading -> onChange(prependLine(value, "# "))
            PillAction.Bold -> onChange(wrapSelection(value, "**", "**", "bold text"))
            PillAction.Italic -> onChange(wrapSelection(value, "*", "*", "italic"))
            PillAction.Bullet -> onChange(prependLine(value, "- "))
            PillAction.Ordered -> onChange(prependLine(value, "1. "))
            PillAction.Task -> onChange(prependLine(value, "- [ ] "))
            PillAction.Code -> onChange(wrapSelection(value, "`", "`", "code"))
            PillAction.Link -> onChange(insertText(value, "[](url)", caretOffsetFromEnd = 6))
            PillAction.Quote -> onChange(prependLine(value, "> "))
            PillAction.Rule -> onChange(insertText(value, "\n---\n", caretOffsetFromEnd = 0))
            PillAction.DismissKeyboard -> ime?.hide()
        }
    }
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp)
            .padding(bottom = 6.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(Brand.SheetBg.copy(alpha = 0.92f))
                .border(0.5.dp, Brand.BorderDim, RoundedCornerShape(24.dp))
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            PillIcon(Lucide.Hash) { act(PillAction.Heading) }
            PillIcon(Lucide.Bold) { act(PillAction.Bold) }
            PillIcon(Lucide.Italic) { act(PillAction.Italic) }
            PillIcon(Lucide.List) { act(PillAction.Bullet) }
            PillIcon(Lucide.ListOrdered) { act(PillAction.Ordered) }
            PillIcon(Lucide.SquareCheck) { act(PillAction.Task) }
            PillIcon(Lucide.Code) { act(PillAction.Code) }
            PillIcon(Lucide.Link) { act(PillAction.Link) }
            PillIcon(Lucide.Quote) { act(PillAction.Quote) }
            PillIcon(Lucide.Minus) { act(PillAction.Rule) }
            Spacer(Modifier.width(2.dp))
            Box(Modifier.width(1.dp).height(22.dp).background(Brand.BorderDim))
            Spacer(Modifier.width(2.dp))
            PillIcon(Lucide.ChevronDown, tint = Brand.TextMuted) { act(PillAction.DismissKeyboard) }
        }
    }
}

private enum class PillAction {
    Heading, Bold, Italic, Bullet, Ordered, Task,
    Code, Link, Quote, Rule, DismissKeyboard,
}

@Composable
private fun PillIcon(
    icon: ImageVector,
    tint: androidx.compose.ui.graphics.Color = Brand.TextPrimary,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .size(40.dp)
            .clip(CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(16.dp))
    }
}

// ───────────────────── Text transforms ─────────────────────

/** Wrap the current selection in `left` + `right`. If selection
 *  is empty, insert `placeholder` between the wrappers and select
 *  it so the user can type-over. */
private fun wrapSelection(
    v: TextFieldValue,
    left: String,
    right: String,
    placeholder: String,
): TextFieldValue {
    val sel = v.selection
    val text = v.text
    return if (sel.collapsed) {
        val insertion = "$left$placeholder$right"
        val before = text.substring(0, sel.start)
        val after = text.substring(sel.start)
        val newText = before + insertion + after
        val selStart = sel.start + left.length
        val selEnd = selStart + placeholder.length
        TextFieldValue(newText, TextRange(selStart, selEnd))
    } else {
        val before = text.substring(0, sel.min)
        val middle = text.substring(sel.min, sel.max)
        val after = text.substring(sel.max)
        val newText = before + left + middle + right + after
        val caret = sel.max + left.length + right.length
        TextFieldValue(newText, TextRange(caret))
    }
}

/** Insert literal text at the cursor. `caretOffsetFromEnd`
 *  positions the caret N chars before the end of the inserted
 *  text (e.g. inside `[](url)` selectors). */
private fun insertText(v: TextFieldValue, insertion: String, caretOffsetFromEnd: Int): TextFieldValue {
    val sel = v.selection
    val before = v.text.substring(0, sel.start)
    val after = v.text.substring(sel.end)
    val newText = before + insertion + after
    val caret = sel.start + insertion.length - caretOffsetFromEnd
    return TextFieldValue(newText, TextRange(caret))
}

/** Prepend a prefix to the start of the current line — finds the
 *  preceding newline (or start of text) and inserts there. Always
 *  positions the caret after the inserted prefix. */
private fun prependLine(v: TextFieldValue, prefix: String): TextFieldValue {
    val text = v.text
    val sel = v.selection
    val lineStart = text.lastIndexOf('\n', sel.start - 1).let { if (it < 0) 0 else it + 1 }
    val before = text.substring(0, lineStart)
    val rest = text.substring(lineStart)
    val newText = before + prefix + rest
    val caret = sel.start + prefix.length
    return TextFieldValue(newText, TextRange(caret))
}
