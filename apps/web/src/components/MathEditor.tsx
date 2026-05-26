"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import katex from "katex";

// ═══════════════════════════════════════════════════════════════
// MathEditor — Visual LaTeX / KaTeX equation editor
// ═══════════════════════════════════════════════════════════════

type MathMode = "inline" | "block";
type LayoutId = "A" | "B" | "C" | "D" | "E";

// ─── Symbol Categories ───

interface SymbolEntry {
  display: string;
  latex: string;
}

interface TemplateEntry {
  display: string;
  latex: string;
  cursorOffset?: number; // how far back from end to place cursor
}

interface SymbolCategory {
  id: string;
  label: string;
  items: (SymbolEntry | TemplateEntry)[];
}

const SYMBOL_CATEGORIES: SymbolCategory[] = [
  {
    id: "greek", label: "Greek",
    items: [
      { display: "\u03B1", latex: "\\alpha" },
      { display: "\u03B2", latex: "\\beta" },
      { display: "\u03B3", latex: "\\gamma" },
      { display: "\u03B4", latex: "\\delta" },
      { display: "\u03B5", latex: "\\varepsilon" },
      { display: "\u03B8", latex: "\\theta" },
      { display: "\u03BB", latex: "\\lambda" },
      { display: "\u03BC", latex: "\\mu" },
      { display: "\u03C0", latex: "\\pi" },
      { display: "\u03C3", latex: "\\sigma" },
      { display: "\u03C6", latex: "\\varphi" },
      { display: "\u03C9", latex: "\\omega" },
      { display: "\u0393", latex: "\\Gamma" },
      { display: "\u0394", latex: "\\Delta" },
      { display: "\u0398", latex: "\\Theta" },
      { display: "\u039B", latex: "\\Lambda" },
      { display: "\u03A0", latex: "\\Pi" },
      { display: "\u03A3", latex: "\\Sigma" },
      { display: "\u03A6", latex: "\\Phi" },
      { display: "\u03A9", latex: "\\Omega" },
    ],
  },
  {
    id: "operators", label: "Operators",
    items: [
      { display: "+", latex: "+" },
      { display: "\u2212", latex: "-" },
      { display: "\u00D7", latex: "\\times" },
      { display: "\u00F7", latex: "\\div" },
      { display: "\u00B1", latex: "\\pm" },
      { display: "\u2213", latex: "\\mp" },
      { display: "\u00B7", latex: "\\cdot" },
      { display: "\u2218", latex: "\\circ" },
      { display: "\u2295", latex: "\\oplus" },
      { display: "\u2297", latex: "\\otimes" },
    ],
  },
  {
    id: "relations", label: "Relations",
    items: [
      { display: "=", latex: "=" },
      { display: "\u2260", latex: "\\neq" },
      { display: "<", latex: "<" },
      { display: ">", latex: ">" },
      { display: "\u2264", latex: "\\leq" },
      { display: "\u2265", latex: "\\geq" },
      { display: "\u2248", latex: "\\approx" },
      { display: "\u223C", latex: "\\sim" },
      { display: "\u2261", latex: "\\equiv" },
      { display: "\u221D", latex: "\\propto" },
      { display: "\u2208", latex: "\\in" },
      { display: "\u2209", latex: "\\notin" },
      { display: "\u2282", latex: "\\subset" },
      { display: "\u2283", latex: "\\supset" },
      { display: "\u2286", latex: "\\subseteq" },
      { display: "\u2287", latex: "\\supseteq" },
    ],
  },
  {
    id: "arrows", label: "Arrows",
    items: [
      { display: "\u2190", latex: "\\leftarrow" },
      { display: "\u2192", latex: "\\rightarrow" },
      { display: "\u2194", latex: "\\leftrightarrow" },
      { display: "\u21D0", latex: "\\Leftarrow" },
      { display: "\u21D2", latex: "\\Rightarrow" },
      { display: "\u21D4", latex: "\\Leftrightarrow" },
      { display: "\u2191", latex: "\\uparrow" },
      { display: "\u2193", latex: "\\downarrow" },
      { display: "\u21A6", latex: "\\mapsto" },
    ],
  },
  {
    id: "accents", label: "Accents",
    items: [
      { display: "hat", latex: "\\hat{x}", cursorOffset: 1 },
      { display: "bar", latex: "\\bar{x}", cursorOffset: 1 },
      { display: "vec", latex: "\\vec{x}", cursorOffset: 1 },
      { display: "dot", latex: "\\dot{x}", cursorOffset: 1 },
      { display: "ddot", latex: "\\ddot{x}", cursorOffset: 1 },
      { display: "tilde", latex: "\\tilde{x}", cursorOffset: 1 },
      { display: "overline", latex: "\\overline{x}", cursorOffset: 1 },
      { display: "underline", latex: "\\underline{x}", cursorOffset: 1 },
    ],
  },
  {
    id: "functions", label: "Functions",
    items: [
      { display: "sin", latex: "\\sin" },
      { display: "cos", latex: "\\cos" },
      { display: "tan", latex: "\\tan" },
      { display: "log", latex: "\\log" },
      { display: "ln", latex: "\\ln" },
      { display: "exp", latex: "\\exp" },
      { display: "lim", latex: "\\lim_{x \\to }", cursorOffset: 1 },
      { display: "min", latex: "\\min" },
      { display: "max", latex: "\\max" },
      { display: "sup", latex: "\\sup" },
      { display: "inf", latex: "\\inf" },
    ],
  },
  {
    id: "structures", label: "Structures",
    items: [
      { display: "a/b", latex: "\\frac{a}{b}", cursorOffset: 4 },
      { display: "\u221A", latex: "\\sqrt{x}", cursorOffset: 1 },
      { display: "\u2211", latex: "\\sum_{i=0}^{n}", cursorOffset: 1 },
      { display: "\u220F", latex: "\\prod_{i=0}^{n}", cursorOffset: 1 },
      { display: "\u222B", latex: "\\int_{a}^{b}", cursorOffset: 1 },
      { display: "\u222E", latex: "\\oint", cursorOffset: 0 },
      { display: "C(n,k)", latex: "\\binom{n}{k}", cursorOffset: 4 },
      { display: "matrix", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", cursorOffset: 15 },
    ],
  },
  {
    id: "delimiters", label: "Delimiters",
    items: [
      { display: "( )", latex: "\\left( \\right)", cursorOffset: 8 },
      { display: "[ ]", latex: "\\left[ \\right]", cursorOffset: 8 },
      { display: "{ }", latex: "\\left\\{ \\right\\}", cursorOffset: 9 },
      { display: "| |", latex: "\\left| \\right|", cursorOffset: 8 },
      { display: "\u2016 \u2016", latex: "\\left\\| \\right\\|", cursorOffset: 9 },
      { display: "\u27E8 \u27E9", latex: "\\left\\langle \\right\\rangle", cursorOffset: 14 },
    ],
  },
];

// ─── Layout System (same as MdCanvas) ───

const LAYOUTS: { id: LayoutId; title: string; icon: React.ReactNode }[] = [
  { id: "A", title: "Symbols left, stacked right", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/><line x1="7" y1="0" x2="7" y2="12"/><line x1="7" y1="6" x2="16" y2="6"/></svg> },
  { id: "B", title: "Symbols top, split bottom", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/><line x1="0" y1="5.5" x2="16" y2="5.5"/><line x1="8" y1="5.5" x2="8" y2="12"/></svg> },
  { id: "C", title: "3 columns", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/><line x1="5.5" y1="0" x2="5.5" y2="12"/><line x1="10.5" y1="0" x2="10.5" y2="12"/></svg> },
  { id: "D", title: "Preview bottom", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/><line x1="0" y1="5.5" x2="16" y2="5.5"/><line x1="8" y1="0" x2="8" y2="5.5"/></svg> },
  { id: "E", title: "Preview only", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/></svg> },
];

type PanelPos = React.CSSProperties;
const bdr = "var(--border-dim)";

const GRID_STYLES: Record<LayoutId, React.CSSProperties> = {
  A: { gridTemplateColumns: "1fr 5px 1.2fr", gridTemplateRows: "1fr 5px 1.5fr" },
  B: { gridTemplateColumns: "1fr 5px 1.5fr", gridTemplateRows: "1.2fr 5px 1fr" },
  C: { gridTemplateColumns: "2fr 5px 1fr 5px 1.5fr", gridTemplateRows: "1fr" },
  D: { gridTemplateColumns: "1fr 5px 1fr", gridTemplateRows: "2fr 5px 3fr" },
  E: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
};

const PANEL_AREAS: Record<LayoutId, { symbols: PanelPos; sep1: PanelPos; code: PanelPos; sep2: PanelPos; preview: PanelPos }> = {
  A: {
    symbols: { gridColumn: "1", gridRow: "1 / -1" },
    sep1:    { gridColumn: "2", gridRow: "1 / -1", background: bdr, cursor: "col-resize" },
    code:    { gridColumn: "3", gridRow: "1" },
    sep2:    { gridColumn: "3", gridRow: "2", background: bdr, cursor: "row-resize" },
    preview: { gridColumn: "3", gridRow: "3" },
  },
  B: {
    symbols: { gridColumn: "1 / -1", gridRow: "1" },
    sep1:    { gridColumn: "2", gridRow: "3", background: bdr, cursor: "col-resize" },
    code:    { gridColumn: "1", gridRow: "3" },
    sep2:    { gridColumn: "1 / -1", gridRow: "2", background: bdr, cursor: "row-resize" },
    preview: { gridColumn: "3", gridRow: "3" },
  },
  C: {
    symbols: { gridColumn: "1", gridRow: "1" },
    sep1:    { gridColumn: "2", gridRow: "1", background: bdr, cursor: "col-resize" },
    code:    { gridColumn: "3", gridRow: "1" },
    sep2:    { gridColumn: "4", gridRow: "1", background: bdr, cursor: "col-resize" },
    preview: { gridColumn: "5", gridRow: "1" },
  },
  D: {
    symbols: { gridColumn: "1", gridRow: "1" },
    sep1:    { gridColumn: "2", gridRow: "1", background: bdr, cursor: "col-resize" },
    code:    { gridColumn: "3", gridRow: "1" },
    sep2:    { gridColumn: "1 / -1", gridRow: "2", background: bdr, cursor: "row-resize" },
    preview: { gridColumn: "1 / -1", gridRow: "3" },
  },
  E: {
    symbols: { display: "none" },
    sep1:    { display: "none" },
    code:    { display: "none" },
    sep2:    { display: "none" },
    preview: { gridColumn: "1", gridRow: "1" },
  },
};

// ─── Panel Header ───

function Header({ label }: { label: string }) {
  return (
    <div className="flex items-center px-3 py-1.5 text-caption font-mono uppercase tracking-wider shrink-0"
      style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-dim)" }}>
      {label}
    </div>
  );
}

