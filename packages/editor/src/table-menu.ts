// @ts-nocheck
// table-menu — a floating context toolbar that appears ABOVE the
// currently focused TipTap table. Web ships it as a React component
// (apps/web/src/components/TiptapLiveEditor.tsx L1112-L1193); this is
// the same UI in vanilla DOM, positioning + commands match 1:1.
//
// Usage:
//   const menu = mountTableMenu(editor, document.body);
//   // ...later:
//   menu.destroy();
//
// Behaviour:
//   - Subscribes to editor.on("selectionUpdate" / "transaction" /
//     "focus" / "blur") to know when the cursor enters/leaves a table.
//   - If editor.isActive("table"), it walks up from the selection's
//     DOM node to the nearest <table>, reads its bounding rect, and
//     positions itself 36px above the table.
//   - Hidden otherwise.
//
// Buttons (web's labels verbatim):
//   ↑+ Row   addRowBefore
//   ↓+ Row   addRowAfter
//   ←+ Col   addColumnBefore
//   +→ Col   addColumnAfter
//   − Row    deleteRow
//   − Col    deleteColumn
//   Header   toggleHeaderRow
//   🗑       deleteTable (trash icon SVG, no emoji)

type Editor = any;

export interface MountTableMenuOptions {
  /** Element to mount the menu under (defaults to document.body). */
  container?: HTMLElement;
  /**
   * Optional offset in pixels above the table. Default 36 — matches
   * web. Use 8 if your toolbar sits in a narrow split pane.
   */
  topOffset?: number;
  /**
   * Optional offset element whose bounding rect is subtracted from
   * the menu's `top` / `left`. Useful when the menu is appended
   * inside a positioned scroll container (e.g. apps/web wraps the
   * editor in an `.overflow-auto` div). If omitted the menu uses
   * absolute viewport coords (recommended for Desktop + VSCode where
   * the menu lives on body).
   */
  scrollContainer?: HTMLElement | null;
}

export interface TableMenuHandle {
  /** Remove the menu and detach listeners. */
  destroy(): void;
  /** Force a recompute (e.g. after editor re-mount). */
  refresh(): void;
}

