// @ts-nocheck
// ai-menu — AI rewrite popover that opens next to the floating
// selection toolbar. Ports web's React widget (apps/web/src/
// components/TiptapLiveEditor.tsx L939-L1107) as vanilla DOM so
// Desktop + VSCode can share it.
//
// Surface:
//   ┌─ On "snippet preview…"      ┐
//   │ ✦ [custom prompt input] ↵   │
//   │   Or pick a quick action    │
//   │   Polish                    │
//   │   Shorten                   │
//   │   Expand                    │
//   │   Translate           ›     │
//   │ ───────────────────────     │
//   │  Esc to close      Close    │
//   └────────────────────────────┘
//
// Translate submenu: 8 languages (English / 한국어 / 日本語 / 中文 /
//                    Español / Français / Deutsch / Português).
//
// All AI work is delegated to the host channel via `options.runAi`.
// The host owns auth + API base URL + transport (web: fetch /api/ai,
// desktop: IPC, vscode: postMessage). The host returns either a
// `{ result: string }` or `{ error: string }` promise.

type Editor = any;

export interface AiMenuOptions {
  /**
   * Host-supplied AI runner. Called with the same action names web
   * uses on /api/ai: selection_polish | selection_shorten |
   * selection_expand | selection_rewrite | selection_translate.
   * Payload always includes { markdown, language?, instruction? }.
   *
   * Return value:
   *   { result: string }  → menu inserts the result into the editor
   *                          replacing the saved selection range.
   *   { error: string }   → menu shows the error in its footer.
   *   throws              → caught + shown as error.
   */
  runAi: (
    action: string,
    payload: { markdown: string; language?: string; instruction?: string }
  ) => Promise<{ result?: string; error?: string }>;
}

interface SavedRange { from: number; to: number }

interface OpenOptions {
  /** Anchor element used for positioning. */
  anchor: HTMLElement;
  /** Snippet text for the preview pill at top. Truncated to 200 chars. */
  snippet: string;
  /** Saved selection range used to replace text once AI returns. */
  range: SavedRange;
}

export interface AiMenuHandle {
  open(opts: OpenOptions): void;
  close(): void;
  destroy(): void;
  isOpen(): boolean;
}

const QUICK_ACTIONS: { key: string; label: string; action: string }[] = [
  { key: "polish",  label: "Polish",  action: "selection_polish" },
  { key: "shorten", label: "Shorten", action: "selection_shorten" },
  { key: "expand",  label: "Expand",  action: "selection_expand" },
];

const LANGS: [string, string][] = [
  ["English",  "English"],
  ["한국어",   "Korean"],
  ["日本語",   "Japanese"],
  ["中文",     "Chinese"],
  ["Español",  "Spanish"],
  ["Français", "French"],
  ["Deutsch",  "German"],
  ["Português","Portuguese"],
];

