/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  ReactFlowProvider,
  getBezierPath,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type EdgeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import { Copy, Plus, Minus, Sparkles, Circle, Maximize, Minimize, Trash2, ExternalLink, FilePlus2, Layers, Pencil, MoreHorizontal, FileText, Lightbulb, CheckSquare, Tag, Check } from "lucide-react";
import Tooltip from "./Tooltip";
import type { Section } from "@/lib/parse-sections";
import { stripMarkdownPreview } from "@/lib/strip-markdown-preview";

// ─── Types ───

interface BundleDocument {
  id: string;
  title: string | null;
  markdown: string;
  created_at: string;
  updated_at: string;
}

export interface AIGraphData {
  nodes: Array<{ id: string; label: string; type: string; weight: number; documentId?: string; description?: string }>;
  edges: Array<{ source: string; target: string; label?: string; weight: number; type: string }>;
  clusters: Array<{ id: string; label: string; nodeIds: string[]; color: string }>;
  summary?: string;
  themes?: string[];
  insights?: string[];
  readingOrder?: string[];
  readingOrderReason?: string;
  keyTakeaways?: string[];
  documentSummaries?: Record<string, string>;
  gaps?: string[];
  connections?: Array<{ doc1: string; doc2: string; relationship: string }>;
}

// Detail levels: 1=docs only, 2=+summary, 3=+themes, 4=+top concepts, 5=everything
type DetailLevel = 1 | 2 | 3 | 4 | 5;
const DETAIL_LABELS = ["", "Documents", "+ Analysis", "+ Themes", "+ Key Concepts", "Full Map"];

interface BundleCanvasProps {
  documents: BundleDocument[];
  aiGraph?: AIGraphData | null;
  isAnalyzing?: boolean;
  /** ISO timestamp the bundle's AI graph was last generated. Drives the
   *  Analysis status pill so the user can see freshness without clicking. */
  graphGeneratedAt?: string | null;
  /** ISO timestamp the bundle's vector embedding was last refreshed.
   *  Surfaced as a status pill so the user knows recall reflects the
   *  current title/description/members. */
  embeddingUpdatedAt?: string | null;
  isEmbedding?: boolean;
  /** True when at least one member doc was updated AFTER the bundle's
   *  graph was generated — signals the Analyzed pill to show a Stale
   *  badge so the user knows to re-Analyze. */
  isAnalysisStale?: boolean;
  /** Owner-only actions (re-embed) are gated on this. */
  isOwner?: boolean;
  onEmbed?: () => void;
  hoveredNodeId?: string | null;
  selectedDocId?: string | null;
  onDocumentClick?: (docId: string) => void;
  onCopyContext?: () => void;
  onRegenerate?: () => void;
  onRemoveDoc?: (docId: string) => void;
  onOpenDoc?: (docId: string) => void;
  onRequestAddDocs?: () => void;
  onAddDocs?: (docIds: string[]) => void;
  /** When set, the canvas replaces this doc's card with a tree of section
   *  nodes parsed from the doc's markdown — clicked sections call onSectionClick. */
  expandedDocId?: string | null;
  /** AI-derived semantic decomposition for the expanded doc. When provided,
   *  takes precedence over the heading-based fallback inside buildLayout. */
  decomposition?: { chunks: SemanticChunkLike[]; edges: SemanticEdgeLike[] } | null;
  isDecomposing?: boolean;
  decomposeError?: string | null;
  onDecomposeDoc?: (docId: string) => void;
  onRedecomposeDoc?: (docId: string) => void;
  onCollapseDoc?: () => void;
  onSectionClick?: (docId: string, section: Section) => void;
  onSectionContextMenu?: (docId: string, section: Section, x: number, y: number) => void;
  onChunkClick?: (docId: string, chunk: SemanticChunkLike, additive?: boolean) => void;
  onChunkContextMenu?: (docId: string, chunk: SemanticChunkLike, x: number, y: number) => void;
  /** Selected chunk ids (for visual highlight). */
  selectedChunkIds?: Set<string>;
  /** Clear chunk selection (background click). */
  onClearChunkSelection?: () => void;
  /** Close the side info panel — fires from background pane clicks so an
   *  empty-area click acts as "deselect" instead of leaving the previous
   *  node's panel pinned open. */
  onPaneClose?: () => void;
  /** Drag-reorder: source chunk dropped near target chunk → reorder source doc. */
  onChunkDragReorder?: (docId: string, fromChunkId: string, targetChunkId: string, position: "before" | "after") => void;
  /** Filter chunks by type (null = all). When set, filtered chunks are dimmed
   *  but still visible so the constellation stays intact. */
  chunkTypeFilter?: string | null;
  onChangeChunkTypeFilter?: (t: string | null) => void;
  /** Add a brand-new chunk to the expanded doc (opens parent's modal). */
  onAddChunk?: (docId: string) => void;
  /** Trigger bundle-level synthesis (Memo / FAQ / Brief). */
  onSynthesize?: (kind: "memo" | "faq" | "brief") => void;
  /** Externally requested focus — fits view to this chunk and pulses it.
   *  Cleared automatically after the animation finishes (parent's choice). */
  focusChunkId?: string | null;
  /** Called once the canvas has finished focusing a chunk so the parent can
   *  clear `focusChunkId` (single-fire request). */
  onFocusChunkSettled?: () => void;
  /** Conversational-query filter: doc ids the chat's "Show on canvas"
   *  action selected. Matching doc cards + their direct neighbours
   *  (concepts, themes, edge labels) stay at full opacity; everything
   *  else fades to ~0.2. Null = no filter. */
  highlightedDocIds?: string[] | null;
  /** Clear the filter from inside the canvas (exit button on the
   *  filter banner). */
  onClearHighlight?: () => void;
  className?: string;
}

interface SemanticChunkLike { id: string; type: string; label: string; content: string; weight: number; found?: boolean }
interface SemanticEdgeLike { source: string; target: string; type: string; label?: string; weight: number }

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  concept: { bg: "rgba(56,189,248,0.08)", border: "#38bdf8", text: "#38bdf8" },
  entity: { bg: "rgba(74,222,128,0.08)", border: "#4ade80", text: "#4ade80" },
  tag: { bg: "rgba(167,139,250,0.08)", border: "#a78bfa", text: "#a78bfa" },
};

// ─── Layout with ELK — advanced overlap-free positioning ───

const elk = new ELK();

// Shared so the first (estimated-size) pass and the post-measure relayout pass
// produce the SAME arrangement — only the node sizes differ between them.
const ELK_LAYOUT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.layered.spacing.nodeNodeBetweenLayers": "50",
  "elk.layered.spacing.edgeNodeBetweenLayers": "30",
  "elk.spacing.nodeNode": "40",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.padding": "[top=30,left=30,bottom=30,right=30]",
  "elk.edgeRouting": "SPLINES",
};

const NODE_SIZES: Record<string, { w: number; h: number }> = {
  documentCard: { w: 270, h: 150 },
  summaryNode: { w: 300, h: 190 },
  themeTag: { w: 220, h: 32 },
  conceptTag: { w: 160, h: 36 },
  edgeLabel: { w: 120, h: 22 },
  sectionNode: { w: 260, h: 96 },
  sectionRoot: { w: 280, h: 56 },
  chunkNode: { w: 280, h: 124 },
};

// The summary card ("Bundle Analysis") has NO line-clamp — it grows with the
// summary paragraph + up to 3 insight bullets. ELK must get the REAL height or
// it packs neighbours underneath and they overlap (it was pinned at 190 but
// routinely renders 280-360+). Estimate generously: under-estimating overlaps,
// slight over just adds harmless gap.
function estimateSummaryHeight(summary: string, insights: string[]): number {
  let h = 44 + 20; // header + body padding
  if (summary) h += Math.ceil(summary.length / 44) * 19; // ~44 chars/line @300px, 12px/1.6
  const ins = (insights || []).slice(0, 3);
  if (ins.length) {
    h += 8; // gap before the list
    for (const s of ins) h += Math.ceil((s.length || 1) / 40) * 18 + 4;
  }
  return Math.max(190, Math.min(Math.round(h), 560));
}

const CHUNK_TYPE_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  concept: { border: "#38bdf8", text: "#38bdf8", bg: "rgba(56,189,248,0.06)" },
  claim: { border: "#fb923c", text: "#fb923c", bg: "rgba(251,146,60,0.06)" },
  example: { border: "#4ade80", text: "#4ade80", bg: "rgba(74,222,128,0.06)" },
  definition: { border: "#60a5fa", text: "#60a5fa", bg: "rgba(96,165,250,0.06)" },
  task: { border: "#fbbf24", text: "#fbbf24", bg: "rgba(251,191,36,0.06)" },
  question: { border: "#a78bfa", text: "#a78bfa", bg: "rgba(167,139,250,0.06)" },
  context: { border: "#94a3b8", text: "#94a3b8", bg: "rgba(148,163,184,0.06)" },
  evidence: { border: "#f472b6", text: "#f472b6", bg: "rgba(244,114,182,0.06)" },
};

