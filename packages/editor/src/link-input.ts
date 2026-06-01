// @ts-nocheck
// link-input — inline URL input replacement for the legacy prompt()
// flow. Web's WysiwygToolbar.tsx uses a popover input + Apply/Remove
// buttons; this is the same UX as vanilla DOM so Desktop + VSCode
// can stop calling prompt() (which is jarring in Electron and
// outright blocked by some VSCode webview configurations).
//
// Usage:
//   const link = buildInlineLinkInput(editor, mountEl);
//   linkButton.addEventListener("click", () => link.open(linkButton));
//   // ...later:
//   link.destroy();
//
// The input attaches itself to `mountEl` (usually the toolbar
// container) so it inherits the toolbar's z-index and theme. When
// opened, it floats next to the anchor element you pass to open().
// If the anchor isn't supplied it positions itself at the top-left of
// the mount element.
//
// Open behaviour:
//   - If the editor already has a link at the selection, prefill the
//     input with that href and show Apply + Remove.
//   - Otherwise show Apply only.
//   - Enter applies, Esc cancels.
//   - Click outside cancels.

type Editor = any;

export interface InlineLinkInputHandle {
  open(anchor?: HTMLElement): void;
  close(): void;
  destroy(): void;
}

export function buildInlineLinkInput(
  editor: Editor,
  mountEl: HTMLElement | null | undefined
): InlineLinkInputHandle {
  if (!editor || !mountEl) {
    return { open() { /* noop */ }, close() { /* noop */ }, destroy() { /* noop */ } };
  }

  const pop = document.createElement("div");
  pop.className = "mw-link-input";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Link URL");
  pop.style.cssText = [
    "position: absolute",
    "z-index: 9999",
    "display: none",
    "align-items: center",
    "gap: 4px",
    "padding: 4px 6px",
    "border-radius: 8px",
    "background: var(--surface, #1e1e1e)",
    "border: 1px solid var(--border, #3a3a3c)",
    "box-shadow: 0 8px 24px rgba(0,0,0,0.3)",
    "pointer-events: auto",
  ].join(";");

  // Prevent mousedown from collapsing the editor selection — the
  // anchor offset must survive long enough to apply the link.
  pop.addEventListener("mousedown", (e) => e.preventDefault());

  const input = document.createElement("input");
  input.type = "url";
  input.placeholder = "https://...";
  input.style.cssText = [
    "background: var(--background, var(--bg, #0a0a0a))",
    "color: var(--text-primary, var(--fg, #ffffff))",
    "border: 1px solid var(--border, #3a3a3c)",
    "border-radius: 4px",
    "padding: 4px 8px",
    "font-size: 12px",
    "outline: none",
    "width: 200px",
  ].join(";");

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "Apply";
  applyBtn.style.cssText = [
    "background: var(--text-primary, var(--fg, #ffffff))",
    "color: var(--background, var(--bg, #0a0a0a))",
    "border: none",
    "border-radius: 4px",
    "padding: 4px 10px",
    "font-size: 11px",
    "font-weight: 600",
    "cursor: pointer",
  ].join(";");

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.style.cssText = [
    "background: transparent",
    "color: var(--text-secondary, var(--fg-muted, #888))",
    "border: 1px solid var(--border, #3a3a3c)",
    "border-radius: 4px",
    "padding: 4px 10px",
    "font-size: 11px",
    "cursor: pointer",
  ].join(";");

  pop.appendChild(input);
  pop.appendChild(applyBtn);
  pop.appendChild(removeBtn);

  // mountEl needs position:relative for absolute children to land on
  // it. Most toolbars are already position:relative; if not, push it
  // here without overwriting an existing relative/absolute value.
  const mountPos = getComputedStyle(mountEl).position;
  if (mountPos === "static") mountEl.style.position = "relative";
  mountEl.appendChild(pop);

  let isOpen = false;
  let outsideHandler: ((e: MouseEvent) => void) | null = null;

  const close = (): void => {
    if (!isOpen) return;
    isOpen = false;
    pop.style.display = "none";
    if (outsideHandler) {
      document.removeEventListener("mousedown", outsideHandler, true);
      outsideHandler = null;
    }
    try { editor.commands.focus(); } catch { /* noop */ }
  };

  const apply = (): void => {
    const url = input.value.trim();
    if (!url) { close(); return; }
    try { editor.chain().focus().setLink({ href: url }).run(); } catch { /* noop */ }
    close();
  };

  const remove = (): void => {
    try { editor.chain().focus().unsetLink().run(); } catch { /* noop */ }
    close();
  };

  applyBtn.addEventListener("click", apply);
  removeBtn.addEventListener("click", remove);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  const open = (anchor?: HTMLElement): void => {
    let existing = "";
    try {
      existing = (editor.getAttributes("link") || {}).href || "";
    } catch { /* noop */ }
    input.value = existing;
    removeBtn.style.display = existing ? "" : "none";

    // Position next to the anchor; otherwise mount-relative origin.
    if (anchor && anchor.offsetParent) {
      // Render hidden first so we can measure.
      pop.style.display = "inline-flex";
      pop.style.visibility = "hidden";
      pop.style.top = "-9999px";
      pop.style.left = "-9999px";
      const ar = anchor.getBoundingClientRect();
      const mr = mountEl.getBoundingClientRect();
      const top = ar.bottom - mr.top + 4;
      const left = Math.max(0, ar.left - mr.left);
      pop.style.top = top + "px";
      pop.style.left = left + "px";
      pop.style.visibility = "visible";
    } else {
      pop.style.display = "inline-flex";
      pop.style.top = "100%";
      pop.style.left = "0";
    }

    isOpen = true;
    // Focus after layout so the cursor lands in the input.
    setTimeout(() => { try { input.focus(); input.select(); } catch { /* noop */ } }, 0);

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
    destroy() {
      close();
      try { pop.remove(); } catch { /* noop */ }
    },
  };
}
