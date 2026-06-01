// @ts-nocheck
// toolbar-state — bind a TipTap editor's active-mark/active-node state
// to the visual state of toolbar buttons that carry a `data-action`
// attribute. Web's WysiwygToolbar.tsx (apps/web/src/components/
// WysiwygToolbar.tsx) does this in React; this module ports the same
// behaviour as pure DOM so the Desktop renderer + the VSCode webview
// can share it without pulling React.
//
// Usage:
//   const detach = attachToolbarState(editor, document.getElementById('toolbar'));
//   // ...later, when tearing down:
//   detach();
//
// Effects on each matching button:
//   - aria-pressed="true" / data-active="true" when isActive(mapping)
//   - aria-pressed="false" / data-active="false" otherwise
// CSS in editor.css + each channel's preview.css uses [data-active] to
// paint the orange-on-ink "pressed" look.
//
// Mapping table — actions web routes to TipTap's isActive():
//   bold          → "bold"
//   italic        → "italic"
//   strike        → "strike"
//   strikethrough → "strike"           (web uses both names)
//   code          → "code"
//   h1..h6        → ["heading", {level: N}]
//   p             → "paragraph"
//   ul            → "bulletList"
//   ol            → "orderedList"
//   task          → "taskList"
//   blockquote    → "blockquote"
//   codeblock     → "codeBlock"
//   link          → "link"
//
// Buttons whose data-action is not in the mapping are ignored — they
// likely represent commands without a binary active state (undo,
// indent, image, table, math, mermaid, hr, removeFormat, ai-tools).

type Editor = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MAPPING: Record<string, { name: string; attrs?: Record<string, any> }> = {
  bold: { name: "bold" },
  italic: { name: "italic" },
  strike: { name: "strike" },
  strikethrough: { name: "strike" },
  code: { name: "code" },
  h1: { name: "heading", attrs: { level: 1 } },
  h2: { name: "heading", attrs: { level: 2 } },
  h3: { name: "heading", attrs: { level: 3 } },
  h4: { name: "heading", attrs: { level: 4 } },
  h5: { name: "heading", attrs: { level: 5 } },
  h6: { name: "heading", attrs: { level: 6 } },
  p: { name: "paragraph" },
  ul: { name: "bulletList" },
  ol: { name: "orderedList" },
  task: { name: "taskList" },
  blockquote: { name: "blockquote" },
  codeblock: { name: "codeBlock" },
  link: { name: "link" },
};

export interface AttachToolbarStateHandle {
  /** Stop listening + reset every button's active state. */
  detach(): void;
  /** Force a recompute (e.g. after a programmatic transaction). */
  refresh(): void;
}

export function attachToolbarState(
  editor: Editor,
  toolbarEl: HTMLElement | null | undefined
): AttachToolbarStateHandle {
  if (!editor || !toolbarEl) {
    return { detach: () => undefined, refresh: () => undefined };
  }

  const buttons: { el: HTMLElement; name: string; attrs?: Record<string, unknown> }[] = [];
  toolbarEl.querySelectorAll("[data-action]").forEach((btn) => {
    const action = btn.getAttribute("data-action") || "";
    const entry = MAPPING[action];
    if (entry) buttons.push({ el: btn as HTMLElement, name: entry.name, attrs: entry.attrs });
  });

  const update = (): void => {
    for (const b of buttons) {
      let on = false;
      try {
        on = b.attrs ? editor.isActive(b.name, b.attrs) : editor.isActive(b.name);
      } catch {
        on = false;
      }
      if (on) {
        b.el.setAttribute("aria-pressed", "true");
        b.el.setAttribute("data-active", "true");
      } else {
        b.el.setAttribute("aria-pressed", "false");
        b.el.setAttribute("data-active", "false");
      }
    }
  };

  // Fire once so initial mount paints the correct state.
  update();

  editor.on("selectionUpdate", update);
  editor.on("update", update);
  editor.on("focus", update);
  editor.on("blur", update);

  return {
    detach() {
      try { editor.off("selectionUpdate", update); } catch { /* noop */ }
      try { editor.off("update", update); } catch { /* noop */ }
      try { editor.off("focus", update); } catch { /* noop */ }
      try { editor.off("blur", update); } catch { /* noop */ }
      for (const b of buttons) {
        b.el.removeAttribute("aria-pressed");
        b.el.removeAttribute("data-active");
      }
    },
    refresh: update,
  };
}
