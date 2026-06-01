// @ts-nocheck
// hover-preview — read each toolbar button's `data-preview` HTML
// attribute and render it as a floating popover below the button on
// hover. Web's WysiwygToolbar.tsx attaches this via TBtn's `preview`
// prop (apps/web/src/components/WysiwygToolbar.tsx L187-L237); this
// is the same UX wired up off DOM attributes so channels can keep
// their plain `<button data-preview="...">` markup.
//
// Usage:
//   const detach = attachHoverPreviews(document.getElementById('toolbar'));
//   // ...later:
//   detach();
//
// CSS — the popover is styled inline so a host channel can drop it in
// without shipping new styles. The `data-preview` attribute is raw
// HTML (matches web's `<div>` preview) so callers can include big
// "Heading 1" text, monospace `inline code`, etc.

const POPOVER_ID = "mw-hover-preview";
const TIP_DELAY_MS = 60;   // near-instant, like web's tip system
const TIP_HIDE_MS = 120;

export interface HoverPreviewHandle {
  detach(): void;
}

export function attachHoverPreviews(
  toolbarEl: HTMLElement | null | undefined
): HoverPreviewHandle {
  if (!toolbarEl) return { detach() { /* noop */ } };

  // Singleton popover; reused for every hover.
  let pop = document.getElementById(POPOVER_ID) as HTMLDivElement | null;
  if (!pop) {
    pop = document.createElement("div");
    pop.id = POPOVER_ID;
    pop.style.cssText = [
      "position: fixed",
      "z-index: 10001",
      "padding: 8px 10px",
      "border-radius: 8px",
      "background: var(--surface, #1e1e1e)",
      "color: var(--text-primary, var(--fg, #ffffff))",
      "border: 1px solid var(--border, #3a3a3c)",
      "box-shadow: 0 8px 24px rgba(0,0,0,0.3)",
      "pointer-events: none",
      "opacity: 0",
      "transition: opacity 0.1s",
      "max-width: 280px",
      "white-space: normal",
      "font-size: 12px",
      "line-height: 1.4",
    ].join(";");
    document.body.appendChild(pop);
  }

  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let currentTarget: HTMLElement | null = null;

  const place = (target: HTMLElement): void => {
    if (!pop) return;
    pop.style.opacity = "0";
    pop.style.visibility = "hidden";
    const html = target.getAttribute("data-preview") || "";
    pop.innerHTML = html;
    // Measure then position.
    const tr = target.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let top = tr.bottom + 6;
    let left = tr.left + tr.width / 2 - pr.width / 2;
    // Clamp inside viewport.
    if (left < 4) left = 4;
    if (left + pr.width > window.innerWidth - 4) {
      left = window.innerWidth - pr.width - 4;
    }
    if (top + pr.height > window.innerHeight - 4) {
      // Flip above the button if there's no room below.
      top = tr.top - pr.height - 6;
    }
    pop.style.top = top + "px";
    pop.style.left = left + "px";
    pop.style.visibility = "visible";
    pop.style.opacity = "1";
  };

  const hide = (): void => {
    if (!pop) return;
    pop.style.opacity = "0";
    pop.style.visibility = "hidden";
    currentTarget = null;
  };

  const onOver = (e: MouseEvent): void => {
    const tgt = (e.target as HTMLElement)?.closest("[data-preview]") as HTMLElement | null;
    if (!tgt) return;
    if (!toolbarEl.contains(tgt)) return;
    if (currentTarget === tgt) return;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (showTimer) clearTimeout(showTimer);
    currentTarget = tgt;
    showTimer = setTimeout(() => place(tgt), TIP_DELAY_MS);
  };

  const onOut = (e: MouseEvent): void => {
    const tgt = (e.target as HTMLElement)?.closest("[data-preview]") as HTMLElement | null;
    if (!tgt) return;
    if (!toolbarEl.contains(tgt)) return;
    // If the cursor moved to another previewed button, the next mouseover handles it.
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    hideTimer = setTimeout(hide, TIP_HIDE_MS);
  };

  toolbarEl.addEventListener("mouseover", onOver);
  toolbarEl.addEventListener("mouseout", onOut);
  // Hide on any click — the user just dispatched the command.
  toolbarEl.addEventListener("click", hide);
  // Hide on scroll so the popover doesn't strand mid-viewport.
  const onScroll = (): void => hide();
  window.addEventListener("scroll", onScroll, true);

  return {
    detach() {
      toolbarEl.removeEventListener("mouseover", onOver);
      toolbarEl.removeEventListener("mouseout", onOut);
      toolbarEl.removeEventListener("click", hide);
      window.removeEventListener("scroll", onScroll, true);
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      hide();
    },
  };
}
