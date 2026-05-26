/**
 * CodeMirror 6 WYSIWYG Decoration Plugin
 *
 * Hides markdown syntax and shows rendered styling when the cursor
 * is outside a block. When the cursor enters a block, decorations
 * are removed and raw markdown is shown for editing.
 *
 * Approach: Walk the syntax tree, find markdown markers, and apply
 * Decoration.replace (to hide markers) + Decoration.mark (to style content).
 */

import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { EditorState, Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ─── Widget for list bullets ───

class BulletWidget extends WidgetType {
  constructor(private ordered: boolean, private index: number) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-bullet";
    span.textContent = this.ordered ? `${this.index}.` : "\u2022";
    span.style.cssText = "color: var(--text-primary); margin-right: 4px; font-weight: 600;";
    return span;
  }
  eq(other: BulletWidget) {
    return this.ordered === other.ordered && this.index === other.index;
  }
}

// ─── Widget for horizontal rule ───

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("div");
    hr.className = "cm-md-hr";
    hr.style.cssText = "border-top: 1px solid var(--border); margin: 8px 0;";
    return hr;
  }
}

// ─── Widget for checkboxes ───

class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-checkbox";
    span.textContent = this.checked ? "\u2611" : "\u2610";
    span.style.cssText = `color: var(--text-primary); margin-right: 4px; font-size: 1.1em; cursor: default;`;
    return span;
  }
  eq(other: CheckboxWidget) {
    return this.checked === other.checked;
  }
}

// ─── Helpers ───

/** Get the line range that the cursor is currently on */
function getCursorBlockRange(state: EditorState): { from: number; to: number } | null {
  const sel = state.selection.main;
  // Get the full line range containing the selection
  const fromLine = state.doc.lineAt(sel.from);
  const toLine = state.doc.lineAt(sel.to);

  // Walk up the syntax tree to find the containing block node
  const tree = syntaxTree(state);
  let blockFrom = fromLine.from;
  let blockTo = toLine.to;

  // Find the nearest block-level node containing the cursor
  tree.iterate({
    from: sel.from,
    to: sel.from,
    enter(node) {
      const blockTypes = [
        "ATXHeading1", "ATXHeading2", "ATXHeading3",
        "ATXHeading4", "ATXHeading5", "ATXHeading6",
        "SetextHeading1", "SetextHeading2",
        "Paragraph", "FencedCode", "CodeBlock",
        "Blockquote", "ListItem", "HorizontalRule",
        "Table", "HTMLBlock",
      ];
      if (blockTypes.includes(node.name)) {
        blockFrom = node.from;
        blockTo = node.to;
      }
    },
  });

  return { from: blockFrom, to: blockTo };
}

/** Check if a range overlaps with the cursor block */
function overlapsWithCursor(
  from: number,
  to: number,
  cursorBlock: { from: number; to: number } | null
): boolean {
  if (!cursorBlock) return false;
  return from < cursorBlock.to && to > cursorBlock.from;
}

// ─── Decoration CSS classes ───

const headingStyles: Record<string, Decoration> = {
  ATXHeading1: Decoration.mark({ class: "cm-md-h1" }),
  ATXHeading2: Decoration.mark({ class: "cm-md-h2" }),
  ATXHeading3: Decoration.mark({ class: "cm-md-h3" }),
  ATXHeading4: Decoration.mark({ class: "cm-md-h4" }),
  ATXHeading5: Decoration.mark({ class: "cm-md-h5" }),
  ATXHeading6: Decoration.mark({ class: "cm-md-h6" }),
};

const boldDeco = Decoration.mark({ class: "cm-md-bold" });
const italicDeco = Decoration.mark({ class: "cm-md-italic" });
const strikeDeco = Decoration.mark({ class: "cm-md-strike" });
const inlineCodeDeco = Decoration.mark({ class: "cm-md-inline-code" });
const linkTextDeco = Decoration.mark({ class: "cm-md-link-text" });
const _blockquoteDeco = Decoration.mark({ class: "cm-md-blockquote" });
const hiddenDeco = Decoration.replace({});