export function mountTableMenu(
  editor: Editor,
  options: MountTableMenuOptions = {}
): TableMenuHandle {
  if (!editor) return { destroy() { /* noop */ }, refresh() { /* noop */ } };
  const container = options.container || document.body;
  const topOffset = typeof options.topOffset === "number" ? options.topOffset : 36;

  const menu = document.createElement("div");
  menu.className = "mw-table-menu";
  menu.setAttribute("role", "toolbar");
  menu.setAttribute("aria-label", "Table actions");
  // Inline styles so the menu paints correctly even if a host channel
  // forgets to ship the matching CSS. Theme-aware via CSS vars.
  menu.style.cssText = [
    "position: fixed",
    "z-index: 9998",
    "display: none",
    "align-items: center",
    "gap: 2px",
    "padding: 4px 6px",
    "border-radius: 8px",
    "background: var(--surface)",
    "border: 1px solid var(--border)",
    "box-shadow: 0 6px 20px rgba(0,0,0,0.25)",
    "font-size: 11px",
    "pointer-events: auto",
    "user-select: none",
  ].join(";");
  // Stop the menu from collapsing the editor selection on click.
  menu.addEventListener("mousedown", (e) => e.preventDefault());

  const btn = (label: string, title: string, html: string | null, run: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = title;
    b.style.cssText = [
      "background: transparent",
      "color: var(--text-secondary, var(--fg-muted, currentColor))",
      "border: none",
      "border-radius: 4px",
      "padding: 3px 8px",
      "cursor: pointer",
      "font-size: 11px",
      "font-weight: 500",
      "display: inline-flex",
      "align-items: center",
      "gap: 3px",
      "white-space: nowrap",
    ].join(";");
    if (html) {
      b.innerHTML = html;
    } else {
      b.textContent = label;
    }
    b.addEventListener("click", (e) => {
      e.preventDefault();
      try { run(); } catch (err) { /* noop */ }
    });
    return b;
  };

  const sep = (): HTMLSpanElement => {
    const s = document.createElement("span");
    s.style.cssText = "width:1px;height:14px;background:var(--border-dim,var(--border,#3a3a3c));margin:0 1px;display:inline-block";
    return s;
  };

  menu.appendChild(btn("↑+ Row", "Insert row above", null, () => editor.chain().focus().addRowBefore().run()));
  menu.appendChild(btn("↓+ Row", "Insert row below", null, () => editor.chain().focus().addRowAfter().run()));
  menu.appendChild(sep());
  menu.appendChild(btn("←+ Col", "Insert column left", null, () => editor.chain().focus().addColumnBefore().run()));
  menu.appendChild(btn("+→ Col", "Insert column right", null, () => editor.chain().focus().addColumnAfter().run()));
  menu.appendChild(sep());
  menu.appendChild(btn("− Row", "Delete row", null, () => editor.chain().focus().deleteRow().run()));
  menu.appendChild(btn("− Col", "Delete column", null, () => editor.chain().focus().deleteColumn().run()));
  menu.appendChild(sep());
  menu.appendChild(btn("Header", "Toggle header row", null, () => editor.chain().focus().toggleHeaderRow().run()));
  menu.appendChild(sep());
  // Trash icon matches web (Lucide Trash2 14×14 inline SVG).
  const trashSvg =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
    '<path d="M10 11v6"/><path d="M14 11v6"/>' +
    '<path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>' +
    '</svg>';
  const trash = btn("", "Delete table", trashSvg, () => editor.chain().focus().deleteTable().run());
  trash.style.color = "var(--text-primary, var(--fg, currentColor))";
  menu.appendChild(trash);

  container.appendChild(menu);

  const update = (): void => {
    let inTable = false;
    try { inTable = !!editor.isActive("table"); } catch { /* noop */ }
    if (!inTable || !editor.isFocused) {
      menu.style.display = "none";
      return;
    }
    try {
      const { from } = editor.state.selection;
      const dap = editor.view.domAtPos(from);
      const node = dap.node as Node;
      const el: HTMLElement | null =
        (node.nodeType === 3 ? node.parentElement : (node as HTMLElement)) as HTMLElement | null;
      const tableEl = el?.closest("table");
      if (!tableEl) { menu.style.display = "none"; return; }
      const tableRect = tableEl.getBoundingClientRect();
      // Render off-screen first so we can measure once layout settles.
      menu.style.display = "inline-flex";
      menu.style.visibility = "hidden";
      menu.style.top = "-9999px";
      menu.style.left = "-9999px";
      const menuRect = menu.getBoundingClientRect();
      let top = tableRect.top - topOffset;
      // If there's not enough room above (heading row would clip),
      // float below the table head row instead. Matches web.
      if (top < 4) top = tableRect.top + 4;
      let left = tableRect.left;
      const maxLeft = window.innerWidth - menuRect.width - 8;
      if (left > maxLeft) left = maxLeft;
      if (left < 8) left = 8;
      // If a host channel needs container-relative coords, subtract
      // its bounding rect now.
      if (options.scrollContainer) {
        const sc = options.scrollContainer.getBoundingClientRect();
        top -= sc.top;
        left -= sc.left;
        menu.style.position = "absolute";
      } else {
        menu.style.position = "fixed";
      }
      menu.style.top = top + "px";
      menu.style.left = left + "px";
      menu.style.visibility = "visible";
    } catch {
      menu.style.display = "none";
    }
  };

  const blur = (): void => {
    setTimeout(() => { if (!editor.isFocused) menu.style.display = "none"; }, 100);
  };

  editor.on("selectionUpdate", update);
  editor.on("transaction", update);
  editor.on("focus", update);
  editor.on("blur", blur);

  // Recompute on scroll/resize so the menu tracks the table.
  const onScroll = (): void => update();
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);

  return {
    destroy() {
      try { editor.off("selectionUpdate", update); } catch { /* noop */ }
      try { editor.off("transaction", update); } catch { /* noop */ }
      try { editor.off("focus", update); } catch { /* noop */ }
      try { editor.off("blur", blur); } catch { /* noop */ }
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      try { menu.remove(); } catch { /* noop */ }
    },
    refresh: update,
  };
}