export function buildAiMenu(
  editor: Editor,
  options: AiMenuOptions
): AiMenuHandle {
  if (!editor || !options || typeof options.runAi !== "function") {
    return {
      open() { /* noop */ },
      close() { /* noop */ },
      destroy() { /* noop */ },
      isOpen() { return false; },
    };
  }

  // ── root container ──
  const wrap = document.createElement("div");
  wrap.className = "mw-ai-menu";
  wrap.style.cssText = [
    "position: fixed",
    "z-index: 10000",
    "min-width: 260px",
    "max-width: 320px",
    "display: none",
    "flex-direction: column",
    "gap: 4px",
    "padding: 6px",
    "border-radius: 10px",
    "background: var(--surface, #1e1e1e)",
    "border: 1px solid var(--border, #3a3a3c)",
    "box-shadow: 0 8px 24px rgba(0,0,0,0.35)",
    "color: var(--text-primary, var(--fg, #ffffff))",
    "user-select: none",
  ].join(";");
  wrap.addEventListener("mousedown", (e) => e.stopPropagation());
  document.body.appendChild(wrap);

  let view: "root" | "translate" = "root";
  let busy: string | null = null;
  let error: string | null = null;
  let snippet = "";
  let range: SavedRange | null = null;
  let isOpenFlag = false;
  let anchorEl: HTMLElement | null = null;
  let outsideHandler: ((e: MouseEvent) => void) | null = null;
  let escHandler: ((e: KeyboardEvent) => void) | null = null;

  const setBusy = (b: string | null): void => { busy = b; render(); };
  const setError = (e: string | null): void => { error = e; render(); };

  const close = (): void => {
    if (!isOpenFlag) return;
    isOpenFlag = false;
    wrap.style.display = "none";
    view = "root";
    busy = null;
    error = null;
    snippet = "";
    range = null;
    anchorEl = null;
    if (outsideHandler) document.removeEventListener("mousedown", outsideHandler, true);
    if (escHandler) document.removeEventListener("keydown", escHandler, true);
    outsideHandler = null;
    escHandler = null;
  };

  const replaceSelection = (markdown: string): boolean => {
    if (!range) return false;
    try {
      let html = markdown;
      try {
        const mdParser =
          (editor.storage as any)?.markdown?.parser;
        if (mdParser?.md?.render) html = mdParser.md.render(markdown);
      } catch { /* fall back to raw markdown */ }
      // Unwrap a single top-level <p> so we don't accidentally split
      // the surrounding paragraph. Matches web's logic exactly.
      try {
        const tmp = document.createElement("div");
        tmp.innerHTML = html.trim();
        const children = Array.from(tmp.children);
        if (children.length === 1 && (children[0] as HTMLElement).tagName === "P") {
          html = (children[0] as HTMLElement).innerHTML;
        }
      } catch { /* noop */ }
      editor.chain().focus()
        .deleteRange({ from: range.from, to: range.to })
        .insertContentAt(range.from, html)
        .run();
      return true;
    } catch {
      return false;
    }
  };

  const runAction = async (action: string, payload: { language?: string; instruction?: string } = {}, busyKey?: string): Promise<void> => {
    if (!range) { setError("Selection lost — try again."); return; }
    const md = (() => {
      try { return editor.state.doc.textBetween(range.from, range.to, "\n"); }
      catch { return ""; }
    })();
    if (!md.trim()) { setError("Empty selection."); return; }
    if (md.length > 8000) { setError("Selection too long (max 8k chars)."); return; }
    setBusy(busyKey || action);
    setError(null);
    try {
      const r = await options.runAi(action, { markdown: md, ...payload });
      if (!r || typeof r !== "object") throw new Error("AI returned nothing");
      if (r.error) throw new Error(r.error);
      const out = (r.result || "").trim();
      if (!out) throw new Error("Empty AI result");
      const ok = replaceSelection(out);
      if (!ok) throw new Error("Could not insert AI result");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err) || "AI failed");
    } finally {
      setBusy(null);
    }
  };

  // ── single render() rebuilds the inner DOM every state change ──
  function render(): void {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);

    // Snippet preview pill (only when snippet present).
    if (snippet) {
      const pill = document.createElement("div");
      pill.style.cssText = [
        "padding: 6px 8px",
        "border-radius: 6px",
        "background: var(--border, #3a3a3c)",
        "border: 1px solid var(--border-dim, var(--border, #3a3a3c))",
        "font-size: 11px",
        "line-height: 1.4",
        "color: var(--text-secondary, var(--fg-muted, #aaa))",
        "display: flex",
        "gap: 6px",
        "margin-bottom: 4px",
        "align-items: flex-start",
      ].join(";");
      const tag = document.createElement("span");
      tag.style.cssText = [
        "font-family: ui-monospace, SFMono-Regular, monospace",
        "text-transform: uppercase",
        "letter-spacing: 0.04em",
        "font-size: 9px",
        "padding-top: 1px",
        "color: var(--text-primary, var(--fg, #fff))",
        "flex-shrink: 0",
      ].join(";");
      tag.textContent = "On";
      const body = document.createElement("span");
      body.style.cssText = [
        "flex: 1",
        "word-break: break-word",
        "display: -webkit-box",
        "-webkit-line-clamp: 2",
        "-webkit-box-orient: vertical",
        "overflow: hidden",
      ].join(";");
      body.textContent = snippet.length > 200 ? snippet.slice(0, 200) + "…" : snippet;
      pill.appendChild(tag);
      pill.appendChild(body);
      wrap.appendChild(pill);
    }

    if (view === "root") {
      // Custom prompt input row.
      const row = document.createElement("div");
      row.style.cssText = [
        "display: flex",
        "align-items: center",
        "gap: 6px",
        "padding: 4px 6px",
        "border-radius: 6px",
        "background: var(--background, var(--bg, #0a0a0a))",
        "border: 1px solid var(--border-dim, var(--border, #3a3a3c))",
      ].join(";");
      const icon = document.createElement("span");
      icon.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg>';
      icon.style.cssText = "display:inline-flex;color:var(--micro-ai,#a78bfa);flex-shrink:0";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Tell AI what to do with this…";
      input.maxLength = 500;
      input.disabled = !!busy;
      input.style.cssText = [
        "flex: 1",
        "background: transparent",
        "border: none",
        "outline: none",
        "color: var(--text-primary, var(--fg, #fff))",
        "font-size: 13px",
      ].join(";");
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !(e as any).isComposing) {
          e.preventDefault();
          const v = input.value.trim();
          if (v) runAction("selection_rewrite", { instruction: v });
        } else if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      });
      const sendBtn = document.createElement("button");
      sendBtn.type = "button";
      sendBtn.title = "Send (Enter)";
      sendBtn.style.cssText = [
        "background: var(--text-primary, var(--fg, #fff))",
        "color: var(--background, var(--bg, #0a0a0a))",
        "border: none",
        "border-radius: 4px",
        "padding: 2px 8px",
        "font-size: 11px",
        "font-weight: 600",
        "cursor: pointer",
        "flex-shrink: 0",
      ].join(";");
      sendBtn.textContent = busy === "selection_rewrite" ? "…" : "↵";
      sendBtn.disabled = !!busy;
      sendBtn.addEventListener("click", () => {
        const v = input.value.trim();
        if (v) runAction("selection_rewrite", { instruction: v });
      });
      row.appendChild(icon);
      row.appendChild(input);
      row.appendChild(sendBtn);
      wrap.appendChild(row);

      // Focus the input after layout so caret lands here, not editor.
      setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 0);

      const hint = document.createElement("div");
      hint.style.cssText = "padding: 4px 6px;color:var(--text-faint,var(--fg-muted,#888));font-size:11px";
      hint.textContent = "Or pick a quick action";
      wrap.appendChild(hint);

      for (const q of QUICK_ACTIONS) {
        const b = quickButton(q.label, !!busy, () => runAction(q.action), busy === q.action);
        wrap.appendChild(b);
      }

      const translateBtn = quickButton("Translate", !!busy, () => {
        view = "translate";
        render();
      }, false, "›");
      wrap.appendChild(translateBtn);
    } else if (view === "translate") {
      const back = document.createElement("button");
      back.type = "button";
      back.textContent = "‹ Back";
      back.style.cssText = [
        "background: transparent",
        "color: var(--text-faint, var(--fg-muted, #888))",
        "border: none",
        "padding: 4px 8px",
        "text-align: left",
        "font-size: 11px",
        "cursor: pointer",
        "border-radius: 4px",
      ].join(";");
      back.addEventListener("click", () => { view = "root"; render(); });
      wrap.appendChild(back);

      const langGrid = document.createElement("div");
      langGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px";
      for (const [label, lang] of LANGS) {
        const key = `translate:${lang}`;
        const b = quickButton(label, !!busy, () => runAction("selection_translate", { language: lang }, key), busy === key);
        b.style.padding = "4px 8px";
        langGrid.appendChild(b);
      }
      wrap.appendChild(langGrid);
    }

    if (error) {
      const errEl = document.createElement("div");
      errEl.style.cssText = "padding:4px 8px;color:#f87171;font-size:11px;word-break:break-word";
      errEl.textContent = error;
      wrap.appendChild(errEl);
    }

    // Footer with Esc hint + Close.
    const foot = document.createElement("div");
    foot.style.cssText = [
      "margin-top: 4px",
      "padding-top: 4px",
      "border-top: 1px solid var(--border-dim, var(--border, #3a3a3c))",
      "display: flex",
      "align-items: center",
      "justify-content: space-between",
    ].join(";");
    const escHint = document.createElement("span");
    escHint.textContent = "Esc to close";
    escHint.style.cssText = "padding-left:6px;color:var(--text-faint,var(--fg-muted,#888));font-size:11px";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = [
      "background: transparent",
      "color: var(--text-faint, var(--fg-muted, #888))",
      "border: none",
      "padding: 2px 8px",
      "border-radius: 4px",
      "cursor: pointer",
      "font-size: 11px",
    ].join(";");
    closeBtn.addEventListener("click", close);
    foot.appendChild(escHint);
    foot.appendChild(closeBtn);
    wrap.appendChild(foot);
  }

  function quickButton(label: string, isBusy: boolean, onClick: () => void, busyNow: boolean, suffix?: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.disabled = isBusy;
    b.style.cssText = [
      "display: flex",
      "align-items: center",
      "justify-content: space-between",
      "gap: 8px",
      "padding: 6px 10px",
      "background: transparent",
      "border: none",
      "color: var(--text-secondary, var(--fg, #ddd))",
      "font-size: 12px",
      "text-align: left",
      "border-radius: 6px",
      "cursor: " + (isBusy ? "default" : "pointer"),
    ].join(";");
    const txt = document.createElement("span");
    txt.textContent = label;
    b.appendChild(txt);
    const right = document.createElement("span");
    right.style.cssText = "color:var(--text-faint,var(--fg-muted,#888));font-size:11px";
    if (busyNow) right.textContent = "…";
    else if (suffix) right.textContent = suffix;
    b.appendChild(right);
    if (!isBusy) {
      b.addEventListener("mouseenter", () => { b.style.background = "var(--menu-hover,var(--surface-hover,rgba(255,255,255,0.05)))"; });
      b.addEventListener("mouseleave", () => { b.style.background = "transparent"; });
    }
    b.addEventListener("click", onClick);
    return b;
  }

  const place = (anchor: HTMLElement): void => {
    wrap.style.display = "flex";
    wrap.style.visibility = "hidden";
    wrap.style.top = "-9999px";
    wrap.style.left = "-9999px";
    const ar = anchor.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    let top = ar.bottom + 6;
    let left = ar.right - wr.width;
    if (left < 6) left = 6;
    if (top + wr.height > window.innerHeight - 6) top = ar.top - wr.height - 6;
    if (top < 6) top = 6;
    wrap.style.top = top + "px";
    wrap.style.left = left + "px";
    wrap.style.visibility = "visible";
  };

  return {
    isOpen() { return isOpenFlag; },
    open(opts: OpenOptions) {
      view = "root";
      busy = null;
      error = null;
      snippet = opts.snippet || "";
      range = opts.range;
      anchorEl = opts.anchor;
      isOpenFlag = true;
      render();
      place(opts.anchor);

      outsideHandler = (e: MouseEvent) => {
        const t = e.target as Node;
        if (wrap.contains(t)) return;
        if (anchorEl && anchorEl.contains(t)) return;
        close();
      };
      escHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") { e.preventDefault(); close(); }
      };
      document.addEventListener("mousedown", outsideHandler, true);
      document.addEventListener("keydown", escHandler, true);
    },
    close,
    destroy() {
      close();
      try { wrap.remove(); } catch { /* noop */ }
    },
  };
}
