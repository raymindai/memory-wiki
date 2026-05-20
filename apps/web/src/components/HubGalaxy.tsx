"use client";

// Hub Galaxy — pure SVG cosmos.
//
// Chrome (header / sidebar / detail panel / scrubber) uses mdfy CSS vars
// (--background, --surface, --border, --text-*, --accent), forced to
// dark theme. Canvas uses hand-picked hex (SVG gradient stops need
// explicit colours) inside mdfy's warm zinc + orange family.
//
// API:  GET /api/user/hub/constellation  (owner-only)

import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import Link from "next/link";
import { Play, Pause, Maximize2, ChevronLeft, FileText, ExternalLink, X, ZoomIn, ZoomOut, Expand, Minimize } from "lucide-react";
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
interface GalaxyData {
  nodes: ApiNode[];
  edges: ApiEdge[];
  clusters: ApiCluster[];
  hubStart: string;
  hubEnd: string;
  counts: { nodes: number; edges: number; clusters: number; cappedConcepts: boolean; cappedDocs: boolean };
}

interface Props {
  authHeaders: Record<string, string>;
  userEmail: string | null;
  /** Embedded mode — drop the standalone /galaxy chrome (top header,
   *  left sidebar) so this can sit inside an editor surface that
   *  already owns the page header / footer / sidebars. Controls are
   *  floated over the canvas instead. Doc/bundle links call the
   *  parent's handlers instead of opening a new tab. */
  embedded?: boolean;
  onOpenDoc?: (docId: string) => void;
  onOpenBundle?: (bundleId: string) => void;
}

const SKY = {
  bg: "#09090b",
  bgGradient:
    "radial-gradient(ellipse at 30% 18%, #1a1410 0%, #0e0a07 42%, #09090b 78%)",
  starDoc: "#fafafa",
  starConcept: "#fb923c",
  starEntity: "#ea580c",
  starTag: "#a8a29e",
};

const NEBULA_PALETTE = [
  "#fb923c", "#ffb677", "#d4a373",
  "#b08968", "#ffd5a5", "#ea580c",
];

const KIND_ORDER: Array<ApiNode["kind"]> = ["concept", "entity", "tag", "doc"];

// Growth playback — CSS-driven. Total animation window + per-element
// fade-in duration. Each element's animation-delay is interpolated from
// its createdAt across PLAY_ANIM_MS so the staggered reveal feels like
// a time-lapse of the hub forming itself.
const PLAY_ANIM_MS = 6000;
const PLAY_FADE_MS = 700;

// Fake astronomical designation, deterministic per node id.
// Only used in the detail panel now (hover tooltip dropped per feedback).
const CATALOGS = ["HD", "HIP", "NGC", "Kepler", "Gaia"];
function starDesignation(id: string): string {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  const abs = Math.abs(h);
  const cat = CATALOGS[abs % CATALOGS.length];
  const num = (abs >>> 8) % 99999;
  return `${cat}-${num}`;
}

function colourForKind(kind: ApiNode["kind"]): string {
  if (kind === "entity") return SKY.starEntity;
  if (kind === "tag") return SKY.starTag;
  if (kind === "doc") return SKY.starDoc;
  return SKY.starConcept;
}
function colourForBundle(bundleId: string | null | undefined, clusters: ApiCluster[]): string {
  if (!bundleId) return SKY.starDoc;
  const idx = clusters.findIndex((c) => c.id === bundleId);
  return idx >= 0 ? NEBULA_PALETTE[idx % NEBULA_PALETTE.length] : SKY.starDoc;
}

interface Positioned {
  id: string;
  x: number;
  y: number;
  api: ApiNode;
  size: number;
  colour: string;
  twinkleDelay: number;
}

interface NebulaBlob {
  id: string;
  x: number;
  y: number;
  radius: number;
  colour: string;
}

interface ShootingStar {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  totalLen: number;
}

const elk = new ELK();

// Deterministic small hash for scattering isolated nodes.
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

async function layoutGraph(nodes: ApiNode[], edges: ApiEdge[]): Promise<Map<string, { x: number; y: number }>> {
  const result = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "force",
      "elk.force.iterations": "200",
      "elk.spacing.nodeNode": "44",
      "elk.padding": "[top=40, left=40, bottom=40, right=40]",
      // ELK's default is to lay each connected component out separately
      // and then arrange them in rows — which is exactly the "stars in
      // a straight line" the founder spotted. Turn that off, and we
      // also scatter true isolates ourselves below.
      "elk.separateConnectedComponents": "false",
    },
    children: nodes.map((n) => ({ id: n.id, width: 24, height: 24 })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const map = new Map<string, { x: number; y: number }>();
  for (const c of result.children || []) {
    map.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
  }

  // Scatter isolated nodes (degree 0) inside the bbox of the connected
  // graph. Without this, ELK still parks them at the canvas margins
  // even with separateConnectedComponents disabled.
  const deg = new Map<string, number>();
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) || 0) + 1);
    deg.set(e.target, (deg.get(e.target) || 0) + 1);
  }
  const connectedPositions: Array<{ x: number; y: number }> = [];
  for (const id of deg.keys()) {
    const p = map.get(id);
    if (p) connectedPositions.push(p);
  }
  if (connectedPositions.length > 0) {
    const xs = connectedPositions.map((p) => p.x);
    const ys = connectedPositions.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bbW = Math.max(240, maxX - minX);
    const bbH = Math.max(240, maxY - minY);
    for (const n of nodes) {
      if ((deg.get(n.id) || 0) === 0) {
        const h1 = hashStr(n.id);
        const h2 = hashStr(n.id + "·y");
        const rx = (Math.abs(h1) % 10000) / 10000;
        const ry = (Math.abs(h2) % 10000) / 10000;
        map.set(n.id, {
          x: minX + rx * bbW,
          y: minY + ry * bbH,
        });
      }
    }
  }
  return map;
}

function GalaxyKeyframes() {
  return (
    <style>{`
      @keyframes galaxyTwinkle {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
      @keyframes galaxyFloat0 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(1.6px, -1.2px); } }
      @keyframes galaxyFloat1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-1.4px, 1.4px); } }
      @keyframes galaxyFloat2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0.8px, 1.6px); } }
      @keyframes galaxyFloat3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-1.2px, -0.8px); } }
      @keyframes galaxyNebulaDrift {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(6px, -8px); }
      }
      @keyframes galaxyPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      @keyframes galaxyHoverRipple {
        0%   { transform: scale(0.6); opacity: 0.5; }
        100% { transform: scale(2.2); opacity: 0; }
      }
      /* Star fade-in — gentler than the old burst. Tiny growing
         glow that settles into the star's normal halo. */
      @keyframes galaxyFadeIn {
        0%   { opacity: 0; transform: scale(0.6); }
        100% { opacity: 1; transform: scale(1); }
      }
      /* Opacity-only fade. Used by the Growth playback schedule on
         elements that already carry their own transform (star wrappers
         with translate, nebulae with drift) — galaxyFadeIn's CSS
         transform would override those attribute / animation transforms
         and yank the element to origin during the fade. */
      @keyframes galaxyOpacityIn {
        0%   { opacity: 0; }
        100% { opacity: 1; }
      }
      /* Star scintillation — applied to a ~20% subset of stars, very
         long period, randomised per-star phase so the sky reads as a
         field of slowly twinkling lights rather than a synchronised
         blink. Brief spike only, mostly idle. */
      @keyframes galaxyScintillate {
        0%, 92%, 100% { opacity: 1; }
        95%           { opacity: 0.35; }
        97%           { opacity: 1.2; }
      }
      @keyframes galaxyMagneticPulse {
        0%   { transform: scale(0.8); opacity: 0.8; }
        100% { transform: scale(3.6); opacity: 0; }
      }
      @keyframes galaxyShoot {
        0%   { stroke-dashoffset: 0; opacity: 0; }
        8%   { opacity: 0.9; }
        92%  { opacity: 0.7; }
        100% { stroke-dashoffset: calc(var(--shoot-len) * -1); opacity: 0; }
      }
      .galaxy-star,
      .galaxy-pulse-ring,
      .galaxy-fade-in,
      .galaxy-hover-ring { transform-box: fill-box; transform-origin: center; }

      .galaxy-range {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        height: 18px;
        cursor: pointer;
      }
      .galaxy-range::-webkit-slider-runnable-track {
        height: 2px;
        background: var(--border);
        border-radius: 1px;
      }
      .galaxy-range::-moz-range-track {
        height: 2px;
        background: var(--border);
        border-radius: 1px;
      }
      .galaxy-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        margin-top: -5px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-dim);
        border: none;
      }
      .galaxy-range::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-dim);
        border: none;
      }
    `}</style>
  );
}