// ─── Build decorations from syntax tree ───

function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const tree = syntaxTree(state);
  const cursorBlock = getCursorBlockRange(state);

  tree.iterate({
    enter(node) {
      const { from, to, name } = node;

      // Skip decorations for the block containing the cursor
      if (overlapsWithCursor(from, to, cursorBlock)) {
        // Still allow entering child nodes (don't return false)
        // but don't add decorations for marker nodes in cursor block
        const markerTypes = [
          "HeaderMark", "EmphasisMark", "CodeMark",
          "StrikethroughMark", "LinkMark", "QuoteMark",
          "ListMark", "TaskMarker",
        ];
        if (markerTypes.includes(name)) return;
        // Don't style headings/bold/italic etc in cursor block either
        if (name in headingStyles) return;
        if (["StrongEmphasis", "Emphasis", "Strikethrough", "InlineCode", "Link"].includes(name)) return;
        return; // skip all decorations in cursor block
      }

      // ── Headings: hide # marks, style text ──
      if (name in headingStyles) {
        decorations.push(headingStyles[name].range(from, to));
        return; // children will be processed (HeaderMark hidden below)
      }
      if (name === "HeaderMark") {
        // Hide # and the space after it
        const after = state.doc.sliceString(to, to + 1);
        const end = after === " " ? to + 1 : to;
        decorations.push(hiddenDeco.range(from, end));
        return false;
      }

      // ── Bold ──
      if (name === "StrongEmphasis") {
        // Find the EmphasisMark children (** or __)
        const text = state.doc.sliceString(from, to);
        const markerLen = text.startsWith("**") ? 2 : text.startsWith("__") ? 2 : 0;
        if (markerLen > 0) {
          decorations.push(hiddenDeco.range(from, from + markerLen));
          decorations.push(hiddenDeco.range(to - markerLen, to));
          decorations.push(boldDeco.range(from + markerLen, to - markerLen));
        }
        return false; // don't process children
      }

      // ── Italic ──
      if (name === "Emphasis") {
        const text = state.doc.sliceString(from, to);
        const markerLen = text.startsWith("*") || text.startsWith("_") ? 1 : 0;
        if (markerLen > 0) {
          decorations.push(hiddenDeco.range(from, from + markerLen));
          decorations.push(hiddenDeco.range(to - markerLen, to));
          decorations.push(italicDeco.range(from + markerLen, to - markerLen));
        }
        return false;
      }

      // ── Strikethrough ──
      if (name === "Strikethrough") {
        decorations.push(hiddenDeco.range(from, from + 2)); // ~~
        decorations.push(hiddenDeco.range(to - 2, to));
        decorations.push(strikeDeco.range(from + 2, to - 2));
        return false;
      }

      // ── Inline code ──
      if (name === "InlineCode") {
        const text = state.doc.sliceString(from, to);
        const backticks = text.match(/^(`+)/)?.[1].length || 1;
        decorations.push(hiddenDeco.range(from, from + backticks));
        decorations.push(hiddenDeco.range(to - backticks, to));
        decorations.push(inlineCodeDeco.range(from + backticks, to - backticks));
        return false;
      }

      // ── Links: [text](url) → show "text" as link ──
      if (name === "Link") {
        // Find URL and LinkMark children
        let linkLabelFrom = -1, linkLabelTo = -1;
        let hasUrl = false;
        const cursor = node.node.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === "LinkMark") {
              // [ or ] or ( or )
              const mark = state.doc.sliceString(cursor.from, cursor.to);
              if (mark === "[") linkLabelFrom = cursor.to;
              if (mark === "]") linkLabelTo = cursor.from;
            }
            if (cursor.name === "URL") hasUrl = true;
          } while (cursor.nextSibling());
        }

        if (linkLabelFrom >= 0 && linkLabelTo >= 0 && hasUrl) {
          // Hide everything except the label text
          decorations.push(hiddenDeco.range(from, linkLabelFrom)); // [
          decorations.push(hiddenDeco.range(linkLabelTo, to)); // ](url)
          decorations.push(linkTextDeco.range(linkLabelFrom, linkLabelTo));
        }
        return false;
      }

      // ── Blockquote marks ──
      if (name === "QuoteMark") {
        // Dim the > instead of hiding (keeps structure visible)
        decorations.push(Decoration.mark({ class: "cm-md-quote-mark" }).range(from, to));
        return false;
      }

      // ── List markers ──
      if (name === "ListMark") {
        const text = state.doc.sliceString(from, to).trim();
        const isOrdered = /^\d+[.)]$/.test(text);
        const index = isOrdered ? parseInt(text) : 0;

        // Hide the marker and replace with styled bullet/number
        const after = state.doc.sliceString(to, to + 1);
        const end = after === " " ? to + 1 : to;
        decorations.push(Decoration.replace({
          widget: new BulletWidget(isOrdered, index),
        }).range(from, end));
        return false;
      }

      // ── Task markers [x] / [ ] ──
      if (name === "TaskMarker") {
        const text = state.doc.sliceString(from, to);
        const checked = text.includes("x") || text.includes("X");
        const after = state.doc.sliceString(to, to + 1);
        const end = after === " " ? to + 1 : to;
        decorations.push(Decoration.replace({
          widget: new CheckboxWidget(checked),
        }).range(from, end));
        return false;
      }

      // ── Horizontal rule ──
      if (name === "HorizontalRule") {
        decorations.push(Decoration.replace({
          widget: new HrWidget(),
        }).range(from, to));
        return false;
      }
    },
  });

  // Sort decorations by position (required by CM6)
  decorations.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(decorations, true);
}

// ─── ViewPlugin ───

export const wysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// ─── CSS theme for decoration classes ───

export const wysiwygTheme = EditorView.baseTheme({
  ".cm-md-h1": {
    fontSize: "1.8em",
    fontWeight: "700",
    lineHeight: "1.3",
    color: "var(--text-primary)",
  },
  ".cm-md-h2": {
    fontSize: "1.45em",
    fontWeight: "700",
    lineHeight: "1.35",
    color: "var(--h2-color, var(--text-primary))",
  },
  ".cm-md-h3": {
    fontSize: "1.2em",
    fontWeight: "600",
    lineHeight: "1.4",
    color: "var(--text-primary)",
  },
  ".cm-md-h4": {
    fontSize: "1.05em",
    fontWeight: "600",
    color: "var(--text-primary)",
  },
  ".cm-md-h5": {
    fontSize: "1em",
    fontWeight: "600",
    color: "var(--text-secondary)",
  },
  ".cm-md-h6": {
    fontSize: "0.95em",
    fontWeight: "600",
    color: "var(--text-tertiary)",
  },
  ".cm-md-bold": {
    fontWeight: "700",
  },
  ".cm-md-italic": {
    fontStyle: "italic",
  },
  ".cm-md-strike": {
    textDecoration: "line-through",
    opacity: "0.6",
  },
  ".cm-md-inline-code": {
    fontFamily: "inherit",
    backgroundColor: "var(--border)",
    color: "var(--text-primary)",
    padding: "1px 5px",
    borderRadius: "3px",
    fontSize: "0.9em",
  },
  ".cm-md-link-text": {
    color: "var(--text-primary)",
    textDecoration: "underline",
    cursor: "pointer",
  },
  ".cm-md-quote-mark": {
    color: "var(--text-primary)",
    opacity: "0.4",
  },
  ".cm-md-blockquote": {
    borderLeft: "3px solid var(--border)",
    paddingLeft: "12px",
    color: "var(--text-secondary)",
    fontStyle: "italic",
  },
  ".cm-md-bullet": {
    display: "inline",
  },
  ".cm-md-hr": {
    display: "block",
  },
  ".cm-md-checkbox": {
    display: "inline",
  },
});