async function buildLayout(
  docs: BundleDocument[],
  aiGraph?: AIGraphData | null,
  selectedDocId?: string | null,
  detail: DetailLevel = 5,
  expandedDocId?: string | null,
  decomposition?: { chunks: SemanticChunkLike[]; edges: SemanticEdgeLike[] } | null,
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const elkNodes: any[] = [];
  const elkEdges: any[] = [];
  const nodeSet = new Set<string>();
  const hasSummary = aiGraph?.summary || (aiGraph?.themes && aiGraph.themes.length > 0);
  // Maps "doc:<id>" → real node id for decomposed docs (which render as
  // sectionRoot instead of documentCard). Used when wiring AI-graph edges
  // that reference the document by its original id.
  const docNodeAliases = new Map<string, string>();
  const resolve = (id: string) => docNodeAliases.get(id) ?? id;

  function addNode(id: string, type: string, data: any, sizeOverride?: { w: number; h: number }) {
    if (nodeSet.has(id)) return;
    nodeSet.add(id);
    const size = sizeOverride || NODE_SIZES[type] || NODE_SIZES.conceptTag;
    elkNodes.push({ id, width: size.w, height: size.h });
    nodes.push({ id, type, position: { x: 0, y: 0 }, data });
  }

  // ── 1. Summary (detail >= 2) ──
  if (hasSummary && detail >= 2) {
    addNode("analysis:summary", "summaryNode", {
      summary: aiGraph?.summary || "",
      insights: aiGraph?.insights || [],
      docCount: docs.length,
      totalWords: docs.reduce((s, d) => s + d.markdown.split(/\s+/).filter(Boolean).length, 0),
    }, { w: 300, h: estimateSummaryHeight(aiGraph?.summary || "", aiGraph?.insights || []) });

    // ── 2. Themes (detail >= 3) ──
    if (aiGraph?.themes && detail >= 3) {
      aiGraph.themes.forEach((theme, i) => {
        const tid = `theme:${i}`;
        addNode(tid, "themeTag", { label: theme });
        elkEdges.push({ id: `e-summary-${tid}`, sources: ["analysis:summary"], targets: [tid] });
        edges.push({ id: `e-summary-${tid}`, source: "analysis:summary", target: tid, type: "default", style: { stroke: "#60a5fa", strokeWidth: 1.5, opacity: 0.3 } });
      });
    }
  }

  // ── 3. Documents ──
  docs.forEach((doc, i) => {
    const nid = `doc:${doc.id}`;
    const wc = doc.markdown.split(/\s+/).filter(Boolean).length;
    const isExpanded = expandedDocId === doc.id;

    if (isExpanded) {
      const rootId = `doc-root:${doc.id}`;

      if (decomposition && decomposition.chunks.length > 0) {
        // ── AI semantic decomposition path ──
        addNode(rootId, "sectionRoot", { title: doc.title || "Untitled", docId: doc.id, sectionCount: decomposition.chunks.length, index: i + 1 });

        const chunkIdMap = new Map<string, string>();
        decomposition.chunks.forEach(c => {
          const cid = `chunk:${doc.id}:${c.id}`;
          chunkIdMap.set(c.id, cid);
          addNode(cid, "chunkNode", { docId: doc.id, chunk: c });
          // Connect the root to every chunk so the cluster is rooted; AI edges
          // layer on top with their semantic relations.
          elkEdges.push({ id: `cr-${rootId}-${cid}`, sources: [rootId], targets: [cid] });
          edges.push({ id: `cr-${rootId}-${cid}`, source: rootId, target: cid, type: "default", style: { stroke: "var(--text-primary)", strokeWidth: 1, opacity: 0.18 } });
        });

        // AI semantic edges between chunks
        const edgeColors: Record<string, string> = {
          supports: "#4ade80",
          elaborates: "#60a5fa",
          contradicts: "#ef4444",
          exemplifies: "#fbbf24",
          depends_on: "#a78bfa",
          related: "#94a3b8",
        };
        decomposition.edges.forEach((e, i) => {
          const src = chunkIdMap.get(e.source);
          const tgt = chunkIdMap.get(e.target);
          if (!src || !tgt) return;
          const stroke = edgeColors[e.type] || "var(--text-primary)";
          if (e.label) {
            const labelId = `clabel-${doc.id}-${i}`;
            addNode(labelId, "edgeLabel", { label: e.label, color: stroke });
            elkEdges.push({ id: `cs-${src}-${labelId}`, sources: [src], targets: [labelId] });
            elkEdges.push({ id: `cs-${labelId}-${tgt}`, sources: [labelId], targets: [tgt] });
            edges.push({ id: `cs-${src}-${labelId}`, source: src, target: labelId, type: "default", style: { stroke, strokeWidth: 1, opacity: 0.5 } });
            edges.push({ id: `cs-${labelId}-${tgt}`, source: labelId, target: tgt, type: "default", style: { stroke, strokeWidth: 1, opacity: 0.5 } });
          } else {
            elkEdges.push({ id: `cs-${src}-${tgt}-${i}`, sources: [src], targets: [tgt] });
            edges.push({ id: `cs-${src}-${tgt}-${i}`, source: src, target: tgt, type: "default", style: { stroke, strokeWidth: 1, opacity: 0.4 } });
          }
        });
      } else {
        // No AI decomposition yet — render JUST the section root. Previously
        // we fell back to a heading-based section tree (parseSections) that
        // appeared instantly and was then replaced by the AI result a moment
        // later, which was confusing — it looked like the AI had already run
        // but with H-tag-shaped output. Removing the fallback means the user
        // sees: doc card → click Decompose → section root alone (header only)
        // → AI returns → chunks fly in. One source of truth.
        addNode(rootId, "sectionRoot", { title: doc.title || "Untitled", docId: doc.id, sectionCount: 0, index: i + 1 });
      }

      // Re-route any AI graph edges that reference doc:<id> onto the root node
      // so the decomposed cluster still hangs from the bundle's main graph.
      // (The actual rewiring happens in the AI graph edges loop below; we keep
      // a synonym so that block reuses the same `nid` lookup.)
      // Add a bridge from doc:<id> → doc-root:<id> via virtual passthrough:
      // we just allow nodeSet to also know the doc id by inserting a tiny
      // marker — the simplest thing is to ALSO add the doc node as the root
      // alias. We picked sectionRoot over documentCard, so AI graph will use
      // `doc:<id>` as expected — let's normalize the AI edges' source/target
      // by walking later. To keep that simple here, also register the doc id
      // as an alias by *not* adding a real node, but by treating it as the
      // root id when building edges below. We achieve this by mapping in the
      // edge loop later. For now, the bundle-section connections (theme,
      // ai-graph) need the doc id to resolve — so we register a hidden
      // alias node:
      // Hidden alias: addNode would also add an ELK entry, which we don't want
      // for a non-rendered placeholder. Instead, track an alias map.
      docNodeAliases.set(`doc:${doc.id}`, rootId);

      if (hasSummary && aiGraph?.themes && detail >= 3) {
        const tid = `theme:${i % aiGraph.themes.length}`;
        if (nodeSet.has(tid)) {
          elkEdges.push({ id: `e-${tid}-${rootId}`, sources: [tid], targets: [rootId] });
          edges.push({ id: `e-${tid}-${rootId}`, source: tid, target: rootId, type: "default", style: { stroke: "#60a5fa", strokeWidth: 1, opacity: 0.2 } });
        }
      }
      return;
    }

    addNode(nid, "documentCard", {
      title: doc.title || "Untitled", preview: getPreview(doc.markdown), wordCount: wc,
      readingTime: Math.max(1, Math.ceil(wc / 200)), index: i + 1, total: docs.length,
      docId: doc.id, headingCount: (doc.markdown.match(/^#{1,3}\s+/gm) || []).length,
      hasCode: /```\w+/.test(doc.markdown), isSelected: selectedDocId === doc.id,
    });
    if (hasSummary && aiGraph?.themes && detail >= 3) {
      const tid = `theme:${i % aiGraph.themes.length}`;
      if (nodeSet.has(tid)) {
        elkEdges.push({ id: `e-${tid}-${nid}`, sources: [tid], targets: [nid] });
        edges.push({ id: `e-${tid}-${nid}`, source: tid, target: nid, type: "default", style: { stroke: "#60a5fa", strokeWidth: 1, opacity: 0.2 } });
      }
    }
  });

  // ── 4. Concepts (detail >= 4) ──
  if (aiGraph && detail >= 4) {
    const conceptNodes = aiGraph.nodes.filter(n => n.type !== "document");
    const showNodes = detail >= 5 ? conceptNodes : conceptNodes.sort((a, b) => b.weight - a.weight).slice(0, Math.ceil(conceptNodes.length / 2));
    for (const n of showNodes) {
      addNode(n.id, "conceptTag", { label: n.label, type: n.type, weight: n.weight });
    }

    // Build a map of node IDs to their colors for edge coloring
    const nodeColorMap = new Map<string, string>();
    docs.forEach(d => nodeColorMap.set(`doc:${d.id}`, "#fb923c"));
    showNodes.forEach(n => nodeColorMap.set(n.id, TYPE_COLORS[n.type]?.border || "#38bdf8"));

    // Passive "…in" verbs read backwards once we re-orient an edge to
    // doc → concept; map them to the active form so the label still reads L→R.
    const FLIP_LABEL: Record<string, string> = {
      "mentioned in": "mentions", "tagged in": "tags", "stated in": "states",
      "discussed in": "discusses", "advocated in": "advocates", "made in": "makes",
      "referenced in": "references", "defined in": "defines", "used in": "used by",
    };
    for (const e of aiGraph.edges) {
      let eSource = e.source;
      let eTarget = e.target;
      let eLabel = e.label;
      // Re-orient concept→doc into doc→concept so documents always sit LEFT of
      // their concepts (ELK RIGHT places sources on the left). The AI phrases
      // relations both ways ("doc mentions concept" vs "concept mentioned in
      // doc"); without this the whole graph flips and the concepts land on the
      // wrong side of the documents.
      if (eTarget.startsWith("doc:") && !eSource.startsWith("doc:")) {
        const t = eSource; eSource = eTarget; eTarget = t;
        const key = (eLabel || "").toLowerCase().trim();
        if (key && FLIP_LABEL[key]) eLabel = FLIP_LABEL[key];
      }
      const src = resolve(eSource);
      const tgt = resolve(eTarget);
      if (!nodeSet.has(src) || !nodeSet.has(tgt)) continue;
      const isDocToDoc = eSource.startsWith("doc:") && eTarget.startsWith("doc:");
      // Edge color = source node's color
      const sourceColor = nodeColorMap.get(eSource) || "var(--text-primary)";
      const edgeColor = isDocToDoc ? "#60a5fa" : sourceColor;
      const edgeStyle = {
        stroke: edgeColor, strokeWidth: 1,
        opacity: isDocToDoc ? 0.3 : 0.2,
      };

      if (eLabel) {
        const labelId = `label-${src}-${tgt}`;
        addNode(labelId, "edgeLabel", { label: eLabel, color: edgeColor });
        elkEdges.push({ id: `ai-${src}-${labelId}`, sources: [src], targets: [labelId] });
        elkEdges.push({ id: `ai-${labelId}-${tgt}`, sources: [labelId], targets: [tgt] });
        edges.push({ id: `ai-${src}-${labelId}`, source: src, target: labelId, type: "default", style: edgeStyle });
        edges.push({ id: `ai-${labelId}-${tgt}`, source: labelId, target: tgt, type: "default", style: edgeStyle });
      } else {
        elkEdges.push({ id: `ai-${src}-${tgt}`, sources: [src], targets: [tgt] });
        edges.push({ id: `ai-${src}-${tgt}`, source: src, target: tgt, type: "default", style: edgeStyle });
      }
    }

    // Remove orphan concept nodes (no path to document)
    const docNodeIds = new Set(docs.map(d => `doc:${d.id}`));
    function hasDocPath(nodeId: string, visited = new Set<string>()): boolean {
      if (docNodeIds.has(nodeId)) return true;
      visited.add(nodeId);
      for (const e of edges) {
        const nb = e.source === nodeId ? e.target : (e.target === nodeId ? e.source : null);
        if (nb && !visited.has(nb) && hasDocPath(nb, visited)) return true;
      }
      return false;
    }
    const orphanIds = new Set<string>();
    for (const n of showNodes) { if (!hasDocPath(n.id)) orphanIds.add(n.id); }
    if (orphanIds.size > 0) {
      nodes.splice(0, nodes.length, ...nodes.filter(n => !orphanIds.has(n.id)));
      edges.splice(0, edges.length, ...edges.filter(e => !orphanIds.has(e.source) && !orphanIds.has(e.target)));
      elkNodes.splice(0, elkNodes.length, ...elkNodes.filter((n: any) => !orphanIds.has(n.id)));
      elkEdges.splice(0, elkEdges.length, ...elkEdges.filter((e: any) => !orphanIds.has(e.sources[0]) && !orphanIds.has(e.targets[0])));
    }
  }

  // Run ELK layout
  try {
    const elkGraph = await elk.layout({
      id: "root",
      layoutOptions: ELK_LAYOUT_OPTIONS,
      children: elkNodes,
      edges: elkEdges,
    });

    const posMap = new Map<string, { x: number; y: number }>();
    for (const child of elkGraph.children || []) {
      posMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
    }

    let positioned = 0;
    for (const node of nodes) {
      const pos = posMap.get(node.id);
      if (pos && (pos.x !== 0 || pos.y !== 0)) {
        node.position = pos;
        positioned++;
      }
    }

    // If ELK didn't position any nodes, use grid fallback
    if (positioned === 0) {
      console.warn("ELK produced no positions, using grid fallback");
      nodes.forEach((n, i) => { n.position = { x: (i % 4) * 320, y: Math.floor(i / 4) * 200 }; });
    }
  } catch (err) {
    console.error("ELK layout failed:", err);
    nodes.forEach((n, i) => { n.position = { x: (i % 4) * 320, y: Math.floor(i / 4) * 200 }; });
  }

  return { nodes, edges };
}

// Strip markdown chrome (headings/bold/code/links/blockquotes/tables) and
// return up to ~400 chars of clean prose so DocumentCardNode can render a
// meaningful multi-line excerpt instead of just word/read stats. The card
// uses CSS line-clamp to crop visually — the extra characters give the
// clamp room to fill rather than truncating mid-sentence.
function getPreview(md: string): string {
  const cleaned = md
    .replace(/^---[\s\S]*?---\n/m, "")           // strip front matter
    .replace(/```[\s\S]*?```/g, "")               // fenced code blocks
    .replace(/^#{1,6}\s+.*$/gm, "")               // ATX headings (drop entire heading line)
    .replace(/^[>\-*+]\s*/gm, "")                 // list/quote markers
    .replace(/^\|.*\|$/gm, "")                    // table rows
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")    // images + links
    .replace(/`([^`]+)`/g, "$1")                  // inline code
    .replace(/(\*\*|__)([^*_]+)\1/g, "$2")        // bold
    .replace(/(\*|_)([^*_]+)\1/g, "$2")           // italic
    .split("\n").map(l => l.trim()).filter(Boolean)
    .join(" ");
  return cleaned.slice(0, 400);
}

// ─── Summary Node ───

function SummaryNode({ data }: { data: any }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{
      width: 300, background: "var(--surface)",
      border: "1.5px solid #60a5fa",
      boxShadow: "0 4px 20px rgba(96,165,250,0.12)",
    }}>
      <Handle type="source" position={Position.Right} style={{ background: "#60a5fa", width: 8, height: 8, border: "2px solid var(--surface)" }} />

      <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(96,165,250,0.08)", borderBottom: "1px solid var(--border-dim)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <span className="text-caption font-semibold" style={{ color: "#60a5fa" }}>Bundle Analysis</span>
        <span className="text-caption ml-auto px-1.5 py-0.5 rounded" style={{ background: "var(--toggle-bg)", color: "var(--text-faint)" }}>
          {data.docCount} docs — {data.totalWords.toLocaleString()} words
        </span>
      </div>

      <div className="px-3 py-2.5 space-y-2">
        {data.summary && (
          <p className="text-caption leading-[1.6]" style={{ color: "var(--text-secondary)" }}>{data.summary}</p>
        )}
        {data.insights?.length > 0 && (
          <div className="space-y-1">
            {data.insights.slice(0, 3).map((ins: string, i: number) => (
              <div key={i} className="text-caption leading-[1.5] flex gap-1.5" style={{ color: "var(--text-muted)" }}>
                <span style={{ color: "#60a5fa", flexShrink: 0 }}>→</span>
                <span>{ins}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Theme Tag Node ───

function ThemeTagNode({ data }: { data: any }) {
  return (
    <div className="rounded-full px-3 py-1.5 flex items-center gap-1.5" style={{
      background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.3)",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: "#60a5fa", width: 5, height: 5, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#60a5fa", width: 5, height: 5, border: "none" }} />
      <span className="text-caption font-medium" style={{ color: "#60a5fa" }}>{data.label}</span>
    </div>
  );
}

// ─── Document Card Node ───

function DocumentCardNode({ data }: { data: any }) {
  // Header order: NUMBER → FileText icon → title. The number anchors the
  // doc in the bundle's reading order (same convention used in the
  // sidebar list); putting it before the icon makes the eye scan the
  // sequence first, which is what the canvas is showing the user.
  //
  // Stats footer (word count / reading time) removed entirely — the user
  // explicitly asked for more content over more numbers. The body now
  // gives ~5 lines of clamped prose, which is what tells you whether
  // this doc is worth opening.
  const isSelected = data.isSelected;
  const DOC_COLOR = "#fb923c";
  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{
      width: 270,
      background: isSelected ? "rgba(251,146,60,0.10)" : "var(--surface)",
      border: `1.5px solid ${DOC_COLOR}`,
      boxShadow: isSelected ? "0 0 0 3px rgba(251,146,60,0.15), 0 4px 20px rgba(0,0,0,0.25)" : "0 4px 20px rgba(251,146,60,0.10)",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: DOC_COLOR, width: 8, height: 8, border: "2px solid var(--surface)" }} />
      <Handle type="source" position={Position.Right} style={{ background: DOC_COLOR, width: 8, height: 8, border: "2px solid var(--surface)" }} />

      <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(251,146,60,0.08)", borderBottom: "1px solid var(--border-dim)" }}>
        <span className="font-mono tabular-nums shrink-0" style={{ fontSize: 10, color: DOC_COLOR, fontWeight: 700, letterSpacing: 0.3 }}>
          {String(data.index).padStart(2, "0")}
        </span>
        <FileText width={12} height={12} style={{ color: DOC_COLOR, flexShrink: 0 }} />
        <span className="font-semibold truncate flex-1" style={{ fontSize: 12, color: "var(--text-primary)" }}>{data.title}</span>
        {data.hasCode && (
          <span className="font-mono uppercase shrink-0" style={{ fontSize: 9, letterSpacing: 0.4, color: "#a78bfa", padding: "1px 5px", borderRadius: 3, background: "rgba(167,139,250,0.10)" }}>
            code
          </span>
        )}
      </div>

      {data.preview ? (
        <div className="px-3 py-2.5">
          <p className="line-clamp-5" style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55 }}>{data.preview}</p>
        </div>
      ) : (
        <div className="px-3 py-3" style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic" }}>
          Empty document
        </div>
      )}
    </div>
  );
}

// ─── Concept Tag Node ───

function ConceptTagNode({ data }: { data: any }) {
  const style = TYPE_COLORS[data.type] || TYPE_COLORS.concept;
  const Icon = data.type === "entity" ? CheckSquare : data.type === "tag" ? Tag : Lightbulb;
  return (
    <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{
      background: style.bg, border: `1.5px solid ${style.border}`, maxWidth: 180,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: style.border, width: 5, height: 5, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: style.border, width: 5, height: 5, border: "none" }} />
      <Icon width={9} height={9} style={{ color: style.text, opacity: 0.7, flexShrink: 0 }} />
      <span className="text-caption font-medium truncate" style={{ color: style.text }}>{data.label}</span>
    </div>
  );
}

// ─── Edge Label Node (inline with edges so dagre reserves space) ───

function EdgeLabelNode({ data }: { data: any }) {
  // The wrapper itself carries the border, background, and rounded corners.
  // Previously the chrome lived on the inner span while the wrapper was a
  // bare flex container — react-flow's hover ring then drew a sharp
  // rectangular outline around the wrapper that didn't match the rounded
  // pill inside. With the chrome on the wrapper, any hover treatment
  // applied by react-flow follows the same rounded shape.
  return (
    <div
      className="flex items-center justify-center text-caption px-1.5 py-0.5 whitespace-nowrap"
      style={{
        minWidth: 40,
        color: data.color || "var(--text-faint)",
        background: "var(--surface)",
        border: `1px solid ${data.color || "var(--border)"}30`,
        borderRadius: 4,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "transparent", width: 1, height: 1, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: "transparent", width: 1, height: 1, border: "none" }} />
      {data.label}
    </div>
  );
}

// ─── Custom Edge with flowing dots ───

function FlowingEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, data }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const stroke = (style as any)?.stroke || "var(--text-primary)";
  const width = (style as any)?.strokeWidth || 1;
  const opacity = (style as any)?.opacity || 0.3;
  const flowing = (data as any)?.flowing;

  return (
    <g>
      {/* Base solid line */}
      <path d={path} fill="none" stroke={stroke} strokeWidth={width} opacity={opacity} />
      {/* Flowing dots — small circles traveling along the line */}
      {flowing && (
        <path d={path} fill="none" stroke={stroke} strokeWidth={width} opacity={Math.min(0.9, opacity + 0.3)} className="bundle-dot-overlay" />
      )}
    </g>
  );
}

const edgeTypes: EdgeTypes = { default: FlowingEdge };

// ─── Section Root Node — slim header for a decomposed doc ───
// Mirrors DocumentCardNode's header exactly (number → FileText → title) so
// toggling Decompose doesn't redesign the header out from under the user.
// The only difference is the chunk-count chip on the right + a flat layout
// (no body / no preview, since those move into the chunk children below).
function SectionRootNode({ data }: { data: any }) {
  const DOC_COLOR = "#fb923c";
  return (
    <div className="rounded-xl overflow-hidden" style={{
      width: 280,
      background: "var(--surface)",
      border: `1.5px solid ${DOC_COLOR}`,
      boxShadow: "0 0 0 3px rgba(251,146,60,0.10), 0 4px 16px rgba(0,0,0,0.25)",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: DOC_COLOR, width: 8, height: 8, border: "2px solid var(--surface)" }} />
      <Handle type="source" position={Position.Right} style={{ background: DOC_COLOR, width: 8, height: 8, border: "2px solid var(--surface)" }} />

      <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(251,146,60,0.08)" }}>
        {typeof data.index === "number" && (
          <span className="font-mono tabular-nums shrink-0" style={{ fontSize: 10, color: DOC_COLOR, fontWeight: 700, letterSpacing: 0.3 }}>
            {String(data.index).padStart(2, "0")}
          </span>
        )}
        <FileText width={12} height={12} style={{ color: DOC_COLOR, flexShrink: 0 }} />
        <span className="font-semibold truncate flex-1" style={{ fontSize: 12, color: "var(--text-primary)" }}>{data.title}</span>
        <span className="font-mono uppercase shrink-0" style={{ fontSize: 9, letterSpacing: 0.4, color: DOC_COLOR, padding: "1px 5px", borderRadius: 3, background: "rgba(251,146,60,0.15)" }}>
          {data.sectionCount} chunks
        </span>
      </div>
    </div>
  );
}

// ─── Section Node — one heading + body preview ───
function SectionNode({ data }: { data: any }) {
  const s: Section = data.section;
  // Visual depth via left bar tint that gets cooler with level
  const levelTint = s.level === 0 ? "#94a3b8" : s.level === 1 ? "#fb923c" : s.level === 2 ? "#fbbf24" : s.level === 3 ? "#60a5fa" : "#a78bfa";
  const levelLabel = s.level === 0 ? "Pre" : `H${s.level}`;
  return (
    <div className="rounded-lg overflow-hidden" style={{
      width: 260,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: levelTint, width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: levelTint, width: 6, height: 6, border: "none" }} />
      <div className="flex items-stretch" style={{ minHeight: 96 }}>
        <div style={{ width: 3, background: levelTint, flexShrink: 0 }} />
        <div className="px-3 py-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-caption font-bold tabular-nums uppercase tracking-wider" style={{ color: levelTint }}>{levelLabel}</span>
            <span className="text-caption font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>{s.heading || "(preamble)"}</span>
            <Pencil width={9} height={9} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
          </div>
          <p className="text-caption leading-[1.45] line-clamp-3" style={{ color: "var(--text-muted)" }}>
            {data.preview || <span style={{ fontStyle: "italic", color: "var(--text-faint)" }}>(empty)</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Chunk Node — AI semantic chunk with type pill + content preview ───
function ChunkNode({ data }: { data: any }) {
  const c: SemanticChunkLike = data.chunk;
  const palette = CHUNK_TYPE_COLORS[c.type] || CHUNK_TYPE_COLORS.context;
  const preview = stripMarkdownPreview(c.content);
  const truncated = preview.length > 140 ? preview.slice(0, 139) + "…" : preview;
  return (
    <div className="rounded-lg overflow-hidden" style={{
      width: 280,
      background: "var(--surface)",
      border: `1px solid ${palette.border}40`,
      boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: palette.border, width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: palette.border, width: 6, height: 6, border: "none" }} />
      <div className="px-3 py-1.5" style={{ background: palette.bg, borderBottom: `1px solid ${palette.border}25` }}>
        <div className="flex items-center gap-1.5">
          {/* Type badge: smaller font, no bold, font-mono so the tracking
              looks intentional rather than oversized. */}
          <span
            className="font-mono uppercase px-1 py-px rounded shrink-0"
            style={{
              color: palette.text,
              background: `${palette.border}14`,
              fontSize: 9,
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            {c.type}
          </span>
          <span className="text-caption font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>{c.label}</span>
          {c.found === false && (
            <span
              className="font-mono uppercase px-1 py-px rounded shrink-0"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.10)", fontSize: 9, letterSpacing: 0.4, fontWeight: 600 }}
            >
              Stale
            </span>
          )}
          <Pencil width={9} height={9} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-caption leading-[1.45] line-clamp-3" style={{ color: "var(--text-muted)" }}>{truncated || <span style={{ fontStyle: "italic" }}>(no content)</span>}</p>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  summaryNode: SummaryNode,
  themeTag: ThemeTagNode,
  documentCard: DocumentCardNode,
  conceptTag: ConceptTagNode,
  edgeLabel: EdgeLabelNode,
  sectionNode: SectionNode,
  sectionRoot: SectionRootNode,
  chunkNode: ChunkNode,
};

// ─── Bundle pipeline status group ─────────────────────────────────────────
//
// Two passes contribute to a "live" bundle:
//   1. Graph extraction — one Anthropic call producing the canvas's
//      summary/themes/insights/concepts (graph_generated_at).
//   2. Vector embedding — one OpenAI call producing the bundle's recall
//      vector from title + description + member titles (embedding_updated_at).
//
// Before this strip the user had no surface for either timestamp; both are
// invisible but load-bearing. The chips are color-coded (orange=fresh,
// neutral=missing) and tooltip the absolute time. Owners can click to
// re-run; viewers see the chip without the click affordance.
//
function fmtAge(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function fmtAbsolute(iso: string | null): string {
  if (!iso) return "Never";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function BundleStatusGroup({
  isOwner,
  isAnalyzing,
  isEmbedding,
  isAnalysisStale,
  graphGeneratedAt,
  embeddingUpdatedAt,
  onAnalyze,
  onEmbed,
}: {
  isOwner: boolean;
  isAnalyzing: boolean;
  isEmbedding: boolean;
  isAnalysisStale: boolean;
  graphGeneratedAt: string | null;
  embeddingUpdatedAt: string | null;
  onAnalyze?: () => void;
  onEmbed?: () => void;
}) {
  // Chips re-render when the underlying timestamps change; we don't tick
  // every minute because the canvas already triggers re-renders often
  // enough (hover, zoom, layout) that fmtAge stays close to real time.
  const chips: Array<{
    label: string;
    age: string;
    tooltip: string;
    fresh: boolean;
    busy: boolean;
    stale?: boolean;
    onClick?: () => void;
    color: string;
  }> = [
    {
      label: "Analyzed",
      age: graphGeneratedAt ? fmtAge(graphGeneratedAt) : "Not yet",
      tooltip: graphGeneratedAt
        ? (isAnalysisStale
            ? `AI graph generated ${fmtAbsolute(graphGeneratedAt)} — STALE: at least one member doc was edited since.${isOwner ? " Click to re-run." : ""}`
            : `AI graph last generated ${fmtAbsolute(graphGeneratedAt)}.${isOwner ? " Click to re-run." : ""}`)
        : `This bundle hasn't been analyzed yet.${isOwner ? " Click to run AI analysis." : ""}`,
      fresh: !!graphGeneratedAt,
      busy: isAnalyzing,
      stale: !!graphGeneratedAt && isAnalysisStale,
      onClick: isOwner ? onAnalyze : undefined,
      color: "#fb923c",
    },
    {
      label: "Embedded",
      age: embeddingUpdatedAt ? fmtAge(embeddingUpdatedAt) : "Not yet",
      tooltip: embeddingUpdatedAt
        ? `Vector embedding refreshed ${fmtAbsolute(embeddingUpdatedAt)}. Powers semantic recall.${isOwner ? " Click to re-embed after editing title/description/members." : ""}`
        : `This bundle hasn't been embedded yet — semantic recall won't surface it.${isOwner ? " Click to embed now." : ""}`,
      fresh: !!embeddingUpdatedAt,
      busy: isEmbedding,
      onClick: isOwner ? onEmbed : undefined,
      color: "#60a5fa",
    },
  ];

  return (
    <div
      className="flex items-center h-8 rounded-md overflow-hidden"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      {chips.map((chip, i) => {
        const interactive = !!chip.onClick && !chip.busy;
        const dotColor = chip.busy ? chip.color : chip.fresh ? chip.color : "var(--text-faint)";
        const inner = (
          <span className="inline-flex items-center text-caption font-mono h-full" style={{ padding: "0 var(--space-3)", gap: 6 }}>
            <span
              style={{
                width: 6, height: 6, borderRadius: 999,
                background: dotColor,
                opacity: chip.fresh || chip.busy ? 1 : 0.5,
                animation: chip.busy ? "bundlePulse 1.2s ease-in-out infinite" : undefined,
              }}
            />
            <span style={{ color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.4, fontSize: 9 }}>{chip.label}</span>
            <span className="tabular-nums" style={{ color: chip.fresh ? "var(--text-secondary)" : "var(--text-faint)", fontSize: 11 }}>
              {chip.busy ? "Working…" : chip.age}
            </span>
            {chip.stale && !chip.busy && (
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: 9,
                  letterSpacing: 0.5,
                  color: "#fbbf24",
                  background: "rgba(251,191,36,0.12)",
                  padding: "1px 5px",
                  borderRadius: 3,
                  marginLeft: 2,
                }}
              >
                Stale
              </span>
            )}
          </span>
        );
        return (
          <div key={chip.label} className="flex items-center h-full">
            <Tooltip text={chip.tooltip} position="bottom">
              {interactive ? (
                <button
                  onClick={chip.onClick}
                  className="h-full inline-flex items-center hover:bg-[var(--toggle-bg)] transition-colors"
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  {inner}
                </button>
              ) : (
                <div className="h-full inline-flex items-center">{inner}</div>
              )}
            </Tooltip>
            {i < chips.length - 1 && <div style={{ width: 1, height: 18, background: "var(--border)" }} />}
          </div>
        );
      })}
      <style>{`@keyframes bundlePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}

// ─── Main ───

function BundleCanvasInner({ documents, aiGraph, isAnalyzing, graphGeneratedAt, embeddingUpdatedAt, isEmbedding, isAnalysisStale, isOwner, onEmbed, selectedDocId, hoveredNodeId, onDocumentClick, onCopyContext, onRegenerate, onRemoveDoc, onOpenDoc, onRequestAddDocs, onAddDocs, expandedDocId, decomposition, isDecomposing, decomposeError, onDecomposeDoc, onRedecomposeDoc, onCollapseDoc, onSectionClick, onSectionContextMenu, onChunkClick, onChunkContextMenu, selectedChunkIds, onClearChunkSelection, onPaneClose, onChunkDragReorder, chunkTypeFilter, onChangeChunkTypeFilter, onAddChunk, onSynthesize, focusChunkId, onFocusChunkSettled, highlightedDocIds, onClearHighlight, className = "" }: BundleCanvasProps) {
  const { zoomIn, zoomOut, fitView: rfFitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen state changes (Esc, F11, etc.)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Fullscreen targets the whole page (documentElement) instead of just the
  // canvas div so that the sidebar and AI panel stay visible/accessible while
  // the canvas goes edge-to-edge. Esc/F11 still toggles back.
  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ignore */ });
    } else {
      document.documentElement.requestFullscreen().catch(() => { /* ignore */ });
    }
  }, []);

  // Re-fit the canvas whenever the container size changes (sidebar toggle,
  // AI panel toggle, window resize, etc.). React Flow internally listens to
  // window resize but not to its container resizing inside flex/grid layouts.
  // Skip the first observation — the initial mount fit is handled by ReactFlow's
  // own `fitView` prop, so re-fitting here causes a visible "big → small" flicker.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf: number | null = null;
    let firstObservation = true;
    const obs = new ResizeObserver(() => {
      if (firstObservation) { firstObservation = false; return; }
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try { rfFitView({ padding: 0.15, maxZoom: 1.2, duration: 200 }); } catch { /* ignore */ }
      });
    });
    obs.observe(el);
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [rfFitView]);
  const [detail, setDetail] = useState<DetailLevel>(aiGraph ? 5 : 1);
  // Always show full map when AI data is available
  useEffect(() => {
    if (aiGraph) setDetail(5);
  }, [aiGraph]);

  useEffect(() => {
    const detect = () => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    detect();
    const obs = new MutationObserver(detect);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState([] as any[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as any[]);
  const nodesInitialized = useNodesInitialized();
  // Guards the post-measure relayout so it runs once per built graph.
  const relaidOutRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    buildLayout(documents, aiGraph, selectedDocId, detail, expandedDocId, decomposition).then(({ nodes: n, edges: e }) => {
      if (cancelled) return;
      setNodes(n);
      setEdges(e);
      relaidOutRef.current = ""; // new graph → allow a fresh measured relayout
      // ELK is async, so by the time setNodes runs ReactFlow has already
      // rendered with empty nodes — its `fitView` prop only fits on first
      // render. Refit after the layout populates so the freshly placed nodes
      // fill the viewport instead of being clipped at the bottom/right.
      if (n.length > 0) {
        requestAnimationFrame(() => {
          if (cancelled) return;
          try { rfFitView({ padding: 0.15, maxZoom: 1.2, duration: 0 }); } catch { /* ignore */ }
        });
      }
    });
    return () => { cancelled = true; };
  }, [documents, aiGraph, selectedDocId, detail, expandedDocId, decomposition, setNodes, setEdges, rfFitView]);

  // ── Pass 2: relayout with the MEASURED node sizes ──
  // Pass 1 (buildLayout) positions nodes using ESTIMATED card heights. The
  // summary card especially varies with content, so estimates drift — ELK then
  // either overlaps neighbours (under-estimate) or spreads them out with long
  // floating edges (over-estimate). Once ReactFlow has measured the real DOM
  // sizes, re-run ELK with them so the graph snaps to a clean, tight layout
  // (no overlaps, short connected edges) regardless of what re-analysis emits.
  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0) return;
    const sig = nodes.length + "::" + nodes.map((n) => n.id).join("|");
    if (relaidOutRef.current === sig) return; // already relaid out this graph
    const elkNodes = nodes.map((n: any) => ({
      id: n.id,
      width: Math.round(n.measured?.width ?? n.width ?? 200),
      height: Math.round(n.measured?.height ?? n.height ?? 100),
    }));
    const elkEdges = edges.map((e: any) => ({ id: e.id, sources: [e.source], targets: [e.target] }));
    let cancelled = false;
    elk
      .layout({ id: "root", layoutOptions: ELK_LAYOUT_OPTIONS, children: elkNodes, edges: elkEdges })
      .then((g) => {
        if (cancelled) return;
        const posMap = new Map<string, { x: number; y: number }>();
        for (const c of g.children || []) posMap.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
        relaidOutRef.current = sig;
        setNodes((prev) => prev.map((n) => {
          const p = posMap.get(n.id);
          return p ? { ...n, position: p } : n;
        }));
        requestAnimationFrame(() => {
          if (cancelled) return;
          try { rfFitView({ padding: 0.15, maxZoom: 1.2, duration: 0 }); } catch { /* ignore */ }
        });
      })
      .catch(() => { /* keep the pass-1 layout */ });
    return () => { cancelled = true; };
  }, [nodesInitialized, nodes, edges, setNodes, rfFitView]);

  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  // Fly-to + pulse for externally requested chunk focus (Discoveries panel)
  useEffect(() => {
    if (!focusChunkId || !expandedDocId) return;
    if (nodes.length === 0) return;
    const targetNodeId = `chunk:${expandedDocId}:${focusChunkId}`;
    if (!nodes.some(n => n.id === targetNodeId)) return;
    const handle = requestAnimationFrame(() => {
      try {
        rfFitView({ nodes: [{ id: targetNodeId }], padding: 1.2, maxZoom: 1.4, duration: 600 });
      } catch { /* viewport not ready */ }
      setPulsedNodeId(targetNodeId);
      onFocusChunkSettled?.();
      const t = setTimeout(() => setPulsedNodeId(null), 2200);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(handle);
  }, [focusChunkId, expandedDocId, rfFitView, onFocusChunkSettled, nodes]);

  // Compute connected nodes (traverse through label nodes for full chain)
  const connectedSet = useMemo(() => {
    if (!focusedNode) return null;
    const connected = new Set<string>();
    const queue = [focusedNode];
    connected.add(focusedNode);
    // BFS through edges, following label nodes
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const e of edges) {
        const neighbor = e.source === current ? e.target : (e.target === current ? e.source : null);
        if (neighbor && !connected.has(neighbor)) {
          connected.add(neighbor);
          // Continue traversal through label/theme nodes (small intermediaries)
          if (neighbor.startsWith("label-") || neighbor.startsWith("theme:")) {
            queue.push(neighbor);
          }
        }
      }
    }
    return connected;
  }, [focusedNode, edges]);

  // Right-click context menu state for document nodes (Open / Remove)
  const [docCtxMenu, setDocCtxMenu] = useState<{ x: number; y: number; docId: string } | null>(null);
  // External focus (set by parent via focusChunkId) — declared up here so the
  // pulse class can be applied in styledNodes below.
  const [pulsedNodeId, setPulsedNodeId] = useState<string | null>(null);
  useEffect(() => {
    if (!docCtxMenu) return;
    const close = () => setDocCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [docCtxMenu]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    // Doc nodes (collapsed view): open / remove / decompose
    if (node.id.startsWith("doc:")) {
      if (!onRemoveDoc && !onOpenDoc && !onDecomposeDoc) return;
      e.preventDefault();
      e.stopPropagation();
      const docId = node.id.slice(4);
      setDocCtxMenu({ x: e.clientX, y: e.clientY, docId });
      return;
    }
    // Section nodes (decomposed view): forward to parent so it can offer
    // edit / delete / add-subsection in its own menu.
    if (node.id.startsWith("section:") && onSectionContextMenu) {
      const data = node.data as { docId: string; section: Section } | undefined;
      if (!data) return;
      e.preventDefault();
      e.stopPropagation();
      onSectionContextMenu(data.docId, data.section, e.clientX, e.clientY);
      return;
    }
    // Semantic chunk nodes
    if (node.id.startsWith("chunk:") && onChunkContextMenu) {
      const data = node.data as { docId: string; chunk: SemanticChunkLike } | undefined;
      if (!data) return;
      e.preventDefault();
      e.stopPropagation();
      onChunkContextMenu(data.docId, data.chunk, e.clientX, e.clientY);
      return;
    }
  }, [onRemoveDoc, onOpenDoc, onDecomposeDoc, onSectionContextMenu, onChunkContextMenu]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const wasFocused = focusedNode === node.id;
    setFocusedNode(wasFocused ? null : node.id);
    // Focus zoom — smoothly center on the clicked node
    if (!wasFocused && node.position) {
      const size = NODE_SIZES[node.type || "conceptTag"] || { w: 160, h: 36 };
      rfFitView({ nodes: [{ id: node.id }], padding: 1.5, maxZoom: 1.2, duration: 500 });
    }
    // Section click → forward to parent for editing
    if (node.id.startsWith("section:") && onSectionClick) {
      const data = node.data as { docId: string; section: Section } | undefined;
      if (data) onSectionClick(data.docId, data.section);
      return;
    }
    // Semantic chunk click → forward to parent for editing / multi-select
    if (node.id.startsWith("chunk:") && onChunkClick) {
      const data = node.data as { docId: string; chunk: SemanticChunkLike } | undefined;
      if (!data) return;
      // Detect modifier key from the original event (React synthetic event
      // lives on the first param, not the node)
      // We don't have direct access to the event here — use the global
      // mouseEvent state captured via window.event as a fallback. ReactFlow
      // forwards the MouseEvent as the first argument; we rebind below.
      onChunkClick(data.docId, data.chunk, false);
      return;
    }
    if (onDocumentClick && node.type !== "edgeLabel") {
      onDocumentClick(node.id);
    }
  }, [onDocumentClick, focusedNode, rfFitView, onSectionClick, onChunkClick]);

  // Wrapper that captures the original DOM event so we can detect modifier
  // keys for multi-select. ReactFlow's onNodeClick gives us the React mouse
  // event as the first arg.
  const onNodeClickWithMods = useCallback((e: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("chunk:") && onChunkClick) {
      const data = node.data as { docId: string; chunk: SemanticChunkLike } | undefined;
      if (!data) return;
      const additive = e.metaKey || e.ctrlKey || e.shiftKey;
      onChunkClick(data.docId, data.chunk, additive);
      return;
    }
    onNodeClick(e, node);
  }, [onChunkClick, onNodeClick]);

  // Drag-reorder: when a chunk node is dropped, find the nearest other chunk
  // node (within the same expanded doc) and reorder source markdown.
  const onNodeDragStop = useCallback((_e: React.MouseEvent, node: Node, allNodes: Node[]) => {
    if (!onChunkDragReorder) return;
    if (!node.id.startsWith("chunk:")) return;
    const draggedData = node.data as { docId: string; chunk: SemanticChunkLike } | undefined;
    if (!draggedData) return;
    const dragSize = NODE_SIZES.chunkNode;
    const dragCenter = {
      x: (node.position?.x ?? 0) + dragSize.w / 2,
      y: (node.position?.y ?? 0) + dragSize.h / 2,
    };
    let bestId: string | null = null;
    let bestDist = Infinity;
    let bestY = 0;
    for (const other of allNodes) {
      if (other.id === node.id) continue;
      if (!other.id.startsWith("chunk:")) continue;
      const oData = other.data as { docId: string } | undefined;
      if (!oData || oData.docId !== draggedData.docId) continue;
      const oCenter = {
        x: (other.position?.x ?? 0) + dragSize.w / 2,
        y: (other.position?.y ?? 0) + dragSize.h / 2,
      };
      const dx = dragCenter.x - oCenter.x;
      const dy = dragCenter.y - oCenter.y;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        bestId = other.id;
        bestY = oCenter.y;
      }
    }
    // Threshold: must be reasonably close (<300px) AND must have moved a real
    // distance (>40px) from its original ELK-laid position to count as intent.
    if (!bestId || bestDist > 300) return;
    const targetData = allNodes.find(n => n.id === bestId)?.data as { chunk: SemanticChunkLike } | undefined;
    if (!targetData) return;
    const position: "before" | "after" = dragCenter.y < bestY ? "before" : "after";
    onChunkDragReorder(draggedData.docId, draggedData.chunk.id, targetData.chunk.id, position);
  }, [onChunkDragReorder]);

  const onPaneClick = useCallback(() => {
    setFocusedNode(null);
    onClearChunkSelection?.();
    // Background click also clears the side info panel — clicking empty
    // space anywhere on the canvas is the universal "deselect" gesture.
    onPaneClose?.();
  }, [onClearChunkSelection, onPaneClose]);

  const totalWords = documents.reduce((s, d) => s + d.markdown.split(/\s+/).filter(Boolean).length, 0);

  // Node color lookup for CSS variables
  const getNodeGlowColor = useCallback((n: Node) => {
    if (n.type === "documentCard") return "#fb923c";
    if (n.type === "summaryNode" || n.type === "themeTag") return "#60a5fa";
    if (n.type === "sectionRoot") return "#fb923c"; // doc-aligned accent
    if (n.type === "sectionNode") {
      // Match the heading-level tint used inside the SectionNode body
      const level = (n.data as { section?: { level?: number } } | undefined)?.section?.level;
      if (level === 0) return "#94a3b8";
      if (level === 1) return "#fb923c";
      if (level === 2) return "#fbbf24";
      if (level === 3) return "#60a5fa";
      return "#a78bfa";
    }
    if (n.type === "chunkNode") {
      // Use the chunk's semantic type color (claim=orange, concept=cyan, etc.)
      // This is what the user expected from the chunk's visible accent stripe.
      const chunkType = (n.data as { chunk?: { type?: string } } | undefined)?.chunk?.type;
      return CHUNK_TYPE_COLORS[chunkType || ""]?.border || "#94a3b8";
    }
    if (n.type === "edgeLabel") {
      // Edge label nodes carry their own color (set by the source edge's stroke)
      return (n.data as { color?: string } | undefined)?.color || "#94a3b8";
    }
    const t = (n.data as { type?: string } | undefined)?.type;
    return TYPE_COLORS[t || ""]?.border || "#38bdf8";
  }, []);

  // Mark nodes/edges with CSS classes + animations based on focus
  const chunkSelectedSet = selectedChunkIds || null;
  const decoreateChunkExtra = useCallback((n: Node, baseClass: string): { className: string; extraStyle: Record<string, string> } => {
    const extraStyle: Record<string, string> = {};
    let className = baseClass;
    if (n.id.startsWith("chunk:")) {
      const data = n.data as { chunk?: SemanticChunkLike } | undefined;
      const cid = data?.chunk?.id;
      if (cid && chunkSelectedSet?.has(cid)) {
        className += " bundle-chunk-selected";
      }
      if (chunkTypeFilter && data?.chunk && data.chunk.type !== chunkTypeFilter) {
        className += " bundle-chunk-filtered-out";
      }
    }
    if (pulsedNodeId === n.id) {
      className += " bundle-chunk-pulse";
    }
    return { className, extraStyle };
  }, [chunkSelectedSet, chunkTypeFilter, pulsedNodeId]);

  // Conversational-query filter: build a set of doc nodes the chat
  // told us to highlight, plus their one-hop neighbours (concepts /
  // themes / edge labels they're connected to). The same fade applies
  // to anything outside this set so the visual focus is obvious.
  // Doc nodes can be `doc:<id>` (collapsed) or `doc-root:<id>`
  // (expanded with decomposition); seed both shapes.
  const highlightSet = useMemo(() => {
    if (!highlightedDocIds || highlightedDocIds.length === 0) return null;
    const seeds = new Set<string>();
    for (const id of highlightedDocIds) {
      seeds.add(`doc:${id}`);
      seeds.add(`doc-root:${id}`);
    }
    const result = new Set<string>(seeds);
    for (const e of edges) {
      const src = String(e.source);
      const tgt = String(e.target);
      if (seeds.has(src)) result.add(tgt);
      if (seeds.has(tgt)) result.add(src);
    }
    return result;
  }, [highlightedDocIds, edges]);

  const styledNodes = useMemo(() => {
    // Combine highlight filter with the existing connected-set logic.
    // When both are active, a node has to satisfy both to stay bright;
    // when only one is, that one governs.
    const passesFilter = (id: string): boolean => {
      if (highlightSet && !highlightSet.has(id)) return false;
      if (connectedSet && !connectedSet.has(id)) return false;
      return true;
    };
    const hasAnyFilter = !!(connectedSet || highlightSet);
    if (!hasAnyFilter) {
      return nodes.map(n => {
        const color = getNodeGlowColor(n);
        const baseClass = hoveredNodeId === n.id ? "bundle-node-ext-hover" : "";
        const extra = decoreateChunkExtra(n, baseClass);
        return {
          ...n,
          className: extra.className,
          // --node-color: solid color used for hover/selection/focus outlines.
          // Each node type contributes its own (orange for docs, type-color
          // for chunks, etc.) so the outline matches the node's identity.
          style: { "--node-color": color, ...extra.extraStyle } as any,
        };
      });
    }
    return nodes.map(n => {
      const color = getNodeGlowColor(n);
      const isFocused = n.id === focusedNode;
      const isActive = passesFilter(n.id);
      const isExtHover = hoveredNodeId === n.id;
      const baseClass = `${isActive ? "bundle-node-active" : "bundle-node-dim"} ${isFocused ? "bundle-node-focused" : ""} ${isExtHover ? "bundle-node-ext-hover" : ""}`;
      const extra = decoreateChunkExtra(n, baseClass);
      return {
        ...n,
        className: extra.className,
        style: { "--node-color": color, ...extra.extraStyle } as any,
      };
    });
  }, [nodes, connectedSet, highlightSet, focusedNode, getNodeGlowColor, decoreateChunkExtra, hoveredNodeId]);

  const styledEdges = useMemo(() => {
    if (!connectedSet && !highlightSet) return edges;
    return edges.map(e => {
      const passConnected = !connectedSet || (connectedSet.has(e.source) && connectedSet.has(e.target));
      const passHighlight = !highlightSet || (highlightSet.has(e.source) && highlightSet.has(e.target));
      const isActive = passConnected && passHighlight;
      return {
        ...e,
        data: { ...((e.data as any) || {}), flowing: isActive },
        style: { ...e.style, opacity: isActive ? (e.style as any)?.opacity || 0.2 : 0.04 },
      };
    });
  }, [edges, connectedSet, highlightSet]);

  // Drop zone for sidebar drag-and-drop: dragging a doc tab from MDs section
  // onto the canvas adds it to this bundle.
  //
  // Browser quirk: custom MIME types are sometimes hidden from
  // `dataTransfer.types` during `dragover` (Chrome's protected drag mode).
  // If we conditionally call `preventDefault` only on our MIME, the drop
  // gets rejected entirely. Instead we always allow drop on dragover (unless
  // it's a file drag from the OS) and validate the payload at drop time.
  const [dropActive, setDropActive] = useState(false);
  // Fail-safe: any time a drag ends or aborts (Esc, mouseup outside, drop on
  // a non-handler), clear the overlay. Without this the overlay can stick on
  // screen if the browser silently rejects our drop (e.g. effectAllowed
  // mismatch) — drop never fires, so handleDrop's setDropActive(false) never
  // runs.
  useEffect(() => {
    const clear = () => setDropActive(false);
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!onAddDocs) return;
    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes("Files")) return; // OS file drag — let it through
    e.preventDefault();
    // "copy" or "move" both work since the source sets effectAllowed:"copyMove".
    // We pick "copy" for the cursor cue (adds without removing) but the
    // browser only honors values compatible with effectAllowed.
    e.dataTransfer.dropEffect = "copy";
    setDropActive(true);
  }, [onAddDocs]);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when leaving the canvas root, not when entering a child
    if (e.currentTarget === e.target) setDropActive(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!onAddDocs) return;
    e.preventDefault();
    setDropActive(false);
    let docIds: string[] = [];
    try {
      // Primary: the explicit doc-ids MIME we set on dragstart
      const raw = e.dataTransfer.getData("application/x-memorywiki-doc-ids");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          docIds = parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
        }
      }
      // Fallback: text/plain "mw-doc:<id>" form (used when custom MIMEs are
      // hidden by Chrome's protected drag mode)
      if (docIds.length === 0) {
        const text = e.dataTransfer.getData("text/plain") || "";
        const m = text.match(/^mw-doc:([\w-]+)$/);
        if (m) docIds = [m[1]];
      }
    } catch { /* malformed payload */ }
    if (docIds.length === 0) return; // not our drag — silently ignore
    // Skip docs already in the bundle
    const existing = new Set(documents.map(d => d.id));
    const fresh = docIds.filter(id => !existing.has(id));
    if (fresh.length > 0) onAddDocs(fresh);
  }, [onAddDocs, documents]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ width: "100%", height: "100%" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dropActive && (
        <div className="absolute inset-0 z-[50] pointer-events-none flex items-center justify-center" style={{ background: "rgba(251,146,60,0.06)", border: "2px dashed var(--text-primary)", borderRadius: 8 }}>
          <div className="px-4 py-2 rounded-lg text-body font-semibold" style={{ background: "var(--text-primary)", color: "var(--background)" }}>
            Drop to add to bundle
          </div>
        </div>
      )}
      <style>{`
        .react-flow__node { transition: none; }
        .bundle-node-dim { opacity: 0.12 !important; transition: opacity 0.2s; }
        .bundle-node-active { opacity: 1 !important; transition: opacity 0.2s; }
        /* Hover / focus / selection now use a SOLID OUTLINE in the node's
           main color (set via --node-color) instead of a soft glow. The ring
           is drawn with box-shadow spread so it respects rounded corners. */
        .react-flow__node:hover > div {
          box-shadow: 0 0 0 1px var(--node-color, var(--text-primary)) !important;
          transition: box-shadow 0.12s;
        }
        /* Edge labels are inline pills, not interactive nodes. Their wrapper
           div is rectangular but the visible pill inside is rounded — so the
           default hover ring above would draw a sharp rectangle around a
           rounded pill. Suppress the hover ring on edgeLabel nodes. */
        .react-flow__node[data-id^="edge-"]:hover > div,
        .react-flow__node.react-flow__node-edgeLabel:hover > div {
          box-shadow: none !important;
        }
        .bundle-node-focused > div {
          box-shadow: 0 0 0 1px var(--node-color, var(--text-primary)) !important;
        }
        .bundle-node-ext-hover > div {
          box-shadow: 0 0 0 1px var(--node-color, var(--text-primary)) !important;
          transform: scale(1.02);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .bundle-chunk-selected > div {
          box-shadow: 0 0 0 2px var(--node-color, var(--text-primary)) !important;
        }
        .bundle-chunk-filtered-out { opacity: 0.18; transition: opacity 0.2s; }
        @keyframes bundleDotFlow { to { stroke-dashoffset: -18; } }
        .bundle-dot-overlay { stroke-dasharray: 0.01 6; stroke-linecap: round; animation: bundleDotFlow 2s linear infinite; }
        /* Pulse: outline thickens/expands rhythmically — no fuzzy glow */
        @keyframes bundleChunkPulseOutline {
          0%   { box-shadow: 0 0 0 1px var(--node-color, var(--text-primary)); }
          50%  { box-shadow: 0 0 0 3px var(--node-color, var(--text-primary)); }
          100% { box-shadow: 0 0 0 1px var(--node-color, var(--text-primary)); }
        }
        .bundle-chunk-pulse > div { animation: bundleChunkPulseOutline 1.4s ease-in-out 2 !important; }
        @keyframes analyzeShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .bundle-analyzing-bar {
          height: 2px; background: linear-gradient(90deg, transparent 0%, var(--text-primary) 50%, transparent 100%);
          background-size: 200% 100%; animation: analyzeShimmer 1.5s ease infinite;
        }
      `}</style>
      <ReactFlow
        nodes={styledNodes} edges={styledEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickWithMods} onNodeContextMenu={onNodeContextMenu} onPaneClick={onPaneClick}
        onNodeDragStop={(e, node) => onNodeDragStop(e as unknown as React.MouseEvent, node, styledNodes as Node[])}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2, duration: 0 }}
        minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
        // Disable ReactFlow's built-in multi-selection (default key = Meta) so
        // Cmd/Ctrl/Shift+click is delivered straight to our handler instead of
        // being consumed for ReactFlow's internal selection model. We also
        // turn off node selection styling we don't need.
        multiSelectionKeyCode={null}
        nodesFocusable={false}
        style={{ background: "var(--background)" }}
      >
        <Background variant={"dots" as any} color={theme === "dark" ? "#2a2a2f" : "#c4c4c8"} gap={18} size={1.5} />
        {highlightedDocIds && highlightedDocIds.length > 0 && onClearHighlight && (
          <Panel position="top-center">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-caption"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--text-primary)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                color: "var(--text-secondary)",
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>◉</span>
              <span>Filtered to <strong style={{ color: "var(--text-primary)" }}>{highlightedDocIds.length} doc{highlightedDocIds.length === 1 ? "" : "s"}</strong> from the chat</span>
              <button
                onClick={onClearHighlight}
                className="px-2 py-0.5 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                style={{ color: "var(--text-muted)", fontWeight: 600, border: "1px solid var(--border-dim)" }}
                title="Show every node again"
              >
                Exit
              </button>
            </div>
          </Panel>
        )}
        <MiniMap position="bottom-right" pannable zoomable
          nodeColor={(n) => {
            // Mirror the canvas + legend mapping exactly so the minimap is a
            // true thumbnail of the colors above. Chunks and edge labels
            // both delegate to their type-color tables; sectionRoot inherits
            // the doc orange because it's the same primitive in expanded mode.
            if (n.type === "summaryNode" || n.type === "themeTag") return "#60a5fa";
            if (n.type === "documentCard" || n.type === "sectionRoot") return "#fb923c";
            if (n.type === "chunkNode") {
              const ct = (n.data as any)?.type;
              return CHUNK_TYPE_COLORS[ct]?.border || "#94a3b8";
            }
            if (n.type === "edgeLabel") {
              return ((n.data as any)?.color as string) || "var(--border)";
            }
            return TYPE_COLORS[(n.data as any)?.type]?.border || "#38bdf8";
          }}
          maskColor={theme === "dark" ? "rgba(9,9,11,0.8)" : "rgba(250,249,247,0.8)"}
          style={{ background: theme === "dark" ? "#18181b" : "#f4f4f5", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", width: 160, height: 100 }} />
      </ReactFlow>

      {/* Top-left toolbar — pipeline status pills are now the canonical
          surface for "where this bundle stands" (clicking them re-runs the
          underlying AI pass). The standalone Analyze button was redundant
          with the Analyzed pill, and the Memo/FAQ/Brief trio moves into the
          More menu so the toolbar reads as: STATUS + MORE, nothing else. */}
      <div className="absolute z-20 flex items-center" style={{ top: "var(--space-3)", left: "var(--space-3)", gap: "var(--space-2)" }}>
        {/* COLLAPSED MODE — bundle-level actions */}
        {!expandedDocId && (
          <>
            {/* Pipeline status — at-a-glance freshness for the two AI passes
                this bundle depends on (graph extraction + vector embedding).
                Owners can click to re-run. Read-only viewers see the chip but
                can't trigger refresh. Now the primary action surface — the
                old "Analyze" button was just a duplicate. */}
            <BundleStatusGroup
              isOwner={!!isOwner}
              isAnalyzing={!!isAnalyzing}
              isEmbedding={!!isEmbedding}
              isAnalysisStale={!!isAnalysisStale}
              graphGeneratedAt={graphGeneratedAt || null}
              embeddingUpdatedAt={embeddingUpdatedAt || null}
              onAnalyze={onRegenerate}
              onEmbed={onEmbed}
            />

            {/* More menu — Synthesize (Memo/FAQ/Brief), Copy context, Add
                docs, Detail level. */}
            <CanvasMoreMenu
              onCopyContext={onCopyContext}
              onRequestAddDocs={onRequestAddDocs}
              onSynthesize={onSynthesize}
              detail={detail}
              setDetail={setDetail}
              detailLabels={DETAIL_LABELS}
            />
          </>
        )}

        {/* EXPANDED MODE — single decomposed doc */}
        {expandedDocId && onCollapseDoc && (
          <>
            <div
              className="flex items-center h-8 overflow-hidden"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--text-primary)", borderRadius: "var(--radius-md)" }}
            >
              {/* "Done" instead of "Collapse" — the previous label was a
                  mode-mechanic word ("collapse the tree"); users read it as
                  "minimize" or got stuck wondering whether they had to
                  manually save first. "Done" + the auto-save hint below
                  describes the actual exit gesture. */}
              <Tooltip text="Exit decompose view. Edits to chunks save automatically as you type — there's nothing to commit before leaving." position="bottom">
                <button
                  onClick={onCollapseDoc}
                  className="inline-flex items-center text-caption font-semibold h-full hover:brightness-110 transition-all"
                  style={{ background: "var(--text-primary)", color: "var(--background)", padding: "0 var(--space-3)", gap: "var(--space-2)" }}
                >
                  <Check width={11} height={11} strokeWidth={2.5} />
                  Done
                </button>
              </Tooltip>
              {isDecomposing ? (
                <div className="inline-flex items-center text-caption" style={{ color: "var(--text-primary)", padding: "0 var(--space-3)", gap: "var(--space-2)" }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--text-primary)" }} />
                  Decomposing…
                </div>
              ) : decomposition ? (
                <Tooltip text="Re-run AI semantic decomposition" position="bottom">
                  <button
                    onClick={() => onRedecomposeDoc?.(expandedDocId)}
                    className="inline-flex items-center text-caption font-medium h-full hover:bg-[var(--toggle-bg)] transition-colors"
                    style={{ color: "var(--text-muted)", padding: "0 var(--space-3)", gap: "var(--space-1)" }}
                  >
                    <Sparkles width={10} height={10} />
                    Re-analyze
                  </button>
                </Tooltip>
              ) : null}
              {onAddChunk && decomposition && (
                <>
                  <div style={{ width: 1, height: 18, background: "var(--border)" }} />
                  <Tooltip text="Append a new chunk to this document" position="bottom">
                    <button
                      onClick={() => onAddChunk(expandedDocId)}
                      className="inline-flex items-center text-caption font-medium h-full hover:bg-[var(--toggle-bg)] transition-colors"
                      style={{ color: "var(--text-secondary)", padding: "0 var(--space-3)", gap: "var(--space-1)" }}
                    >
                      <Plus width={11} height={11} />
                      Add chunk
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Top-right: zoom in / out / reset / fullscreen */}
      <div className="absolute top-3 right-3 z-20 flex items-center h-8 rounded-lg overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Tooltip text="Zoom out" position="bottom">
          <button onClick={() => zoomOut({ duration: 200 })}
            className="flex items-center justify-center w-8 h-full hover:bg-[var(--toggle-bg)] transition-colors"
            style={{ color: "var(--text-secondary)" }}>
            <Minus width={12} height={12} />
          </button>
        </Tooltip>
        <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        <Tooltip text="Zoom in" position="bottom">
          <button onClick={() => zoomIn({ duration: 200 })}
            className="flex items-center justify-center w-8 h-full hover:bg-[var(--toggle-bg)] transition-colors"
            style={{ color: "var(--text-secondary)" }}>
            <Plus width={12} height={12} />
          </button>
        </Tooltip>
        <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        <Tooltip text="Reset view" position="bottom">
          <button onClick={() => rfFitView({ padding: 0.15, maxZoom: 1.2, duration: 300 })}
            className="flex items-center justify-center w-8 h-full hover:bg-[var(--toggle-bg)] transition-colors"
            style={{ color: "var(--text-secondary)" }}>
            <Circle width={11} height={11} />
          </button>
        </Tooltip>
        <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        <Tooltip text={isFullscreen ? "Exit fullscreen" : "Fullscreen"} position="bottom">
          <button onClick={toggleFullscreen}
            className="flex items-center justify-center w-8 h-full hover:bg-[var(--toggle-bg)] transition-colors"
            style={{ color: "var(--text-secondary)" }}>
            {isFullscreen ? <Minimize width={11} height={11} /> : <Maximize width={11} height={11} />}
          </button>
        </Tooltip>
      </div>

      {/* Decompose error (floats below the top-left toolbar so it never
          collides with the action chips) */}
      {expandedDocId && decomposeError && (
        <div className="absolute top-12 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-caption"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid #ef4444", color: "#ef4444", maxWidth: "min(420px, 60%)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {decomposeError}
        </div>
      )}

      {/* Bottom-left: type filter pills (decomposed mode only). Mirrors
          the MD filter chip pattern in the main editor's left sidebar
          (All / Private / Shared / Synced) — single accent color for the
          active state, no per-type color variation, equal-width buttons,
          subtle hover. Cleaner than the previous per-type colored pills. */}
      {expandedDocId && decomposition && onChangeChunkTypeFilter && (() => {
        const presentTypes = Array.from(new Set(decomposition.chunks.map(c => c.type)));
        if (presentTypes.length <= 1) return null;
        const allOptions = [null as string | null, ...presentTypes];
        return (
          <div
            className="absolute bottom-12 left-3 z-20 inline-flex items-center gap-0.5 p-0.5 rounded-md"
            style={{ background: "var(--background)", border: "1px solid var(--border-dim)", maxWidth: "60vw" }}
          >
            {allOptions.map((t) => {
              const isActive = chunkTypeFilter === t;
              const label = t ?? "All";
              return (
                <button
                  key={label}
                  onClick={() => onChangeChunkTypeFilter(t === null ? null : (isActive ? null : t))}
                  className="px-2.5 py-1 text-caption rounded transition-colors capitalize"
                  style={{
                    background: isActive ? "var(--border)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-faint)",
                    fontWeight: isActive ? 600 : 500,
                  }}
                  onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "var(--toggle-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; } }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Bottom-left: legend — single horizontal row, nodes + chunk types
          only. Edge colors deliberately omitted: they always follow the
          source node's color (already represented), so a separate Edges row
          was repeating information without adding signal. Tooltips on each
          item give the explanation that the row label can't fit. */}
      {(() => {
        const nodeKinds = new Set<string>();
        const conceptKinds = new Set<string>();
        const chunkKinds = new Set<string>();
        nodes.forEach(n => { if (n.type) nodeKinds.add(n.type); });
        nodes.filter(n => n.type === "conceptTag").forEach(n => conceptKinds.add((n.data as any)?.type || "concept"));
        nodes.filter(n => n.type === "chunkNode").forEach(n => { const ct = (n.data as any)?.type; if (ct) chunkKinds.add(ct); });

        type Item = { Icon?: typeof Sparkles; dot?: string; label: string; color: string; tooltip?: string };
        const items: Item[] = [];
        if (nodeKinds.has("summaryNode")) items.push({ Icon: Sparkles, label: "Analysis", color: "#60a5fa", tooltip: "Bundle-level AI analysis (summary, themes, insights)." });
        if (nodeKinds.has("documentCard") || nodeKinds.has("sectionRoot")) items.push({ Icon: FileText, label: "Docs", color: "#fb923c", tooltip: "Source documents in this bundle." });
        if (conceptKinds.has("concept")) items.push({ Icon: Lightbulb, label: "Concepts", color: TYPE_COLORS.concept.border, tooltip: "Distinct concepts the AI extracted across docs." });
        if (conceptKinds.has("entity")) items.push({ Icon: CheckSquare, label: "Entities", color: TYPE_COLORS.entity.border, tooltip: "Specific things — products, people, projects." });
        if (conceptKinds.has("tag")) items.push({ Icon: Tag, label: "Tags", color: TYPE_COLORS.tag.border, tooltip: "Topical tags assigned across the bundle." });

        // Chunk types only when decomposition is open — appended inline so
        // the legend stays a single row.
        const chunkOrder: Array<keyof typeof CHUNK_TYPE_COLORS> = ["claim", "definition", "example", "evidence", "question", "task", "concept", "context"];
        chunkOrder
          .filter(k => chunkKinds.has(k))
          .forEach(k => items.push({ dot: CHUNK_TYPE_COLORS[k].border, label: k.charAt(0).toUpperCase() + k.slice(1), color: CHUNK_TYPE_COLORS[k].border, tooltip: `${k.charAt(0).toUpperCase() + k.slice(1)} chunks (decomposition view).` }));

        if (items.length === 0) return null;

        return (
          <div className="absolute bottom-3 left-3 z-20 flex items-center flex-nowrap overflow-x-auto px-2.5 h-7 rounded-md"
            style={{ gap: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", maxWidth: "calc(100% - 24px)" }}>
            {items.map((item, i) => (
              <Tooltip key={i} text={item.tooltip || item.label} position="top">
                <div className="flex items-center shrink-0" style={{ gap: 5 }}>
                  {item.Icon ? (
                    <item.Icon width={10} height={10} style={{ color: item.color }} />
                  ) : (
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color, display: "inline-block" }} />
                  )}
                  <span className="text-caption whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                </div>
              </Tooltip>
            ))}
          </div>
        );
      })()}

      {/* Right-click context menu on document nodes */}
      {docCtxMenu && (
        <div
          className="fixed z-[200] py-1 rounded-lg shadow-xl"
          style={{
            left: Math.min(docCtxMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1024) - 180),
            top: Math.min(docCtxMenu.y, (typeof window !== "undefined" ? window.innerHeight : 768) - 90),
            minWidth: 180,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onOpenDoc && (
            <button
              onClick={() => { onOpenDoc(docCtxMenu.docId); setDocCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-caption flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
              style={{ color: "var(--text-secondary)" }}
            >
              <ExternalLink width={11} height={11} /> Open
            </button>
          )}
          {onDecomposeDoc && (
            <button
              onClick={() => { onDecomposeDoc(docCtxMenu.docId); setDocCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-caption flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
              style={{ color: "var(--text-secondary)" }}
            >
              <Layers width={11} height={11} /> Decompose into sections
            </button>
          )}
          {onRemoveDoc && (
            <button
              onClick={() => { onRemoveDoc(docCtxMenu.docId); setDocCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-caption flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
              style={{ color: "#ef4444" }}
            >
              <Trash2 width={11} height={11} /> Remove from bundle
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Canvas More menu — secondary actions tucked behind a single button so
//      the toolbar stays at one primary group instead of five competing chips. ───
function CanvasMoreMenu({
  onCopyContext,
  onRequestAddDocs,
  onSynthesize,
  detail,
  setDetail,
  detailLabels,
}: {
  onCopyContext?: () => void;
  onRequestAddDocs?: () => void;
  onSynthesize?: (kind: "memo" | "faq" | "brief") => void;
  detail: DetailLevel;
  setDetail: (d: DetailLevel) => void;
  detailLabels: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);
  if (!onCopyContext && !onRequestAddDocs && !onSynthesize) return null;

  const menuItem = (label: string, desc: string, Icon: typeof Copy, onClick: () => void) => (
    <button
      onClick={() => { onClick(); setOpen(false); }}
      className="text-left inline-flex items-start hover:bg-[var(--toggle-bg)] transition-colors rounded"
      style={{ color: "var(--text-secondary)", padding: "var(--space-2) var(--space-3)", gap: "var(--space-2)" }}
    >
      <Icon width={12} height={12} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-faint)" }} />
      <div className="flex flex-col">
        <span className="text-body" style={{ color: "var(--text-primary)" }}>{label}</span>
        <span className="text-caption" style={{ color: "var(--text-faint)" }}>{desc}</span>
      </div>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <Tooltip text="More — Synthesize, Copy context, Add docs, Detail level" position="bottom">
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center justify-center h-8 hover:bg-[var(--toggle-bg)] transition-colors"
          style={{
            width: 32,
            background: open ? "var(--toggle-bg)" : "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-muted)",
          }}
        >
          <MoreHorizontal width={13} height={13} />
        </button>
      </Tooltip>
      {open && (
        <div
          className="absolute z-30 flex flex-col"
          style={{
            top: "calc(100% + var(--space-1))",
            left: 0,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            minWidth: 260,
            padding: "var(--space-1)",
          }}
        >
          {/* Synthesize trio — moved out of the toolbar to declutter the
              top-left strip per user feedback. Each entry pairs the action
              name with a one-line "what it produces" so the user doesn't
              have to recall what Memo / FAQ / Brief mean. */}
          {onSynthesize && (
            <>
              <div style={{ padding: "var(--space-1) var(--space-3)" }}>
                <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>Synthesize</span>
              </div>
              {menuItem("Memo", "1-page decision memo from this bundle", Sparkles, () => onSynthesize("memo"))}
              {menuItem("FAQ", "FAQ from cross-doc questions + answers", Sparkles, () => onSynthesize("faq"))}
              {menuItem("Brief", "Narrative brief tying the bundle together", Sparkles, () => onSynthesize("brief"))}
              <div style={{ height: 1, background: "var(--border-dim)", margin: "var(--space-1) 0" }} />
            </>
          )}
          {onCopyContext && menuItem("Copy bundle as context", "Concatenated markdown for the AI of your choice", Copy, onCopyContext)}
          {onRequestAddDocs && menuItem("Add documents…", "Pick from your library to extend this bundle", FilePlus2, onRequestAddDocs)}
          <div style={{ height: 1, background: "var(--border-dim)", margin: "var(--space-1) 0" }} />
          {/* Detail level — minimal redesign per founder's last
              note: just the title row, the slider, and the
              current level name below it. No tick marks, no
              number row, no inline level label on the title row.
              The slider's filled-track + thumb position tell you
              where you are; the centered label below names what
              you're looking at. */}
          <div className="flex flex-col mw-detail-slider" style={{ padding: "var(--space-2) var(--space-3)", gap: "var(--space-2)" }}>
            <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>
              Detail level
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={detail}
              onChange={(e) => setDetail(Number(e.target.value) as DetailLevel)}
              aria-label={`Detail level (1–5). Current: ${detailLabels[detail] || detail}`}
              style={{
                width: "100%",
                // CSS var feeds the webkit track gradient — see globals.css
                // .mw-detail-slider ::-webkit-slider-runnable-track.
                // Firefox uses ::-moz-range-progress which is value-aware
                // natively, so the var is ignored there.
                ["--mw-detail-progress" as string]: `linear-gradient(to right, var(--text-primary) 0%, var(--text-primary) ${((detail - 1) / 4) * 100}%, var(--toggle-bg) ${((detail - 1) / 4) * 100}%, var(--toggle-bg) 100%)`,
              } as React.CSSProperties}
            />
            <span
              className="text-xs font-medium text-center"
              style={{ color: "var(--text-primary)" }}
            >
              {detailLabels[detail] || `Level ${detail}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper with ReactFlowProvider
export default function BundleCanvas(props: BundleCanvasProps) {
  return (
    <ReactFlowProvider>
      <BundleCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
