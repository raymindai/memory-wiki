"use client";

// Hub Constellation — Layer 2 of the "growing knowledge hub" surface.
// Concepts + docs rendered as a force-laid-out graph. A time slider at
// the bottom lets the user replay how the hub populated from the first
// capture to today — that "look what I built" moment is the whole
// point of this layer. See claude memory note
// `start_growing_hub_concept_2026_05` for the design + anti-patterns.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";

interface ApiNode {
  id: string;
  label: string;
  kind: "concept" | "entity" | "tag" | "doc";
  weight: number;
  description?: string | null;
  occurrence?: number;
  createdAt: string;
  docIds?: string[];
  bundleId?: string | null;
  intent?: string | null;
}

interface ApiEdge {
  id: string;
  source: string;
  target: string;
  kind: "concept_doc" | "concept_concept";
  weight: number;
  label?: string;
  createdAt: string;
}

interface ApiCluster {
  id: string;
  label: string;
  createdAt: string;
}

interface ConstellationData {
  nodes: ApiNode[];
  edges: ApiEdge[];
  clusters: ApiCluster[];
  hubStart: string;
  hubEnd: string;
  counts: { nodes: number; edges: number; clusters: number; cappedConcepts: boolean; cappedDocs: boolean };
}

interface Props {
  authHeaders: Record<string, string>;
  minNodesToShow?: number;
}

// Cluster palette — recycled from the BundleCanvas vocabulary so a
// hub-level view of a doc feels visually consistent with its bundle
// view. Six values cycle for hubs with more than six bundles.
const CLUSTER_COLOURS = [
  "#fb923c", // orange
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#4ade80", // green
  "#f472b6", // pink
  "#fbbf24", // amber
];

function colourForBundle(bundleId: string | null | undefined, clusters: ApiCluster[]): string {
  if (!bundleId) return "color-mix(in srgb, var(--text-faint) 40%, transparent 60%)";
  const idx = clusters.findIndex((c) => c.id === bundleId);
  return idx >= 0 ? CLUSTER_COLOURS[idx % CLUSTER_COLOURS.length] : "var(--text-primary)";
}

function colourForConcept(kind: ApiNode["kind"]): string {
  if (kind === "entity") return "var(--text-primary)";
  if (kind === "tag") return "color-mix(in srgb, var(--text-primary) 50%, var(--text-muted) 50%)";
  return "color-mix(in srgb, var(--text-primary) 75%, var(--text-primary) 25%)";
}

const elk = new ELK();

async function layoutGraph(nodes: Node[], edges: Edge[]): Promise<Node[]> {
  const result = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "force",
      "elk.force.iterations": "120",
      "elk.spacing.nodeNode": "26",
      "elk.padding": "[top=12, left=12, bottom=12, right=12]",
    },
    children: nodes.map((n) => ({ id: n.id, width: 16, height: 16 })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const positioned = nodes.map((n) => {
    const laid = result.children?.find((c) => c.id === n.id);
    return { ...n, position: { x: laid?.x ?? 0, y: laid?.y ?? 0 } };
  });
  return positioned;
}

// Custom dot-style node — we don't want labels by default (200 labels
// would be a wall of text); the label appears on hover via the tooltip
// + the right-side details panel.
function DotNode({ data }: { data: { kind: ApiNode["kind"]; size: number; colour: string; label: string } }) {
  return (
    <div
      title={data.label}
      style={{
        width: data.size,
        height: data.size,
        borderRadius: data.kind === "doc" ? 3 : "50%",
        background: data.colour,
        boxShadow: `0 0 ${Math.max(2, data.size / 3)}px ${data.colour}55`,
        opacity: 0.85,
      }}
    />
  );
}

const NODE_TYPES: NodeTypes = { dot: DotNode };

