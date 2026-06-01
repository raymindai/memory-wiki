// @ts-nocheck
// selection-toolbar — the floating mini-toolbar that pops above the
// user's text selection. Web ships it as a React component
// (apps/web/src/components/TiptapLiveEditor.tsx L711-L1109); this is
// the same shape + buttons in vanilla DOM so Desktop + VSCode can
// share one implementation.
//
// Buttons (left to right, dividers between groups):
//   B  I  S  </>         (bold / italic / strike / inline code)
//   H1 H2 H3              (headings)
//   • • ☐  "             (bulleted / ordered / task list / blockquote)
//   ↳  ↲                  (indent / outdent)
//   🔗 ─                  (link / horizontal rule)
//   ✦                     (AI menu)
//
// Positioning:
//   - Subscribe to editor.on("selectionUpdate") + "blur".
//   - Hidden when selection is empty, editor unfocused, or selection
//     intersects <pre> / .mermaid / .katex-display.
//   - Otherwise compute the midpoint of coordsAtPos(from..to) and
//     place the toolbar 8px above it. Auto-flip below when the
//     selection sits near the top of the viewport.
//   - Uses fixed positioning (matches web's React portal pattern), so
//     it stays correct regardless of which scroll container holds the
//     editor.
//
// AI wiring:
//   - Host channels supply `options.runAi`, exactly like buildAiMenu.
//   - When the AI button is clicked, we instantiate buildAiMenu()
//     anchored next to the selection toolbar and pass the saved
//     selection range so the menu can replace it on completion.

import { buildInlineLinkInput, type InlineLinkInputHandle } from "./link-input";
import { buildAiMenu, type AiMenuHandle, type AiMenuOptions } from "./ai-menu";

type Editor = any;

export interface MountSelectionToolbarOptions {
  /**
   * Optional AI runner. Pass to enable the ✦ AI button + popover.
   * Omit to hide the AI button entirely. Web always supplies one;
   * Desktop + VSCode supply one too (routed through their IPC).
   */
  runAi?: AiMenuOptions["runAi"];
}

export interface SelectionToolbarHandle {
  /** Force a recompute. */
  refresh(): void;
  destroy(): void;
}

const ICON = {
  bold:   '<span style="font-weight:700;font-size:13px">B</span>',
  italic: '<span style="font-style:italic;font-size:13px">I</span>',
  strike: '<span style="text-decoration:line-through;font-size:13px">S</span>',
  code:   '<span style="font-family:ui-monospace,monospace;font-size:11px">&lt;/&gt;</span>',
  h1:     '<span style="font-weight:700;font-size:11px">H1</span>',
  h2:     '<span style="font-weight:700;font-size:11px">H2</span>',
  h3:     '<span style="font-weight:600;font-size:11px">H3</span>',
  ul:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="4" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="3" cy="12" r="1.2"/><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg>',
  ol:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><text x="1" y="5.5" font-size="5" font-weight="700" font-family="system-ui">1</text><text x="1" y="9.5" font-size="5" font-weight="700" font-family="system-ui">2</text><text x="1" y="13.5" font-size="5" font-weight="700" font-family="system-ui">3</text><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg>',
  task:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="5" height="5" rx="1"/><path d="M3.5 4.5l1 1 2-2" stroke-linecap="round"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="3" width="5" height="2" rx="0.5" fill="currentColor"/><rect x="9" y="10" width="5" height="2" rx="0.5" fill="currentColor"/></svg>',
  quote:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 4h4v4H5.5L4 11H3V4zm6 0h4v4h-1.5L10 11H9V4z"/></svg>',
  indent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 6H11M21 12H11M21 18H11M3 8l4 4-4 4"/></svg>',
  outdent:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 6H11M21 12H11M21 18H11M7 8l-4 4 4 4"/></svg>',
  link:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
  hr:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="8" x2="14" y2="8"/></svg>',
  clear:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
  ai:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>',
};

interface ButtonDef {
  key: string;
  title: string;
  html: string;
  isActive: () => boolean;
  run: (anchor: HTMLElement) => void;
}

