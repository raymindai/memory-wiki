"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  Undo2, Redo2, List, ListOrdered, IndentIncrease, IndentDecrease,
  Quote, Minus, Link2, ImageIcon, RemoveFormatting,
  Sparkles, Loader2,
} from "lucide-react";

type AIQuickAction = "polish" | "shorten" | "expand";
const AI_QUICK: { key: AIQuickAction; label: string; action: string }[] = [
  { key: "polish", label: "Polish", action: "selection_polish" },
  { key: "shorten", label: "Shorten", action: "selection_shorten" },
  { key: "expand", label: "Expand", action: "selection_expand" },
];
const AI_LANGS: [string, string][] = [
  ["English", "English"], ["한국어", "Korean"], ["日本語", "Japanese"], ["中文", "Chinese"],
  ["Español", "Spanish"], ["Français", "French"], ["Deutsch", "German"], ["Português", "Portuguese"],
];

interface FloatingToolbarProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

function FloatingToolbar({ containerRef }: FloatingToolbarProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [blockType, setBlockType] = useState("p");
  const [inputPopup, setInputPopup] = useState<{ label: string; onSubmit: (v: string) => void } | null>(null);
  const [aiMenu, setAiMenu] = useState<null | "root" | "translate">(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  // Stash the selection range while the AI menu is open — opening the
  // menu drops focus from the article, which collapses the selection.
  const savedRangeRef = useRef<Range | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const aiMenuRef = useRef<typeof aiMenu>(null);
  aiMenuRef.current = aiMenu;

  const updateToolbar = useCallback(() => {
    // Don't tear the toolbar down while an AI popup is open — its
    // input fields collapse the article selection, but we still need
    // the toolbar (and stashed range) visible to act on.
    if (aiMenuRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { setPos(null); return; }
    const container = containerRef.current;
    if (!container) return;
    const anchor = sel.anchorNode;
    if (!anchor || !container.contains(anchor)) { setPos(null); return; }
    const el = anchor instanceof HTMLElement ? anchor : anchor.parentElement;
    if (el?.closest("pre, .mermaid-container, .math-rendered, code, table")) { setPos(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0) { setPos(null); return; }

    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      strikethrough: document.queryCommandState("strikeThrough"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
      code: !!el?.closest("code"),
    });

    const block = document.queryCommandValue("formatBlock").toLowerCase().replace(/[<>]/g, "");
    if (block && /^h[1-6]$|^p$|^blockquote$/.test(block)) {
      setBlockType(block);
    } else {
      const heading = el?.closest("h1,h2,h3,h4,h5,h6,blockquote,p,li");
      if (heading) {
        const tag = heading.tagName.toLowerCase();
        setBlockType(tag === "li" ? "p" : tag);
      }
    }
  }, [containerRef]);

  useEffect(() => {
    document.addEventListener("selectionchange", updateToolbar);
    return () => document.removeEventListener("selectionchange", updateToolbar);
  }, [updateToolbar]);

  useEffect(() => {
    const scroller = containerRef.current?.closest(".overflow-auto");
    if (!scroller) return;
    const hide = () => setPos(null);
    scroller.addEventListener("scroll", hide);
    return () => scroller.removeEventListener("scroll", hide);
  }, [containerRef]);

  const exec = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    containerRef.current?.querySelector("article")?.focus();
    updateToolbar();
  }, [containerRef, updateToolbar]);

  const fmtBlock = useCallback((tag: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    const block = node instanceof HTMLElement ? node : node?.parentElement;
    const heading = block?.closest("h1,h2,h3,h4,h5,h6,blockquote");
    if (heading && heading.tagName.toLowerCase() === tag) {
      document.execCommand("formatBlock", false, "p");
    } else {
      document.execCommand("formatBlock", false, tag);
    }
    updateToolbar();
  }, [updateToolbar]);

  const openAiMenu = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    setAiError(null);
    setAiMenu("root");
  }, []);

  const closeAiMenu = useCallback(() => {
    setAiMenu(null);
    setAiError(null);
    setAiPrompt("");
    savedRangeRef.current = null;
  }, []);

  const replaceSavedSelection = useCallback((text: string) => {
    const range = savedRangeRef.current;
    const container = containerRef.current;
    if (!range || !container) return false;
    const article = container.querySelector("article") as HTMLElement | null;
    if (!article) return false;
    // Restore the range, focus the article, then use insertText so the
    // host's input handlers (markdown serializer, autosave, undo)
    // pick it up like a normal typed edit.
    const sel = window.getSelection();
    if (!sel) return false;
    article.focus();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand("insertText", false, text);
    if (!ok) {
      try {
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        article.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      } catch { return false; }
    }
    return true;
  }, [containerRef]);

  const runAi = useCallback(async (action: string, opts: { language?: string; instruction?: string } = {}) => {
    const range = savedRangeRef.current;
    if (!range) { setAiError("Selection lost — try again."); return; }
    const snippet = range.toString();
    if (!snippet.trim()) { setAiError("Empty selection."); return; }
    if (snippet.length > 8000) { setAiError("Selection too long (max 8k chars)."); return; }
    setAiBusy(action);
    setAiError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, markdown: snippet, ...opts }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "AI failed" }));
        throw new Error(j.error || `AI failed (${res.status})`);
      }
      const j = await res.json();
      const out = (j.result || "").trim();
      if (!out) throw new Error("Empty AI result");
      const ok = replaceSavedSelection(out);
      if (!ok) throw new Error("Could not insert result");
      closeAiMenu();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI failed");
    } finally {
      setAiBusy(null);
    }
  }, [replaceSavedSelection, closeAiMenu]);

  if (!pos) return null;

  const I = 14;
  const b = "w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--accent-dim)] hover:text-[var(--accent)] shrink-0";
  const on = "bg-[var(--accent-dim)] text-[var(--accent)]";
  const sep = <div className="w-px h-5 shrink-0 mx-0.5" style={{ background: "var(--border)" }} />;

  // Clamp position so toolbar stays within viewport
  const toolbarW = toolbarRef.current?.offsetWidth || 500;
  const toolbarH = toolbarRef.current?.offsetHeight || 40;
  const pad = 8;
  // Calculate left position (no transform needed)
  const rawLeft = pos.x - toolbarW / 2;
  const clampedLeft = Math.max(pad, Math.min(rawLeft, window.innerWidth - toolbarW - pad));
  const clampedTop = Math.max(pad, pos.y - toolbarH - 8);

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[9998] flex flex-wrap items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-xl border max-w-[90vw]"
      style={{
        left: clampedLeft, top: clampedTop,
        background: "var(--surface)", borderColor: "var(--border)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Undo / Redo */}
      <button className={b} onClick={() => exec("undo")} title="Undo">
        <Undo2 size={I} strokeWidth={1.5} />
      </button>
      <button className={b} onClick={() => exec("redo")} title="Redo">
        <Redo2 size={I} strokeWidth={1.5} />
      </button>
      {sep}

      {/* Headings */}
      <button className={`${b} ${blockType === "h1" ? on : ""}`} onClick={() => fmtBlock("h1")} title="Heading 1"><span className="text-caption font-bold">H1</span></button>
      <button className={`${b} ${blockType === "h2" ? on : ""}`} onClick={() => fmtBlock("h2")} title="Heading 2"><span className="text-caption font-bold">H2</span></button>
      <button className={`${b} ${blockType === "h3" ? on : ""}`} onClick={() => fmtBlock("h3")} title="Heading 3"><span className="text-caption font-semibold">H3</span></button>
      <button className={`${b} ${blockType === "h4" ? on : ""}`} onClick={() => fmtBlock("h4")} title="Heading 4"><span className="text-caption">H4</span></button>
      <button className={`${b} ${blockType === "h5" ? on : ""}`} onClick={() => fmtBlock("h5")} title="Heading 5"><span className="text-caption">H5</span></button>
      <button className={`${b} ${blockType === "h6" ? on : ""}`} onClick={() => fmtBlock("h6")} title="Heading 6"><span className="text-caption">H6</span></button>
      <button className={`${b} ${blockType === "p" ? on : ""}`} onClick={() => fmtBlock("p")} title="Paragraph"><span className="text-caption">P</span></button>
      {sep}

      {/* Inline */}
      <button className={`${b} ${active.bold ? on : ""}`} onClick={() => exec("bold")} title="Bold"><span className="font-bold text-body">B</span></button>
      <button className={`${b} ${active.italic ? on : ""}`} onClick={() => exec("italic")} title="Italic"><span className="italic text-body">I</span></button>
      <button className={`${b} ${active.strikethrough ? on : ""}`} onClick={() => exec("strikeThrough")} title="Strikethrough"><span className="line-through text-body">S</span></button>
      <button className={`${b} ${active.code ? on : ""}`} title="Inline code" onClick={() => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount) {
          try { sel.getRangeAt(0).surroundContents(document.createElement("code")); } catch { /* */ }
        }
        updateToolbar();
        containerRef.current?.focus();
      }}><span className="font-mono text-caption">{`</>`}</span></button>
      {sep}

      {/* Lists */}
      <button className={`${b} ${active.ul ? on : ""}`} onClick={() => exec("insertUnorderedList")} title="Bullet list">
        <List size={I} strokeWidth={1.5} />
      </button>
      <button className={`${b} ${active.ol ? on : ""}`} onClick={() => exec("insertOrderedList")} title="Numbered list">
        <ListOrdered size={I} strokeWidth={1.5} />
      </button>
      <button className={b} onClick={() => exec("indent")} title="Increase indent">
        <IndentIncrease size={I} strokeWidth={1.5} />
      </button>
      <button className={b} onClick={() => exec("outdent")} title="Decrease indent">
        <IndentDecrease size={I} strokeWidth={1.5} />
      </button>
      {sep}

      {/* Block */}
      <button className={`${b} ${blockType === "blockquote" ? on : ""}`} onClick={() => fmtBlock("blockquote")} title="Blockquote">
        <Quote size={I} strokeWidth={1.5} />
      </button>
      <button className={b} onClick={() => exec("insertHorizontalRule")} title="Horizontal rule">
        <Minus size={I} strokeWidth={2} />
      </button>
      {sep}

      {/* Link, Image */}
      <button className={b} onClick={() => setInputPopup({ label: "URL", onSubmit: (u) => { exec("createLink", u); setInputPopup(null); } })} title="Insert link">
        <Link2 size={I} strokeWidth={1.5} />
      </button>
      <button className={b} onClick={() => setInputPopup({ label: "Image URL", onSubmit: (u) => { exec("insertImage", u); setInputPopup(null); } })} title="Insert image">
        <ImageIcon size={I} strokeWidth={1.5} />
      </button>
      {sep}

      {/* Clear */}
      <button className={b} onClick={() => exec("removeFormat")} title="Remove formatting">
        <RemoveFormatting size={I} strokeWidth={1.5} />
      </button>
      {sep}

      {/* AI on selection */}
      <button
        className={`${b} ${aiMenu ? on : ""}`}
        onClick={openAiMenu}
        title="AI on selection"
      >
        <Sparkles size={I} strokeWidth={1.5} />
      </button>

      {aiMenu && (
        <div
          className="absolute top-full left-0 mt-2 min-w-[260px] rounded-lg p-1.5 flex flex-col gap-1"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            zIndex: 10000,
          }}
        >
          {aiMenu === "root" && (
            <>
              {/* Free-form prompt — always at top, autofocused */}
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md"
                style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}
              >
                <Sparkles size={12} style={{ color: "var(--accent)" }} />
                <input
                  autoFocus
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Tell AI what to do with this…"
                  maxLength={500}
                  disabled={!!aiBusy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      const v = aiPrompt.trim();
                      if (v) runAi("selection_rewrite", { instruction: v });
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      closeAiMenu();
                    }
                  }}
                  className="flex-1 text-caption bg-transparent outline-none"
                  style={{ color: "var(--text-primary)", border: "none" }}
                />
                {aiBusy === "selection_rewrite" ? (
                  <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-faint)" }} />
                ) : aiPrompt.trim() ? (
                  <button
                    onClick={() => {
                      const v = aiPrompt.trim();
                      if (v) runAi("selection_rewrite", { instruction: v });
                    }}
                    disabled={!!aiBusy}
                    className="shrink-0 px-1.5 py-0.5 rounded text-caption font-medium"
                    style={{ background: "var(--accent)", color: "#000" }}
                    title="Send (Enter)"
                  >
                    ↵
                  </button>
                ) : null}
              </div>
              <div className="text-caption px-1.5 pt-1" style={{ color: "var(--text-faint)" }}>
                Or pick a quick action
              </div>
              {AI_QUICK.map((q) => (
                <button
                  key={q.key}
                  disabled={!!aiBusy}
                  onClick={() => runAi(q.action)}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-caption text-left hover:bg-[var(--menu-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span>{q.label}</span>
                  {aiBusy === q.action && <Loader2 size={12} className="animate-spin" />}
                </button>
              ))}
              <button
                disabled={!!aiBusy}
                onClick={() => setAiMenu("translate")}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-caption text-left hover:bg-[var(--menu-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <span>Translate</span>
                <span style={{ color: "var(--text-faint)" }}>›</span>
              </button>
            </>
          )}
          {aiMenu === "translate" && (
            <>
              <button
                onClick={() => setAiMenu("root")}
                className="px-2.5 py-1 text-caption text-left hover:bg-[var(--menu-hover)] rounded"
                style={{ color: "var(--text-faint)" }}
              >
                ‹ Back
              </button>
              <div className="grid grid-cols-2 gap-0.5 mt-1">
                {AI_LANGS.map(([label, lang]) => (
                  <button
                    key={lang}
                    disabled={!!aiBusy}
                    onClick={() => runAi("selection_translate", { language: lang })}
                    className="px-2 py-1 text-caption rounded hover:bg-[var(--menu-hover)] flex items-center justify-between gap-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span>{label}</span>
                    {aiBusy === "selection_translate" && <Loader2 size={10} className="animate-spin" />}
                  </button>
                ))}
              </div>
            </>
          )}
          {aiError && (
            <div className="px-2.5 py-1 text-caption" style={{ color: "#f87171" }}>
              {aiError}
            </div>
          )}
          <div className="border-t mt-1 pt-1 flex items-center justify-between" style={{ borderColor: "var(--border-dim)" }}>
            <span className="px-1.5 text-caption" style={{ color: "var(--text-faint)" }}>
              Esc to close
            </span>
            <button
              onClick={closeAiMenu}
              className="px-2 py-0.5 text-caption rounded hover:bg-[var(--menu-hover)]"
              style={{ color: "var(--text-faint)" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Inline input popup */}
      {inputPopup && (
        <div className="fixed inset-0 z-[9999]" onClick={() => setInputPopup(null)} onMouseDown={(e) => e.stopPropagation()}>
          <div className="absolute rounded-lg shadow-xl p-3 flex flex-col gap-2" style={{ left: Math.max(140, Math.min(pos.x, typeof window !== "undefined" ? window.innerWidth - 140 : pos.x)), top: Math.max(8, pos.y - 80), transform: "translate(-50%, -100%)", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 260 }} onClick={(e) => e.stopPropagation()}>
            <label className="text-caption font-mono" style={{ color: "var(--text-muted)" }}>{inputPopup.label}</label>
            <input autoFocus className="px-3 py-1.5 rounded-md text-sm outline-none" style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} placeholder={inputPopup.label}
              onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) inputPopup.onSubmit(v); } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setInputPopup(null); } }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(FloatingToolbar);