function HubConstellationInner({ authHeaders, minNodesToShow = 6 }: Props) {
  const [data, setData] = useState<ConstellationData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sliderDate, setSliderDate] = useState<string>("");
  const [playing, setPlaying] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<ApiNode | null>(null);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);
  const playRef = useRef<number | null>(null);

  // Fetch once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/hub/constellation", { headers: authHeaders });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const json = (await res.json()) as ConstellationData;
        if (cancelled) return;
        setData(json);
        setSliderDate(json.hubEnd);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run ELK once with the full dataset; the slider then hides nodes
  // rather than re-laying out (re-running ELK on slider drag would be
  // far too slow + jittery).
  useEffect(() => {
    if (!data || data.nodes.length === 0) return;
    let cancelled = false;
    (async () => {
      const initialFlowNodes: Node[] = data.nodes.map((n) => ({
        id: n.id,
        type: "dot",
        position: { x: 0, y: 0 },
        data: {
          kind: n.kind,
          size: n.kind === "doc" ? 8 : Math.max(6, Math.min(18, 6 + (n.occurrence || 1) * 0.6)),
          colour: n.kind === "doc" ? colourForBundle(n.bundleId, data.clusters) : colourForConcept(n.kind),
          label: n.label,
        },
        draggable: false,
        selectable: false,
      }));
      const flowEdges: Edge[] = data.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
      const positioned = await layoutGraph(initialFlowNodes, flowEdges);
      if (!cancelled) setLayoutedNodes(positioned);
    })();
    return () => { cancelled = true; };
  }, [data]);

  // Filter by slider — visible iff createdAt <= sliderDate
  const visible = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] };
    const slider = sliderDate || data.hubEnd;
    const cutoff = slider + "T23:59:59Z";
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    const visibleIds = new Set<string>();
    for (const n of data.nodes) {
      if (n.createdAt <= cutoff) visibleIds.add(n.id);
    }
    const nodes = layoutedNodes.filter((n) => visibleIds.has(n.id));
    const edges: Edge[] = data.edges
      .filter((e) => e.createdAt <= cutoff && visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        style: {
          stroke:
            e.kind === "concept_concept"
              ? "color-mix(in srgb, var(--text-primary) 35%, transparent 65%)"
              : "color-mix(in srgb, var(--text-faint) 30%, transparent 70%)",
          strokeWidth: e.kind === "concept_concept" ? 1.2 : 0.7,
        },
        animated: false,
      }));
    void nodeMap;
    return { nodes, edges };
  }, [data, layoutedNodes, sliderDate]);

  // Play / pause time-slider replay
  useEffect(() => {
    if (!playing || !data) return;
    const startMs = new Date(data.hubStart + "T00:00:00Z").getTime();
    const endMs = new Date(data.hubEnd + "T00:00:00Z").getTime();
    const cursorStart = sliderDate
      ? new Date(sliderDate + "T00:00:00Z").getTime()
      : startMs;
    const fromMs = cursorStart >= endMs ? startMs : cursorStart;
    const totalMs = endMs - fromMs;
    const animMs = 4500; // replay length
    if (totalMs <= 0) {
      setPlaying(false);
      return;
    }
    const startT = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startT;
      const t = Math.min(1, elapsed / animMs);
      const now = fromMs + totalMs * t;
      const iso = new Date(now).toISOString().slice(0, 10);
      setSliderDate(iso);
      if (t >= 1) {
        setPlaying(false);
        playRef.current = null;
        return;
      }
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
    return () => {
      if (playRef.current) cancelAnimationFrame(playRef.current);
      playRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  if (!loaded) return null;
  if (!data || data.nodes.length < minNodesToShow) return null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-dim)",
        borderRadius: 12,
        padding: "16px 18px 12px",
      }}
    >
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-y-2">
        <div className="flex items-baseline gap-3">
          <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>
            Constellation
          </span>
          <span className="text-caption" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{visible.nodes.length}</span>
            {" "}of {data.nodes.length} nodes visible
            {data.counts.cappedConcepts && <span style={{ color: "var(--text-faint)" }}> (top 200 concepts)</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>
            {sliderDate || data.hubEnd}
          </span>
          <button
            onClick={() => {
              if (playing) {
                setPlaying(false);
                return;
              }
              setSliderDate(data.hubStart);
              setPlaying(true);
            }}
            className="text-caption"
            style={{
              background: "var(--toggle-bg)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-dim)",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            {playing ? "Pause" : "Replay growth"}
          </button>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: 380,
          borderRadius: 10,
          overflow: "hidden",
          background: "color-mix(in srgb, var(--background) 85%, var(--surface) 15%)",
        }}
        onMouseLeave={() => setHoveredNode(null)}
      >
        <ReactFlow
          nodes={visible.nodes}
          edges={visible.edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          panOnDrag
          zoomOnScroll
          minZoom={0.4}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeMouseEnter={(_, n) => {
            const api = data.nodes.find((nn) => nn.id === n.id);
            if (api) setHoveredNode(api);
          }}
          onNodeMouseLeave={() => setHoveredNode(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="color-mix(in srgb, var(--text-faint) 18%, transparent 82%)" />
          <Controls
            showInteractive={false}
            position="bottom-right"
            style={{ background: "transparent", border: "none" }}
          />
        </ReactFlow>

        {/* Hover details overlay */}
        {hoveredNode && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              maxWidth: 320,
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 8,
              padding: "10px 12px",
              pointerEvents: "none",
              boxShadow: "0 2px 12px color-mix(in srgb, var(--background) 70%, transparent 30%)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="font-mono uppercase"
                style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}
              >
                {hoveredNode.kind}
              </span>
              <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                {hoveredNode.createdAt.slice(0, 10)}
              </span>
            </div>
            <div className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>
              {hoveredNode.label}
            </div>
            {hoveredNode.description && (
              <p className="text-caption mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
                {hoveredNode.description}
              </p>
            )}
            {hoveredNode.kind !== "doc" && (hoveredNode.occurrence || 0) > 0 && (
              <p className="text-caption mt-1" style={{ color: "var(--text-faint)" }}>
                Appears in {hoveredNode.docIds?.length || 0} docs, mentioned {hoveredNode.occurrence}x
              </p>
            )}
          </div>
        )}
      </div>

      {/* Time slider */}
      <div className="flex items-center gap-3 mt-3">
        <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)", fontSize: 10 }}>
          {data.hubStart}
        </span>
        <input
          type="range"
          min={0}
          max={1000}
          value={(() => {
            const startMs = new Date(data.hubStart + "T00:00:00Z").getTime();
            const endMs = new Date(data.hubEnd + "T00:00:00Z").getTime();
            const curMs = new Date((sliderDate || data.hubEnd) + "T00:00:00Z").getTime();
            const total = Math.max(1, endMs - startMs);
            return Math.round(((curMs - startMs) / total) * 1000);
          })()}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000;
            const startMs = new Date(data.hubStart + "T00:00:00Z").getTime();
            const endMs = new Date(data.hubEnd + "T00:00:00Z").getTime();
            const target = startMs + (endMs - startMs) * v;
            setPlaying(false);
            setSliderDate(new Date(target).toISOString().slice(0, 10));
          }}
          style={{ flex: 1, accentColor: "var(--text-primary)", cursor: "pointer" }}
        />
        <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)", fontSize: 10 }}>
          {data.hubEnd}
        </span>
      </div>
    </div>
  );
}

export default function HubConstellation(props: Props) {
  return (
    <ReactFlowProvider>
      <HubConstellationInner {...props} />
    </ReactFlowProvider>
  );
}
