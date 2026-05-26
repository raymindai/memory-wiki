"use client";

import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import {
  type CanvasNode,
  type CanvasEdge,
  canvasToMermaid,
  mermaidToCanvas,
  wrapInCodeBlock,
} from "@/lib/canvas-to-mermaid";

let nextId = 1;
function genId() {
  return `n${nextId++}`;
}

type Direction = "LR" | "TD";

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface ConnectState {
  fromId: string;
  mouseX: number;
  mouseY: number;
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const shapeCSS: Record<CanvasNode["shape"], React.CSSProperties> = {
  round: { borderRadius: "20px" },
  square: { borderRadius: "4px" },
  circle: { borderRadius: "50%", width: "90px", height: "90px", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", margin: "0 auto" },
  diamond: { transform: "rotate(45deg)", borderRadius: "4px", width: "80px", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", margin: "0 auto" },
};

// SVG mini icons for shape selector
function ShapeIcon({ shape, size = 14 }: { shape: CanvasNode["shape"]; size?: number }) {
  const s = size;
  const c = "var(--text-primary)";
  switch (shape) {
    case "round":
      return <svg width={s} height={s} viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="5" fill="none" stroke={c} strokeWidth="1.5"/></svg>;
    case "square":
      return <svg width={s} height={s} viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="1" fill="none" stroke={c} strokeWidth="1.5"/></svg>;
    case "circle":
      return <svg width={s} height={s} viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.5"/></svg>;
    case "diamond":
      return <svg width={s} height={s} viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="none" stroke={c} strokeWidth="1.5"/></svg>;
  }
}

import { DiagramFormEditor, detectDiagramType, DIAGRAM_TYPES, type DiagramTypeId } from "./MermaidEditors";

const _PIE_COLORS = ["#fb923c", "#60a5fa", "#4ade80", "#c4b5fd", "#f472b6", "#fbbf24", "#f87171", "#38bdf8", "#a3e635", "#e879f9"];

// ─── Diagram-type-specific Help ───

const A = ({ children }: { children: React.ReactNode }) => <span style={{ color: "var(--text-primary)" }}>{children}</span>;
const HelpCol = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div><p className="font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>{title}</p>{children}</div>
);

function DiagramHelp({ type }: { type: DiagramTypeId | "flowchart" }) {
  const guides: Record<string, React.ReactNode> = {
    flowchart: (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ color: "var(--text-tertiary)" }}>
        <HelpCol title="Create">
          <p><A>Double-click</A> canvas to add a node</p>
          <p><A>Click shape</A> to cycle: round/square/circle/diamond</p>
          <p><A>Double-click node</A> to edit text</p>
        </HelpCol>
        <HelpCol title="Connect">
          <p><A>Alt + drag</A> from one node to another</p>
          <p><A>Double-click edge</A> to add a label</p>
          <p><A>Delete</A> to remove selected</p>
          <p><A>Cmd+D</A> to duplicate</p>
        </HelpCol>
        <HelpCol title="Shapes">
          <p><A>()</A> Round &mdash; default node</p>
          <p><A>[]</A> Square &mdash; process/action</p>
          <p><A>(())</A> Circle &mdash; start/end</p>
          <p><A>{"{}"}</A> Diamond &mdash; decision</p>
        </HelpCol>
      </div>
    ),
    sequence: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ color: "var(--text-tertiary)" }}>
        <HelpCol title="Participants">
          <p>Add actors at the top &mdash; they appear as boxes in the diagram</p>
          <p>Order matters: left to right in the diagram</p>
        </HelpCol>
        <HelpCol title="Messages">
          <p><A>{"->>  "}</A> Solid line with arrowhead (request)</p>
          <p><A>{"-->>"}</A> Dashed line with arrowhead (response)</p>
          <p><A>{"->"}</A> Solid line, no arrowhead</p>
          <p><A>{"-->"}</A> Dashed line, no arrowhead</p>
          <p><A>{"-)"}</A> Async message (open arrowhead)</p>
        </HelpCol>
      </div>
    ),
    pie: (
      <div style={{ color: "var(--text-tertiary)" }}>
        <p>Add slices with labels and values. The chart auto-calculates percentages.</p>
        <p>Drag the slider or type a number to adjust each slice.</p>
      </div>
    ),
    gantt: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ color: "var(--text-tertiary)" }}>
        <HelpCol title="Tasks">
          <p><A>Status:</A> done, active, crit, or leave empty</p>
          <p><A>Date:</A> start date + duration, e.g. <code>2026-01-01, 5d</code></p>
          <p>Or use <code>after task1, 3d</code> for dependencies</p>
        </HelpCol>
        <HelpCol title="Sections">
          <p>Group tasks into phases/sections</p>
          <p>Each section gets a visual separator in the chart</p>
        </HelpCol>
      </div>
    ),
    er: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ color: "var(--text-tertiary)" }}>
        <HelpCol title="Entities">
          <p>Define tables with typed attributes</p>
          <p>Format: <code>type name</code> (e.g. <code>int id</code>)</p>
        </HelpCol>
        <HelpCol title="Relations">
          <p><A>||--o{"{"}</A> one-to-many</p>
          <p><A>{"}"}&zwj;|--|{"{"}</A> many-to-many</p>
          <p><A>||--||</A> one-to-one</p>
        </HelpCol>
      </div>
    ),
    class: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ color: "var(--text-tertiary)" }}>
        <HelpCol title="Classes">
          <p>Add members with <A>+</A> (public), <A>-</A> (private), <A>#</A> (protected)</p>
          <p>Methods end with <code>()</code></p>
        </HelpCol>
        <HelpCol title="Relations">
          <p><A>{"<|--"}</A> Inheritance</p>
          <p><A>*--</A> Composition</p>
          <p><A>o--</A> Aggregation</p>
          <p><A>{"..|>"}</A> Implementation</p>
        </HelpCol>
      </div>
    ),
    state: (
      <div style={{ color: "var(--text-tertiary)" }}>
        <p>Define states and transitions between them.</p>
        <p><A>[*]</A> represents the start/end point.</p>
        <p>Add labels to transitions to describe triggers (e.g. <code>start</code>, <code>complete</code>).</p>
      </div>
    ),
    mindmap: (
      <div style={{ color: "var(--text-tertiary)" }}>
        <p>Hierarchical tree structure. Indent level determines parent-child relationship.</p>
        <p>The first item is the root node. Each deeper indent creates a child.</p>
      </div>
    ),
    timeline: (
      <div style={{ color: "var(--text-tertiary)" }}>
        <p>Add periods (years, quarters, etc.) and events under each period.</p>
        <p>Events are shown chronologically along the timeline.</p>
      </div>
    ),
    journey: (
      <div style={{ color: "var(--text-tertiary)" }}>
        <p>Map user experience across sections. Each task has a <A>satisfaction rating</A> (1-5).</p>
        <p>Group tasks into sections like &ldquo;Onboarding&rdquo;, &ldquo;Usage&rdquo;, etc.</p>
      </div>
    ),
    quadrant: (
      <div style={{ color: "var(--text-tertiary)" }}>
        <p>Plot items on a 2D grid. X and Y values range from <A>0.0</A> to <A>1.0</A>.</p>
        <p>Great for priority matrices, effort/impact charts, etc.</p>
      </div>
    ),
    xy: (
      <div style={{ color: "var(--text-tertiary)" }}>
        <p>Define X-axis labels, then add <A>bar</A> or <A>line</A> series with matching data points.</p>
        <p>Each series array must have the same length as the X-axis labels.</p>
      </div>
    ),
    git: (
      <div style={{ color: "var(--text-tertiary)" }}>
        <p>Build a git history: <A>commit</A>, <A>branch</A>, <A>checkout</A>, <A>merge</A>.</p>
        <p>Commands execute in order, building the graph top to bottom.</p>
      </div>
    ),
  };

  return <>{guides[type] || guides.flowchart}</>;
}