// Memoized star. Stable props → React.memo's default shallow compare
// skips re-render. Stars that don't change between scrub ticks (the
// vast majority) cost nothing to reconcile. Inline JSX inside HubGalaxy
// was being re-created on every cutoff change, which is what made the
// scrub feel jerky with hundreds of nodes on screen.
type StarProps = {
  node: Positioned;
  viewK: number;
  isSelected: boolean;
  isHovered: boolean;
  isIgniting: boolean;
  // Time-cursor visibility. Toggled per scrub frame without mounting /
  // unmounting the SVG node so the twinkle / float animations don't
  // restart from t=0 every time the cursor crosses an element.
  isTimeVisible: boolean;
  dimmed: boolean;
  showLabel: boolean;
  floatEnabled: boolean;
  twinkleEnabled: boolean;
  playDelay: number | undefined;
  onSelect: (id: string) => void;
  onDoubleClick: (n: Positioned) => void;
  onHover: (id: string | null) => void;
  // Stable callback that returns true if the pointer was dragging at
  // mouseup (we should swallow the synthetic click). Using a function
  // instead of the underlying ref keeps StarProps' types narrow and
  // avoids MutableRefObject variance complaints.
  shouldSwallowClick: () => boolean;
};
const Star = memo(function Star({
  node: n,
  viewK,
  isSelected,
  isHovered,
  isIgniting,
  isTimeVisible,
  dimmed,
  showLabel,
  floatEnabled,
  twinkleEnabled,
  playDelay,
  onSelect,
  onDoubleClick,
  onHover,
  shouldSwallowClick,
}: StarProps) {
  const haloR = n.size * (isSelected ? 7 : isHovered ? 6 : 4.5);
  const coreR = n.size * (isSelected ? 1.5 : isHovered ? 1.25 : 1);
  const haloFill = n.api.kind === "doc" && n.api.bundleId
    ? `url(#halo-doc-${n.api.bundleId})`
    : `url(#halo-${n.api.kind})`;
  // Deterministic per-star animation phase, derived from the id so it's
  // stable across renders (idx-based picks would shift when the visible
  // set's ordering changes, which used to retrigger CSS animations).
  const h = hashStr(n.id) >>> 0;
  const floatIdx = h % 4;
  const period = 7 + (h % 7);
  // Scintillation — ~20% of stars get an additional slow blink. Period
  // 14-26s with a deterministic per-star phase so the sky never blinks
  // in unison. Combined inline with the twinkle animation via the
  // comma-separated shorthand.
  const scintillates = h % 5 === 0;
  const scintPeriod = 14 + (h % 13);
  const scintDelay = -((h % 100) / 100) * scintPeriod;
  return (
    <g
      transform={`translate(${n.x}, ${n.y})`}
      onClick={(e) => {
        e.stopPropagation();
        if (shouldSwallowClick()) return;
        onSelect(n.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(n);
      }}
      onMouseEnter={() => onHover(n.id)}
      onMouseLeave={() => onHover(null)}
      className={isIgniting ? "galaxy-fade-in" : undefined}
      style={{
        cursor: "pointer",
        // Three layers of visibility: time cursor (scrub), focus dim,
        // and explicit invisibility for not-yet-born elements.
        opacity: !isTimeVisible ? 0 : dimmed ? 0.05 : 1,
        pointerEvents: isTimeVisible ? undefined : "none",
        transition: "opacity 0.18s ease-out",
        ...(playDelay !== undefined ? {
          animation: `galaxyOpacityIn ${PLAY_FADE_MS}ms ease-out ${playDelay}ms both`,
        } : isIgniting ? {
          animation: "galaxyFadeIn 700ms ease-out",
        } : null),
      }}
    >
      {isHovered && (
        <circle
          r={haloR}
          fill="none"
          stroke={n.colour}
          strokeWidth={0.45 / Math.max(0.5, viewK)}
          strokeOpacity={0.55}
          className="galaxy-hover-ring"
          style={{ animation: "galaxyHoverRipple 1.4s ease-out infinite", pointerEvents: "none" }}
        />
      )}
      <g
        className="galaxy-star"
        style={floatEnabled ? {
          animation: `galaxyFloat${floatIdx} ${period}s ease-in-out -${n.twinkleDelay * 1.2}s infinite`,
        } : undefined}
      >
        <circle
          r={haloR}
          fill={haloFill}
          style={twinkleEnabled ? {
            animation: scintillates
              ? `galaxyTwinkle ${5 + (n.twinkleDelay % 4)}s ease-in-out -${n.twinkleDelay}s infinite, galaxyScintillate ${scintPeriod}s linear ${scintDelay}s infinite`
              : `galaxyTwinkle ${5 + (n.twinkleDelay % 4)}s ease-in-out -${n.twinkleDelay}s infinite`,
          } : undefined}
        />
        <circle
          r={coreR}
          fill="#fafafa"
          filter={isSelected || isHovered ? "url(#glow-core-strong)" : "url(#glow-core)"}
          style={isSelected ? {
            animation: `galaxyPulse 2.4s ease-in-out infinite`,
            transformBox: "fill-box",
            transformOrigin: "center",
          } : undefined}
        />
      </g>
      {showLabel && (
        <text
          y={haloR + 10}
          textAnchor="middle"
          style={{
            fontSize: 10 / Math.max(0.6, viewK * 0.7),
            fill: "#fafafa",
            fontFamily: "ui-monospace, 'JetBrains Mono', 'Fira Code', monospace",
            letterSpacing: 0.3,
            pointerEvents: "none",
            paintOrder: "stroke",
            stroke: "rgba(9, 9, 11, 0.85)",
            strokeWidth: 3 / Math.max(0.6, viewK * 0.7),
            strokeLinejoin: "round",
            opacity: dimmed ? 0 : 0.9,
          }}
        >
          {n.api.label}
        </text>
      )}
    </g>
  );
});

// Memoized edge. Edges have no event handlers, so the default shallow
// compare is sufficient. The parent passes the precomputed `d`
// attribute and visual props — when none change, the path skips
// reconciliation entirely.
type EdgePathProps = {
  d: string;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  isTimeVisible: boolean;
  playDelay: number | undefined;
};
const EdgePath = memo(function EdgePath({ d, stroke, strokeOpacity, strokeWidth, isTimeVisible, playDelay }: EdgePathProps) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeOpacity={strokeOpacity}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      style={{
        opacity: isTimeVisible ? 1 : 0,
        transition: "opacity 0.18s ease-out",
        ...(playDelay !== undefined ? {
          animation: `galaxyOpacityIn ${PLAY_FADE_MS}ms ease-out ${playDelay}ms both`,
        } : null),
      }}
    />
  );
});

