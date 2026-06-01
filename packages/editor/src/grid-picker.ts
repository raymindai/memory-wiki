// @ts-nocheck
// grid-picker — Word/Notion-style 6×6 table size picker. Hover to
// preview an N×M selection, click to insert. Web ships this inside
// WysiwygToolbar.tsx (apps/web/src/components/WysiwygToolbar.tsx
// L274-L309); this vanilla version matches sizing + commit shape.
//
// Usage:
//   const picker = buildTableGridPicker(editor, toolbarEl);
//   tableButton.addEventListener("click", () => picker.toggle(tableButton));
//   // ...later:
//   picker.destroy();
//
// Insert command mirrors web:
//   editor.chain().focus().insertTable({rows, cols, withHeaderRow: true}).run()

type Editor = any;

const GRID_SIZE = 6; // 6×6 cells
const CELL_PX = 18;  // size of each square + 3px gap

export interface TableGridPickerHandle {
  open(anchor?: HTMLElement): void;
  close(): void;
  toggle(anchor?: HTMLElement): void;
  destroy(): void;
}

export function buildTableGridPicker(
  editor: Editor,
  mountEl: HTMLElement | null | undefined
): TableGridPickerHandle {
  if (!editor || !mountEl) {
    return {
      open() { /* noop */ },
      close() { /* noop */ },
      toggle() { /* noop */ },
      destroy() { /* noop */ },
    };
  }

  const pop = document.createElement("div");
  pop.className = "mw-table-grid-picker";
  pop.style.cssText = [
    "position: absolute",
    "z-index: 9998",
    "display: none",
    "padding: 10px",
    "border-radius: 8px",
    "background: var(--surface, #1e1e1e)",
    "border: 1px solid var(--border, #3a3a3c)",
    "box-shadow: 0 8px 24px rgba(0,0,0,0.3)",
    "user-select: none",
  ].join(";");
  pop.addEventListener("mousedown", (e) => e.preventDefault());

  const caption = document.createElement("div");
  caption.style.cssText = [
    "text-align: center",
    "font-size: 11px",
    "color: var(--text-muted, var(--fg-muted, #888))",
    "margin-bottom: 6px",
    "font-variant-numeric: tabular-nums",
  ].join(";");
  caption.textContent = "Select size";
  pop.appendChild(caption);

  const grid = document.createElement("div");
  grid.style.cssText = [
    "display: grid",
    `grid-template-columns: repeat(${GRID_SIZE}, ${CELL_PX}px)`,
    "gap: 3px",
  ].join(";");
  pop.appendChild(grid);

  let hoverCol = 0;
  let hoverRow = 0;

  const cells: HTMLDivElement[] = [];
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const col = (i % GRID_SIZE) + 1;
    const row = Math.floor(i / GRID_SIZE) + 1;
    const cell = document.createElement("div");
    cell.dataset.col = String(col);
    cell.dataset.row = String(row);
    cell.style.cssText = [
      `width: ${CELL_PX}px`,
      `height: ${CELL_PX}px`,
      "border: 1px solid var(--border-dim, var(--border, #3a3a3c))",
      "border-radius: 2px",
      "background: transparent",
      "cursor: pointer",
      "transition: background 0.08s, border-color 0.08s",
    ].join(";");
    cell.addEventListener("mouseenter", () => {
      hoverCol = col;
      hoverRow = row;
      paint();
    });
    cell.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        editor.chain().focus().insertTable({
          rows: row,
          cols: col,
          withHeaderRow: true,
        }).run();
      } catch { /* noop */ }
      close();
    });
    cells.push(cell);
    grid.appendChild(cell);
  }

  function paint(): void {
    if (hoverCol > 0 && hoverRow > 0) {
      caption.textContent = `${hoverCol} × ${hoverRow}`;
    } else {
      caption.textContent = "Select size";
    }
    for (const c of cells) {
      const col = Number(c.dataset.col || "0");
      const row = Number(c.dataset.row || "0");
      const on = col <= hoverCol && row <= hoverRow;
      c.style.background = on ? "var(--border, #3a3a3c)" : "transparent";
      c.style.borderColor = on
        ? "var(--text-primary, var(--fg, #ffffff))"
        : "var(--border-dim, var(--border, #3a3a3c))";
    }
  }

  pop.addEventListener("mouseleave", () => {
    hoverCol = 0;
    hoverRow = 0;
    paint();
  });

  const mountPos = getComputedStyle(mountEl).position;
  if (mountPos === "static") mountEl.style.position = "relative";
  mountEl.appendChild(pop);

  let isOpen = false;
  let outsideHandler: ((e: MouseEvent) => void) | null = null;

  const close = (): void => {
    if (!isOpen) return;
    isOpen = false;
    pop.style.display = "none";
    hoverCol = 0;
    hoverRow = 0;
    paint();
    if (outsideHandler) {
      document.removeEventListener("mousedown", outsideHandler, true);
      outsideHandler = null;
    }
  };

  const open = (anchor?: HTMLElement): void => {
    if (anchor && anchor.offsetParent) {
      pop.style.display = "block";
      pop.style.visibility = "hidden";
      pop.style.top = "-9999px";
      pop.style.left = "-9999px";
      const ar = anchor.getBoundingClientRect();
      const mr = mountEl.getBoundingClientRect();
      pop.style.top = (ar.bottom - mr.top + 4) + "px";
      pop.style.left = Math.max(0, ar.left - mr.left) + "px";
      pop.style.visibility = "visible";
    } else {
      pop.style.display = "block";
      pop.style.top = "100%";
      pop.style.left = "0";
    }
    isOpen = true;
    paint();

    outsideHandler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pop.contains(t)) return;
      if (anchor && anchor.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", outsideHandler, true);
  };

  return {
    open,
    close,
    toggle(anchor?: HTMLElement) {
      if (isOpen) close(); else open(anchor);
    },
    destroy() {
      close();
      try { pop.remove(); } catch { /* noop */ }
    },
  };
}