// ─── Symbols Panel ───

function SymbolsPanel({
  onInsert,
}: {
  onInsert: (latex: string, cursorOffset?: number) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-0 overflow-auto" style={{ padding: 0 }}>
      {SYMBOL_CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <button
            onClick={() => toggle(cat.id)}
            className="w-full flex items-center justify-between px-3 py-2 text-caption font-semibold uppercase tracking-wider"
            style={{
              color: "var(--text-faint)",
              borderBottom: "1px solid var(--border-dim)",
              background: "none",
              border: "none",
              borderBottomStyle: "solid",
              borderBottomWidth: 1,
              borderBottomColor: "var(--border-dim)",
              cursor: "pointer",
            }}
          >
            <span>{cat.label}</span>
            <span style={{ fontSize: 10, opacity: 0.5, transform: collapsed[cat.id] ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.15s" }}>
              {"\u25BE"}
            </span>
          </button>
          {!collapsed[cat.id] && (
            <div className="flex flex-wrap gap-1 p-2">
              {cat.items.map((item, i) => (
                <button
                  key={i}
                  title={item.latex}
                  onClick={() => onInsert(item.latex, (item as TemplateEntry).cursorOffset)}
                  className="flex items-center justify-center rounded text-xs"
                  style={{
                    width: cat.id === "accents" || cat.id === "functions" || cat.id === "structures" || cat.id === "delimiters" ? "auto" : 32,
                    minWidth: 32,
                    height: 32,
                    padding: "2px 6px",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-dim)",
                    cursor: "pointer",
                    fontFamily: cat.id === "functions" || cat.id === "accents" || cat.id === "structures" ? "monospace" : "inherit",
                    fontSize: cat.id === "functions" || cat.id === "accents" || cat.id === "structures" || cat.id === "delimiters" ? 10 : 14,
                    transition: "border-color 0.12s, color 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--text-primary)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-dim)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                >
                  {item.display}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Grid Layout ───

function MathGridLayout({
  latex,
  setLatex,
  layout,
  mode,
  previewHtml,
  previewError,
  onInsertSymbol,
  textareaRef,
}: {
  latex: string;
  setLatex: (v: string) => void;
  layout: LayoutId;
  mode: MathMode;
  previewHtml: string;
  previewError: string | null;
  onInsertSymbol: (latex: string, cursorOffset?: number) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const areas = PANEL_AREAS[layout];
  const gridRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"sep1" | "sep2" | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const grid = gridRef.current;
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    if (dragging.current === "sep1") {
      if (areas.sep1.cursor === "col-resize") {
        const px = Math.max(100, Math.min(rect.width - 150, xPx));
        grid.style.gridTemplateColumns = `${px}px 5px 1fr` + (layout === "C" ? " 5px 1fr" : "");
      } else if (areas.sep1.cursor === "row-resize") {
        const px = Math.max(60, Math.min(rect.height - 100, yPx));
        grid.style.gridTemplateRows = `${px}px 5px 1fr`;
      }
    } else if (dragging.current === "sep2") {
      if (areas.sep2.cursor === "col-resize") {
        const firstColPx = gridRef.current.children[0]?.getBoundingClientRect().width || 200;
        const codePx = Math.max(80, Math.min(rect.width - firstColPx - 160, xPx - firstColPx - 5));
        grid.style.gridTemplateColumns = `${firstColPx}px 5px ${codePx}px 5px 1fr`;
      } else if (areas.sep2.cursor === "row-resize") {
        const px = Math.max(60, Math.min(rect.height - 100, yPx));
        grid.style.gridTemplateRows = `${px}px 5px 1fr`;
      }
    }
  }, [areas, layout]);

  const handleMouseUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={gridRef} className="flex-1" style={{ display: "grid", ...GRID_STYLES[layout], minHeight: 0 }}>
      {/* Symbols panel */}
      <div className="flex flex-col overflow-hidden" style={areas.symbols}>
        <Header label="Symbols" />
        <div className="flex-1 overflow-auto">
          <SymbolsPanel onInsert={onInsertSymbol} />
        </div>
      </div>

      {/* Sep 1 */}
      <div
        style={areas.sep1}
        onMouseDown={(e) => { e.preventDefault(); dragging.current = "sep1"; }}
      >
        <div style={{ width: "100%", height: "100%", minWidth: 5, minHeight: 5 }} />
      </div>

      {/* Code panel */}
      <div className="flex flex-col overflow-hidden" style={areas.code}>
        <Header label="LaTeX" />
        <textarea
          ref={textareaRef}
          className="flex-1 p-3 overflow-auto text-sm font-mono leading-relaxed resize-none outline-none"
          style={{ color: "var(--text-primary)", background: "var(--surface)", margin: 0, border: "none" }}
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          spellCheck={false}
          placeholder="Type LaTeX here, e.g. \frac{a}{b} + \sqrt{c}"
        />
      </div>

      {/* Sep 2 */}
      <div
        style={areas.sep2}
        onMouseDown={(e) => { e.preventDefault(); dragging.current = "sep2"; }}
      >
        <div style={{ width: "100%", height: "100%", minWidth: 5, minHeight: 5 }} />
      </div>

      {/* Preview panel */}
      <div className="flex flex-col overflow-hidden" style={areas.preview}>
        <Header label="Preview" />
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {previewError ? (
            <div className="text-xs font-mono p-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", maxWidth: "100%", wordBreak: "break-word" }}>
              {previewError}
            </div>
          ) : latex.trim() ? (
            <div
              className="katex-preview"
              style={{
                fontSize: mode === "block" ? "1.3em" : "1.1em",
                color: "var(--text-primary)",
                textAlign: "center",
                width: "100%",
                overflowX: "auto",
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              Type LaTeX to see preview
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

function MathEditor({
  onGenerate,
  onCancel,
  initialMath,
}: {
  onGenerate: (md: string) => void;
  onCancel?: () => void;
  initialMath?: string;
}) {
  const [latex, setLatex] = useState(initialMath || "");
  const [mode, setMode] = useState<MathMode>("block");
  const [layout, setLayout] = useState<LayoutId>("A");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced KaTeX rendering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = latex.trim();
      if (!trimmed) {
        setPreviewHtml("");
        setPreviewError(null);
        return;
      }
      try {
        const html = katex.renderToString(trimmed, {
          displayMode: mode === "block",
          throwOnError: true,
          trust: true,
          strict: false,
        });
        setPreviewHtml(html);
        setPreviewError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // Clean up KaTeX error messages
        const cleaned = message.replace(/^KaTeX parse error:\s*/i, "");
        setPreviewError(cleaned);
      }
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [latex, mode]);

  // Insert symbol at cursor position
  const handleInsertSymbol = useCallback((symbolLatex: string, cursorOffset?: number) => {
    const ta = textareaRef.current;
    if (!ta) {
      setLatex(prev => prev + symbolLatex);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = latex.substring(0, start);
    const after = latex.substring(end);
    // Add space before if needed (not at start, not after space/newline/opening brace)
    const needsSpace = before.length > 0 && !/[\s{(]$/.test(before);
    const insert = (needsSpace ? " " : "") + symbolLatex;
    const newLatex = before + insert + after;
    setLatex(newLatex);

    // Set cursor position
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insert.length - (cursorOffset || 0);
      ta.setSelectionRange(pos, pos);
    });
  }, [latex]);

  // Apply: wrap in delimiters and call onGenerate
  const handleApply = useCallback(() => {
    const trimmed = latex.trim();
    if (!trimmed) return;
    if (mode === "inline") {
      onGenerate(`$${trimmed}$`);
    } else {
      onGenerate(`$$\n${trimmed}\n$$`);
    }
  }, [latex, mode, onGenerate]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-2 text-xs flex-wrap gap-2"
        style={{ borderBottom: "1px solid var(--border-dim)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono uppercase tracking-wider text-caption" style={{ color: "var(--text-muted)" }}>
            Math
          </span>
          {/* Inline / Block toggle */}
          <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
            <button
              onClick={() => setMode("inline")}
              className="px-2.5 font-mono text-caption font-semibold leading-[24px]"
              style={{
                height: 24,
                background: mode === "inline" ? "var(--border)" : "transparent",
                color: mode === "inline" ? "var(--text-primary)" : "var(--text-faint)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Inline
            </button>
            <button
              onClick={() => setMode("block")}
              className="px-2.5 font-mono text-caption font-semibold leading-[24px]"
              style={{
                height: 24,
                background: mode === "block" ? "var(--border)" : "transparent",
                color: mode === "block" ? "var(--text-primary)" : "var(--text-faint)",
                border: "none",
                borderLeft: "1px solid var(--border-dim)",
                cursor: "pointer",
              }}
            >
              Block
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout options */}
          <div className="flex gap-1 mr-1" style={{ borderRight: "1px solid var(--border-dim)", paddingRight: 8 }}>
            {LAYOUTS.map((l) => (
              <button key={l.id} title={l.title}
                className="p-1 rounded"
                style={{ color: layout === l.id ? "var(--text-primary)" : "var(--text-faint)", opacity: layout === l.id ? 1 : 0.4, background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setLayout(l.id)}>
                {l.icon}
              </button>
            ))}
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 rounded-md font-mono text-caption"
              style={{ background: "var(--toggle-bg)", color: "var(--text-muted)", border: "none", cursor: "pointer" }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleApply}
            disabled={!latex.trim()}
            className="px-3 py-1 rounded-md font-mono text-caption font-semibold"
            style={{
              background: latex.trim() ? "var(--text-primary)" : "var(--toggle-bg)",
              color: latex.trim() ? "#000" : "var(--text-muted)",
              border: "none",
              cursor: latex.trim() ? "pointer" : "default",
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Grid layout */}
      <MathGridLayout
        latex={latex}
        setLatex={setLatex}
        layout={layout}
        mode={mode}
        previewHtml={previewHtml}
        previewError={previewError}
        onInsertSymbol={handleInsertSymbol}
        textareaRef={textareaRef}
      />
    </div>
  );
}

export default memo(MathEditor);