// ─── Raw Mode Layout (Editor + Code + Preview with layout options) ───

// Layout options:
// A: Editor | Code | Preview  (3 columns)
// B: Editor+Code (top) / Preview (bottom full)  — for wide diagrams
// C: Editor (top full) / Code+Preview (bottom)  — editor focus
// D: Preview only (full)  — viewing focus

type RawLayout = "A" | "B" | "C" | "D" | "E";

const LAYOUTS: { id: RawLayout; title: string; icon: React.ReactNode }[] = [
  // A: Editor (left full) / Code (right top) + Preview (right bottom) — DEFAULT
  { id: "A", title: "Editor left, stacked right", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/><line x1="7" y1="0" x2="7" y2="12"/><line x1="7" y1="6" x2="16" y2="6"/></svg> },
  // B: Editor (top full) / Code (bottom left) + Preview (bottom right)
  { id: "B", title: "Editor top, split bottom", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/><line x1="0" y1="5.5" x2="16" y2="5.5"/><line x1="8" y1="5.5" x2="8" y2="12"/></svg> },
  // C: Editor | Code | Preview (3 columns)
  { id: "C", title: "3 columns", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/><line x1="5.5" y1="0" x2="5.5" y2="12"/><line x1="10.5" y1="0" x2="10.5" y2="12"/></svg> },
  // D: Editor+Code (top) / Preview (bottom full) — wide diagrams
  { id: "D", title: "Preview bottom", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/><line x1="0" y1="5.5" x2="16" y2="5.5"/><line x1="8" y1="0" x2="8" y2="5.5"/></svg> },
  // E: Preview only (full)
  { id: "E", title: "Preview only", icon: <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="15" height="11" rx="1"/></svg> },
];

// CSS Grid layouts — panels stay in DOM, only grid-template changes
type PanelPos = React.CSSProperties;
const bdr = "var(--border-dim)";

const GRID_STYLES: Record<RawLayout, React.CSSProperties> = {
  A: { gridTemplateColumns: "1fr 5px 1.2fr", gridTemplateRows: "1fr 5px 1.5fr" },
  B: { gridTemplateColumns: "1fr 5px 1.5fr", gridTemplateRows: "1.2fr 5px 1fr" },
  C: { gridTemplateColumns: "2fr 5px 1fr 5px 1.5fr", gridTemplateRows: "1fr" },
  D: { gridTemplateColumns: "1fr 5px 1fr", gridTemplateRows: "2fr 5px 3fr" },
  E: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
};

const PANEL_AREAS: Record<RawLayout, { editor: PanelPos; sep1: PanelPos; code: PanelPos; sep2: PanelPos; preview: PanelPos }> = {
  // A: Editor (left full height) / Code (right top) + Preview (right bottom)
  A: {
    editor:  { gridColumn: "1", gridRow: "1 / -1" },
    sep1:    { gridColumn: "2", gridRow: "1 / -1", background: bdr, cursor: "col-resize" },
    code:    { gridColumn: "3", gridRow: "1" },
    sep2:    { gridColumn: "3", gridRow: "2", background: bdr, cursor: "row-resize" },
    preview: { gridColumn: "3", gridRow: "3" },
  },
  // B: Editor (top full width) / Code (bottom left) + Preview (bottom right)
  B: {
    editor:  { gridColumn: "1 / -1", gridRow: "1" },
    sep1:    { gridColumn: "2", gridRow: "3", background: bdr, cursor: "col-resize" },
    code:    { gridColumn: "1", gridRow: "3" },
    sep2:    { gridColumn: "1 / -1", gridRow: "2", background: bdr, cursor: "row-resize" },
    preview: { gridColumn: "3", gridRow: "3" },
  },
  // C: Editor | Code | Preview (3 columns)
  C: {
    editor:  { gridColumn: "1", gridRow: "1" },
    sep1:    { gridColumn: "2", gridRow: "1", background: bdr, cursor: "col-resize" },
    code:    { gridColumn: "3", gridRow: "1" },
    sep2:    { gridColumn: "4", gridRow: "1", background: bdr, cursor: "col-resize" },
    preview: { gridColumn: "5", gridRow: "1" },
  },
  // D: Editor+Code (top) / Preview (bottom full)
  D: {
    editor:  { gridColumn: "1", gridRow: "1" },
    sep1:    { gridColumn: "2", gridRow: "1", background: bdr, cursor: "col-resize" },
    code:    { gridColumn: "3", gridRow: "1" },
    sep2:    { gridColumn: "1 / -1", gridRow: "2", background: bdr, cursor: "row-resize" },
    preview: { gridColumn: "1 / -1", gridRow: "3" },
  },
  // E: Preview only
  E: {
    editor:  { display: "none" },
    sep1:    { display: "none" },
    code:    { display: "none" },
    sep2:    { display: "none" },
    preview: { gridColumn: "1", gridRow: "1" },
  },
};