function GalaxyButton({
  active,
  onClick,
  children,
  title,
  primary,
  floating,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  primary?: boolean;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="text-caption font-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 10px",
        background: primary
          ? "var(--accent-dim)"
          : active
            ? "var(--toggle-bg)"
            : floating ? "rgba(9, 9, 11, 0.6)" : "transparent",
        color: primary || active ? "var(--accent)" : "var(--text-secondary)",
        border: "1px solid",
        borderColor: primary || active ? "var(--accent-dim)" : "var(--border)",
        borderRadius: 6,
        cursor: "pointer",
        letterSpacing: 0.3,
        transition: "background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)",
        backdropFilter: floating ? "blur(8px)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export default function HubGalaxy({ authHeaders, userEmail, embedded, onOpenDoc, onOpenBundle }: Props) {
  const [data, setData] = useState<GalaxyData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [sliderDate, setSliderDate] = useState<string>("");
  const [playing, setPlaying] = useState(false);
  // CSS-driven Growth playback: when non-null, every star/edge/nebula
  // in this map renders with a baked-in `animation-delay` for fade-in.
  // No per-frame React state updates required during play.
  const [playSchedule, setPlaySchedule] = useState<Map<string, number> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredBundleId, setHoveredBundleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pulseId, setPulseId] = useState(0);
  const [igniteEntries, setIgniteEntries] = useState<Map<string, number>>(new Map());
  const [shooters, setShooters] = useState<ShootingStar[]>([]);
  const [visibleKinds, setVisibleKinds] = useState<Set<ApiNode["kind"]>>(
    () => new Set(KIND_ORDER),
  );
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const playRef = useRef<number | null>(null);
  // Refs for direct-DOM updates of the timeline cursor + slider thumb
  // during CSS-driven playback (avoids re-rendering React on the rAF
  // tick — and keeps the native range input's thumb in lockstep with
  // the floating cursor label so they don't drift apart visually).
  const cursorLabelRef = useRef<HTMLSpanElement>(null);
  const cursorThumbRef = useRef<HTMLSpanElement>(null);
  const sliderInputRef = useRef<HTMLInputElement>(null);
  // rAF-coalesce scrub events so a fast drag doesn't trigger one full
  // SVG reconcile per native onChange (browsers can fire these faster
  // than the display refresh on trackpads). We capture the latest
  // fractional value in a ref and flush it once per frame.
  const scrubPendingRef = useRef<number | null>(null);
  const scrubRafIdRef = useRef<number | null>(null);
  const cameraAnimRef = useRef<number | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const prevVisibleIdsRef = useRef<Set<string>>(new Set());
  // Auto-play guard — first load triggers Growth playback once positions
  // are ready. Subsequent state changes (search, filter, scrub) must not
  // re-trigger it; the user can replay via the Growth button.
  const autoPlayedRef = useRef(false);
  // Pan throttle — coalesce many mousemoves into one setView per frame.
  const pendingViewRef = useRef<{ x: number; y: number } | null>(null);
  const moveRafRef = useRef<number | null>(null);
  // Hover throttle — collapse rapid hover changes to one per frame.
  const pendingHoverRef = useRef<{ id: string | null } | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/hub/constellation", { headers: authHeaders });
        if (!res.ok) {
          if (!cancelled) {
            setError(res.status === 401 ? "auth" : "fetch");
            setLoaded(true);
          }
          return;
        }
        const json = (await res.json()) as GalaxyData;
        if (cancelled) return;
        setData(json);
        // Start the cursor parked at hubStart (empty canvas) so the
        // initial render doesn't flash the fully-formed galaxy before
        // auto-play kicks in. Auto-play then keeps it at hubStart and
        // CSS schedules the staggered fade-in; on play end the cursor
        // snaps to endMs so everything stays visible thereafter.
        setSliderDate(new Date(json.hubStart + "T00:00:00Z").toISOString());
        setLoaded(true);
      } catch {
        if (!cancelled) {
          setError("fetch");
          setLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-play once layout is ready — the time-lapse is the most
  // legible way to introduce the hub on first view (a fully-formed
  // dense galaxy doesn't communicate "this is YOUR hub growing").
  useEffect(() => {
    if (autoPlayedRef.current) return;
    if (!data || !positions || data.nodes.length === 0) return;
    autoPlayedRef.current = true;
    // Inline the startMs — `hubBounds` is declared later in this file,
    // and pulling it into the dep array trips a TDZ ReferenceError at
    // mount time. The auto-play effect only needs the start anchor.
    const startMs = new Date(data.hubStart + "T00:00:00Z").getTime();
    // Small defer so the first paint completes before kicking off the
    // staggered fade-in — otherwise the play start coincides with the
    // initial mount + layout-fit and can feel laggy.
    const t = setTimeout(() => {
      // Park cursor at hubStart in the same batched update so the
      // timeline thumb starts at the left, not the right.
      setSliderDate(new Date(startMs).toISOString());
      setPlaying(true);
    }, 120);
    return () => clearTimeout(t);
  }, [data, positions]);

  // Layout once
  useEffect(() => {
    if (!data || data.nodes.length === 0) return;
    let cancelled = false;
    (async () => {
      const pos = await layoutGraph(data.nodes, data.edges);
      if (!cancelled) setPositions(pos);
    })();
    return () => { cancelled = true; };
  }, [data]);

  // Container size
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [loaded]);

  const all = useMemo<Positioned[]>(() => {
    if (!data || !positions) return [];
    return data.nodes.map((n, idx) => {
      const p = positions.get(n.id) || { x: 0, y: 0 };
      const colour = n.kind === "doc"
        ? colourForBundle(n.bundleId, data.clusters)
        : colourForKind(n.kind);
      const occ = n.occurrence || 1;
      const size = n.kind === "doc"
        ? 2.6
        : Math.max(1.6, Math.min(9, Math.sqrt(occ) * 1.8));
      return {
        id: n.id,
        x: p.x,
        y: p.y,
        api: n,
        size,
        colour,
        twinkleDelay: (idx * 0.37) % 6,
      };
    });
  }, [data, positions]);

  // Compute a focal bounding box that ignores outlier stars (5/95
  // percentile per axis). Centering on the raw bbox pulled the camera
  // toward isolated faraway stars; the trimmed bbox lands naturally on
  // the densest cluster of points while still fitting most of the
  // graph in view. Falls back to raw bbox when there aren't enough
  // nodes for percentile trimming to be meaningful.
  const computeFocalBox = useCallback((points: { x: number; y: number }[]) => {
    if (points.length === 0) return null;
    if (points.length < 20) {
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    }
    const xs = points.map((p) => p.x).sort((a, b) => a - b);
    const ys = points.map((p) => p.y).sort((a, b) => a - b);
    const lo = Math.floor(xs.length * 0.05);
    const hi = Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1);
    return {
      minX: xs[lo],
      maxX: xs[hi],
      minY: ys[lo],
      maxY: ys[hi],
    };
  }, []);

  const didFitRef = useRef(false);
  useEffect(() => {
    if (didFitRef.current) return;
    if (all.length === 0 || size.w === 0 || size.h === 0) return;
    const box = computeFocalBox(all);
    if (!box) return;
    const bbW = Math.max(1, box.maxX - box.minX);
    const bbH = Math.max(1, box.maxY - box.minY);
    const margin = 80;
    const k = Math.min((size.w - margin * 2) / bbW, (size.h - margin * 2) / bbH);
    const clampedK = Math.max(0.2, Math.min(3, k));
    const x = size.w / 2 - (box.minX + bbW / 2) * clampedK;
    const y = size.h / 2 - (box.minY + bbH / 2) * clampedK;
    setView({ x, y, k: clampedK });
    didFitRef.current = true;
  }, [all, size, computeFocalBox]);

  const apiMap = useMemo(() => {
    const m = new Map<string, ApiNode>();
    for (const n of data?.nodes || []) m.set(n.id, n);
    return m;
  }, [data]);

  // Bundle-hover focus set — when hovering a Nebula row in the sidebar,
  // the bundle's docs + every concept/entity/tag mentioned in any of
  // those docs counts as "in focus." Everything else dims.
  const bundleFocusIds = useMemo<Set<string>>(() => {
    if (!hoveredBundleId || !data) return new Set();
    const docNodeIds = new Set<string>();
    const rawDocIds = new Set<string>();
    for (const n of data.nodes) {
      if (n.kind === "doc" && n.bundleId === hoveredBundleId) {
        docNodeIds.add(n.id);
        rawDocIds.add(n.id.startsWith("doc:") ? n.id.slice(4) : n.id);
      }
    }
    const out = new Set<string>(docNodeIds);
    for (const n of data.nodes) {
      if (n.kind === "doc") continue;
      if (n.docIds && n.docIds.some((did) => rawDocIds.has(did))) {
        out.add(n.id);
      }
    }
    return out;
  }, [hoveredBundleId, data]);

  // `visible` no longer depends on the time cursor — that filter moved
  // to a per-element `isTimeVisible` prop so scrubbing doesn't mount /
  // unmount hundreds of SVG nodes per frame (the actual cause of the
  // scrub jank — each remount also restarts the CSS twinkle / float
  // animations). Kind / search / focus filters stay here because
  // toggling them is a discrete user action; momentary mount cost is
  // fine in that case.
  const visible = useMemo(() => {
    if (!data) return { nodes: [] as Positioned[], edges: [] as ApiEdge[], neighbours: new Set<string>(), hoverNeighbours: new Set<string>() };
    const term = searchTerm.trim().toLowerCase();
    const visibleIds = new Set<string>();
    for (const n of data.nodes) {
      if (!visibleKinds.has(n.kind)) continue;
      visibleIds.add(n.id);
    }
    const neighbours = new Set<string>();
    if (selectedId && visibleIds.has(selectedId)) {
      for (const e of data.edges) {
        if (e.source === selectedId && visibleIds.has(e.target)) neighbours.add(e.target);
        if (e.target === selectedId && visibleIds.has(e.source)) neighbours.add(e.source);
      }
    }
    const hoverNeighbours = new Set<string>();
    if (hoveredId && hoveredId !== selectedId && visibleIds.has(hoveredId)) {
      for (const e of data.edges) {
        if (e.source === hoveredId && visibleIds.has(e.target)) hoverNeighbours.add(e.target);
        if (e.target === hoveredId && visibleIds.has(e.source)) hoverNeighbours.add(e.source);
      }
    }
    const nodes = all.filter((n) =>
      visibleIds.has(n.id) &&
      (!term || n.api.label.toLowerCase().includes(term) || selectedId === n.id || neighbours.has(n.id) || hoveredId === n.id || hoverNeighbours.has(n.id)),
    );
    const renderedIds = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter(
      (e) => renderedIds.has(e.source) && renderedIds.has(e.target),
    );
    return { nodes, edges, neighbours, hoverNeighbours };
  }, [data, all, visibleKinds, searchTerm, selectedId, hoveredId]);

  // Hub time bounds. Asymmetric on purpose:
  //  - startMs is midnight UTC of hubStart so scrubbing to the very
  //    left empties the canvas ("Day 0 of the hub").
  //  - endMs is end-of-day of hubEnd so scrubbing / playing to the
  //    very right includes everything created today after midnight.
  //    Without this, the post-play frame snaps and re-hides any
  //    element with createdAt > hubEnd midnight UTC.
  const hubBounds = useMemo(() => {
    if (!data) return null;
    return {
      startMs: new Date(data.hubStart + "T00:00:00Z").getTime(),
      endMs: new Date(data.hubEnd + "T23:59:59.999Z").getTime(),
    };
  }, [data]);

  // Cutoff in ms — read per render to compute each element's isTimeVisible.
  const cutoffMs = useMemo(() => {
    if (!hubBounds || !data) return Number.POSITIVE_INFINITY;
    if (!sliderDate) return hubBounds.endMs;
    if (sliderDate.length >= 19) return new Date(sliderDate).getTime();
    // Day-form string — hubEnd resolves to end-of-day so "today is
    // fully visible"; any other day resolves to start-of-day so
    // scrubbing back to hubStart still empties the canvas.
    if (sliderDate === data.hubEnd) return hubBounds.endMs;
    return new Date(sliderDate + "T00:00:00Z").getTime();
  }, [hubBounds, sliderDate, data]);

  // Stable lookup tables for createdAt (ms). One-time cost per data fetch.
  const nodeMs = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const n of data.nodes) m.set(n.id, new Date(n.createdAt).getTime());
    return m;
  }, [data]);
  const edgeMs = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const e of data.edges) m.set(e.id, new Date(e.createdAt).getTime());
    return m;
  }, [data]);
  const clusterMs = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const c of data.clusters) m.set(c.id, new Date(c.createdAt).getTime());
    return m;
  }, [data]);

  // Counts for the sidebar — visible-set elements that are also past
  // the time cursor. Lightweight per-scrub recomputation (single pass).
  const timeVisibleCounts = useMemo(() => {
    let nodes = 0;
    for (const n of visible.nodes) if ((nodeMs.get(n.id) ?? 0) <= cutoffMs) nodes++;
    let edges = 0;
    for (const e of visible.edges) if ((edgeMs.get(e.id) ?? 0) <= cutoffMs) edges++;
    return { nodes, edges };
  }, [visible.nodes, visible.edges, nodeMs, edgeMs, cutoffMs]);

  // Nebulae — stable centroid based on the bundle's full member set.
  // (Previously recomputed against time-visible members on every scrub
  // tick, which caused the centroid to jump + the drift animation to
  // restart each frame. Per-element opacity now toggles via clusterMs.)
  const nebulae = useMemo<NebulaBlob[]>(() => {
    if (!data || all.length === 0) return [];
    const byBundle = new Map<string, Positioned[]>();
    for (const n of all) {
      if (n.api.kind !== "doc" || !n.api.bundleId) continue;
      const arr = byBundle.get(n.api.bundleId) || [];
      arr.push(n);
      byBundle.set(n.api.bundleId, arr);
    }
    const out: NebulaBlob[] = [];
    data.clusters.forEach((c, idx) => {
      const members = byBundle.get(c.id);
      if (!members || members.length === 0) return;
      const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
      const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
      let maxDist = 0;
      for (const m of members) {
        const d = Math.hypot(m.x - cx, m.y - cy);
        if (d > maxDist) maxDist = d;
      }
      const radius = Math.max(60, Math.min(340, maxDist * 1.35 + 60));
      out.push({
        id: c.id,
        x: cx,
        y: cy,
        radius,
        colour: NEBULA_PALETTE[idx % NEBULA_PALETTE.length],
      });
    });
    return out;
  }, [data, all]);

  // Replay — CSS-driven. We compute a per-element animation-delay map
  // once at play start, expand the visible set to cover the whole hub,
  // and let the browser compositor handle the staggered fade-in at native
  // 60fps. No per-frame React state updates touch the SVG tree, which is
  // the only way to keep playback smooth with hundreds of stars and
  // edges. The timeline cursor label is updated via refs so its rAF
  // doesn't trigger React renders either.
  useEffect(() => {
    if (!playing || !data || !hubBounds) return;
    const { startMs, endMs } = hubBounds;
    const totalMs = endMs - startMs;
    if (totalMs <= 0) { setPlaying(false); return; }

    const schedule = new Map<string, number>();
    const addDelay = (id: string, createdAt: string | undefined) => {
      if (!createdAt) return;
      const t = new Date(createdAt).getTime();
      // Elements that pre-date the play start window simply stay where
      // they are; only future-of-cursor elements get fade-in delays.
      if (t <= startMs) return;
      schedule.set(
        id,
        Math.min(PLAY_ANIM_MS - 1, ((t - startMs) / totalMs) * PLAY_ANIM_MS),
      );
    };
    for (const n of data.nodes) addDelay(n.id, n.createdAt);
    for (const e of data.edges) addDelay(e.id, e.createdAt);
    for (const c of data.clusters) addDelay(c.id, c.createdAt);

    // Park the React cursor at hubStart so the slider thumb + floating
    // cursor render at the LEFT edge immediately. (Previously parked at
    // hubEnd so the thumb flashed at the right end for one frame before
    // the rAF moved it.) The CSS schedule overrides element opacity
    // during play, so React's isTimeVisible=false doesn't cause a flash.
    setSliderDate(new Date(startMs).toISOString());
    setPlaySchedule(schedule);

    // Live timeline cursor — DOM-direct, no React re-render. Also drives
    // the native range input's thumb so it tracks the floating cursor
    // (without this, the thumb stays at the right end because sliderDate
    // is pinned to hubEnd while CSS handles the staggered reveal).
    const startT = performance.now();
    const tickLabel = () => {
      const elapsed = performance.now() - startT;
      const t = Math.min(1, elapsed / PLAY_ANIM_MS);
      const cur = new Date(startMs + totalMs * t).toISOString().slice(0, 10);
      if (cursorLabelRef.current) cursorLabelRef.current.textContent = cur;
      if (cursorThumbRef.current) cursorThumbRef.current.style.left = `${Math.max(8, Math.min(92, t * 100))}%`;
      if (sliderInputRef.current) sliderInputRef.current.value = String(Math.round(t * 1000));
      if (t < 1) playRef.current = requestAnimationFrame(tickLabel);
    };
    playRef.current = requestAnimationFrame(tickLabel);

    const stopTimer = setTimeout(() => {
      // Snap React's cursor to the inclusive end so isTimeVisible
      // matches the schedule's final opacity-1 state for every element.
      // Without this the post-play frame would re-hide anything created
      // today after midnight UTC, producing a visible jump.
      setSliderDate(new Date(endMs).toISOString());
      setPlaying(false);
      setPlaySchedule(null);
    }, PLAY_ANIM_MS + PLAY_FADE_MS + 100);

    return () => {
      if (playRef.current) cancelAnimationFrame(playRef.current);
      playRef.current = null;
      clearTimeout(stopTimer);
      setPlaySchedule(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hubBounds]);

  // Auto-clear stale focus state when scrubbing leaves the target
  // node behind. Without this, focusing mode stays on, the focusSet
  // contains ids of nodes that aren't being rendered, lit edges draw
  // toward invisible endpoints, and the canvas reads as broken.
  useEffect(() => {
    const renderedSet = new Set(visible.nodes.map((n) => n.id));
    if (selectedId && !renderedSet.has(selectedId)) setSelectedId(null);
    if (hoveredId && !renderedSet.has(hoveredId)) setHoveredId(null);
    if (hoveredBundleId) {
      // Clear bundle hover if NO members of the bundle are currently
      // visible — otherwise the bundleFocusIds is keeping focusing=true
      // with ids that don't exist on the canvas.
      const stillHasMember = visible.nodes.some(
        (n) => n.api.kind === "doc" && n.api.bundleId === hoveredBundleId,
      );
      if (!stillHasMember) setHoveredBundleId(null);
    }
  }, [visible.nodes, selectedId, hoveredId, hoveredBundleId]);

  // Ignite tracker — used to fade-in stars that newly enter the visible
  // set. Skipped while a CSS-driven play schedule is active (the schedule
  // handles fade-in via animation-delay, so duplicating here would cause
  // double-anim and re-renders).
  useEffect(() => {
    const currentIds = new Set(visible.nodes.map((n) => n.id));
    if (playing && !playSchedule) {
      const prev = prevVisibleIdsRef.current;
      const newOnes: string[] = [];
      for (const id of currentIds) if (!prev.has(id)) newOnes.push(id);
      if (newOnes.length > 0) {
        const expiresAt = performance.now() + 900;
        setIgniteEntries((m) => {
          const next = new Map(m);
          for (const id of newOnes) next.set(id, expiresAt);
          return next;
        });
        for (const id of newOnes) {
          setTimeout(() => {
            setIgniteEntries((m) => {
              if (!m.has(id)) return m;
              const next = new Map(m);
              next.delete(id);
              return next;
            });
          }, 950);
        }
      }
    }
    prevVisibleIdsRef.current = currentIds;
  }, [visible.nodes, playing]);

  useEffect(() => {
    if (searchTerm.trim().length > 0) setPulseId((p) => p + 1);
  }, [searchTerm]);

  // Shooting stars — only from top / right / left edges, always
  // travelling downward. Bottom-up streaks looked unnatural per
  // founder feedback. Smaller and more delicate stroke too.
  useEffect(() => {
    if (size.w === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const spawn = () => {
      if (cancelled) return;
      const fromEdge = Math.floor(Math.random() * 3); // 0=top 1=right 2=left
      let fromX = 0, fromY = 0, toX = 0, toY = 0;
      if (fromEdge === 0) {
        // Top → angled down. Trail mostly stays inside the canvas.
        fromX = Math.random() * size.w;
        fromY = -20;
        const driftX = (Math.random() - 0.5) * size.w * 0.5;
        toX = Math.max(-20, Math.min(size.w + 20, fromX + driftX));
        toY = size.h * 0.55 + Math.random() * size.h * 0.35;
      } else if (fromEdge === 1) {
        // Right → angled down-left.
        fromX = size.w + 20;
        fromY = -20 + Math.random() * size.h * 0.35;
        toX = size.w * 0.15 + Math.random() * size.w * 0.45;
        toY = fromY + size.h * 0.45 + Math.random() * size.h * 0.2;
      } else {
        // Left → angled down-right.
        fromX = -20;
        fromY = -20 + Math.random() * size.h * 0.35;
        toX = size.w * 0.4 + Math.random() * size.w * 0.45;
        toY = fromY + size.h * 0.45 + Math.random() * size.h * 0.2;
      }
      const dx = toX - fromX, dy = toY - fromY;
      const totalLen = Math.sqrt(dx * dx + dy * dy);
      const id = `shoot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setShooters((s) => [...s, { id, fromX, fromY, toX, toY, totalLen }]);
      setTimeout(() => {
        setShooters((s) => s.filter((x) => x.id !== id));
      }, 1500);
      timer = setTimeout(spawn, 8000 + Math.random() * 9000);
    };
    timer = setTimeout(spawn, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [size.w, size.h]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      viewX: viewRef.current.x,
      viewY: viewRef.current.y,
      moved: false,
    };
  }, []);
  // RAF-throttled pan. Two things matter here:
  //  1) Capture viewX/viewY into LOCALS before setView. If we read
  //     dragRef.current inside the updater closure, mouseup may have
  //     fired between the early-return check and the setter being
  //     invoked, leaving dragRef null and crashing with
  //     "cannot read properties of null (reading 'viewX')".
  //  2) Coalesce multiple mousemoves into one setView per frame so
  //     the SVG tree (200+ stars) doesn't re-render at the OS event
  //     rate (which can be 1000+ Hz on high-end mice).
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const ref = dragRef.current;
    if (!ref) return;
    const dx = e.clientX - ref.startX;
    const dy = e.clientY - ref.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) ref.moved = true;
    const nextX = ref.viewX + dx;
    const nextY = ref.viewY + dy;
    pendingViewRef.current = { x: nextX, y: nextY };
    if (moveRafRef.current !== null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const p = pendingViewRef.current;
      pendingViewRef.current = null;
      if (!p) return;
      setView((v) => ({ ...v, x: p.x, y: p.y }));
    });
  }, []);
  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Escape clears all focus state (and search) — gives users a one-key
  // bail-out when the canvas gets too lit-up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        setHoveredId(null);
        setHoveredBundleId(null);
        setSearchTerm("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // RAF-throttled hover — onMouseEnter / Leave can fire many times
  // per frame as the cursor crosses adjacent SVG hit areas. Without
  // this, every micro-movement triggers a full SVG re-render.
  const queueHover = useCallback((id: string | null) => {
    pendingHoverRef.current = { id };
    if (hoverRafRef.current !== null) return;
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      const p = pendingHoverRef.current;
      pendingHoverRef.current = null;
      if (!p) return;
      setHoveredId((h) => (h === p.id ? h : p.id));
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      e.preventDefault();
      setView((v) => {
        const delta = -e.deltaY * 0.0014;
        const newK = Math.max(0.2, Math.min(4, v.k * (1 + delta)));
        const x = mx - (mx - v.x) * (newK / v.k);
        const y = my - (my - v.y) * (newK / v.k);
        return { x, y, k: newK };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loaded, error, data]);

  const animateViewTo = useCallback((targetX: number, targetY: number, targetK: number, durationMs = 450) => {
    if (cameraAnimRef.current) cancelAnimationFrame(cameraAnimRef.current);
    const fromX = viewRef.current.x;
    const fromY = viewRef.current.y;
    const fromK = viewRef.current.k;
    const startT = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - startT) / durationMs);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setView({
        x: fromX + (targetX - fromX) * e,
        y: fromY + (targetY - fromY) * e,
        k: fromK + (targetK - fromK) * e,
      });
      if (t < 1) cameraAnimRef.current = requestAnimationFrame(tick);
      else cameraAnimRef.current = null;
    };
    cameraAnimRef.current = requestAnimationFrame(tick);
  }, []);

  const handleRecentre = useCallback(() => {
    if (visible.nodes.length === 0 || size.w === 0) return;
    const box = computeFocalBox(visible.nodes);
    if (!box) return;
    const bbW = Math.max(1, box.maxX - box.minX);
    const bbH = Math.max(1, box.maxY - box.minY);
    const margin = 80;
    const k = Math.min((size.w - margin * 2) / bbW, (size.h - margin * 2) / bbH);
    const clampedK = Math.max(0.2, Math.min(3, k));
    const x = size.w / 2 - (box.minX + bbW / 2) * clampedK;
    const y = size.h / 2 - (box.minY + bbH / 2) * clampedK;
    animateViewTo(x, y, clampedK);
  }, [visible.nodes, size, animateViewTo, computeFocalBox]);

  const handleStarDoubleClick = useCallback((n: Positioned) => {
    const targetK = Math.max(viewRef.current.k, 1.6);
    const targetX = size.w / 2 - n.x * targetK;
    const targetY = size.h / 2 - n.y * targetK;
    animateViewTo(targetX, targetY, targetK, 520);
    setSelectedId(n.id);
  }, [size, animateViewTo]);

  // Stable click handler — id arg form lets <Star memo> hold a reference
  // identity across scrub frames so its prop check passes.
  const handleStarSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);
  const shouldSwallowStarClick = useCallback(() => {
    return !!dragRef.current?.moved;
  }, []);

  // Zoom buttons — anchor on viewport centre so the focal point of the
  // current layout stays put while scale changes.
  const handleZoom = useCallback((factor: number) => {
    const cur = viewRef.current;
    const newK = Math.max(0.2, Math.min(3, cur.k * factor));
    if (Math.abs(newK - cur.k) < 0.001) return;
    const cx = size.w / 2;
    const cy = size.h / 2;
    const wx = (cx - cur.x) / cur.k;
    const wy = (cy - cur.y) / cur.k;
    animateViewTo(cx - wx * newK, cy - wy * newK, newK, 180);
  }, [size, animateViewTo]);

  // Fullscreen — request on the page container so the SVG plus header /
  // sidebar / scrubber all stay in view.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  const selected = selectedId ? apiMap.get(selectedId) : null;
  const linkedDocs = useMemo(() => {
    if (!selected || !data) return [];
    if (selected.kind === "doc") return [];
    return (selected.docIds || [])
      .map((id) => apiMap.get(`doc:${id}`))
      .filter((n): n is ApiNode => !!n)
      .slice(0, 12);
  }, [selected, data, apiMap]);

  const sliderPct = useMemo(() => {
    if (!hubBounds) return 0;
    const { startMs, endMs } = hubBounds;
    const total = Math.max(1, endMs - startMs);
    return Math.max(0, Math.min(1, (cutoffMs - startMs) / total));
  }, [hubBounds, cutoffMs]);

  // Display date — sliderDate may carry sub-day precision during Growth
  // playback, so always slice to YYYY-MM-DD for the UI chrome.
  const displayDate = sliderDate ? sliderDate.slice(0, 10) : "";

  const cosmosWrap: React.CSSProperties = {
    height: "100vh",
    background: SKY.bg,
    backgroundImage: SKY.bgGradient,
    color: "var(--text-primary)",
    position: "relative",
    overflow: "hidden",
  };

  if (!loaded) {
    return (
      <div data-theme="dark" style={{ ...cosmosWrap, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GalaxyKeyframes />
        <span className="text-caption font-mono uppercase" style={{ letterSpacing: 1.5, color: "var(--text-muted)" }}>
          Locating your galaxy…
        </span>
      </div>
    );
  }
  if (error === "auth") {
    return (
      <div data-theme="dark" style={{ ...cosmosWrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <GalaxyKeyframes />
        <p className="text-body" style={{ color: "var(--text-secondary)" }}>Sign in to see your galaxy.</p>
        <Link
          href="/"
          className="text-caption font-mono"
          style={{ background: "var(--accent)", color: "var(--background)", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, letterSpacing: 0.3 }}
        >
          Go to mdfy.app
        </Link>
      </div>
    );
  }
  if (!data || data.nodes.length === 0) {
    return (
      <div data-theme="dark" style={{ ...cosmosWrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <GalaxyKeyframes />
        <p className="text-body" style={{ color: "var(--text-secondary)", maxWidth: 360, textAlign: "center", lineHeight: 1.6 }}>
          Your galaxy is empty so far. Capture a few docs and let analysis run — concepts and connections will appear here as stars.
        </p>
        <Link
          href="/"
          className="text-caption font-mono"
          style={{ background: "var(--accent)", color: "var(--background)", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, letterSpacing: 0.3 }}
        >
          Back to editor
        </Link>
      </div>
    );
  }

  const searchActive = searchTerm.trim().length > 0;
  const term = searchTerm.trim().toLowerCase();
  const matchedNodes = searchActive
    ? visible.nodes.filter((n) => n.api.label.toLowerCase().includes(term))
    : [];

  // Single focus set — anything in here is "lit"; everything else is
  // dim. Edges with both endpoints in this set are rendered, others
  // are skipped entirely (no more ghost lines).
  const focusing = selectedId !== null || hoveredId !== null || searchActive || hoveredBundleId !== null;
  const focusSet = new Set<string>();
  if (selectedId) {
    focusSet.add(selectedId);
    for (const id of visible.neighbours) focusSet.add(id);
  }
  if (hoveredId && hoveredId !== selectedId) {
    focusSet.add(hoveredId);
    for (const id of visible.hoverNeighbours) focusSet.add(id);
  }
  if (searchActive) {
    for (const n of matchedNodes) focusSet.add(n.id);
  }
  if (hoveredBundleId) {
    for (const id of bundleFocusIds) focusSet.add(id);
  }

  // Set of bundle ids that are "in focus" — used to dim nebulae that
  // aren't part of the current focus. Without this, nebulae stayed at
  // full opacity when a star was selected, fighting visually with the
  // lit constellation.
  const focusedBundleIds = new Set<string>();
  if (hoveredBundleId) focusedBundleIds.add(hoveredBundleId);
  function bundlesForNodeId(id: string | null) {
    if (!id || !data) return;
    const node = apiMap.get(id);
    if (!node) return;
    if (node.kind === "doc" && node.bundleId) focusedBundleIds.add(node.bundleId);
    if (node.kind !== "doc" && node.docIds) {
      const docIdSet = new Set(node.docIds);
      for (const m of data.nodes) {
        if (m.kind !== "doc" || !m.bundleId) continue;
        const raw = m.id.startsWith("doc:") ? m.id.slice(4) : m.id;
        if (docIdSet.has(raw)) focusedBundleIds.add(m.bundleId);
      }
    }
  }
  bundlesForNodeId(selectedId);
  bundlesForNodeId(hoveredId);

  return (
    <div
      data-theme="dark"
      style={{
        height: embedded ? "100%" : "100vh",
        display: "flex",
        flexDirection: "column",
        background: SKY.bg,
        backgroundImage: SKY.bgGradient,
        color: "var(--text-primary)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <GalaxyKeyframes />

      {!embedded && <header
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          borderBottom: "1px solid var(--border-dim)",
          gap: 14,
          flexShrink: 0,
          background: "var(--header-bg)",
          backdropFilter: "blur(12px)",
          zIndex: 3,
        }}
      >
        <Link
          href="/"
          className="text-caption"
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          title="Back to editor"
        >
          <ChevronLeft width={14} height={14} />
          Back
        </Link>

        <span style={{ width: 1, height: 14, background: "var(--border-dim)" }} />

        <span
          className="text-caption font-mono uppercase"
          style={{ color: "var(--text-primary)", letterSpacing: 1.8, fontWeight: 600 }}
        >
          Galaxy
        </span>

        {userEmail && (
          <span
            className="text-caption font-mono"
            style={{
              color: "var(--text-secondary)",
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              padding: "2px 8px",
              borderRadius: 999,
              letterSpacing: 0.3,
            }}
            title={`Signed in as ${userEmail}`}
          >
            {userEmail}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {/* Stats — three discrete counts, mono, faint. */}
        <div
          className="text-caption font-mono"
          style={{
            color: "var(--text-faint)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            letterSpacing: 0.3,
          }}
        >
          <span>
            <span style={{ color: "var(--text-secondary)" }}>{data.counts.nodes}</span>
            {" stars"}
          </span>
          <span>
            <span style={{ color: "var(--text-secondary)" }}>{data.clusters.length}</span>
            {" nebulae"}
          </span>
          <span>
            <span style={{ color: "var(--text-secondary)" }}>{data.counts.edges}</span>
            {" threads"}
          </span>
        </div>

        <span style={{ width: 1, height: 14, background: "var(--border-dim)" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <GalaxyButton onClick={() => handleZoom(1 / 1.25)} title="Zoom out">
            <ZoomOut width={11} height={11} />
          </GalaxyButton>
          <GalaxyButton onClick={() => handleZoom(1.25)} title="Zoom in">
            <ZoomIn width={11} height={11} />
          </GalaxyButton>
          <GalaxyButton onClick={handleRecentre} title="Fit galaxy to view">
            <Maximize2 width={11} height={11} />
            <span>Fit</span>
          </GalaxyButton>
          <GalaxyButton
            onClick={handleFullscreen}
            active={isFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize width={11} height={11} /> : <Expand width={11} height={11} />}
          </GalaxyButton>
        </div>
      </header>}

      <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative", zIndex: 1 }}>
        {/* Sidebar — standalone /galaxy only. Embedded mode floats the
            essential controls over the canvas instead (see overlay
            below the SVG). */}
        {!embedded && <aside
          style={{
            width: 220,
            borderRight: "1px solid var(--border-dim)",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            overflowY: "auto",
            flexShrink: 0,
            background: "color-mix(in srgb, var(--background) 70%, transparent 30%)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div>
            <label className="text-caption font-mono uppercase" style={{ color: "var(--text-faint)", display: "block", marginBottom: 6, letterSpacing: 0.5 }}>
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="filter by label"
              className="text-body font-mono"
              style={{
                width: "100%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 10px",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label className="text-caption font-mono uppercase" style={{ color: "var(--text-faint)", display: "block", marginBottom: 6, letterSpacing: 0.5 }}>
              Star kinds
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {KIND_ORDER.map((k) => {
                const active = visibleKinds.has(k);
                const c = colourForKind(k);
                return (
                  <button
                    key={k}
                    onClick={() => {
                      const next = new Set(visibleKinds);
                      if (next.has(k)) next.delete(k);
                      else next.add(k);
                      setVisibleKinds(next);
                    }}
                    className="text-caption"
                    style={{
                      background: active ? "var(--toggle-bg)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-faint)",
                      border: "1px solid var(--border-dim)",
                      borderRadius: 6,
                      padding: "5px 10px",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: `radial-gradient(circle, #fff 0%, ${c} 50%, transparent 100%)`,
                        boxShadow: active ? `0 0 6px ${c}aa` : "none",
                        opacity: active ? 1 : 0.4,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, textTransform: "capitalize" }}>{k}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {data.clusters.length > 0 && (
            <div>
              <label className="text-caption font-mono uppercase" style={{ color: "var(--text-faint)", display: "block", marginBottom: 6, letterSpacing: 0.5 }}>
                Nebulae
              </label>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 1 }}
                onMouseLeave={() => setHoveredBundleId(null)}
              >
                {data.clusters.slice(0, 8).map((c, idx) => {
                  const colour = NEBULA_PALETTE[idx % NEBULA_PALETTE.length];
                  const isHover = hoveredBundleId === c.id;
                  return (
                    <div
                      key={c.id}
                      onMouseEnter={() => setHoveredBundleId(c.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "3px 6px",
                        margin: "0 -6px",
                        cursor: "default",
                        background: isHover ? "var(--toggle-bg)" : "transparent",
                        borderRadius: 4,
                        transition: "background var(--duration-fast) var(--ease-default)",
                      }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 4,
                          borderRadius: 2,
                          background: `linear-gradient(to right, ${colour}, ${colour}33)`,
                          boxShadow: isHover ? `0 0 8px ${colour}aa` : `0 0 6px ${colour}55`,
                          flexShrink: 0,
                          transition: "box-shadow var(--duration-fast) var(--ease-default)",
                        }}
                      />
                      <span
                        className="text-caption"
                        style={{
                          color: isHover ? "var(--text-primary)" : "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={c.label}
                      >
                        {c.label}
                      </span>
                    </div>
                  );
                })}
                {data.clusters.length > 8 && (
                  <span className="text-caption font-mono" style={{ color: "var(--text-faint)", paddingTop: 2 }}>
                    +{data.clusters.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--border-dim)", paddingTop: 12, marginTop: "auto" }}>
            <p className="text-caption font-mono" style={{ color: "var(--text-muted)", lineHeight: 1.7, margin: 0, letterSpacing: 0.3 }}>
              <span style={{ color: "var(--text-primary)" }}>{timeVisibleCounts.nodes}</span>
              {" / "}
              {data.nodes.length} stars
              <br />
              <span style={{ color: "var(--text-primary)" }}>{timeVisibleCounts.edges}</span>
              {" / "}
              {data.edges.length} threads
            </p>
            {(data.counts.cappedConcepts || data.counts.cappedDocs) && (
              <p className="text-caption" style={{ color: "var(--text-faint)", marginTop: 8, lineHeight: 1.5 }}>
                Capped at top 200 concepts / 200 most-recent docs.
              </p>
            )}
            <p className="text-caption font-mono" style={{ color: "var(--text-faint)", marginTop: 10, lineHeight: 1.6, letterSpacing: 0.3 }}>
              drag to pan / scroll to zoom
              <br />
              hover to focus / dbl-click to fly
            </p>
          </div>
        </aside>}

        {/* SVG cosmos canvas */}
        <div
          ref={containerRef}
          style={{ flex: 1, minWidth: 0, position: "relative", cursor: dragRef.current ? "grabbing" : "grab" }}
        >
          {/* Embedded-mode floating chrome — drops the standalone
              header / aside in favour of two small backdrop-blurred
              widgets that sit ON the canvas so they read as part of
              the cosmos instead of a separate page chrome. */}
          {embedded && (
            <>
              {/* Top-left: search + kind filter chips. */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  zIndex: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: "color-mix(in srgb, var(--background) 70%, transparent 30%)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid var(--border-dim)",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="search stars"
                  className="text-caption font-mono"
                  style={{
                    width: 140,
                    background: "transparent",
                    border: "none",
                    color: "var(--text-primary)",
                    outline: "none",
                    padding: "2px 4px",
                  }}
                />
                <span style={{ width: 1, height: 14, background: "var(--border-dim)" }} />
                <div style={{ display: "flex", gap: 4 }}>
                  {KIND_ORDER.map((k) => {
                    const active = visibleKinds.has(k);
                    const c = colourForKind(k);
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          const next = new Set(visibleKinds);
                          if (next.has(k)) next.delete(k);
                          else next.add(k);
                          setVisibleKinds(next);
                        }}
                        title={`Show / hide ${k} stars`}
                        className="text-caption"
                        style={{
                          height: 22,
                          borderRadius: 4,
                          background: active ? "var(--toggle-bg)" : "transparent",
                          border: "1px solid var(--border-dim)",
                          padding: "0 8px 0 6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          cursor: "pointer",
                          color: active ? "var(--text-primary)" : "var(--text-faint)",
                          textTransform: "capitalize",
                          letterSpacing: 0.2,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: `radial-gradient(circle, #fff 0%, ${c} 50%, transparent 100%)`,
                            opacity: active ? 1 : 0.35,
                            flexShrink: 0,
                          }}
                        />
                        {k}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Top-right: stats + zoom/fit/fullscreen. */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  zIndex: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: "color-mix(in srgb, var(--background) 70%, transparent 30%)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid var(--border-dim)",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  className="text-caption font-mono"
                  style={{
                    color: "var(--text-faint)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    letterSpacing: 0.3,
                  }}
                >
                  <span>
                    <span style={{ color: "var(--text-secondary)" }}>{data.counts.nodes}</span>
                    {" stars"}
                  </span>
                  <span>
                    <span style={{ color: "var(--text-secondary)" }}>{data.clusters.length}</span>
                    {" nebulae"}
                  </span>
                  <span>
                    <span style={{ color: "var(--text-secondary)" }}>{data.counts.edges}</span>
                    {" threads"}
                  </span>
                </div>
                <span style={{ width: 1, height: 14, background: "var(--border-dim)" }} />
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <GalaxyButton onClick={() => handleZoom(1 / 1.25)} title="Zoom out">
                    <ZoomOut width={11} height={11} />
                  </GalaxyButton>
                  <GalaxyButton onClick={() => handleZoom(1.25)} title="Zoom in">
                    <ZoomIn width={11} height={11} />
                  </GalaxyButton>
                  <GalaxyButton onClick={handleRecentre} title="Fit galaxy to view">
                    <Maximize2 width={11} height={11} />
                  </GalaxyButton>
                  <GalaxyButton
                    onClick={handleFullscreen}
                    active={isFullscreen}
                    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {isFullscreen ? <Minimize width={11} height={11} /> : <Expand width={11} height={11} />}
                  </GalaxyButton>
                </div>
              </div>
            </>
          )}
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              // Pointer left the canvas — drop drag and any hover
              // state so the cosmos returns to its at-rest look.
              handleMouseUp();
              queueHover(null);
            }}
            onClick={(e) => {
              if (dragRef.current?.moved) return;
              if (e.target === svgRef.current) setSelectedId(null);
            }}
            style={{ display: "block" }}
          >
            <defs>
              <filter id="glow-core" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="1.4" result="b1" />
                <feMerge>
                  <feMergeNode in="b1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-core-strong" x="-300%" y="-300%" width="700%" height="700%">
                <feGaussianBlur stdDeviation="3" result="b1" />
                <feMerge>
                  <feMergeNode in="b1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="nebula-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="32" />
              </filter>
              <filter id="thread-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="b1" />
                <feMerge>
                  <feMergeNode in="b1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {(["doc", "concept", "entity", "tag"] as const).map((k) => {
                const c = colourForKind(k);
                return (
                  <radialGradient key={k} id={`halo-${k}`}>
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="20%" stopColor={c} stopOpacity="0.7" />
                    <stop offset="55%" stopColor={c} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={c} stopOpacity="0" />
                  </radialGradient>
                );
              })}
              {nebulae.map((b) => (
                <radialGradient key={`doc-${b.id}`} id={`halo-doc-${b.id}`}>
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="20%" stopColor={b.colour} stopOpacity="0.75" />
                  <stop offset="55%" stopColor={b.colour} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={b.colour} stopOpacity="0" />
                </radialGradient>
              ))}
              {nebulae.map((b) => (
                <radialGradient key={`neb-${b.id}`} id={`neb-${b.id}`}>
                  <stop offset="0%" stopColor={b.colour} stopOpacity="0.22" />
                  <stop offset="45%" stopColor={b.colour} stopOpacity="0.07" />
                  <stop offset="100%" stopColor={b.colour} stopOpacity="0" />
                </radialGradient>
              ))}
            </defs>

            {/* WORLD. Children (nebulae / edges / stars) are keyed by
                their stable ids, so React reconciles add/remove cleanly
                as the visible set changes during scrub or playback. Do
                NOT key this group on sliderDate — doing so unmounts and
                remounts the entire layer on every tick, resetting every
                CSS animation and producing visible jank. */}
            <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
              {/* Nebulae — also respect focus state. When something is
                  selected/hovered/searched, nebulae unrelated to the
                  focused node's bundle drop to a near-invisible 0.08. */}
              <g style={{ mixBlendMode: "screen" }}>
                {nebulae.map((b, idx) => {
                  const dimmed = focusing && !focusedBundleIds.has(b.id);
                  const playDelay = playSchedule?.get(b.id);
                  const isTimeVisible = (clusterMs.get(b.id) ?? 0) <= cutoffMs;
                  const driftDur = 28 + (idx % 5) * 6;
                  const driftDelay = -(idx * 3.7);
                  const animation = playDelay !== undefined
                    ? `galaxyNebulaDrift ${driftDur}s ease-in-out ${driftDelay}s infinite, galaxyOpacityIn ${PLAY_FADE_MS}ms ease-out ${playDelay}ms both`
                    : `galaxyNebulaDrift ${driftDur}s ease-in-out ${driftDelay}s infinite`;
                  // Visibility via opacity (not mount/unmount) so the
                  // drift animation never restarts mid-scrub.
                  const opacity = !isTimeVisible ? 0 : dimmed ? 0.08 : 1;
                  return (
                    <circle
                      key={b.id}
                      cx={b.x}
                      cy={b.y}
                      r={b.radius}
                      fill={`url(#neb-${b.id})`}
                      filter="url(#nebula-blur)"
                      opacity={opacity}
                      style={{
                        animation,
                        transformOrigin: `${b.x}px ${b.y}px`,
                        transition: "opacity 0.25s ease-out",
                      }}
                    />
                  );
                })}
              </g>

              {/* Edges, split into TWO conditional layers. When focus
                  flips, the wrapper <g> on one side unmounts entirely
                  — defensive against stale <path> elements ("white
                  curves that don't go away after selecting a star"). */}
              {!focusing && (
                <g key="edges-base" style={{ pointerEvents: "none" }}>
                  {visible.edges.map((e) => {
                    const a = positions?.get(e.source);
                    const b = positions?.get(e.target);
                    if (!a || !b) return null;
                    const aScreenX = view.x + a.x * view.k;
                    const aScreenY = view.y + a.y * view.k;
                    const bScreenX = view.x + b.x * view.k;
                    const bScreenY = view.y + b.y * view.k;
                    const m = 140;
                    const aOut = aScreenX < -m || aScreenX > size.w + m || aScreenY < -m || aScreenY > size.h + m;
                    const bOut = bScreenX < -m || bScreenX > size.w + m || bScreenY < -m || bScreenY > size.h + m;
                    if (aOut && bOut) return null;
                    let h = 0;
                    for (let i = 0; i < e.id.length; i++) h = ((h << 5) - h + e.id.charCodeAt(i)) | 0;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    const sign = (h & 1) ? 1 : -1;
                    const bend = Math.min(60, len * 0.18) * sign;
                    const cx = (a.x + b.x) / 2 + (-dy / len) * bend;
                    const cy = (a.y + b.y) / 2 + (dx / len) * bend;
                    const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
                    const isTimeVisible = (edgeMs.get(e.id) ?? 0) <= cutoffMs;
                    return (
                      <EdgePath
                        key={e.id}
                        d={d}
                        stroke="#fafafa"
                        strokeOpacity={e.kind === "concept_concept" ? 0.09 : 0.05}
                        strokeWidth={0.35 / Math.max(0.5, view.k * 0.7)}
                        isTimeVisible={isTimeVisible}
                        playDelay={playSchedule?.get(e.id)}
                      />
                    );
                  })}
                </g>
              )}

              {focusing && (
                <g key="edges-focused" style={{ pointerEvents: "none" }}>
                  {visible.edges
                    .filter((e) => focusSet.has(e.source) && focusSet.has(e.target))
                    .map((e) => {
                      const a = positions?.get(e.source);
                      const b = positions?.get(e.target);
                      if (!a || !b) return null;
                      const aScreenX = view.x + a.x * view.k;
                      const aScreenY = view.y + a.y * view.k;
                      const bScreenX = view.x + b.x * view.k;
                      const bScreenY = view.y + b.y * view.k;
                      const m = 140;
                      const aOut = aScreenX < -m || aScreenX > size.w + m || aScreenY < -m || aScreenY > size.h + m;
                      const bOut = bScreenX < -m || bScreenX > size.w + m || bScreenY < -m || bScreenY > size.h + m;
                      if (aOut && bOut) return null;
                      let h = 0;
                      for (let i = 0; i < e.id.length; i++) h = ((h << 5) - h + e.id.charCodeAt(i)) | 0;
                      const dx = b.x - a.x;
                      const dy = b.y - a.y;
                      const len = Math.sqrt(dx * dx + dy * dy) || 1;
                      const sign = (h & 1) ? 1 : -1;
                      const bend = Math.min(60, len * 0.18) * sign;
                      const cx = (a.x + b.x) / 2 + (-dy / len) * bend;
                      const cy = (a.y + b.y) / 2 + (dx / len) * bend;
                      const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
                      const isTimeVisible = (edgeMs.get(e.id) ?? 0) <= cutoffMs;
                      return (
                        <path
                          key={e.id}
                          d={d}
                          fill="none"
                          stroke={SKY.starConcept}
                          strokeOpacity={0.65}
                          strokeWidth={0.95 / Math.max(0.5, view.k * 0.7)}
                          strokeLinecap="round"
                          filter="url(#thread-glow)"
                          style={{
                            opacity: isTimeVisible ? 1 : 0,
                            transition: "opacity 0.18s ease-out",
                          }}
                        />
                      );
                    })}
                </g>
              )}

              {/* Magnetic pulses */}
              <g style={{ pointerEvents: "none" }}>
                {searchActive && pulseId > 0 && matchedNodes.map((n) => (
                  <circle
                    key={`pulse-${n.id}-${pulseId}`}
                    cx={n.x}
                    cy={n.y}
                    r={Math.max(8, n.size * 4)}
                    fill="none"
                    stroke={SKY.starConcept}
                    strokeOpacity={0.7}
                    strokeWidth={1.2 / Math.max(0.5, view.k)}
                    className="galaxy-pulse-ring"
                    style={{ animation: "galaxyMagneticPulse 1.4s ease-out 3" }}
                  />
                ))}
              </g>

              {/* Stars. Viewport-culled (skip anything offscreen by
                  more than a star's worth of margin) and animations
                  scoped to stars where they're actually visible —
                  ~400 simultaneous CSS animations was crushing the
                  compositor. Now only large + on-focus stars float;
                  tiny dimmed stars get nothing. */}
              <g>
                {visible.nodes.map((n) => {
                  // Viewport culling — convert world coord to screen and
                  // skip if offscreen (+ margin for halo bleed).
                  const sx = view.x + n.x * view.k;
                  const sy = view.y + n.y * view.k;
                  const cullMargin = 100;
                  if (sx < -cullMargin || sx > size.w + cullMargin) return null;
                  if (sy < -cullMargin || sy > size.h + cullMargin) return null;

                  const isSelected = n.id === selectedId;
                  const isHovered = n.id === hoveredId;
                  const dimmed = focusing && !focusSet.has(n.id);
                  const animEnabled = !dimmed && view.k >= 0.45;
                  const isTimeVisible = (nodeMs.get(n.id) ?? 0) <= cutoffMs;
                  return (
                    <Star
                      key={n.id}
                      node={n}
                      viewK={view.k}
                      isSelected={isSelected}
                      isHovered={isHovered}
                      isIgniting={igniteEntries.has(n.id)}
                      isTimeVisible={isTimeVisible}
                      dimmed={dimmed}
                      showLabel={isSelected || isHovered || (focusing && focusSet.has(n.id)) || view.k >= 1.4}
                      floatEnabled={animEnabled && (n.size > 3 || isSelected || isHovered)}
                      twinkleEnabled={animEnabled}
                      playDelay={playSchedule?.get(n.id)}
                      onSelect={handleStarSelect}
                      onDoubleClick={handleStarDoubleClick}
                      onHover={queueHover}
                      shouldSwallowClick={shouldSwallowStarClick}
                    />
                  );
                })}
              </g>
            </g>

            {/* Shooting stars — viewport-space, smaller + more delicate. */}
            <g style={{ pointerEvents: "none" }}>
              {shooters.map((s) => (
                <line
                  key={s.id}
                  x1={s.fromX}
                  y1={s.fromY}
                  x2={s.toX}
                  y2={s.toY}
                  stroke="#fafafa"
                  strokeWidth={0.8}
                  strokeOpacity={0.75}
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: `42 ${s.totalLen}`,
                    strokeDashoffset: 0,
                    animation: "galaxyShoot 1.35s cubic-bezier(0.4, 0, 0.65, 1) forwards",
                    ['--shoot-len' as keyof React.CSSProperties as string]: `${s.totalLen + 42}px`,
                  } as React.CSSProperties}
                />
              ))}
            </g>
          </svg>
        </div>

        {/* Detail panel — typography + spacing tracks mdfy.app's left
            sidebar. Doc/concept references reuse the SidebarFolder
            TabRow look: compact rounded rows, hover:bg-[var(--toggle-bg)],
            tiny coloured dot prefix instead of bordered chips. */}
        {selected && (
          <aside
            style={{
              width: 320,
              borderLeft: "1px solid var(--border-dim)",
              padding: "14px 12px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflowY: "auto",
              flexShrink: 0,
              background: "color-mix(in srgb, var(--background) 80%, transparent 20%)",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Kind + date + close, single compact line */}
            <div className="flex items-center gap-2" style={{ padding: "0 4px" }}>
              <span
                className="text-caption font-mono uppercase"
                style={{
                  color: colourForKind(selected.kind),
                  letterSpacing: 0.8,
                  fontWeight: 600,
                }}
              >
                {selected.kind}
              </span>
              <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                {selected.createdAt.slice(0, 10)}
              </span>
              <span style={{ flex: 1 }} />
              <button
                onClick={() => setSelectedId(null)}
                className="rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]"
                style={{
                  width: 22,
                  height: 22,
                  background: "transparent",
                  border: "none",
                  color: "var(--text-faint)",
                  cursor: "pointer",
                }}
                aria-label="Close"
              >
                <X width={13} height={13} />
              </button>
            </div>

            <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 6 }}>
              <h3 className="text-heading" style={{ margin: 0, color: "var(--text-primary)", lineHeight: 1.3 }}>
                {selected.label}
              </h3>
              <p className="text-caption font-mono" style={{ color: "var(--text-faint)", margin: 0, letterSpacing: 0.5, textTransform: "uppercase" }}>
                {starDesignation(selected.id)}
                {selected.kind !== "doc" && (selected.occurrence || 0) > 0 && (
                  <span style={{ color: "var(--text-faint)" }}>
                    {"  /  "}
                    {selected.occurrence} mentions in {(selected.docIds || []).length}{" "}
                    {(selected.docIds || []).length === 1 ? "doc" : "docs"}
                  </span>
                )}
              </p>
            </div>

            {selected.description && (
              <p className="text-body" style={{ color: "var(--text-secondary)", lineHeight: 1.55, margin: 0, padding: "0 4px" }}>
                {selected.description}
              </p>
            )}

            {selected.kind === "doc" && (() => {
              const rawDocId = selected.id.startsWith("doc:") ? selected.id.slice(4) : selected.id;
              const className = "flex items-center gap-1.5 rounded-md text-xs transition-colors hover:bg-[var(--toggle-bg)]";
              const style = {
                padding: "6px 8px",
                color: "var(--accent)",
                textDecoration: "none",
                background: "var(--accent-dim)",
              } as const;
              if (embedded && onOpenDoc) {
                return (
                  <button onClick={() => onOpenDoc(rawDocId)} className={className} style={style}>
                    <ExternalLink width={12} height={12} className="shrink-0" />
                    <span>Open document</span>
                  </button>
                );
              }
              return (
                <a
                  href={`/${rawDocId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  style={style}
                >
                  <ExternalLink width={12} height={12} className="shrink-0" />
                  <span>Open document</span>
                </a>
              );
            })()}

            {linkedDocs.length > 0 && (
              <div>
                <label className="text-caption font-mono uppercase" style={{ color: "var(--text-faint)", display: "block", marginBottom: 4, marginLeft: 6, letterSpacing: 0.5 }}>
                  Anchored to
                </label>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {linkedDocs.map((d) => {
                    const id = d.id.startsWith("doc:") ? d.id.slice(4) : d.id;
                    const className = "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors hover:bg-[var(--toggle-bg)] w-full text-left";
                    const style = { color: "var(--text-primary)", textDecoration: "none" } as const;
                    return (
                      <li key={d.id}>
                        {embedded && onOpenDoc ? (
                          <button
                            onClick={() => onOpenDoc(id)}
                            className={className}
                            style={style}
                            title={d.label}
                          >
                            <FileText width={12} height={12} className="shrink-0" style={{ color: "var(--text-faint)" }} />
                            <span className="truncate flex-1">{d.label}</span>
                          </button>
                        ) : (
                          <a
                            href={`/${id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={className}
                            style={style}
                            title={d.label}
                          >
                            <FileText width={12} height={12} className="shrink-0" style={{ color: "var(--text-faint)" }} />
                            <span className="truncate flex-1">{d.label}</span>
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {visible.neighbours.size > 0 && (
              <div>
                <label className="text-caption font-mono uppercase" style={{ color: "var(--text-faint)", display: "block", marginBottom: 4, marginLeft: 6, letterSpacing: 0.5 }}>
                  Connected
                </label>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {Array.from(visible.neighbours)
                    .map((id) => apiMap.get(id))
                    .filter((n): n is ApiNode => !!n && n.kind !== "doc")
                    .slice(0, 16)
                    .map((n) => {
                      const c = colourForKind(n.kind);
                      return (
                        <li key={n.id}>
                          <button
                            onClick={() => setSelectedId(n.id)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors hover:bg-[var(--toggle-bg)] w-full text-left"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--text-primary)",
                              cursor: "pointer",
                            }}
                          >
                            <span
                              aria-hidden
                              className="shrink-0 rounded-full"
                              style={{ width: 6, height: 6, background: c, opacity: 0.85 }}
                            />
                            <span className="truncate flex-1">{n.label}</span>
                            <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)", letterSpacing: 0.3 }}>
                              {n.kind}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Timeline — single, clean row. hubStart / [slider with cursor
          date floating below the thumb] / hubEnd / Growth. No multi-row
          stacking, no border pills, just a scrubber. */}
      <footer
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 14,
          borderTop: "1px solid var(--border-dim)",
          flexShrink: 0,
          background: "var(--header-bg)",
          backdropFilter: "blur(12px)",
          zIndex: 3,
        }}
      >
        <span
          className="text-caption font-mono"
          style={{
            color: displayDate === data.hubStart ? "var(--accent)" : "var(--text-faint)",
            fontWeight: displayDate === data.hubStart ? 600 : 400,
            letterSpacing: 0.3,
            flexShrink: 0,
            minWidth: 78,
            transition: "color 0.15s ease",
          }}
        >
          {data.hubStart}
        </span>

        {/* Slider area — thumb on top, cursor-date label below the
            thumb. Position clamped to [8%..92%] so the label never
            overlaps the hubStart / hubEnd text. Label hidden when
            sitting on hubStart or hubEnd (the bound label tells you). */}
        <div style={{ flex: 1, position: "relative", height: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <input
            ref={sliderInputRef}
            type="range"
            min={0}
            max={1000}
            // Uncontrolled-ish: defaultValue seeds the thumb, scrub
            // onChange writes the React-state cutoff via rAF coalesce
            // (the browser keeps the thumb itself smooth regardless).
            defaultValue={Math.round(sliderPct * 1000)}
            onChange={(e) => {
              // Coalesce many native onChange events to one React update
              // per animation frame. The SVG world reconciles for ~100
              // stars + edges every cutoff change, which is the
              // bottleneck on fast drags; capping to 60fps keeps the
              // input responsive (native thumb tracks the finger) while
              // bounding the reconcile rate.
              scrubPendingRef.current = Number(e.currentTarget.value) / 1000;
              if (scrubRafIdRef.current != null) return;
              scrubRafIdRef.current = requestAnimationFrame(() => {
                scrubRafIdRef.current = null;
                const v = scrubPendingRef.current;
                if (v == null || !hubBounds) return;
                const { startMs, endMs } = hubBounds;
                const target = startMs + (endMs - startMs) * v;
                setPlaying(false);
                // Full ISO (not day-sliced) so cutoffMs matches target
                // exactly — the day-form path only kicks in for the
                // initial hubEnd fallback.
                setSliderDate(new Date(target).toISOString());
              });
            }}
            className="galaxy-range"
            style={{ width: "100%", position: "absolute", top: 4, left: 0 }}
          />
          {/* Cursor — during CSS-driven playback both `left` and the
              text are mutated via refs each rAF, so React doesn't
              re-render the SVG world. Outside of playback the slider's
              sliderPct + displayDate drive these the normal way. */}
          {(playing || (displayDate && displayDate !== data.hubStart && displayDate !== data.hubEnd)) && (
            <span
              ref={cursorThumbRef}
              className="text-caption font-mono"
              style={{
                position: "absolute",
                left: `${Math.max(8, Math.min(92, sliderPct * 100))}%`,
                transform: "translateX(-50%)",
                bottom: 0,
                color: "var(--accent)",
                letterSpacing: 0.3,
                fontWeight: 600,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                transition: playing ? "none" : "left 0.05s linear",
              }}
            >
              <span ref={cursorLabelRef}>{displayDate}</span>
            </span>
          )}
        </div>

        <span
          className="text-caption font-mono"
          style={{
            color: (!displayDate || displayDate === data.hubEnd) ? "var(--accent)" : "var(--text-faint)",
            fontWeight: (!displayDate || displayDate === data.hubEnd) ? 600 : 400,
            letterSpacing: 0.3,
            flexShrink: 0,
            minWidth: 78,
            textAlign: "right",
            transition: "color 0.15s ease",
          }}
        >
          {data.hubEnd}
        </span>

        <GalaxyButton
          primary
          active={playing}
          onClick={() => {
            if (playing) { setPlaying(false); return; }
            // Park React's cursor at hubStart in the same batched update
            // as setPlaying so the timeline thumb renders at the LEFT
            // edge on the very first frame (no right-end flash).
            if (hubBounds) setSliderDate(new Date(hubBounds.startMs).toISOString());
            setPlaying(true);
          }}
          title={playing ? "Pause replay" : "Replay growth from the beginning"}
        >
          {playing ? <Pause width={11} height={11} /> : <Play width={11} height={11} />}
          <span>{playing ? "Pause" : "Growth"}</span>
        </GalaxyButton>
      </footer>
    </div>
  );
}