export function mountSelectionToolbar(
  editor: Editor,
  options: MountSelectionToolbarOptions = {}
): SelectionToolbarHandle {
  if (!editor) return { refresh() { /* noop */ }, destroy() { /* noop */ } };

  // ── container ──
  const bar = document.createElement("div");
  bar.className = "mw-selection-toolbar";
  bar.style.cssText = [
    "position: fixed",
    "z-index: 9999",
    "display: none",
    "align-items: center",
    "gap: 2px",
    "padding: 4px 6px",
    "border-radius: 10px",
    "background: var(--surface, #1e1e1e)",
    "border: 1px solid var(--border, #3a3a3c)",
    "box-shadow: 0 8px 32px rgba(0,0,0,0.3)",
    "color: var(--text-secondary, var(--fg, #ddd))",
    "pointer-events: auto",
    "user-select: none",
  ].join(";");
  bar.addEventListener("mousedown", (e) => e.preventDefault());
  document.body.appendChild(bar);

  // ── helpers ──
  const sep = (): HTMLSpanElement => {
    const s = document.createElement("span");
    s.style.cssText = "width:1px;height:16px;background:var(--border-dim,var(--border,#3a3a3c));margin:0 2px;display:inline-block";
    return s;
  };

  function mkBtn(def: ButtonDef): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.title = def.title;
    b.dataset.key = def.key;
    b.innerHTML = def.html;
    b.style.cssText = [
      "background: transparent",
      "color: inherit",
      "border: none",
      "border-radius: 4px",
      "padding: 4px 6px",
      "cursor: pointer",
      "display: inline-flex",
      "align-items: center",
      "justify-content: center",
      "transition: background 0.1s",
      "min-width: 24px",
      "height: 24px",
    ].join(";");
    b.addEventListener("click", (e) => {
      e.preventDefault();
      def.run(b);
    });
    b.addEventListener("mouseenter", () => { if (!b.disabled) b.style.background = "var(--menu-hover, var(--surface-hover, rgba(255,255,255,0.06)))"; });
    b.addEventListener("mouseleave", () => { syncOne(b, def); });
    return b;
  }

  function syncOne(b: HTMLButtonElement, def: ButtonDef): void {
    let on = false;
    try { on = def.isActive(); } catch { on = false; }
    if (on) {
      b.style.background = "var(--border, #3a3a3c)";
      b.style.color = "var(--text-primary, var(--fg, #fff))";
      b.setAttribute("data-active", "true");
      b.setAttribute("aria-pressed", "true");
    } else {
      b.style.background = "transparent";
      b.style.color = "var(--text-secondary, var(--fg, #ddd))";
      b.setAttribute("data-active", "false");
      b.setAttribute("aria-pressed", "false");
    }
  }

  // ── link input lives inside the bar for inline editing ──
  const linkInput: InlineLinkInputHandle = buildInlineLinkInput(editor, bar);

  // ── AI menu (optional) ──
  const aiMenu: AiMenuHandle | null = options.runAi
    ? buildAiMenu(editor, { runAi: options.runAi })
    : null;

  // ── definitions ──
  const defs: ButtonDef[] = [
    { key: "bold",   title: "Bold (⌘B)",     html: ICON.bold,   isActive: () => isActive("bold"),   run: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", title: "Italic (⌘I)",   html: ICON.italic, isActive: () => isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { key: "strike", title: "Strikethrough", html: ICON.strike, isActive: () => isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
    { key: "code",   title: "Inline code",   html: ICON.code,   isActive: () => isActive("code"),   run: () => editor.chain().focus().toggleCode().run() },
    { key: "_sep1",  title: "", html: "", isActive: () => false, run: () => undefined },
    { key: "h1",     title: "Heading 1", html: ICON.h1, isActive: () => isActiveAttr("heading", { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: "h2",     title: "Heading 2", html: ICON.h2, isActive: () => isActiveAttr("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "h3",     title: "Heading 3", html: ICON.h3, isActive: () => isActiveAttr("heading", { level: 3 }), run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: "_sep2",  title: "", html: "", isActive: () => false, run: () => undefined },
    { key: "ul",     title: "Bullet list",  html: ICON.ul,    isActive: () => isActive("bulletList"),  run: () => editor.chain().focus().toggleBulletList().run() },
    { key: "ol",     title: "Ordered list", html: ICON.ol,    isActive: () => isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: "task",   title: "Task list",    html: ICON.task,  isActive: () => isActive("taskList"),    run: () => editor.chain().focus().toggleTaskList().run() },
    { key: "quote",  title: "Quote",        html: ICON.quote, isActive: () => isActive("blockquote"),  run: () => editor.chain().focus().toggleBlockquote().run() },
    { key: "_sep3",  title: "", html: "", isActive: () => false, run: () => undefined },
    { key: "indent", title: "Indent",  html: ICON.indent,  isActive: () => false, run: () => indentSink() },
    { key: "outdent",title: "Outdent", html: ICON.outdent, isActive: () => false, run: () => indentLift() },
    { key: "_sep4",  title: "", html: "", isActive: () => false, run: () => undefined },
    { key: "link",   title: "Link (⌘K)", html: ICON.link, isActive: () => isActive("link"),
      run: (anchor) => {
        if (isActive("link")) { editor.chain().focus().unsetLink().run(); return; }
        linkInput.open(anchor);
      } },
    { key: "hr",     title: "Horizontal rule", html: ICON.hr,    isActive: () => false, run: () => editor.chain().focus().setHorizontalRule().run() },
    { key: "clear",  title: "Clear formatting", html: ICON.clear, isActive: () => false, run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
  ];
  if (aiMenu) {
    defs.push({ key: "_sep5", title: "", html: "", isActive: () => false, run: () => undefined });
    defs.push({
      key: "ai", title: "AI on selection", html: ICON.ai,
      isActive: () => aiMenu.isOpen(),
      run: (anchor) => {
        const { from, to } = editor.state.selection;
        if (from === to) return;
        const snippet = (() => {
          try { return editor.state.doc.textBetween(from, to, "\n").trim(); } catch { return ""; }
        })();
        aiMenu.open({ anchor, snippet, range: { from, to } });
      },
    });
  }

  const buttons: { el: HTMLButtonElement; def: ButtonDef }[] = [];
  for (const def of defs) {
    if (def.key.startsWith("_sep")) {
      bar.appendChild(sep());
      continue;
    }
    const b = mkBtn(def);
    buttons.push({ el: b, def });
    bar.appendChild(b);
  }

  function isActive(name: string): boolean {
    try { return !!editor.isActive(name); } catch { return false; }
  }
  function isActiveAttr(name: string, attrs: Record<string, unknown>): boolean {
    try { return !!editor.isActive(name, attrs); } catch { return false; }
  }
  function indentSink(): void {
    try {
      if (isActive("taskList")) editor.chain().focus().sinkListItem("taskItem").run();
      else editor.chain().focus().sinkListItem("listItem").run();
    } catch { /* not in list */ }
  }
  function indentLift(): void {
    try {
      if (isActive("taskList")) editor.chain().focus().liftListItem("taskItem").run();
      else editor.chain().focus().liftListItem("listItem").run();
    } catch { /* not in list */ }
  }

  function syncActives(): void {
    for (const { el, def } of buttons) syncOne(el, def);
  }

  // ── positioning ──
  function isInBlockedRegion(): boolean {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return false;
      const r = sel.getRangeAt(0);
      const node = r.commonAncestorContainer;
      const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
      if (!el) return false;
      if (el.closest("pre")) return true;
      if (el.closest(".mermaid")) return true;
      if (el.closest(".katex-display")) return true;
      if (el.closest(".katex")) return true;
      if (el.closest(".tiptap-codeblock-wrapper")) return true;
      if (el.closest(".tiptap-mermaid-render")) return true;
      if (el.closest(".tiptap-math-display")) return true;
      if (el.closest(".tiptap-math-inline")) return true;
      return false;
    } catch { return false; }
  }

  function hide(): void {
    bar.style.display = "none";
  }
  function update(): void {
    // Don't hide while the AI menu owns focus — the prompt input
    // collapses the editor selection by design.
    if (aiMenu?.isOpen()) return;
    if (!editor.isFocused) { hide(); return; }
    const { from, to } = editor.state.selection;
    if (from === to) { hide(); return; }
    if (isInBlockedRegion()) { hide(); return; }
    let cFrom: { left: number; top: number; bottom: number } | null = null;
    let cTo:   { left: number; top: number; bottom: number } | null = null;
    try {
      cFrom = editor.view.coordsAtPos(from);
      cTo   = editor.view.coordsAtPos(to);
    } catch { hide(); return; }
    if (!cFrom || !cTo) { hide(); return; }
    bar.style.display = "inline-flex";
    bar.style.visibility = "hidden";
    bar.style.top = "-9999px";
    bar.style.left = "-9999px";
    const br = bar.getBoundingClientRect();
    // Midpoint of selection horizontally, just above its top edge.
    let left = (cFrom.left + cTo.left) / 2 - br.width / 2;
    let top  = cFrom.top - br.height - 8;
    if (top < 6) top = cFrom.bottom + 8; // flip below
    if (left < 6) left = 6;
    if (left + br.width > window.innerWidth - 6) left = window.innerWidth - br.width - 6;
    bar.style.top = top + "px";
    bar.style.left = left + "px";
    bar.style.visibility = "visible";
    syncActives();
  }

  editor.on("selectionUpdate", update);
  editor.on("transaction", update);
  editor.on("focus", update);
  editor.on("blur", () => {
    // Defer so a click inside the bar (or the link input / AI menu)
    // doesn't tear it down before the click is dispatched.
    setTimeout(() => {
      if (aiMenu?.isOpen()) return;
      // If focus moved into something inside the bar, keep it.
      if (document.activeElement && bar.contains(document.activeElement)) return;
      hide();
    }, 80);
  });
  const onScroll = (): void => update();
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);

  return {
    refresh: update,
    destroy() {
      try { editor.off("selectionUpdate", update); } catch { /* noop */ }
      try { editor.off("transaction", update); } catch { /* noop */ }
      try { editor.off("focus", update); } catch { /* noop */ }
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      linkInput.destroy();
      aiMenu?.destroy();
      try { bar.remove(); } catch { /* noop */ }
    },
  };
}