function RawModeLayout({
  rawCode, setRawCode, previewPanelRef, layout,
}: {
  rawCode: string;
  setRawCode: (code: string) => void;
  previewPanelRef: React.RefObject<HTMLDivElement | null>;
  layout: RawLayout;
}) {
  const areas = PANEL_AREAS[layout];
  const gridRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"sep1" | "sep2" | null>(null);

  const Header = ({ label }: { label: string }) => (
    <div className="flex items-center px-3 py-1.5 text-caption font-mono uppercase tracking-wider shrink-0"
      style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-dim)" }}>
      {label}
    </div>
  );

  // Resize handler — directly set pixel sizes on grid tracks
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
        // For C layout (3 cols): sep2 is between code and preview
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
      {/* Editor */}
      <div className="flex flex-col overflow-hidden" style={areas.editor}>
        <Header label="Editor" />
        <div className="flex-1 overflow-auto">
          <DiagramFormEditor code={rawCode} onChange={setRawCode} />
        </div>
      </div>

      {/* Sep 1 — draggable */}
      <div
        style={areas.sep1}
        onMouseDown={(e) => { e.preventDefault(); dragging.current = "sep1"; }}
      >
        <div style={{ width: "100%", height: "100%", minWidth: 5, minHeight: 5 }} />
      </div>

      {/* Code */}
      <div className="flex flex-col overflow-hidden" style={areas.code}>
        <Header label="Code" />
        <textarea
          className="flex-1 p-3 overflow-auto text-xs font-mono leading-relaxed resize-none outline-none"
          style={{ color: "var(--text-secondary)", background: "var(--surface)", margin: 0, border: "none" }}
          value={rawCode} onChange={(e) => setRawCode(e.target.value)} spellCheck={false}
        />
      </div>

      {/* Sep 2 — draggable */}
      <div
        style={areas.sep2}
        onMouseDown={(e) => { e.preventDefault(); dragging.current = "sep2"; }}
      >
        <div style={{ width: "100%", height: "100%", minWidth: 5, minHeight: 5 }} />
      </div>

      {/* Preview — always in DOM, never unmounts */}
      <div className="flex flex-col overflow-hidden" style={areas.preview}>
        <Header label="Preview" />
        <div className="flex-1 overflow-auto p-3 flex items-center justify-center" ref={previewPanelRef}>
          {rawCode ? (
            <div className="mermaid-preview-render" style={{ textAlign: "center", width: "100%" }} />
          ) : (
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Edit to see preview</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Flowchart Layout — same CSS Grid as RawModeLayout ───

function FlowchartLayout({
  layout, liveCode, previewPanelRef, onCodeChange, direction, setDirection, children,
}: {
  layout: RawLayout;
  liveCode: string;
  previewPanelRef: React.RefObject<HTMLDivElement | null>;
  onCodeChange: (code: string) => void;
  direction: Direction;
  setDirection: (d: Direction) => void;
  children: React.ReactNode; // canvas content
}) {
  const areas = PANEL_AREAS[layout];
  const gridRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"sep1" | "sep2" | null>(null);

  const Header = ({ label, extra }: { label: string; extra?: React.ReactNode }) => (
    <div className="flex items-center justify-between px-3 py-1.5 text-caption font-mono uppercase tracking-wider shrink-0"
      style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-dim)" }}>
      <span>{label}</span>
      {extra}
    </div>
  );

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

  const dirToggle = (
    <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {(["LR", "TD"] as Direction[]).map((d) => (
        <button key={d} onClick={() => setDirection(d)}
          className="px-2.5 py-1 text-caption font-mono font-semibold"
          style={{ background: direction === d ? "var(--border)" : "transparent", color: direction === d ? "var(--text-primary)" : "var(--text-faint)" }}>
          {d === "LR" ? (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"inline",verticalAlign:"middle"}}><path d="M3 8h10M10 5l3 3-3 3"/></svg>) : (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"inline",verticalAlign:"middle"}}><path d="M8 3v10M5 10l3 3 3-3"/></svg>)}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={gridRef} className="flex-1" style={{ display: "grid", ...GRID_STYLES[layout], minHeight: 0 }}>
      {/* Editor (canvas) */}
      <div className="flex flex-col overflow-hidden" style={areas.editor}>
        <Header label="Editor" extra={dirToggle} />
        {children}
      </div>

      <div style={areas.sep1} onMouseDown={(e) => { e.preventDefault(); dragging.current = "sep1"; }}>
        <div style={{ width: "100%", height: "100%", minWidth: 5, minHeight: 5 }} />
      </div>

      {/* Code */}
      <div className="flex flex-col overflow-hidden" style={areas.code}>
        <Header label="Code" />
        <textarea
          className="flex-1 p-3 overflow-auto text-xs font-mono leading-relaxed resize-none outline-none"
          style={{ color: "var(--text-secondary)", background: "var(--surface)", margin: 0, border: "none" }}
          value={liveCode}
          onChange={(e) => onCodeChange(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div style={areas.sep2} onMouseDown={(e) => { e.preventDefault(); dragging.current = "sep2"; }}>
        <div style={{ width: "100%", height: "100%", minWidth: 5, minHeight: 5 }} />
      </div>

      {/* Preview */}
      <div className="flex flex-col overflow-hidden" style={areas.preview}>
        <Header label="Preview" />
        <div className="flex-1 overflow-auto p-3 flex items-center justify-center" ref={previewPanelRef}>
          {liveCode ? (
            <div className="mermaid-preview-render" style={{ textAlign: "center", width: "100%" }} />
          ) : (
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Add nodes to see preview</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MdCanvas({
  onGenerate,
  onCancel,
  initialMermaid,
}: {
  onGenerate: (md: string) => void;
  onCancel?: () => void;
  initialMermaid?: string;
}) {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [direction, setDirection] = useState<Direction>("LR");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [connectState, setConnectState] = useState<ConnectState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<number | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const justSelectedRef = useRef(false);
  const [_canvasSplit, _setCanvasSplit] = useState(65); // editor % vs code+preview
  const [_codeSplit, _setCodeSplit] = useState(50); // code % vs preview (vertical)
  const _isDraggingCanvasSplit = useRef(false);
  const _isDraggingCodeSplit = useRef(false);
  const _canvasWrapperRef = useRef<HTMLDivElement>(null);
  const _codePanelRef = useRef<HTMLDivElement>(null);
  const [_expandedPanel, _setExpandedPanel] = useState<"editor" | "code" | "preview" | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [rawCodeMode, setRawCodeMode] = useState(false);
  const [rawCode, setRawCode] = useState("");
  const [importCode, setImportCode] = useState("");
  const [showCode, _setShowCode] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [rawLayout, setRawLayout] = useState<RawLayout>("A"); // default: Editor left, stacked right
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  // Live Mermaid code preview
  const liveCode = useMemo(
    () => (nodes.length > 0 ? canvasToMermaid(nodes, edges, direction) : ""),
    [nodes, edges, direction]
  );

  // Render live Mermaid preview
  const renderIdRef = useRef(0);
  useEffect(() => {
    const currentRender = ++renderIdRef.current;
    const codeToRender = rawCodeMode ? rawCode : liveCode;
    if (!codeToRender) return;
    if (!rawCodeMode && !showCode) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mermaid = (window as any).mermaid;
    if (!mermaid) return;

    const tryRender = (attempt: number) => {
      if (currentRender !== renderIdRef.current) return; // stale
      // Find container in DOM (may be in different position after layout change)
      const container = document.querySelector(".mermaid-preview-render");
      if (!container) {
        if (attempt < 5) setTimeout(() => tryRender(attempt + 1), 100);
        return;
      }

      // Mermaid theming follows the page's active mode. Earlier this
      // was hardcoded to the dark palette, which left light-mode users
      // looking at black-on-charcoal diagrams on a cream page. We now
      // peek at <html data-theme> at render time and pick the
      // matching variable set.
      const isLight = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
      mermaid.initialize({
        startOnLoad: false, securityLevel: "loose", theme: isLight ? "default" : "dark",
        themeVariables: isLight ? {
          primaryColor: "#ea580c", primaryTextColor: "#09090b", primaryBorderColor: "#c2410c",
          lineColor: "#71717a", secondaryColor: "#f4f4f5", tertiaryColor: "#faf9f7",
          background: "#faf9f7", mainBkg: "#f4f4f5", nodeBorder: "#e4e4e7",
          clusterBkg: "#faf9f7", titleColor: "#09090b", edgeLabelBackground: "#ffffff",
          pie1: "#ea580c", pie2: "#2563eb", pie3: "#16a34a", pie4: "#7c3aed", pie5: "#ec4899",
        } : {
          primaryColor: "#fb923c", primaryTextColor: "#fafafa", primaryBorderColor: "#ea580c",
          lineColor: "#71717a", secondaryColor: "#27272a", tertiaryColor: "#18181b",
          background: "#09090b", mainBkg: "#27272a", nodeBorder: "#3f3f46",
          clusterBkg: "#18181b", titleColor: "#fafafa", edgeLabelBackground: "#18181b",
          pie1: "#fb923c", pie2: "#60a5fa", pie3: "#4ade80", pie4: "#c4b5fd", pie5: "#f472b6",
        },
        fontFamily: "var(--font-mono)", fontSize: 13,
      });

      (async () => {
        try {
          const id = `mermaid-preview-${Date.now()}`;
          const { svg } = await mermaid.render(id, codeToRender);
          if (currentRender !== renderIdRef.current) return;
          container.innerHTML = svg;
        } catch {
          if (currentRender === renderIdRef.current) {
            container.innerHTML = `<span style="color:var(--text-faint);font-size:11px">Invalid diagram</span>`;
          }
        }
      })();
    };

    const timer = setTimeout(() => tryRender(0), 30);
    return () => clearTimeout(timer);
  }, [liveCode, rawCode, rawCodeMode, showCode, rawLayout]);

  // Load initial mermaid code
  useEffect(() => {
    if (initialMermaid) {
      const result = mermaidToCanvas(initialMermaid);
      if (result && result.nodes.length > 0) {
        setNodes(result.nodes);
        setEdges(result.edges);
        setDirection(result.direction === "TD" || result.direction === "TB" ? "TD" : "LR");
        nextId = result.nodes.length + 1;
        setRawCodeMode(false);
      } else {
        // Can't parse as flowchart (sequence, pie, etc) → raw code edit mode
        setRawCodeMode(true);
        setRawCode(initialMermaid);
        setNodes([]);
        setEdges([]);
      }
    } else {
      setNodes([]);
      setEdges([]);
      setRawCodeMode(false);
      setRawCode("");
      nextId = 1;
    }
    setSelectedId(null);
    setEditingId(null);
    setEditingEdge(null);
    // Force re-renders after DOM fully settles (layout + paint)
    // Double rAF ensures CSS margin/transform are applied before measuring
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        forceUpdate(v => v + 1);
      });
    });
  }, [initialMermaid]);

  // Add node on double-click canvas
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".canvas-node")) return;
      if ((e.target as HTMLElement).closest(".edge-label")) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const id = genId();
      const newNode: CanvasNode = {
        id,
        x: e.clientX - rect.left - 60,
        y: e.clientY - rect.top - 18,
        text: "",
        shape: "round",
      };
      setNodes((prev) => [...prev, newNode]);
      setEditingId(id);
      setSelectedId(id);
    },
    []
  );

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if ((e.target as HTMLElement).closest("button")) return;
      e.stopPropagation();
      setSelectedId(nodeId);

      if (e.altKey) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        setConnectState({
          fromId: nodeId,
          mouseX: e.clientX - rect.left,
          mouseY: e.clientY - rect.top,
        });
        return;
      }

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // If this node is part of a multi-selection, keep the selection
      // If not, clear selection and select just this node
      if (!selectedIds.has(nodeId)) {
        setSelectedIds(new Set());
      }

      setDragState({
        nodeId,
        offsetX: e.clientX - rect.left - node.x,
        offsetY: e.clientY - rect.top - node.y,
      });
    },
    [nodes, selectedIds]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (dragState) {
        const newX = e.clientX - rect.left - dragState.offsetX;
        const newY = e.clientY - rect.top - dragState.offsetY;
        const draggedNode = nodes.find((n) => n.id === dragState.nodeId);
        if (!draggedNode) return;
        const dx = newX - draggedNode.x;
        const dy = newY - draggedNode.y;

        // Move all selected nodes together, or just the dragged one
        const movingIds = selectedIds.has(dragState.nodeId) && selectedIds.size > 1
          ? selectedIds
          : new Set([dragState.nodeId]);

        setNodes((prev) =>
          prev.map((n) =>
            movingIds.has(n.id) ? { ...n, x: Math.max(0, n.x + dx), y: Math.max(0, n.y + dy) } : n
          )
        );
      }

      if (connectState) {
        setConnectState((prev) =>
          prev ? { ...prev, mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top } : null
        );
      }
    },
    [dragState, connectState, nodes, selectedIds]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (connectState) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const target = nodes.find(
            (n) =>
              n.id !== connectState.fromId &&
              mx >= n.x - 10 &&
              mx <= n.x + 150 &&
              my >= n.y - 10 &&
              my <= n.y + 50
          );
          if (target) {
            const exists = edges.some(
              (ed) => ed.from === connectState.fromId && ed.to === target.id
            );
            if (!exists) {
              setEdges((prev) => [...prev, { from: connectState.fromId, to: target.id }]);
            }
          }
        }
        setConnectState(null);
      }
      setDragState(null);
    },
    [connectState, nodes, edges]
  );

  const handleTextChange = useCallback((nodeId: string, text: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, text } : n)));
  }, []);

  // Force a second render after shape change so edge points use updated DOM measurements
  const [, forceUpdate] = useState(0);
  const cycleShape = useCallback((nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const shapes: CanvasNode["shape"][] = ["round", "square", "circle", "diamond"];
        const idx = shapes.indexOf(n.shape);
        return { ...n, shape: shapes[(idx + 1) % shapes.length] };
      })
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => forceUpdate(v => v + 1));
    });
  }, []);

  const deleteSelected = useCallback(() => {
    // Delete multi-selected nodes
    if (selectedIds.size > 0) {
      setNodes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      setEdges((prev) => prev.filter((e) => !selectedIds.has(e.from) && !selectedIds.has(e.to)));
      setSelectedIds(new Set());
      return;
    }
    // Delete single selected node
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) => prev.filter((e) => e.from !== selectedId && e.to !== selectedId));
    setSelectedId(null);
    setEditingId(null);
  }, [selectedId, selectedIds]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    const node = nodes.find((n) => n.id === selectedId);
    if (!node) return;
    const newId = genId();
    setNodes((prev) => [...prev, { ...node, id: newId, x: node.x + 30, y: node.y + 30 }]);
    setSelectedId(newId);
  }, [selectedId, nodes]);

  const deleteEdge = useCallback((index: number) => {
    setEdges((prev) => prev.filter((_, i) => i !== index));
    setEditingEdge(null);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingId || editingEdge !== null) return;
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected, duplicateSelected, editingId, editingEdge]);

  const handleGenerate = useCallback(() => {
    if (rawCodeMode) {
      const md = wrapInCodeBlock(rawCode);
      onGenerate(md);
    } else {
      const mermaidCode = canvasToMermaid(nodes, edges, direction);
      const md = wrapInCodeBlock(mermaidCode);
      onGenerate(md);
    }
  }, [nodes, edges, direction, onGenerate, rawCodeMode, rawCode]);

  const handleImport = useCallback(() => {
    // Strip code fences if present
    let code = importCode.trim();
    code = code.replace(/^```mermaid\n?/, "").replace(/\n?```$/, "");

    const result = mermaidToCanvas(code);
    if (result) {
      setNodes(result.nodes);
      setEdges(result.edges);
      setDirection(result.direction === "TD" || result.direction === "TB" ? "TD" : "LR");
      nextId = result.nodes.length + 1;
      setShowImport(false);
      setImportCode("");
    }
  }, [importCode]);

  // Get visual center + bounds using getBoundingClientRect (handles CSS transforms)
  const getShapeVisualRect = (nodeId: string) => {
    const canvas = canvasRef.current;
    const shapeEl = canvas?.querySelector(`[data-shape-el="${nodeId}"]`) as HTMLElement | null;
    if (!canvas || !shapeEl) {
      const node = nodes.find(n => n.id === nodeId);
      return node ? { cx: node.x + 70, cy: node.y + 20, hw: 70, hh: 20 } : { cx: 0, cy: 0, hw: 0, hh: 0 };
    }
    const canvasRect = canvas.getBoundingClientRect();
    const shapeRect = shapeEl.getBoundingClientRect();
    // Convert to canvas-relative coordinates (accounts for scroll)
    const cx = shapeRect.left - canvasRect.left + canvas.scrollLeft + shapeRect.width / 2;
    const cy = shapeRect.top - canvasRect.top + canvas.scrollTop + shapeRect.height / 2;
    return { cx, cy, hw: shapeRect.width / 2, hh: shapeRect.height / 2 };
  };

  const getNodeCenter = (nodeId: string) => {
    const r = getShapeVisualRect(nodeId);
    return { x: r.cx, y: r.cy };
  };

  const getEdgePoint = (nodeId: string, targetX: number, targetY: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const r = getShapeVisualRect(nodeId);
    const dx = targetX - r.cx;
    const dy = targetY - r.cy;
    if (dx === 0 && dy === 0) return { x: r.cx, y: r.cy - r.hh };

    if (node.shape === "circle") {
      const radius = Math.max(r.hw, r.hh);
      const dist = Math.sqrt(dx * dx + dy * dy);
      return { x: r.cx + (dx / dist) * radius, y: r.cy + (dy / dist) * radius };
    }

    if (node.shape === "diamond") {
      // Visual diamond: getBoundingClientRect gives the rotated bounding box
      // The diamond points are at (cx, cy-hh), (cx+hw, cy), (cx, cy+hh), (cx-hw, cy)
      // Boundary: |dx|/hw + |dy|/hh = 1
      const scale = Math.abs(dx) / r.hw + Math.abs(dy) / r.hh;
      if (scale === 0) return { x: r.cx, y: r.cy - r.hh };
      return { x: r.cx + dx / scale, y: r.cy + dy / scale };
    }

    // Rectangle: ray-rect intersection
    const scaleX = Math.abs(dx) > 0 ? r.hw / Math.abs(dx) : Infinity;
    const scaleY = Math.abs(dy) > 0 ? r.hh / Math.abs(dy) : Infinity;
    const s = Math.min(scaleX, scaleY);
    let px = r.cx + dx * s;
    let py = r.cy + dy * s;

    // For "round" shape: adjust corner points inward along the border-radius curve
    if (node.shape === "round") {
      const br = 20; // border-radius
      const cornerX = r.cx + (r.hw - br) * Math.sign(dx);
      const cornerY = r.cy + (r.hh - br) * Math.sign(dy);
      // Check if point is in a corner region
      if (Math.abs(px - r.cx) > r.hw - br && Math.abs(py - r.cy) > r.hh - br) {
        // Point is in rounded corner — project onto circle arc
        const cdx = px - cornerX, cdy = py - cornerY;
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
        if (cdist > 0) {
          px = cornerX + (cdx / cdist) * br;
          py = cornerY + (cdy / cdist) * br;
        }
      }
    }
    return { x: px, y: py };
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* Header row */}
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-2 text-xs"
        style={{ borderBottom: "1px solid var(--border-dim)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono uppercase tracking-wider text-caption" style={{ color: "var(--text-primary)" }}>
            Mermaid Diagrams
          </span>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="px-2 rounded-md font-mono text-caption leading-[24px]"
            style={{
              height: 24,
              background: showGuide ? "var(--border)" : "var(--toggle-bg)",
              color: showGuide ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            Help
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Layout options */}
          <div className="flex gap-1 mr-1" style={{ borderRight: "1px solid var(--border-dim)", paddingRight: 8 }}>
            {LAYOUTS.map((l) => (
              <button key={l.id} title={l.title}
                className="p-1 rounded"
                style={{ color: rawLayout === l.id ? "var(--text-primary)" : "var(--text-faint)", opacity: rawLayout === l.id ? 1 : 0.4 }}
                onClick={() => {
                  setRawLayout(l.id);
                  // Layout applies to both modes via CSS Grid
                }}>
                {l.icon}
              </button>
            ))}
          </div>
          {nodes.length > 0 && (
            <button
              onClick={() => { setNodes([]); setEdges([]); setSelectedId(null); nextId = 1; }}
              className="px-2 py-1 rounded-md font-mono text-caption"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}
            >
              Clear
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 rounded-md font-mono text-caption"
              style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={nodes.length === 0 && !rawCodeMode}
            className="px-3 py-1 rounded-md font-mono text-caption font-semibold"
            style={{
              background: (nodes.length > 0 || rawCodeMode) ? "var(--text-primary)" : "var(--toggle-bg)",
              color: (nodes.length > 0 || rawCodeMode) ? "#000" : "var(--text-muted)",
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Diagram type selector row */}
      <div
        className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border-dim)" }}
      >
        {DIAGRAM_TYPES.map((dt) => {
          const currentType = rawCodeMode ? detectDiagramType(rawCode) : "flowchart";
          return (
            <button
              key={dt.id}
              onClick={() => {
                if (dt.id === "flowchart") {
                  const result = mermaidToCanvas(dt.template);
                  if (result) {
                    setNodes(result.nodes);
                    setEdges(result.edges);
                    setDirection((result.direction === "TD" || result.direction === "LR") ? result.direction : "LR");
                  }
                  setRawCodeMode(false);
                } else {
                  setRawCode(dt.template);
                  setRawCodeMode(true);
                }
              }}
              className="px-2 py-1 rounded-md text-caption transition-colors whitespace-nowrap shrink-0"
              style={{
                background: currentType === dt.id ? "var(--border)" : "var(--toggle-bg)",
                color: currentType === dt.id ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {dt.label}
            </button>
          );
        })}
      </div>

      {/* Import panel */}
      {showImport && (
        <div
          className="px-4 py-3 flex gap-2"
          style={{ borderBottom: "1px solid var(--border-dim)", background: "var(--surface)" }}
        >
          <textarea
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            placeholder="Paste Mermaid code here (graph LR; A --> B)"
            className="flex-1 bg-transparent text-xs font-mono outline-none resize-none"
            style={{ color: "var(--text-primary)", minHeight: 48 }}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={handleImport}
              className="px-3 py-1 rounded text-caption font-mono"
              style={{ background: "var(--border)", color: "var(--text-primary)" }}
            >
              Load
            </button>
            <button
              onClick={() => { setShowImport(false); setImportCode(""); }}
              className="px-3 py-1 rounded text-caption font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Guide panel */}
      {showGuide && (
        <div
          className="px-4 py-3 text-xs overflow-auto"
          style={{ borderBottom: "1px solid var(--border-dim)", background: "var(--surface)", maxHeight: 200 }}
        >
          <DiagramHelp type={rawCodeMode ? detectDiagramType(rawCode) : "flowchart"} />
        </div>
      )}

      {/* Main area — unified CSS Grid layout for both modes */}
      {rawCodeMode ? (
        <RawModeLayout
          rawCode={rawCode}
          setRawCode={setRawCode}
          previewPanelRef={previewPanelRef}
          layout={rawLayout}
        />
      ) : (
        <FlowchartLayout
          layout={rawLayout}
          liveCode={liveCode}
          previewPanelRef={previewPanelRef}
          onCodeChange={(newCode) => {
            const result = mermaidToCanvas(newCode);
            if (result && result.nodes.length > 0) {
              setNodes(result.nodes);
              setEdges(result.edges);
              setDirection(result.direction === "TD" || result.direction === "TB" ? "TD" : "LR");
              nextId = result.nodes.length + 1;
            }
          }}
          direction={direction}
          setDirection={setDirection}
        >
      <div
        ref={canvasRef}
        className="relative flex-1 overflow-auto cursor-crosshair select-none"
        onDoubleClick={handleCanvasDoubleClick}
        onMouseDown={(e) => {
          // Start selection box if clicking on empty canvas
          if ((e.target as HTMLElement).closest(".canvas-node") || (e.target as HTMLElement).closest(".edge-label")) return;
          if (e.button !== 0) return;
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const el = canvasRef.current!;
          const x = e.clientX - rect.left + el.scrollLeft;
          const y = e.clientY - rect.top + el.scrollTop;
          setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
        }}
        onMouseMove={(e) => {
          handleMouseMove(e);
          // Update selection box
          if (selectionBox && !dragState && !connectState) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const el = canvasRef.current!;
            setSelectionBox((prev) => prev ? { ...prev, endX: e.clientX - rect.left + el.scrollLeft, endY: e.clientY - rect.top + el.scrollTop } : null);
          }
        }}
        onMouseUp={(e) => {
          handleMouseUp(e);
          // Finish selection box
          if (selectionBox) {
            const minX = Math.min(selectionBox.startX, selectionBox.endX);
            const maxX = Math.max(selectionBox.startX, selectionBox.endX);
            const minY = Math.min(selectionBox.startY, selectionBox.endY);
            const maxY = Math.max(selectionBox.startY, selectionBox.endY);
            // Only select if box is bigger than 10px (not just a click)
            if (maxX - minX > 10 && maxY - minY > 10) {
              const selected = new Set<string>();
              nodes.forEach((n) => {
                const cx = n.x + 60;
                const cy = n.y + 20;
                if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
                  selected.add(n.id);
                }
              });
              setSelectedIds(selected);
              if (selected.size > 0) {
                setSelectedId(null);
                justSelectedRef.current = true;
                setTimeout(() => { justSelectedRef.current = false; }, 100);
              }
            }
            setSelectionBox(null);
          }
        }}
        onClick={(e) => {
          if (justSelectedRef.current) return; // skip click after drag selection
          if (!(e.target as HTMLElement).closest(".canvas-node") && !(e.target as HTMLElement).closest(".edge-label")) {
            setSelectedId(null);
            setSelectedIds(new Set());
            setEditingId(null);
            setEditingEdge(null);
          }
        }}
      >
        {/* Grid — covers full scrollable area */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: 0,
            minWidth: Math.max(2000, ...nodes.map(n => n.x + 200)),
            minHeight: Math.max(2000, ...nodes.map(n => n.y + 200)),
            backgroundImage: "radial-gradient(circle, var(--border-dim) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Edges SVG — covers full scrollable area */}
        <svg className="absolute pointer-events-none" style={{ zIndex: 1, inset: 0, minWidth: Math.max(2000, ...nodes.map(n => n.x + 200)), minHeight: Math.max(2000, ...nodes.map(n => n.y + 200)) }}>
          <defs>
            <marker id="arr" markerWidth="6" markerHeight="4" refX="5.5" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="var(--text-muted)" />
            </marker>
            <marker id="arr-start" markerWidth="6" markerHeight="4" refX="0.5" refY="2" orient="auto-start-reverse">
              <polygon points="0 0, 6 2, 0 4" fill="var(--text-muted)" />
            </marker>
            <marker id="arr-accent" markerWidth="6" markerHeight="4" refX="5.5" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="var(--text-primary)" />
            </marker>
          </defs>

          {edges.map((edge, i) => {
            const fc = getNodeCenter(edge.from);
            const tc = getNodeCenter(edge.to);
            const from = getEdgePoint(edge.from, tc.x, tc.y);
            const to = getEdgePoint(edge.to, fc.x, fc.y);
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            // Smooth cubic bezier curve
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const isMoreHorizontal = Math.abs(dx) > Math.abs(dy);
            // Control points: bend in the dominant direction
            const cx1 = isMoreHorizontal ? from.x + dx * 0.4 : from.x;
            const cy1 = isMoreHorizontal ? from.y : from.y + dy * 0.4;
            const cx2 = isMoreHorizontal ? to.x - dx * 0.4 : to.x;
            const cy2 = isMoreHorizontal ? to.y : to.y - dy * 0.4;
            const pathD = `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;

            return (
              <g key={i}>
                <path
                  d={pathD}
                  stroke="var(--text-faint)"
                  strokeWidth={edge.style === "thick" ? 3 : 1.5}
                  strokeDasharray={edge.style === "dotted" ? "6 4" : undefined}
                  fill="none"
                  markerEnd={edge.direction === "none" ? undefined : "url(#arr)"}
                  markerStart={edge.direction === "both" ? "url(#arr-start)" : undefined}
                />
                {/* Clickable hit area */}
                <path
                  d={pathD}
                  stroke="transparent" strokeWidth={14}
                  fill="none"
                  style={{ pointerEvents: "all", cursor: "pointer" }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingEdge(i); }}
                />
                {/* Edge label */}
                {edge.label && (
                  <g>
                    <rect
                      x={midX - edge.label.length * 3.5 - 6}
                      y={midY - 18}
                      width={edge.label.length * 7 + 12}
                      height={20}
                      rx={4}
                      fill="var(--surface)"
                      stroke="var(--border)"
                      strokeWidth={0.5}
                    />
                    <text
                      x={midX} y={midY - 5}
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize={11}
                      fontFamily="var(--font-geist-mono), monospace"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {connectState && (
            <line
              x1={getEdgePoint(connectState.fromId, connectState.mouseX, connectState.mouseY).x}
              y1={getEdgePoint(connectState.fromId, connectState.mouseX, connectState.mouseY).y}
              x2={connectState.mouseX} y2={connectState.mouseY}
              stroke="var(--text-primary)" strokeWidth={1.5} strokeDasharray="6 3"
              markerEnd="url(#arr-accent)"
            />
          )}
        </svg>

        {/* Edge editor (label + style) */}
        {editingEdge !== null && edges[editingEdge] && (() => {
          const edge = edges[editingEdge];
          const from = getNodeCenter(edge.from);
          const to = getNodeCenter(edge.to);
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <div
              className="edge-label absolute z-20 flex flex-col gap-1.5"
              style={{ left: midX - 100, top: midY - 22, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
            >
              <div className="flex gap-1 items-center">
                <input
                  autoFocus
                  value={edge.label || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEdges((prev) => prev.map((ed, idx) => idx === editingEdge ? { ...ed, label: val } : ed));
                  }}
                  onBlur={() => setEditingEdge(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingEdge(null);
                  }}
                  placeholder="label"
                  className="px-2 py-1.5 text-caption font-mono rounded outline-none w-28"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onMouseDown={(e) => { e.preventDefault(); deleteEdge(editingEdge); }}
                  className="px-1.5 py-1.5 rounded text-caption font-bold"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}
                >
                  ×
                </button>
              </div>
              {/* Style + Direction row */}
              <div className="flex gap-1">
                <span className="text-caption py-1" style={{ color: "var(--text-faint)" }}>Line:</span>
                {(["solid", "dotted", "thick"] as const).map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setEdges((prev) => prev.map((ed, idx) => idx === editingEdge ? { ...ed, style: s } : ed));
                    }}
                    className="px-2 py-1 rounded text-caption"
                    style={{
                      background: (edge.style || "solid") === s ? "var(--text-primary)" : "var(--background)",
                      color: (edge.style || "solid") === s ? "#000" : "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {s === "solid" ? "━" : s === "dotted" ? "┄" : "┃"}
                  </button>
                ))}
                <span className="text-caption py-1 ml-1" style={{ color: "var(--text-faint)" }}>Dir:</span>
                {(["forward", "both", "none"] as const).map((d) => (
                  <button
                    key={d}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setEdges((prev) => prev.map((ed, idx) => idx === editingEdge ? { ...ed, direction: d } : ed));
                    }}
                    className="px-2 py-1 rounded text-caption"
                    style={{
                      background: (edge.direction || "forward") === d ? "var(--text-primary)" : "var(--background)",
                      color: (edge.direction || "forward") === d ? "#000" : "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {d === "forward" ? "→" : d === "both" ? "⇄" : "―"}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedId === node.id || selectedIds.has(node.id);
          return (
          <div
            key={node.id}
            data-node-id={node.id}
            className="canvas-node absolute group"
            style={{ left: node.x, top: node.y, zIndex: isSelected ? 10 : 2, minWidth: 120 }}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onDoubleClick={(e) => { e.stopPropagation(); setEditingId(node.id); }}
          >
            <div
              data-shape-el={node.id}
              className="px-3 py-2 text-sm transition-colors relative"
              style={{
                background: "var(--surface)",
                border: `1.5px solid ${isSelected ? "var(--text-primary)" : "var(--border)"}`,
                boxShadow: isSelected
                  ? "0 0 0 2px var(--border), 0 4px 12px rgba(0,0,0,0.3)"
                  : "0 2px 8px rgba(0,0,0,0.2)",
                ...shapeCSS[node.shape],
              }}
            >
              {/* Diamond: counter-rotate content */}
              <div style={node.shape === "diamond" ? { transform: "rotate(-45deg)" } : {}}>
                {editingId === node.id ? (
                  <input
                    autoFocus
                    value={node.text}
                    onChange={(e) => handleTextChange(node.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") setEditingId(null);
                      e.stopPropagation();
                    }}
                    className="w-full bg-transparent outline-none text-xs"
                    style={{ color: "var(--text-primary)", minWidth: 80 }}
                  />
                ) : (
                  <div
                    className="text-xs min-h-[20px] whitespace-nowrap"
                    style={{ color: node.text ? "var(--text-secondary)" : "var(--text-faint)" }}
                  >
                    {node.text || "..."}
                  </div>
                )}
              </div>{/* end diamond rotate wrapper */}
              {/* Shape toggle — centered above node, inside the positioned div */}
              <button
                onClick={(e) => { e.stopPropagation(); cycleShape(node.id); }}
                className="absolute opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full z-10"
                style={{ top: -14, left: "50%", transform: "translateX(-50%)", background: "var(--surface)", border: "1px solid var(--border)" }}
                title="Click to change shape"
              >
                <ShapeIcon shape={node.shape} size={12} />
              </button>
            </div>
          </div>
          );
        })}

        {/* Empty state */}
        {/* Selection box */}
        {selectionBox && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.endX - selectionBox.startX),
              height: Math.abs(selectionBox.endY - selectionBox.startY),
              border: "1px dashed var(--text-primary)",
              background: "var(--border)",
              borderRadius: 4,
              zIndex: 20,
            }}
          />
        )}

        {nodes.length === 0 && !showImport && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
            <div className="text-4xl opacity-20">🔀</div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Double-click anywhere to add a node
            </p>
            <div className="text-xs space-y-1 text-center" style={{ color: "var(--text-faint)" }}>
              <p>Alt + drag between nodes to connect them</p>
              <p>Click <span style={{ color: "var(--text-primary)" }}>?</span> for the full guide</p>
            </div>
          </div>
        )}
      </div>{/* end canvasRef */}
      </FlowchartLayout>
      )}
    </div>
  );
}

export default memo(MdCanvas);
