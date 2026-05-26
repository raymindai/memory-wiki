"use client";

/**
 * WysiwygToolbar — Markdown-compatible fixed toolbar that sits between
 * the editor pane and the toolbar header. Routes commands to either
 * the active CM6 instance (Source) or the active Tiptap instance
 * (Live) depending on which surface owns focus.
 *
 * Extracted from MdEditor.tsx so the toolbar can evolve independently
 * (icon set, layout) without growing the editor module further.
 */

import { useEffect, useRef, useState } from "react";
import {
  Undo2, Redo2, List, ListOrdered, Indent, Outdent, Quote, Minus, Link,
  Image as ImageIcon, RemoveFormatting, Table, Code,
} from "lucide-react";
import { TBtn } from "@/components/editor-primitives";

export default function WysiwygToolbar({ onInsert, onInsertTable, onInputPopup, cmWrap, cmInsert, onImageUpload, onUndo, onRedo, getTiptapEditor }: {
  onInsert: (type: "code" | "math" | "mermaid") => void;
  onInsertTable: (cols: number, rows: number) => void;
  onInputPopup: (config: { label: string; onSubmit: (v: string) => void }) => void;
  cmWrap: (prefix: string, suffix?: string) => void;
  cmInsert: (text: string) => void;
  onImageUpload: () => void;
  onUndo: () => void;
  onRedo: () => void;
  getTiptapEditor?: () => import("@tiptap/core").Editor | null;
}) {
  const mod = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "Cmd" : "Ctrl";
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [blockType, setBlockType] = useState("p");
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [tableHover, setTableHover] = useState({ col: 0, row: 0 });
  const tableGridRef = useRef<HTMLDivElement>(null);

  // Close table grid on outside click
  useEffect(() => {
    if (!showTableGrid) return;
    const handler = (e: MouseEvent) => {
      if (tableGridRef.current && !tableGridRef.current.contains(e.target as Node)) {
        setShowTableGrid(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTableGrid]);

  useEffect(() => {
    const update = () => {
      // Try Tiptap editor first
      const ed = getTiptapEditor?.();
      if (ed && ed.isFocused) {
        setActive({
          bold: ed.isActive("bold"),
          italic: ed.isActive("italic"),
          strikethrough: ed.isActive("strike"),
          ul: ed.isActive("bulletList"),
          ol: ed.isActive("orderedList"),
          code: ed.isActive("code"),
        });
        if (ed.isActive("heading", { level: 1 })) setBlockType("h1");
        else if (ed.isActive("heading", { level: 2 })) setBlockType("h2");
        else if (ed.isActive("heading", { level: 3 })) setBlockType("h3");
        else if (ed.isActive("blockquote")) setBlockType("blockquote");
        else setBlockType("p");
        return;
      }
      // Fallback: CM6 / other
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return;
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  // getTiptapEditor identity is stable per-editor instance; updates we
  // care about all come through `selectionchange`. Adding it to deps
  // would rebind the listener on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect if focus is in SOURCE (CM6) or LIVE (Tiptap)
  const isInCM6 = () => !!document.activeElement?.closest(".cm-editor");

  // Smart exec: routes to Tiptap (Live) or CM6 wrap (Source)
  const exec = (cmd: string, value?: string) => {
    if (cmd === "undo") { onUndo(); return; }
    if (cmd === "redo") { onRedo(); return; }
    if (isInCM6()) {
      const mdMap: Record<string, [string, string?]> = {
        bold: ["**"],
        italic: ["*"],
        strikeThrough: ["~~"],
        insertUnorderedList: ["- "],
        insertOrderedList: ["1. "],
      };
      if (cmd === "createLink" && value) {
        cmWrap("[", `](${value})`);
      } else if (cmd === "insertImage" && value) {
        cmWrap("![", `](${value})`);
      } else {
        const wrap = mdMap[cmd];
        if (wrap) {
          if (cmd === "insertUnorderedList" || cmd === "insertOrderedList") {
            cmInsert(wrap[0]);
          } else {
            cmWrap(wrap[0], wrap[1]);
          }
        }
      }
    } else {
      // Route to Tiptap editor API
      const ed = getTiptapEditor?.();
      if (ed) {
        const tiptapMap: Record<string, () => void> = {
          bold: () => ed.chain().focus().toggleBold().run(),
          italic: () => ed.chain().focus().toggleItalic().run(),
          strikeThrough: () => ed.chain().focus().toggleStrike().run(),
          insertUnorderedList: () => ed.chain().focus().toggleBulletList().run(),
          insertOrderedList: () => ed.chain().focus().toggleOrderedList().run(),
          createLink: () => value && ed.chain().focus().setLink({ href: value }).run(),
          insertHorizontalRule: () => ed.chain().focus().setHorizontalRule().run(),
          removeFormat: () => ed.chain().focus().unsetAllMarks().clearNodes().run(),
          indent: () => ed.chain().focus().sinkListItem("listItem").run(),
          outdent: () => ed.chain().focus().liftListItem("listItem").run(),
        };
        const action = tiptapMap[cmd];
        if (action) action();
      }
    }
  };

  const fmtBlock = (tag: string) => {
    if (isInCM6()) {
      const prefixMap: Record<string, string> = {
        h1: "# ", h2: "## ", h3: "### ", h4: "#### ", h5: "##### ", h6: "###### ",
        p: "", blockquote: "> ",
      };
      const prefix = prefixMap[tag];
      if (prefix !== undefined) cmInsert(prefix);
    } else {
      // Route to Tiptap
      const ed = getTiptapEditor?.();
      if (ed) {
        const levelMap: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
        if (levelMap[tag]) {
          ed.chain().focus().toggleHeading({ level: levelMap[tag] as 1|2|3|4|5|6 }).run();
        } else if (tag === "blockquote") {
          ed.chain().focus().toggleBlockquote().run();
        } else if (tag === "p") {
          ed.chain().focus().setParagraph().run();
        }
      }
    }
  };

  const wrapCode = () => {
    if (isInCM6()) {
      cmWrap("`");
    } else {
      const ed = getTiptapEditor?.();
      if (ed) { ed.chain().focus().toggleCode().run(); return; }
    }
  };

  const sep = <div className="w-px h-5 shrink-0 mx-0.5" style={{ background: "var(--border-dim)" }} />;
  const I = 14;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-0.5 px-2 py-0.5 shrink-0 relative z-[90]"
      style={{ borderBottom: "1px solid var(--border-dim)", color: "var(--text-muted)" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5 shrink-0">
        <TBtn tip={`Undo (${mod}+Z)`} onClick={() => exec("undo")}>
          <Undo2 size={I} />
        </TBtn>
        <TBtn tip={`Redo (${mod}+Shift+Z)`} onClick={() => exec("redo")}>
          <Redo2 size={I} />
        </TBtn>
      </div>
      {sep}
      {/* Headings */}
      <div className="flex items-center gap-0.5 shrink-0">
        <TBtn tip="Heading 1 — # text" active={blockType==="h1"} onClick={() => fmtBlock("h1")}
          preview={<div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.025em" }}>Heading 1</div>}>
          <span className="text-caption font-bold">H1</span></TBtn>
        <TBtn tip="Heading 2 — ## text" active={blockType==="h2"} onClick={() => fmtBlock("h2")}
          preview={<div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>Heading 2</div>}>
          <span className="text-caption font-bold">H2</span></TBtn>
        <TBtn tip="Heading 3 — ### text" active={blockType==="h3"} onClick={() => fmtBlock("h3")}
          preview={<div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>Heading 3</div>}>
          <span className="text-caption font-semibold">H3</span></TBtn>
        <TBtn tip="Heading 4 — #### text" active={blockType==="h4"} onClick={() => fmtBlock("h4")}
          preview={<div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>Heading 4</div>}>
          <span className="text-caption">H4</span></TBtn>
        <TBtn tip="Heading 5 — ##### text" active={blockType==="h5"} onClick={() => fmtBlock("h5")}
          preview={<div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Heading 5</div>}>
          <span className="text-caption">H5</span></TBtn>
        <TBtn tip="Heading 6 — ###### text" active={blockType==="h6"} onClick={() => fmtBlock("h6")}
          preview={<div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.025em" }}>Heading 6</div>}>
          <span className="text-caption">H6</span></TBtn>
        <TBtn tip="Paragraph — normal text" active={blockType==="p"} onClick={() => fmtBlock("p")}
          preview={<div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Normal paragraph text</div>}>
          <span className="text-caption">P</span></TBtn>
      </div>
      {sep}
      {/* Text style */}
      <div className="flex items-center gap-0.5 shrink-0">
        <TBtn tip={`Bold (${mod}+B) → **text**`} active={active.bold} onClick={() => exec("bold")}
          preview={<span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>Bold text</span>}>
          <span className="font-bold text-body">B</span></TBtn>
        <TBtn tip={`Italic (${mod}+I) → *text*`} active={active.italic} onClick={() => exec("italic")}
          preview={<span style={{ fontStyle: "italic", color: "var(--text-secondary)", fontSize: 13 }}>Italic text</span>}>
          <span className="italic text-body">I</span></TBtn>
        <TBtn tip="Strikethrough → ~~text~~" active={active.strikethrough} onClick={() => exec("strikeThrough")}
          preview={<span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontSize: 13 }}>Strikethrough</span>}>
          <span className="line-through text-body">S</span></TBtn>
        <TBtn tip="Inline code → `code`" active={active.code} onClick={wrapCode}
          preview={<code style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--border)", padding: "2px 6px", borderRadius: 4, color: "var(--text-primary)" }}>inline code</code>}>
          <span className="font-mono text-caption">{`</>`}</span></TBtn>
      </div>
      {sep}
      {/* Lists */}
      <div className="flex items-center gap-0.5 shrink-0">
        <TBtn tip="Bullet list → - item" active={active.ul} onClick={() => exec("insertUnorderedList")}
          preview={<div style={{ fontSize: 12 }}><div style={{ color: "var(--text-muted)" }}>• First item</div><div style={{ color: "var(--text-muted)" }}>• Second item</div></div>}>
          <List size={I} />
        </TBtn>
        <TBtn tip="Numbered list → 1. item" active={active.ol} onClick={() => exec("insertOrderedList")}
          preview={<div style={{ fontSize: 12 }}><div style={{ color: "var(--text-muted)" }}>1. First item</div><div style={{ color: "var(--text-muted)" }}>2. Second item</div></div>}>
          <ListOrdered size={I} />
        </TBtn>
        <TBtn tip="Task list → - [ ] item" onClick={() => { if (isInCM6()) { cmInsert("- [ ] "); } else { const ed = getTiptapEditor?.(); if (ed) ed.chain().focus().toggleTaskList().run(); } }}
          preview={<div style={{ fontSize: 12 }}><div style={{ color: "var(--text-muted)" }}>☐ To do item</div><div style={{ color: "var(--text-primary)" }}>☑ Done item</div></div>}>
          <svg width={I} height={I} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="5" height="5" rx="1"/><path d="M3.5 4.5l1 1 2-2" strokeLinecap="round"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="3" width="5" height="2" rx="0.5" fill="currentColor"/><rect x="9" y="10" width="5" height="2" rx="0.5" fill="currentColor"/></svg>
        </TBtn>
        <TBtn tip="Indent" onClick={() => exec("indent")}>
          <Indent size={I} />
        </TBtn>
        <TBtn tip="Outdent" onClick={() => exec("outdent")}>
          <Outdent size={I} />
        </TBtn>
      </div>
      {sep}
      {/* Block elements */}
      <div className="flex items-center gap-0.5 shrink-0">
        <TBtn tip="Blockquote → > text" active={blockType==="blockquote"} onClick={() => fmtBlock("blockquote")}
          preview={<div style={{ borderLeft: "3px solid var(--text-primary)", paddingLeft: 8, color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>Quoted text</div>}>
          <Quote size={I} />
        </TBtn>
        <TBtn tip="Horizontal rule → ---" onClick={() => exec("insertHorizontalRule")}>
          <Minus size={I} />
        </TBtn>
      </div>
      {sep}
      {/* Insert */}
      <div className="flex items-center gap-0.5 shrink-0">
        <TBtn tip={`Link (${mod}+K) → [text](url)`} onClick={() => onInputPopup({ label: "URL", onSubmit: (u) => exec("createLink", u) })}>
          <Link size={I} />
        </TBtn>
        <TBtn tip="Upload image" onClick={() => onImageUpload()}>
          <ImageIcon size={I} />
        </TBtn>
        <TBtn tip="Clear formatting" onClick={() => exec("removeFormat")}>
          <RemoveFormatting size={I} />
        </TBtn>
      </div>
      {sep}
      {/* Insert */}
      <div className="flex items-center gap-0.5 shrink-0">
      <div className="relative" ref={tableGridRef}>
        <TBtn tip="Insert table" onClick={() => setShowTableGrid(v => !v)}>
          <Table size={I} />
        </TBtn>
        {showTableGrid && (
          <div className="absolute top-full left-0 mt-1 p-2 rounded-lg shadow-xl z-[9998]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
            onMouseDown={(e) => e.preventDefault()}>
            <div className="text-caption mb-1.5 text-center" style={{ color: "var(--text-muted)" }}>
              {tableHover.col > 0 ? `${tableHover.col} x ${tableHover.row}` : "Select size"}
            </div>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
              {Array.from({ length: 36 }, (_, i) => {
                const col = (i % 6) + 1;
                const row = Math.floor(i / 6) + 1;
                const isActive = col <= tableHover.col && row <= tableHover.row;
                return (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm border cursor-pointer transition-colors"
                    style={{
                      borderColor: isActive ? "var(--text-primary)" : "var(--border-dim)",
                      background: isActive ? "var(--border)" : "transparent",
                    }}
                    onMouseEnter={() => setTableHover({ col, row })}
                    onClick={() => {
                      onInsertTable(col, row);
                      setShowTableGrid(false);
                      setTableHover({ col: 0, row: 0 });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
      <TBtn tip="Insert code block" onClick={() => onInsert("code")}>
        <Code size={I} />
      </TBtn>
      <TBtn tip="Insert math equation" onClick={() => onInsert("math")}>
        <svg width={I} height={I} viewBox="0 0 16 16" fill="currentColor"><text x="2" y="12" fontSize="11" fontFamily="serif" fontStyle="italic">fx</text></svg>
      </TBtn>
      <TBtn tip="Insert Mermaid diagram" onClick={() => onInsert("mermaid")}>
        <svg width={I} height={I} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="4" y="1" width="8" height="4" rx="1"/><rect x="1" y="11" width="5" height="4" rx="1"/><rect x="10" y="11" width="5" height="4" rx="1"/><path d="M8 5v3M8 8L3.5 11M8 8l4.5 3"/></svg>
      </TBtn>
      </div>
    </div>
  );
}
