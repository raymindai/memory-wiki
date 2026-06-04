"use client";

// In-editor view of the user's hub. Distinct from Home (private
// workspace landing) — Hub is the PUBLIC face. The view focuses on:
//
//   - the deploy-to-AI URL (the v6 thesis surface)
//   - "view as a visitor sees it"
//   - the user's full library grouped by access (Public / Shared /
//     Private), bundles above docs in each section so the workspace
//     primitive comes first
//
// Clicking a doc/bundle opens it as an editor tab in the same
// instance — no full-page navigation, no losing context.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Layers, Copy, Check, ExternalLink, Globe, Eye, Cloud, Users,
  ShieldAlert, Sparkles, ArrowUpRight, Lightbulb, FileWarning,
  Network, Clock, FolderClosed, Atom, FileText, Image as ImageIcon,
  GitBranch,
} from "lucide-react";
import DocStatusIcon from "@/components/DocStatusIcon";
import MediaLightbox from "@/components/MediaLightbox";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import { ProviderIcon, type ProviderBrand } from "@/components/pure";

interface DocCard {
  id: string;
  title: string;
  snippet: string;
  updated_at: string;
  isDraft: boolean;
  editMode: string | null;
  cloudId: string;
  hasPassword?: boolean;
  sharedWithCount?: number;
}
interface BundleCard {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
  isDraft: boolean;
  hasPassword?: boolean;
  sharedWithCount?: number;
}
interface HubData {
  hub: {
    slug: string;
    display_name: string | null;
    avatar_url: string | null;
    description: string | null;
    plan: string | null;
    url: string;
  };
  /** Public-only doc list — kept for the public-visitor fallback when
   *  the caller is not the hub owner. Owners use `ownerView` instead. */
  documents: Array<{ id: string; title: string; snippet: string; updated_at: string; source: string | null }>;
  /** Public-only bundle list — same purpose as `documents`. */
  bundles: Array<{ id: string; title: string; description: string | null; updated_at: string }>;
  topConcepts?: Array<{ id: number; label: string; occurrence: number; docCount: number }>;
  counts: { documents: number; bundles: number; concepts?: number; totalWords?: number };
  lastUpdated?: string | null;
  isOwner?: boolean;
  ownerView?: {
    bundles: { public: BundleCard[]; shared: BundleCard[]; private: BundleCard[] };
    documents: { public: DocCard[]; shared: DocCard[]; private: DocCard[] };
  } | null;
  recentActivity?: Array<{
    id: number;
    event: string;
    targetType: string | null;
    targetId: string | null;
    summary: string | null;
    ts: string;
  }> | null;
  mediaImages?: Array<{ docId: string; docTitle: string; urls: string[] }>;
}

interface PromoteSuggestion { type: "promote"; docId: string; title: string; sharedConcepts: string[] }
interface BundleSuggestion { type: "bundle"; concept: string; docIds: string[]; docTitles: string[] }
interface ThinSuggestion { type: "thin"; concept: string; docId: string; docTitle: string; neighbors: string[] }
interface HubSuggestions {
  promote: PromoteSuggestion[];
  bundles: BundleSuggestion[];
  thin: ThinSuggestion[];
}

// Curator lint shapes — duck-typed against the parent's state so
// callers don't have to import @/lib/hub-lint just to wire the props.
interface HubLintReport {
  orphans: { id: string; title: string | null }[];
  duplicates: { a: { id: string; title: string | null }; b: { id: string; title: string | null }; distance: number }[];
  titleMismatches: { id: string; title: string | null; topConcept: string; concepts: string[] }[];
  totalDocs: number;
}
interface HubLintResolved {
  orphans: Set<string>;
  /** Pair key encoded as "aId|bId". */
  duplicates: Set<string>;
  titleMismatches: Set<string>;
  staleClaims: Set<string>;
  /** Pair key "aId|bId" — merge suggestions reuse the duplicate pair shape. */
  mergeSuggestions: Set<string>;
  /** Concept label — roll-up suggestions key on concept name. */
  rollupSuggestions: Set<string>;
  autoArchive: Set<string>;
  /** Cluster slug — dismiss / accept removes it locally. */
  bundleSuggestions: Set<string>;
  /** Composite "docId|url" — citation rot rows the user dismissed. */
  citationRot: Set<string>;
}

interface HubEmbedProps {
  slug: string;
  onOpenDoc?: (docId: string) => void;
  onOpenBundle?: (bundleId: string) => void;
  /** Open the Bundle Creator pre-filled with the supplied doc ids.
   *  Used by the "Bundle these N docs about X" suggestion card. */
  onCreateBundleFromDocs?: (docIds: string[], suggestedTitle?: string) => void;
  /** Primary action on Expand suggestion rows — create a fresh draft
   *  note seeded with the underexplored concept so the user can write
   *  into it immediately. Mirrors the role Publish plays on Promote
   *  rows: one click, the suggested action happens. */
  onExpandConcept?: (concept: string, sourceDocId: string, neighbors: string[]) => void;
  /** Curator findings (Needs Review) + which signals the user has
   *  enabled in Settings. Same data the editor sidebar reads; we
   *  surface it on the hub overview too so the hub reflects what
   *  auto-management has flagged, not just what's been suggested.
   *  When the props are absent the section just doesn't render. */
  lintReport?: HubLintReport | null;
  curatorOrphanEnabled?: boolean;
  curatorDuplicateEnabled?: boolean;
  curatorTitleMismatchEnabled?: boolean;
  curatorStaleEnabled?: boolean;
  curatorMergeEnabled?: boolean;
  curatorRollupEnabled?: boolean;
  curatorAutoArchiveEnabled?: boolean;
  curatorBundleSuggestionEnabled?: boolean;
  curatorCitationRotEnabled?: boolean;
  lintResolved?: HubLintResolved;
  onResolveOrphan?: (docId: string, docTitle: string | null) => void;
  onResolveDuplicate?: (aId: string, aTitle: string | null, bId: string, bTitle: string | null) => void;
  onResolveTitleMismatch?: (docId: string, docTitle: string | null, suggestedConcept: string) => void;
  onResolveStaleClaim?: (docId: string) => void;
  onResolveMergeSuggestion?: (aId: string, bId: string) => void;
  onResolveRollupSuggestion?: (concept: string) => void;
  onResolveAutoArchive?: (docId: string) => void;
  /** Accept a bundle suggestion — caller creates the bundle and
   *  marks the cluster as represented (bundle_ai_metadata.source_cluster_id)
   *  so the suggestion doesn't reappear. */
  onAcceptBundleSuggestion?: (clusterId: string, title: string, docIds: string[]) => void;
  onDismissBundleSuggestion?: (clusterId: string) => void;
  onDismissCitationRot?: (docId: string, url: string) => void;
  /** Auto-management settings — drives the status panel above
   *  Needs Review. When omitted, the panel doesn't render. */
  autoLevel?: "off" | "conservative" | "standard" | "aggressive";
  autoTrigger?: "manual" | "on-open" | "interval";
  /** Run the auto-management pass right now. Wired to the panel's
   *  "Run now" button. May return a Promise — when it does, the button
   *  shows a local "Running…" state until it resolves so the click
   *  has obvious feedback even if the result toast is missed. */
  onAutoResolveRun?: () => void | Promise<void>;
  /** Deep-link to the auto-management section of Settings. */
  onOpenAutoSettings?: () => void;
  /** Concept-index freshness snapshot. When `isStale` is true the
   *  Re-analyze banner renders above auto-management with a one-click
   *  refresh. Parent owns the fetch + the cooldown bypass. */
  freshness?: {
    isStale: boolean;
    staleDocCount: number;
    conceptsBuiltAt: string | null;
  } | null;
  /** Force-refresh concept extraction for stale docs only. Wired to
   *  the "Re-analyze" button on the freshness banner. */
  onReanalyze?: () => void;
  /** True while a reanalyze pass is in flight; disables the button +
   *  flips the label to "Re-analyzing…". */
  reanalyzing?: boolean;
  /** Switch to the in-editor Galaxy overlay. When provided, the hero's
   *  Galaxy CTA fires this instead of opening /galaxy in a new tab —
   *  so the cosmos lands in the same window the user is reading the
   *  hub in, matching the Galaxy pill in the editor toolbar. */
  onOpenGalaxy?: () => void;
}

// Module-level cache. The hub tab unmounts whenever the user switches
// to a doc/bundle tab and re-mounts when they come back, which used
// to fire a fresh /api/hub/<slug> + show the full loader every time.
// Caching across mounts means the cached snapshot paints instantly
// while a background revalidation refreshes silently. 60-second TTL
// keeps the data reasonably fresh without doing the round-trip on
// every back-button press.
// Module-level + sessionStorage-backed cache so opening the Hub
// overlay paints from cache on every visit within a session, AND
// survives a page reload. Module map is the hot path; on first
// hit per page load we rehydrate it from sessionStorage. TTL was
// 60s — bumped to 5 minutes so the "stale-while-revalidate"
// background refresh doesn't fire on every casual reopen.
const hubDataCache = new Map<string, { data: HubData; ts: number }>();
const HUB_CACHE_TTL_MS = 5 * 60_000;
const HUB_CACHE_KEY = "mw-hub-data-cache-v1";

if (typeof window !== "undefined" && hubDataCache.size === 0) {
  try {
    const raw = sessionStorage.getItem(HUB_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { data: HubData; ts: number }>;
      for (const [slug, entry] of Object.entries(parsed)) {
        if (entry && entry.data && typeof entry.ts === "number") {
          hubDataCache.set(slug, entry);
        }
      }
    }
  } catch { /* ignore */ }
}
function persistHubCache() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, { data: HubData; ts: number }> = {};
    for (const [k, v] of hubDataCache.entries()) obj[k] = v;
    sessionStorage.setItem(HUB_CACHE_KEY, JSON.stringify(obj));
  } catch { /* quota / disabled */ }
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Three access tiers — visual identity for each section header. Public
// (orange = on the hub), Shared (blue = with specific people),
// Private (faint = only you). Using explicit colours so the tier the
// user is looking at is always recognisable at a glance.
const TIERS = {
  public:  { label: "Public",  desc: "On your hub URL — anyone with the link can read", icon: Globe,        color: "#22c55e",        bg: "rgba(34,197,94,0.14)" },
  shared:  { label: "Shared",  desc: "Restricted to specific people or password",         icon: Users,         color: "#60a5fa",       bg: "rgba(96,165,250,0.12)" },
  private: { label: "Private", desc: "Only you can read — saved to cloud but not shared", icon: Cloud, color: "var(--text-muted)", bg: "var(--toggle-bg)" },
} as const;

export default function HubEmbed({
  slug,
  onOpenDoc,
  onOpenBundle,
  onCreateBundleFromDocs,
  onExpandConcept,
  lintReport,
  curatorOrphanEnabled,
  curatorDuplicateEnabled,
  curatorTitleMismatchEnabled,
  curatorStaleEnabled,
  curatorMergeEnabled,
  curatorRollupEnabled,
  curatorAutoArchiveEnabled,
  curatorBundleSuggestionEnabled,
  curatorCitationRotEnabled,
  lintResolved,
  onResolveOrphan,
  onResolveDuplicate,
  onResolveTitleMismatch,
  onResolveStaleClaim,
  onResolveMergeSuggestion,
  onResolveRollupSuggestion,
  onResolveAutoArchive,
  onAcceptBundleSuggestion,
  onDismissBundleSuggestion,
  onDismissCitationRot,
  autoLevel,
  autoTrigger,
  onAutoResolveRun,
  onOpenAutoSettings,
  freshness,
  onReanalyze,
  reanalyzing,
  onOpenGalaxy,
}: HubEmbedProps) {
  // Needs Review + Suggestions default to COLLAPSED when auto-
  // management is on — the assumption is Memory.Wiki is handling them
  // for you, so the user shouldn't have to scroll past detailed
  // lists every Hub visit. When auto-management is off, both
  // sections default OPEN so manual triage is still front-and-
  // centre. The user can toggle each independently and that
  // override persists for the session via the click state.
  const autoOn = !!autoLevel && autoLevel !== "off";
  // Visible state for the "Run now" button so a click registers
  // immediately even before the result toast lands. "idle" → "running"
  // (while the parent's pass executes) → "done" (briefly flashes a
  // checkmark) → back to "idle".
  const [runNowState, setRunNowState] = useState<"idle" | "running" | "done">("idle");
  const [needsReviewCollapsed, setNeedsReviewCollapsed] = useState(autoOn);
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(autoOn);
  // Per-tier fold state for the Public / Shared / Private sections.
  // Defaults open — these are the user's own content, not auto-managed
  // findings, so they should be visible on first paint.
  const [tierCollapsed, setTierCollapsed] = useState<Record<"public" | "shared" | "private", boolean>>({
    public: false,
    shared: false,
    private: false,
  });
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [mediaCollapsed, setMediaCollapsed] = useState(true);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Re-evaluate the default whenever the level flips between off
  // and on. Doesn't fight a deliberate user toggle within a
  // session because we only nudge when level itself changes.
  useEffect(() => {
    setNeedsReviewCollapsed(autoOn);
    setSuggestionsCollapsed(autoOn);
  }, [autoOn]);
  // Seed from cache so re-mounting (back-button from a doc/bundle tab)
  // shows the previous snapshot instantly instead of the loader.
  const cachedEntry = hubDataCache.get(slug);
  const cacheIsFresh = cachedEntry && Date.now() - cachedEntry.ts < HUB_CACHE_TTL_MS;
  const [data, setData] = useState<HubData | null>(cachedEntry?.data || null);
  const [error, setError] = useState<string | null>(null);
  // Only show the full-screen loader when there's NO cached snapshot
  // to render. With a snapshot we revalidate in the background.
  const [loading, setLoading] = useState(!cachedEntry);
  const [copied, setCopied] = useState(false);
  // Which URL variant is in the primary URL row — Digest (default,
  // cheap concept map) or Full (?full=1, every doc inline). One Copy
  // button serves whichever is active.
  const [urlVariant, setUrlVariant] = useState<"digest" | "full">("digest");
  // Per-tool setup tab — drives which snippet shows in the "Setup
  // snippet for your tool" card. Claude as the default since chat
  // surfaces are the most common deploy target.
  const [activeTool, setActiveTool] = useState<string>("claude");
  const [copiedTool, setCopiedTool] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<HubSuggestions | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [busySuggestionId, setBusySuggestionId] = useState<string | null>(null);
  // Ontology build state — surfaced only to the owner when concept_index
  // is empty. The "Build ontology now" CTA fires the bulk extractor and
  // shows live progress so the user knows the LLM is working.
  const [ontologyBuilding, setOntologyBuilding] = useState(false);
  const [ontologyProgress, setOntologyProgress] = useState<{ processed: number; concepts: number } | null>(null);
  const [ontologyError, setOntologyError] = useState<string | null>(null);
  // Background-queue status for the Compact CTA. Populated by a
  // poll while the section is on screen so "Building…" / "Failed
  // — retry" / "Last built X ago" surface accurately.
  const [jobStatus, setJobStatus] = useState<{
    pending: number;
    running: number;
    failed: number;
    lastBuiltAt: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Stale-while-revalidate: if we have fresh cache, skip the loading
    // state entirely. If cache is stale, still skip the loader (we
    // already have something to show) but refresh in the background.
    const cached = hubDataCache.get(slug);
    if (cached) {
      setData(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/hub/${slug}`, { credentials: "include" });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          if (!cancelled && !cached) {
            setError(e.error || `Failed (${res.status})`);
            setLoading(false);
          }
          return;
        }
        const json = (await res.json()) as HubData;
        hubDataCache.set(slug, { data: json, ts: Date.now() });
        persistHubCache();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled && !cached) {
          setError(err instanceof Error ? err.message : "Failed");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  void cacheIsFresh; // referenced only to suppress unused-var if linter complains

  // Fetch AI curation suggestions in parallel with hub data. Owner-only;
  // 403 for non-owners is silently ignored (suggestions section just
  // doesn't render).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hub/${slug}/suggestions`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j) setSuggestions(j as HubSuggestions); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  const dismissSuggestion = (key: string) => {
    setDismissedSuggestions((prev) => new Set([...prev, key]));
  };
  const promoteDoc = async (docId: string) => {
    setBusySuggestionId(`promote:${docId}`);
    try {
      const res = await fetch(`/api/docs/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "publish" }),
      });
      if (res.ok) {
        // Bust hub cache so next paint shows the doc in Public.
        hubDataCache.delete(slug);
        persistHubCache();
        // Optimistic: drop the suggestion locally.
        dismissSuggestion(`promote:${docId}`);
      }
    } catch { /* ignore */ }
    finally { setBusySuggestionId(null); }
  };

  // Copies whichever URL variant the user currently has selected
  // (digest by default, ?full=1 when toggled). Single state means a
  // single "Copied" green flash — no juggling two flags.
  const copyUrl = async () => {
    if (!data) return;
    const url = urlVariant === "full" ? `${data.hub.url}?full=1` : data.hub.url;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  // Poll the job queue status. Tightens to 4s while there's pending
  // or running work (so the Compact CTA flips to "Built X ago" the
  // moment the cron worker finishes), backs off to 60s at rest.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/user/jobs/status?kind=doc_ontology`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const j = await res.json();
        if (!cancelled) setJobStatus(j);
      } catch { /* silent — UI just shows stale info */ }
    };
    tick();
    const interval = setInterval(tick, jobStatus && (jobStatus.pending > 0 || jobStatus.running > 0) ? 4000 : 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [jobStatus?.pending, jobStatus?.running]);

  // Bulk-extract concepts across the user's docs. Loops the endpoint in
  // batches of 50 until `remaining: 0` so a hub with hundreds of docs
  // gets fully indexed without a single fat request. Refreshes hub data
  // + suggestions on completion so the new concept badges, digest size,
  // and curation cards all appear immediately.
  const buildOntology = async () => {
    setOntologyBuilding(true);
    setOntologyError(null);
    setOntologyProgress({ processed: 0, concepts: 0 });
    let totalProcessed = 0;
    let totalConcepts = 0;
    try {
      // Cap at a few iterations so a runaway extractor never blocks the
      // UI indefinitely — covers ~250 docs which is well above any
      // realistic single-user hub at this point.
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`/api/hub/${slug}/ontology/build`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ limit: 50 }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setOntologyError(err.error || `Build failed (${res.status})`);
          break;
        }
        const json = await res.json();
        totalProcessed += json.processed || 0;
        totalConcepts += json.conceptsWritten || 0;
        setOntologyProgress({ processed: totalProcessed, concepts: totalConcepts });
        if (json.remaining !== "more") break;
      }
      // Bust caches and refetch hub + suggestions so the new state lands.
      hubDataCache.delete(slug);
      const [hubRes, sugRes] = await Promise.all([
        fetch(`/api/hub/${slug}`, { credentials: "include" }),
        fetch(`/api/hub/${slug}/suggestions`, { credentials: "include" }),
      ]);
      if (hubRes.ok) {
        const json = (await hubRes.json()) as HubData;
        hubDataCache.set(slug, { data: json, ts: Date.now() });
        persistHubCache();
        setData(json);
      }
      if (sugRes.ok) setSuggestions(await sugRes.json());
    } catch (err) {
      setOntologyError(err instanceof Error ? err.message : "Build failed");
    } finally {
      setOntologyBuilding(false);
    }
  };

  if (loading) {
    // Match the doc loader vocabulary: pulsing logo, slide bar,
    // monospace caption. Same visual rhythm so the Hub doesn't feel
    // like a half-built screen while the API request is in flight.
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "var(--background)", gap: 14 }}>
        <div className="mw-loader-enter">
          <MemoryWikiLogo size={64} variant="icon-only" />
        </div>
        <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}>
          Loading hub
        </span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full text-caption px-6 text-center" style={{ color: "#ef4444" }}>
        {error === "Hub not found"
          ? "This hub isn't public yet. Enable hub_public in your profile to view it here."
          : (error || "Could not load hub.")}
      </div>
    );
  }

  const ov = data.ownerView;
  const totalCounts = ov
    ? {
        public:  ov.bundles.public.length  + ov.documents.public.length,
        shared:  ov.bundles.shared.length  + ov.documents.shared.length,
        private: ov.bundles.private.length + ov.documents.private.length,
      }
    : null;

  return (
    <div className="h-full relative overflow-hidden" style={{ background: "var(--canvas)" }}>
      {/* Animated MW-blob backdrop — lives OUTSIDE the scroll
          container so the blob stays anchored to the viewport while
          the user scrolls. */}
      <div className="mw-start-backdrop" aria-hidden>
        <div className="mw-start-backdrop-morph" />
      </div>
      <div className="h-full overflow-auto relative mw-start-backdrop-content">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* ── Identity row. The eyebrow "Public knowledge hub"
              previously sat above this header, but the slug pill
              (/hub/<slug>) and the Deploy-to-AI block already say
              the same thing — removing it keeps the page top
              quieter. */}
        {/* Identity hero — big centered avatar, name, slug, bio,
            meta + Galaxy CTA. "Who / what is this" is the first
            impression; deploy URL becomes the second beat. */}
        <header
          className="mb-8 text-center"
          style={{ padding: "32px 24px 24px" }}
        >
          {/* Avatar + access overlay — mirrors the bundle hero shape:
              Globe corner badge in the hub's lime ("Public") since
              the hub being viewable here implies it's publicly listed
              (private hubs early-return above with a "not public yet"
              message). The badge background is --canvas so it cuts a
              clean notch through the avatar edge. */}
          <div
            className="relative mx-auto"
            style={{ width: 80, height: 80 }}
            title="Public hub"
          >
            <img
              src={data.hub.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(slug)}`}
              alt=""
              className="rounded-full"
              style={{ width: 80, height: 80, border: "1px solid var(--border-dim)" }}
            />
            <span
              aria-hidden
              className="absolute flex items-center justify-center rounded-full"
              style={{
                right: -2, bottom: -2, width: 24, height: 24,
                background: "var(--canvas)",
                color: "#4ade80",
              }}
            >
              <Globe width={14} height={14} />
            </span>
          </div>
          <h1
            className="text-display tracking-tight mt-4"
            style={{ color: "var(--text-primary)", lineHeight: 1.2 }}
          >
            {data.hub.display_name || slug}
          </h1>
          {/* Access pill — same shape as bundle hero so the two
              surfaces share the same visual language. */}
          <div className="mt-3 flex justify-center">
            <span
              className="inline-flex items-center gap-1 text-caption font-mono px-2 py-0.5 rounded-full"
              style={{
                color: "#4ade80",
                background: "rgba(74, 222, 128, 0.12)",
                letterSpacing: "0.04em",
              }}
            >
              Public
            </span>
          </div>
          {/* Slug intentionally NOT shown here — the full URL lives
              in the Deploy card below; printing /hub/<slug> here too
              just duplicates that identifier. */}
          {data.hub.description && (
            <p
              className="text-body mt-3 mx-auto leading-relaxed"
              style={{ color: "var(--text-secondary)", maxWidth: 480 }}
            >
              {data.hub.description}
            </p>
          )}
          {/* Meta + Galaxy CTA — one centered row. Hub-only stats:
              docs / bundles / updated. Galaxy entry as an accent
              pill on the same baseline. */}
          {ov && (() => {
            const docCount = ov.documents.public.length + ov.documents.shared.length + ov.documents.private.length;
            const bundleCount = ov.bundles.public.length + ov.bundles.shared.length + ov.bundles.private.length;
            let latest: string | null = null;
            const consider = (iso?: string | null) => {
              if (!iso) return;
              if (!latest || iso > latest) latest = iso;
            };
            for (const d of ov.documents.public) consider(d.updated_at);
            for (const d of ov.documents.shared) consider(d.updated_at);
            for (const d of ov.documents.private) consider(d.updated_at);
            for (const b of ov.bundles.public) consider(b.updated_at);
            for (const b of ov.bundles.shared) consider(b.updated_at);
            for (const b of ov.bundles.private) consider(b.updated_at);
            return (
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                  <FolderClosed width={11} height={11} />
                  {docCount} {docCount === 1 ? "doc" : "docs"}
                </span>
                {bundleCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                    <Layers width={11} height={11} />
                    {bundleCount} {bundleCount === 1 ? "bundle" : "bundles"}
                  </span>
                )}
                {latest && (
                  <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                    <Clock width={11} height={11} />
                    Updated {relativeTime(latest)}
                  </span>
                )}
                {(() => {
                  const galaxyClass = "inline-flex items-center gap-1.5 text-caption font-mono px-2.5 py-1 rounded transition-colors hover:bg-[var(--border)]";
                  const galaxyStyle = {
                    color: "var(--text-primary)",
                    background: "var(--border)",
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    letterSpacing: 0.3,
                  } as const;
                  const galaxyTitle = "Open your hub as a constellation";
                  // Embedded into the editor → fire the in-window Galaxy
                  // overlay (same surface the toolbar's Atom pill opens),
                  // no new tab.
                  if (onOpenGalaxy) {
                    return (
                      <button
                        type="button"
                        onClick={() => onOpenGalaxy()}
                        className={galaxyClass}
                        style={galaxyStyle}
                        title={galaxyTitle}
                      >
                        <Atom width={11} height={11} />
                        <span>Galaxy</span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      href="/galaxy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={galaxyClass}
                      style={galaxyStyle}
                      title={galaxyTitle}
                    >
                      <Atom width={11} height={11} />
                      <span>Galaxy</span>
                      <ArrowUpRight width={11} height={11} />
                    </Link>
                  );
                })()}
              </div>
            );
          })()}
        </header>

        {/* ─── Stat strip ─── Same typographic-contrast pattern as
            the bundle viewer: hero number in Cal Sans (display
            font), label in JetBrains Mono with a touch of letter-
            spacing, and a quieter context line at the bottom. Three
            cells map to the hub's signal triplet: documents, bundles,
            concepts. Updated stays in the hero meta row above. */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-7">
          {/* Documents */}
          <div
            className="rounded-lg px-4 py-4 flex flex-col"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            <div
              className="tabular-nums"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
                fontSize: 32,
                lineHeight: 1,
                letterSpacing: 0,
              }}
            >
              {data.counts.documents ?? 0}
            </div>
            <div
              className="mt-1"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
            >
              {(data.counts.documents ?? 0) === 1 ? "Document" : "Documents"}
            </div>
            <div
              className="mt-auto pt-4 flex items-center gap-1.5"
              style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
            >
              <FolderClosed width={13} height={13} />
              <span>In this hub</span>
            </div>
          </div>

          {/* Bundles */}
          <div
            className="rounded-lg px-4 py-4 flex flex-col"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            <div
              className="tabular-nums"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
                fontSize: 32,
                lineHeight: 1,
                letterSpacing: 0,
              }}
            >
              {data.counts.bundles ?? 0}
            </div>
            <div
              className="mt-1"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
            >
              {(data.counts.bundles ?? 0) === 1 ? "Bundle" : "Bundles"}
            </div>
            <div
              className="mt-auto pt-4 flex items-center gap-1.5"
              style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
            >
              <Layers width={13} height={13} />
              <span>Grouped reading</span>
            </div>
          </div>

          {/* Concepts */}
          <div
            className="rounded-lg px-4 py-4 flex flex-col"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            {(data.counts.concepts ?? 0) > 0 ? (
              <>
                <div
                  className="tabular-nums"
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-display)",
                    fontSize: 32,
                    lineHeight: 1,
                    letterSpacing: 0,
                  }}
                >
                  {data.counts.concepts}
                </div>
                <div
                  className="mt-1"
                  style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
                >
                  {data.counts.concepts === 1 ? "Concept" : "Concepts"}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-display)",
                    fontSize: 20,
                    lineHeight: 1.1,
                    letterSpacing: 0,
                    fontWeight: 500,
                  }}
                >
                  Not built
                </div>
                <div
                  className="mt-1"
                  style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
                >
                  Build the concept index to enable Compact
                </div>
              </>
            )}
            <div
              className="mt-auto pt-4 flex items-center gap-1.5"
              style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
            >
              <Sparkles width={13} height={13} />
              <span>Across all docs</span>
            </div>
          </div>
        </section>

        {/* Unified "How to use this hub" — replaces the old
            Deploy + Setup split. One panel: pick the tool, see
            exactly what to do, copy, done. URL tools (chat AIs +
            Generic) show a URL row with the Compact/Full chip
            toggle; snippet tools (editor + Memory.Wiki native) show their
            specific snippet. No "via memory.wiki:" group label — every
            tool sits at the same level. */}
        <section
          className="mb-8 px-5 py-4 rounded-xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
        >
          {/* Per-tool setup. Two-row tab layout:
                Row 1 — "where you do AI" (Claude / ChatGPT / Gemini /
                Claude Code / Cursor / Generic), ordered by likely-
                use frequency (chat surfaces first, IDE next).
                Row 2 — "Memory.Wiki native" runtime (MCP / Skill / CLI)
                under a small "via memory.wiki:" label so users see them
                as add-on capabilities, not yet-another-vendor.
              The active tab's snippet card carries a one-line hint,
              the snippet itself, a multi-sentence user-friendly
              explanation, a Copy button, and a "Full guide →" link
              to the relevant /docs page. */}
          {(() => {
            const url = data.hub.url;
            // Token estimates for the variant chips. compactTokens is
            // the digest path (concept-clustered, ~30x cheaper);
            // fullTokens is every doc inlined. Surfaced inside the
            // chip itself so the trade-off is visible the moment the
            // user is choosing — not buried at the bottom.
            const fmtTok = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
            const totalWords = data.counts.totalWords ?? 0;
            const docCountTok = data.counts.documents ?? 0;
            const conceptCountTok = Math.min(data.counts.concepts ?? 0, 40);
            const fullTokens = totalWords > 0 ? Math.round(totalWords * 1.3 + docCountTok * 8) : 0;
            // Compact = concept-index summary. If concept_index is
            // empty, this variant ISN'T available — surface a
            // build-now CTA instead of faking a token count.
            const compactTokens = conceptCountTok > 0 ? Math.round(conceptCountTok * 25 + 200) : 0;
            const compactAvailable = compactTokens > 0;
            const projCtx = `# Project context

Memory.Wiki hub: ${url}

Fetch this URL on every session. The response carries clean
markdown of the user's knowledge graph (concept index, bundle
analyses, doc list) — paste-and-go context.`;
            const cursorRule = `---
description: Memory.Wiki hub context
alwaysApply: true
---
Memory.Wiki hub: ${url}

Fetch this URL on every session for the user's knowledge graph
(concept index, bundle analyses, doc list).`;
            const mcpConfig = `{
  "mcpServers": {
    "Memory.Wiki": {
      "command": "npx",
      "args": ["-y", "memory-wiki-mcp"]
    }
  }
}`;
            const skillUse = `# Install once
claude skill install Memory.Wiki

# Inside any Claude Code session
/memory.wiki capture "your idea"
/memory.wiki search "topic"
/memory.wiki hub`;
            const cliUse = `npm install -g memory-wiki-cli

Memory.Wiki capture "your idea"
Memory.Wiki search "topic"
Memory.Wiki hub`;

            type Tool = {
              id: string;
              label: string;
              brand: ProviderBrand;
              group: "user" | "native";
              hint: string;
              snippet: string;
              savePath?: string;
              explanation: string;
              docHref: string;
            };
            const TOOLS: Tool[] = [
              {
                id: "claude",
                label: "Claude",
                brand: "claude",
                group: "user",
                hint: "Drop the URL into a Claude chat",
                snippet: url,
                explanation:
                  "Works the same in Claude.ai (web) and the Mac / Windows desktop app. Claude fetches the compact view — a concept map of your hub — and follows the inline links to specific docs as needed. Append ?full=1 if you want every doc inlined up-front.",
                docHref: "/docs/integrate",
              },
              {
                id: "chatgpt",
                label: "ChatGPT",
                brand: "chatgpt",
                group: "user",
                hint: "Drop the URL into a ChatGPT chat",
                snippet: url,
                explanation:
                  "Works in ChatGPT web and the Mac desktop app. ChatGPT fetches the URL with its built-in browser tool, reads the compact view, and follows the inline links into specific docs when it needs more context.",
                docHref: "/docs/integrate",
              },
              {
                id: "gemini",
                label: "Gemini",
                brand: "gemini",
                group: "user",
                hint: "Drop the URL into Gemini (web or app)",
                snippet: url,
                explanation:
                  "Gemini reads the URL via its built-in tool use. Same digest format as Claude and ChatGPT — concept map first, then drill-down. Works in Gemini web and the Gemini mobile / desktop app.",
                docHref: "/docs/integrate#gemini",
              },
              {
                id: "claude-code",
                label: "Claude Code",
                brand: "claude",
                group: "user",
                hint: "Save as CLAUDE.md in your project root",
                snippet: projCtx,
                savePath: "CLAUDE.md",
                explanation:
                  "Claude Code auto-loads CLAUDE.md at the start of every session. Once you save the snippet to your project root, every Claude Code conversation in that repo starts with your hub already in context — no need to paste anything by hand.",
                docHref: "/docs/integrate#claude-code",
              },
              {
                id: "cursor",
                label: "Cursor",
                brand: "cursor",
                group: "user",
                hint: "Save as .cursor/rules/memorywiki.mdc in your project root",
                snippet: cursorRule,
                savePath: ".cursor/rules/memorywiki.mdc",
                explanation:
                  "Cursor's Rules feature reads .mdc files from .cursor/rules/. The alwaysApply: true frontmatter keeps your hub URL in context on every chat in the repo, including ad-hoc questions.",
                docHref: "/docs/integrate#cursor",
              },
              {
                id: "generic",
                label: "Generic",
                brand: "browser",
                group: "user",
                hint: "Paste this URL into any AI that can fetch a webpage",
                snippet: url,
                explanation:
                  "Any LLM with web-fetch (or a configured browser tool) works. Useful URL variants you can append:\n  ?digest=1&compact=1  — densest summary, ~30× cheaper to paste\n  ?full=1              — every doc inline, heaviest\n  /llms.txt            — manifest for crawlers",
                docHref: "/docs/integrate",
              },
              {
                id: "mcp",
                label: "MCP",
                brand: "mcp",
                group: "native",
                hint: "Add memory-wiki-mcp to your MCP host config",
                snippet: mcpConfig,
                explanation:
                  "Compatible with Claude Desktop, Cursor, Cline, Windsurf, and any MCP-capable host. Exposes 26 tools across capture / bundle / search / share / version history — so the AI can write into your hub, not just read it.",
                docHref: "/docs/mcp",
              },
              {
                id: "skill",
                label: "Skill",
                brand: "claude",
                group: "native",
                hint: "Use /memory.wiki slash commands inside Claude Code",
                snippet: skillUse,
                explanation:
                  "Install once with `claude skill install Memory.Wiki`. Then in any Claude Code session, run slash commands like /memory.wiki capture, /memory.wiki search, /memory.wiki hub. The skill is namespaced so it doesn't collide with Claude's built-ins.",
                docHref: "/docs/integrate",
              },
              {
                id: "cli",
                label: "CLI",
                brand: "cli",
                group: "native",
                hint: "Capture and search from your terminal",
                snippet: cliUse,
                explanation:
                  "Globally-installed npm package. Run Memory.Wiki capture, Memory.Wiki search, Memory.Wiki hub from any directory. Handy for scripting, terminal-first workflows, or piping shell output into your hub.",
                docHref: "/docs/cli",
              },
            ];
            const active = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];
            // URL tools render a URL row with the Compact/Full chip
            // toggle. Snippet tools render their save-to-file snippet.
            const URL_TOOL_IDS = new Set(["claude", "chatgpt", "gemini", "generic"]);
            const isUrlTool = URL_TOOL_IDS.has(active.id);
            const activeUrl = urlVariant === "full" ? `${url}?full=1` : url;

            // Bundle-style soft chip tabs — active = toggle-bg fill +
            // colored brand glyph, inactive = plain text-muted +
            // faint glyph. Replaces the prior underline-only tabs so
            // hub + bundle share the same "pick your AI" surface.
            const TabBtn = ({ t }: { t: Tool }) => {
              const isActive = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-caption font-medium transition-colors"
                  style={{
                    color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                    background: isActive ? "var(--toggle-bg)" : "transparent",
                  }}
                >
                  <span
                    style={{ display: "inline-flex", width: 12, height: 12, color: isActive ? "currentColor" : "var(--text-faint)" }}
                    aria-hidden
                  >
                    <ProviderIcon brand={t.brand} />
                  </span>
                  {t.label}
                </button>
              );
            };

            return (
              <div className="mb-3">
                {/* Section heading — proper h2 with subtitle, not a
                    tiny mono caption. Same treatment as the Deploy
                    card above so the page reads as a list of real
                    sections, each with its own title. */}
                <h2
                  style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}
                >
                  How to use this hub
                </h2>
                <p className="text-caption mt-1 mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
                  Pick your AI tool. Each one shows exactly what to paste and where.
                </p>

                {/* Single flat tab row — same style as the canvas's
                    Document / Insights / Decompose tabs. Active tab
                    gets a 2px accent underline, no chip backgrounds. */}
                <div className="flex flex-wrap items-center mb-3" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  {TOOLS.map((t) => <TabBtn key={t.id} t={t} />)}
                </div>

                {/* Borderless active-tab block — drops the inner card
                    chrome (which read as a duplicate panel inside
                    the outer section) and the redundant tool-name
                    badge in the header strip. */}
                <div>
                  {/* One-line hint above the action — no separate
                      header strip, no redundant tool-name badge. */}
                  <p className="text-caption mb-3" style={{ color: "var(--text-secondary)" }}>
                    {active.savePath ? (
                      <>
                        Save to{" "}
                        <code className="font-mono" style={{ color: "var(--text-primary)" }}>{active.savePath}</code>
                      </>
                    ) : (
                      <>{active.hint}</>
                    )}
                  </p>

                  {/* BODY — URL mode for chat tools, snippet for others. */}
                  {isUrlTool ? (
                    <div>
                      {/* Segmented payload picker — same shape as the
                          bundle viewer (BundleOverview) so the two
                          surfaces stay in lockstep. Solid filled active
                          chip, both token counts visible, comparison
                          row beneath. */}
                      {/* Side-by-side option cards — both variants
                          visible at once, active marked by a lime dot
                          + soft surface fill (not the prior stark
                          white ink-fill). */}
                      <div className="grid grid-cols-2 gap-2 mb-3" role="tablist" aria-label="Payload size">
                        {(["digest", "full"] as const).map((v) => {
                          const isActive = urlVariant === v;
                          const isCompact = v === "digest";
                          const compactMissing = isCompact && !compactAvailable;
                          const queueBuilding = !!jobStatus && (jobStatus.pending + jobStatus.running) > 0;
                          const queueFailed = !!jobStatus && jobStatus.failed > 0 && !compactAvailable;
                          const tokenLabel = isCompact
                            ? (compactAvailable ? `≈${fmtTok(compactTokens)} tokens`
                              : queueBuilding ? "building…"
                              : queueFailed ? "failed"
                              : "not built")
                            : `≈${fmtTok(fullTokens)} tokens`;
                          const label = isCompact ? "Compact" : "Full";
                          // Real cheaper-% from the two estimates
                          // (compactTokens populated only after the
                          // concept index builds; fall back to a
                          // generic line until then).
                          const cheaperPct = compactAvailable && fullTokens > compactTokens
                            ? Math.round((1 - compactTokens / fullTokens) * 100)
                            : 0;
                          const desc = isCompact
                            ? (cheaperPct > 0 ? `Concept map, ~${cheaperPct}% lighter` : "Concept map")
                            : "Every doc inlined";
                          return (
                            <button
                              key={v}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              onClick={() => setUrlVariant(v)}
                              className="text-left rounded-md px-3 py-2 transition-colors"
                              style={{
                                background: isActive ? "var(--toggle-bg)" : "transparent",
                                border: `1px solid ${isActive ? "var(--border)" : "var(--border-dim)"}`,
                                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                                opacity: compactMissing && !isActive ? 0.6 : 1,
                              }}
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  aria-hidden
                                  style={{
                                    width: 6, height: 6, borderRadius: "50%",
                                    background: isActive ? "var(--micro-lime)" : "var(--border)",
                                    display: "inline-block",
                                  }}
                                />
                                <span className="font-medium" style={{ fontSize: 12 }}>{label}</span>
                                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
                                  {tokenLabel}
                                </span>
                              </div>
                              <div className="text-caption mt-0.5" style={{ color: "var(--text-faint)" }}>
                                {desc}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {urlVariant === "digest" && !compactAvailable ? (
                        /* Compact isn't built yet — three sub-states:
                           queue is working (pending/running) → show
                           "Building..."; previous build failed → show
                           "Failed, retry"; nothing tried → show the
                           original Build CTA. */
                        <div
                          className="rounded-lg px-3 py-3"
                          style={{
                            background: "color-mix(in srgb, var(--border) 40%, var(--background))",
                            border: "1px dashed var(--text-primary)",
                          }}
                        >
                          {jobStatus && (jobStatus.pending + jobStatus.running) > 0 ? (
                            <>
                              <p className="text-caption mb-1" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                                Building Compact view…
                              </p>
                              <p className="text-caption mb-3" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                {jobStatus.running > 0 ? "Extractor is running now." : `${jobStatus.pending} doc${jobStatus.pending === 1 ? "" : "s"} queued.`}
                                {" "}Compact will light up when it&apos;s done — this page polls automatically.
                              </p>
                            </>
                          ) : jobStatus && jobStatus.failed > 0 ? (
                            <>
                              <p className="text-caption mb-1" style={{ color: "var(--color-danger)", fontWeight: 600 }}>
                                Compact build failed
                              </p>
                              <p className="text-caption mb-3" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                {jobStatus.failed} extraction{jobStatus.failed === 1 ? "" : "s"} failed (usually a transient LLM rate-limit). Retry below to re-queue them.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-caption mb-1" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                                Compact view isn&apos;t built yet
                              </p>
                              <p className="text-caption mb-3" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                Your hub&apos;s concept index is empty. Build it once and Compact will fetch a small concept map (~95% cheaper than Full).
                              </p>
                            </>
                          )}
                          <button
                            onClick={buildOntology}
                            disabled={ontologyBuilding}
                            className="inline-flex items-center gap-1.5 text-caption font-mono px-3 py-1.5 rounded transition-colors"
                            style={{
                              background: ontologyBuilding ? "var(--toggle-bg)" : "var(--text-primary)",
                              color: ontologyBuilding ? "var(--text-muted)" : "var(--background)",
                              border: "none",
                              cursor: ontologyBuilding ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              letterSpacing: 0.3,
                            }}
                          >
                            {ontologyBuilding ? (
                              <>Building{ontologyProgress ? ` — ${ontologyProgress.processed} docs, ${ontologyProgress.concepts} concepts` : "…"}</>
                            ) : (
                              <>Build concept index now</>
                            )}
                          </button>
                          {ontologyError && (
                            <p className="text-caption mt-2" style={{ color: "var(--color-danger)" }}>{ontologyError}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Hero — URL + Copy. Slightly stronger
                              border + padding than other rows so
                              this is unambiguously the action. */}
                          <button
                            onClick={async () => {
                              if (typeof navigator === "undefined" || !navigator.clipboard) return;
                              try {
                                await navigator.clipboard.writeText(activeUrl);
                                setCopiedTool(active.id);
                                setTimeout(() => setCopiedTool(null), 1500);
                              } catch { /* clipboard blocked */ }
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg font-mono transition-colors hover:bg-[var(--toggle-bg)]"
                            style={{
                              fontSize: 13,
                              background: "var(--background)",
                              color: copiedTool === active.id ? "var(--micro-lime)" : "var(--text-primary)",
                              border: `1px solid ${copiedTool === active.id ? "var(--micro-lime)" : "var(--border)"}`,
                            }}
                            title="Copy URL"
                          >
                            <span className="flex-1 text-left truncate">{activeUrl}</span>
                            <span
                              className="flex items-center gap-1.5 shrink-0 pl-3 font-medium font-sans"
                              style={{
                                borderLeft: "1px solid var(--border-dim)",
                                color: copiedTool === active.id ? "var(--micro-lime)" : "var(--text-primary)",
                              }}
                            >
                              {copiedTool === active.id ? <Check width={13} height={13} /> : <Copy width={13} height={13} />}
                              <span>{copiedTool === active.id ? "Copied" : "Copy URL"}</span>
                            </span>
                          </button>
                          {/* Support row — raw + guide links only.
                              Variant description lives in the option
                              cards above. */}
                          <div className="flex items-center justify-end gap-3 mt-2.5 text-caption" style={{ color: "var(--text-muted)" }}>
                            <a
                              href={urlVariant === "full" ? `/@${data?.hub?.slug ?? ""}.md?full=1` : `/@${data?.hub?.slug ?? ""}.md`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 transition-colors hover:underline"
                              title="Raw .md payload, what the AI actually sees"
                            >
                              <ExternalLink width={11} height={11} />
                              Raw
                            </a>
                            <Link
                              href={active.docHref}
                              target="_blank"
                              className="inline-flex items-center gap-1 transition-colors hover:underline"
                              title="Read the full integration guide"
                            >
                              Full guide
                              <ArrowUpRight width={11} height={11} />
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <pre
                        className="px-3 py-2.5 rounded-lg font-mono whitespace-pre-wrap"
                        style={{
                          color: "var(--text-primary)",
                          background: "var(--background)",
                          border: "1px solid var(--border-dim)",
                          margin: 0,
                          fontSize: 11,
                          lineHeight: 1.6,
                        }}
                      >{active.snippet}</pre>
                      <div className="flex items-center justify-between gap-3 mt-2.5 text-caption" style={{ color: "var(--text-muted)" }}>
                        <button
                          onClick={async () => {
                            if (typeof navigator === "undefined" || !navigator.clipboard) return;
                            try {
                              await navigator.clipboard.writeText(active.snippet);
                              setCopiedTool(active.id);
                              setTimeout(() => setCopiedTool(null), 1500);
                            } catch { /* clipboard blocked */ }
                          }}
                          className="inline-flex items-center gap-1 transition-colors hover:underline"
                          style={{ color: copiedTool === active.id ? "var(--micro-lime)" : "var(--text-muted)" }}
                          title="Copy snippet"
                        >
                          {copiedTool === active.id ? <Check width={11} height={11} /> : <Copy width={11} height={11} />}
                          {copiedTool === active.id ? "Copied" : "Copy snippet"}
                        </button>
                        <Link
                          href={active.docHref}
                          target="_blank"
                          className="inline-flex items-center gap-1 transition-colors hover:underline"
                          title="Read the full integration guide"
                        >
                          Full guide
                          <ArrowUpRight width={11} height={11} />
                        </Link>
                      </div>
                    </>
                  )}
                </div>
                {active.explanation && (
                  <p
                    className="leading-relaxed mt-4"
                    style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}
                  >
                    {active.explanation}
                  </p>
                )}
              </div>
            );
          })()}
          {/* Preview footer — two plain text-links matching the
              bundle viewer's support row. No uppercase eyebrow, no
              outline pills; just the muted action affordances. */}
          <div
            className="mt-4 pt-3 flex items-center justify-end gap-3 text-caption"
            style={{ borderTop: "1px solid var(--border-dim)", color: "var(--text-muted)" }}
          >
            <Link
              href={`/hub/${slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 transition-colors hover:underline"
              title="Rendered HTML, what a human visitor sees"
            >
              <Eye width={11} height={11} />
              View as visitor
            </Link>
            <Link
              href={`/raw/hub/${slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 transition-colors hover:underline"
              title="Raw .md payload, exactly what an AI fetching this URL receives"
            >
              <ExternalLink width={11} height={11} />
              Raw .md
            </Link>
          </div>
        </section>

        {/* ── Owner stat strip — counts by access tier. Typography
            matches the hub's other stat strip + the bundle viewer:
            Cal Sans number / Mono label (Title Case) / Mono context
            line. Uppercase eyebrow + bold text was screaming. */}
        {totalCounts && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-8">
            {(["public", "shared", "private"] as const).map((tier) => {
              const t = TIERS[tier];
              const Icon = t.icon;
              return (
                <div
                  key={tier}
                  className="rounded-lg px-4 py-4 flex flex-col"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                >
                  <div
                    className="tabular-nums"
                    style={{
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-display)",
                      fontSize: 32,
                      lineHeight: 1,
                      letterSpacing: 0,
                    }}
                  >
                    {totalCounts[tier]}
                  </div>
                  <div
                    className="mt-1"
                    style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
                  >
                    {t.label}
                  </div>
                  <div
                    className="mt-auto pt-4 flex items-center gap-1.5"
                    style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}
                  >
                    <Icon width={13} height={13} style={{ color: t.color }} />
                    <span>
                      {ov ? `${ov.bundles[tier].length} bundle${ov.bundles[tier].length === 1 ? "" : "s"}, ${ov.documents[tier].length} doc${ov.documents[tier].length === 1 ? "" : "s"}` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ── Build-ontology CTA — owner-only, only when concept_index
              is empty AND the hub already has docs to extract from.
              Calling this populates concept_index/concept_relations so
              the digest endpoint, suggestions, and per-concept pages
              get something to show. Hidden once any concept exists so
              we don't nag once the layer is bootstrapped. */}
        {data.isOwner && (data.counts.concepts ?? 0) === 0 && (data.counts.documents > 0) && (
          <section className="mb-8">
            <div
              className="px-4 py-4 rounded-xl flex items-start gap-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
            >
              <span
                className="flex items-center justify-center shrink-0 mt-0.5"
                style={{ width: 28, height: 28, borderRadius: 8, background: "var(--border)", color: "var(--text-primary)" }}
              >
                <Sparkles width={14} height={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Build your ontology
                </p>
                <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Extract concepts across your {data.counts.documents} document{data.counts.documents === 1 ? "" : "s"} so an AI can answer &ldquo;what does this hub know about X?&rdquo; in a single fetch instead of reading every doc. Runs once, refreshes incrementally as you write.
                </p>
                {ontologyProgress && (
                  <p className="text-caption mt-2 font-mono" style={{ color: ontologyError ? "#ef4444" : "var(--text-primary)" }}>
                    {ontologyError
                      ? ontologyError
                      : ontologyBuilding
                        ? `Extracting… ${ontologyProgress.processed} doc${ontologyProgress.processed === 1 ? "" : "s"}, ${ontologyProgress.concepts} concept${ontologyProgress.concepts === 1 ? "" : "s"}`
                        : `Done — ${ontologyProgress.processed} doc${ontologyProgress.processed === 1 ? "" : "s"}, ${ontologyProgress.concepts} concept${ontologyProgress.concepts === 1 ? "" : "s"}`}
                  </p>
                )}
              </div>
              <button
                onClick={buildOntology}
                disabled={ontologyBuilding}
                className="text-caption px-3 py-1.5 rounded shrink-0 transition-colors"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--background)",
                  opacity: ontologyBuilding ? 0.5 : 1,
                  cursor: ontologyBuilding ? "not-allowed" : "pointer",
                }}
              >
                {ontologyBuilding ? "Building…" : "Build ontology"}
              </button>
            </div>
          </section>
        )}

        {/* ── Concept-index freshness banner — surfaces when docs
              have been touched since the last ontology build, so
              the user knows the AI URL's concept layer is out of
              sync until they click Re-analyze. Body markdown is
              always fresh (per-doc 60s edge cache) — what's stale
              is the hub-wide concept attribution.
              Owner-only; parent gates by isOwner before passing
              the prop. Amber tone so it reads as a soft notice,
              not an error. */}
        {freshness?.isStale && onReanalyze && (
          <section
            className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            <span
              className="shrink-0 rounded-full"
              style={{ width: 8, height: 8, background: "#f59e0b" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="text-caption">
                <span className="font-semibold" style={{ color: "#f59e0b" }}>
                  Concepts out of date
                </span>
                <span style={{ color: "var(--text-faint)" }}>
                  {" · "}
                  {freshness.staleDocCount} {freshness.staleDocCount === 1 ? "doc has" : "docs have"} changed since the last build
                </span>
              </div>
              <div className="text-caption" style={{ color: "var(--text-muted)" }}>
                Body markdown in your AI URLs is always fresh (~60s).
                The concept index — what each AI sees as &ldquo;related&rdquo; —
                needs a refresh. Only the changed docs are re-extracted.
                {" "}
                <Link
                  href="/how-memorywiki-stays-fresh"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#f59e0b", textDecoration: "underline" }}
                >
                  Learn more
                </Link>
              </div>
            </div>
            <button
              onClick={onReanalyze}
              disabled={reanalyzing}
              className="text-caption px-3 py-1.5 rounded shrink-0 transition-colors"
              style={{
                background: "#f59e0b",
                color: "#000",
                fontWeight: 600,
                opacity: reanalyzing ? 0.5 : 1,
                cursor: reanalyzing ? "not-allowed" : "pointer",
              }}
            >
              {reanalyzing ? "Re-analyzing…" : `Re-analyze (${freshness.staleDocCount})`}
            </button>
          </section>
        )}

        {/* ── Auto-management status — compact card above Needs
              Review showing the current aggressiveness level + when
              it fires + a one-click "Run now" so users can kick a
              pass without crossing back to Settings. Renders only
              when the parent supplied the autoLevel prop (older
              callers that don't wire it just don't see the panel). */}
        {autoLevel && (() => {
          const levelMeta: Record<string, { label: string; tone: string }> = {
            "off":          { label: "Off",          tone: "var(--text-faint)" },
            "conservative": { label: "Conservative", tone: "#22c55e" },
            "standard":     { label: "Standard",     tone: "#38bdf8" },
            "aggressive":   { label: "Aggressive",   tone: "#f59e0b" },
          };
          const meta = levelMeta[autoLevel] || levelMeta["off"];
          const triggerLabel =
            autoTrigger === "on-open"  ? "fires when Hub opens"
            : autoTrigger === "interval" ? "fires every 30 min"
            : "manual only";
          const dotCount = autoLevel === "off" ? 0 : autoLevel === "conservative" ? 1 : autoLevel === "standard" ? 2 : 3;
          return (
            <section
              className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
            >
              <span className="flex items-center gap-0.5 shrink-0" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="rounded-full"
                    style={{ width: 6, height: 6, background: i < dotCount ? meta.tone : "var(--border-dim)" }}
                  />
                ))}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-caption">
                  <span className="font-semibold" style={{ color: meta.tone }}>Auto-management: {meta.label}</span>
                  <span style={{ color: "var(--text-faint)" }}> {triggerLabel}</span>
                </div>
                <div className="text-caption" style={{ color: "var(--text-muted)" }}>
                  {autoLevel === "off"
                    ? "Findings surface here for manual resolve. Bump to Conservative+ in Settings to auto-handle the safe ones."
                    : "Reversible actions only — Trash always restores. Irreversible actions (publishing, external rewrites) always ask."}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenAutoSettings && (
                  <button
                    onClick={onOpenAutoSettings}
                    className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                    style={{ background: "var(--background)", color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                  >
                    Settings
                  </button>
                )}
                {onAutoResolveRun && autoLevel !== "off" && (
                  <button
                    onClick={async () => {
                      if (runNowState !== "idle") return;
                      setRunNowState("running");
                      try {
                        const ret = onAutoResolveRun();
                        if (ret && typeof (ret as Promise<void>).then === "function") {
                          await ret;
                        }
                        setRunNowState("done");
                        setTimeout(() => setRunNowState("idle"), 1400);
                      } catch {
                        setRunNowState("idle");
                      }
                    }}
                    disabled={runNowState !== "idle"}
                    className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)] inline-flex items-center gap-1.5"
                    style={{
                      background: runNowState === "done" ? "rgba(181, 255, 26, 0.12)" : "var(--background)",
                      color: runNowState === "done" ? "var(--micro-lime)" : "var(--text-muted)",
                      border: `1px solid ${runNowState === "done" ? "var(--micro-lime)" : "var(--border-dim)"}`,
                      cursor: runNowState === "idle" ? "pointer" : "default",
                    }}
                  >
                    {runNowState === "running" && (
                      <span
                        aria-hidden
                        style={{
                          width: 10, height: 10, borderRadius: "50%",
                          border: "1.5px solid currentColor",
                          borderTopColor: "transparent",
                          display: "inline-block",
                          animation: "mw-spin 0.7s linear infinite",
                        }}
                      />
                    )}
                    {runNowState === "done" && <Check width={11} height={11} />}
                    {runNowState === "running" ? "Running…" : runNowState === "done" ? "Done" : "Run now"}
                  </button>
                )}
              </div>
            </section>
          );
        })()}

        {/* ── Needs Review — curator findings (orphan + duplicate
              detections). Same data the editor sidebar's Needs
              Review section reads; surfaced here so the hub view
              reflects what auto-management has flagged, not just
              what's been suggested. Founder ask: this content
              belongs in Hub too, not only behind the sidebar.
              Gated on the user's Settings toggles (orphan /
              duplicate) and the parent-provided lintResolved set
              so a row stays hidden after Resolve. Section renders
              ONLY when at least one finding is visible. ──────── */}
        {lintReport && (() => {
          const visibleOrphans = curatorOrphanEnabled
            ? lintReport.orphans.filter((o) => !lintResolved?.orphans.has(o.id))
            : [];
          const visibleDuplicates = curatorDuplicateEnabled
            ? lintReport.duplicates.filter((p) => !lintResolved?.duplicates.has(`${p.a.id}|${p.b.id}`))
            : [];
          const visibleTitleMismatches = curatorTitleMismatchEnabled
            ? (lintReport.titleMismatches || []).filter((m) => !lintResolved?.titleMismatches.has(m.id))
            : [];
          type ExtendedLint = HubLintReport & {
            staleClaims?: Array<{ id: string; title: string | null; updatedAt: string | null; ageDays: number; referenceCount: number }>;
            mergeSuggestions?: Array<{ a: { id: string; title: string | null }; b: { id: string; title: string | null }; distance: number }>;
            rollupSuggestions?: Array<{ concept: string; docIds: string[]; docCount: number }>;
            autoArchive?: Array<{ id: string; title: string | null; updatedAt: string | null; ageDays: number }>;
            bundleSuggestions?: Array<{ clusterId: string; suggestedTitle: string; docIds: string[]; docCount: number }>;
            citationRot?: Array<{ docId: string; docTitle: string | null; url: string; statusCode: number | null; firstFailedAt: string | null }>;
          };
          const lr = lintReport as ExtendedLint;
          const visibleStaleClaims = curatorStaleEnabled
            ? (lr.staleClaims || []).filter((s) => !lintResolved?.staleClaims?.has(s.id))
            : [];
          const visibleMergeSuggestions = curatorMergeEnabled
            ? (lr.mergeSuggestions || []).filter((p) => !lintResolved?.mergeSuggestions?.has(`${p.a.id}|${p.b.id}`))
            : [];
          const visibleRollupSuggestions = curatorRollupEnabled
            ? (lr.rollupSuggestions || []).filter((r) => !lintResolved?.rollupSuggestions?.has(r.concept))
            : [];
          const visibleAutoArchive = curatorAutoArchiveEnabled
            ? (lr.autoArchive || []).filter((a) => !lintResolved?.autoArchive?.has(a.id))
            : [];
          const visibleBundleSuggestions = curatorBundleSuggestionEnabled
            ? (lr.bundleSuggestions || []).filter((b) => !lintResolved?.bundleSuggestions?.has(b.clusterId))
            : [];
          const visibleCitationRot = curatorCitationRotEnabled
            ? (lr.citationRot || []).filter((c) => !lintResolved?.citationRot?.has(`${c.docId}|${c.url}`))
            : [];
          const total =
            visibleOrphans.length +
            visibleDuplicates.length +
            visibleTitleMismatches.length +
            visibleStaleClaims.length +
            visibleMergeSuggestions.length +
            visibleRollupSuggestions.length +
            visibleAutoArchive.length +
            visibleBundleSuggestions.length +
            visibleCitationRot.length;
          if (total === 0) return null;
          return (
            <section className="mb-8">
              <button
                onClick={() => setNeedsReviewCollapsed((v) => !v)}
                className="w-full flex items-center gap-2 mb-3 text-left transition-colors hover:opacity-90"
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(239, 68, 68, 0.16)", color: "var(--micro-red)" }}
                >
                  <ShieldAlert width={12} height={12} />
                </span>
                <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>Needs review</h2>
                <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>
                  {total} finding{total === 1 ? "" : "s"}
                </span>
                <span className="text-caption ml-auto flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
                  {autoOn && needsReviewCollapsed && (
                    <span style={{ color: "var(--text-muted)" }}>auto-managed</span>
                  )}
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: needsReviewCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                    <path d="M3 4.5L6 7.5L9 4.5" />
                  </svg>
                </span>
              </button>
              {!needsReviewCollapsed && (
              <div className="space-y-2">
                {visibleOrphans.map((o) => (
                  <div
                    key={`orphan:${o.id}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                      title="Orphan doc — not in any bundle, not linked elsewhere, no shared concepts"
                    >
                      <FileWarning width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {o.title || "Untitled"}
                        </span>
                      </div>
                      <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Not in any bundle, not linked from another doc, no shared concepts. Resolve re-runs concept extraction — it&apos;ll drop off the list if it actually shares concepts with something.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onResolveOrphan && (
                        <button
                          onClick={() => onResolveOrphan(o.id, o.title)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Resolve
                        </button>
                      )}
                      <button
                        onClick={() => onOpenDoc?.(o.id)}
                        className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
                {visibleDuplicates.map((p) => (
                  <div
                    key={`dup:${p.a.id}|${p.b.id}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                      title={`Likely duplicate — cosine distance ${p.distance.toFixed(3)}`}
                    >
                      <Copy width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {(p.a.title || "Untitled")} ↔ {(p.b.title || "Untitled")}
                        </span>
                      </div>
                      <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Embedding distance {p.distance.toFixed(3)}. Resolve moves the older copy to Trash and keeps the newer as canonical — restorable from Trash if wrong.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onResolveDuplicate && (
                        <button
                          onClick={() => onResolveDuplicate(p.a.id, p.a.title, p.b.id, p.b.title)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Resolve
                        </button>
                      )}
                      <button
                        onClick={() => onOpenDoc?.(p.a.id)}
                        className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                      >
                        Open older
                      </button>
                    </div>
                  </div>
                ))}
                {visibleTitleMismatches.map((m) => (
                  <div
                    key={`title:${m.id}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                      title="Title mismatch — title doesn't reflect the doc's concepts"
                    >
                      <FileWarning width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {m.title || "Untitled"}
                        </span>
                      </div>
                      <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Title doesn&apos;t mention any of this doc&apos;s concepts. Consider renaming to surface <span className="font-mono" style={{ color: "var(--text-primary)" }}>{m.topConcept}</span>
                        {m.concepts.length > 1 ? ` (or ${m.concepts.slice(1, 3).map((c) => c).join(", ")})` : ""}.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onResolveTitleMismatch && (
                        <button
                          onClick={() => onResolveTitleMismatch(m.id, m.title, m.topConcept)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Rename
                        </button>
                      )}
                      <button
                        onClick={() => onOpenDoc?.(m.id)}
                        className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
                {visibleStaleClaims.map((s) => (
                  <div
                    key={`stale:${s.id}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(96,165,250,0.12)", color: "var(--micro-info)" }}
                      title="Stale claim — doc is old but still load-bearing"
                    >
                      <Clock width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {s.title || "Untitled"}
                        </span>
                      </div>
                      <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Last edited {s.ageDays} days ago, still referenced from {s.referenceCount} place{s.referenceCount === 1 ? "" : "s"}. Re-read and confirm the claim still holds.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onOpenDoc?.(s.id)}
                        className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                      >
                        Open
                      </button>
                      {onResolveStaleClaim && (
                        <button
                          onClick={() => onResolveStaleClaim(s.id)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Confirmed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {visibleMergeSuggestions.map((p) => (
                  <div
                    key={`merge:${p.a.id}|${p.b.id}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(167,139,250,0.14)", color: "var(--micro-ai)" }}
                      title="Merge suggestion — embeddings overlap, you may want to consolidate"
                    >
                      <GitBranch width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {p.a.title || "Untitled"}
                        </span>
                        <span className="font-mono text-caption" style={{ color: "var(--text-faint)" }}>+</span>
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {p.b.title || "Untitled"}
                        </span>
                      </div>
                      <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Embeddings overlap (distance {p.distance.toFixed(2)}). Decide whether to merge into one canonical doc.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onOpenDoc?.(p.a.id)}
                        className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                      >
                        Open A
                      </button>
                      <button
                        onClick={() => onOpenDoc?.(p.b.id)}
                        className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                      >
                        Open B
                      </button>
                      {onResolveMergeSuggestion && (
                        <button
                          onClick={() => onResolveMergeSuggestion(p.a.id, p.b.id)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {visibleRollupSuggestions.map((r) => (
                  <div
                    key={`rollup:${r.concept}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(181,255,26,0.14)", color: "var(--micro-lime)" }}
                      title="Roll-up suggestion — many docs share this concept"
                    >
                      <Sparkles width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="font-mono text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {r.concept}
                        </span>
                        <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>
                          {r.docCount} docs
                        </span>
                      </div>
                      <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Consider synthesising these into a single summary doc you can cite from one URL.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onResolveRollupSuggestion && (
                        <button
                          onClick={() => onResolveRollupSuggestion(r.concept)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {visibleCitationRot.map((c) => (
                  <div
                    key={`cite:${c.docId}|${c.url}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(239,68,68,0.12)", color: "var(--micro-red)" }}
                      title="Citation rot — external link is dead"
                    >
                      <ExternalLink width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {c.docTitle || "Untitled"}
                        </span>
                        {c.statusCode !== null && (
                          <span className="font-mono text-caption" style={{ color: "var(--micro-red)" }}>
                            {c.statusCode}
                          </span>
                        )}
                      </div>
                      <p className="text-caption leading-relaxed truncate" style={{ color: "var(--text-secondary)" }}>
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">
                          {c.url}
                        </a>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onOpenDoc?.(c.docId)}
                        className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                      >
                        Open
                      </button>
                      {onDismissCitationRot && (
                        <button
                          onClick={() => onDismissCitationRot(c.docId, c.url)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {visibleBundleSuggestions.map((b) => (
                  <div
                    key={`bundle-sug:${b.clusterId}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(181,255,26,0.14)", color: "var(--micro-lime)" }}
                      title="Bundle suggestion — these docs share a topical cluster"
                    >
                      <Layers width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {b.suggestedTitle}
                        </span>
                        <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>
                          {b.docCount} docs
                        </span>
                      </div>
                      <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        These docs share a topical cluster. Bundle them so you can paste one URL into any AI and have the whole group as context.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onAcceptBundleSuggestion && (
                        <button
                          onClick={() => onAcceptBundleSuggestion(b.clusterId, b.suggestedTitle, b.docIds)}
                          className="text-caption px-2.5 py-1 rounded transition-colors"
                          style={{ color: "var(--background)", background: "var(--text-primary)" }}
                        >
                          Bundle
                        </button>
                      )}
                      {onDismissBundleSuggestion && (
                        <button
                          onClick={() => onDismissBundleSuggestion(b.clusterId)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {visibleAutoArchive.map((a) => (
                  <div
                    key={`archive:${a.id}`}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(161,161,170,0.18)", color: "var(--text-muted)" }}
                      title="Auto-archive candidate — old and unreferenced"
                    >
                      <FolderClosed width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {a.title || "Untitled"}
                        </span>
                      </div>
                      <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Untouched for {a.ageDays} days, not referenced anywhere. Safe to archive (still restorable).
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onOpenDoc?.(a.id)}
                        className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                      >
                        Open
                      </button>
                      {onResolveAutoArchive && (
                        <button
                          onClick={() => onResolveAutoArchive(a.id)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Keep
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </section>
          );
        })()}

        {/* ── AI suggestions — promote drafts, bundle clusters, expand
              underexplored concepts. Heuristic, no LLM call. Cards are
              dismissable; "Promote" publishes inline; "Bundle these"
              opens BundleCreator pre-filled. */}
        {suggestions && (() => {
          const promoteCards = (suggestions.promote || [])
            .filter((s) => !dismissedSuggestions.has(`promote:${s.docId}`));
          const bundleCards = (suggestions.bundles || [])
            .filter((s) => !dismissedSuggestions.has(`bundle:${s.concept.toLowerCase()}`));
          const thinCards = (suggestions.thin || [])
            .filter((s) => !dismissedSuggestions.has(`thin:${s.concept.toLowerCase()}`));
          if (promoteCards.length === 0 && bundleCards.length === 0 && thinCards.length === 0) return null;
          // Per-doc access lookup — used to inline a small share-status
          // icon next to every doc-title reference inside a suggestion
          // body, so the user can tell at a glance whether a referenced
          // doc is public / shared / private without crossing back to
          // the library list. Built from ownerView when present; an
          // unknown doc just doesn't render an icon.
          type AccessKind = "public" | "shared" | "private";
          const docAccess = new Map<string, AccessKind>();
          if (data?.ownerView) {
            for (const d of data.ownerView.documents.public) docAccess.set(d.id, "public");
            for (const d of data.ownerView.documents.shared) docAccess.set(d.id, "shared");
            for (const d of data.ownerView.documents.private) docAccess.set(d.id, "private");
          }
          // Two layouts for the inline doc-status glyph:
          //   "block" — used inside a flex row next to the title. Sized
          //   to match the title (14px) and lets the parent's gap
          //   handle spacing, so no marginRight (was double-spacing
          //   with the parent's gap-2 + the icon's marginRight,
          //   leaving an empty gap to the right of the icon).
          //   "inline" — used mid-sentence inside body text. Smaller
          //   (11px), inline-flow with a manual 3px right margin so
          //   the doc title that follows sits close to it.
          const InlineDocStatus = ({ docId, variant = "inline" }: { docId: string | undefined; variant?: "inline" | "block" }) => {
            if (!docId) return null;
            const kind = docAccess.get(docId);
            if (!kind) return null;
            const Icon = kind === "public" ? Globe : kind === "shared" ? Users : Cloud;
            const color = kind === "public" ? "#22c55e" : kind === "shared" ? "#60a5fa" : "var(--text-faint)";
            if (variant === "block") {
              return <Icon width={14} height={14} className="shrink-0" style={{ color }} />;
            }
            return (
              <Icon
                width={11}
                height={11}
                style={{ color, display: "inline", verticalAlign: "-0.15em", marginRight: 3 }}
              />
            );
          };
          const totalSuggestions = promoteCards.length + bundleCards.length + thinCards.length;
          return (
            <section className="mb-8">
              <button
                onClick={() => setSuggestionsCollapsed((v) => !v)}
                className="w-full flex items-center gap-2 mb-3 text-left transition-colors hover:opacity-90"
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 22, height: 22, borderRadius: 6, background: "var(--border)", color: "var(--text-primary)" }}
                >
                  <Sparkles width={12} height={12} />
                </span>
                <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>Suggestions</h2>
                <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>
                  {totalSuggestions} item{totalSuggestions === 1 ? "" : "s"}
                </span>
                <span className="text-caption ml-auto flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
                  {autoOn && suggestionsCollapsed && (
                    <span style={{ color: "var(--text-muted)" }}>auto-managed</span>
                  )}
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: suggestionsCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                    <path d="M3 4.5L6 7.5L9 4.5" />
                  </svg>
                </span>
              </button>
              {!suggestionsCollapsed && (<>
              {/* Suggestion rows — colour discipline:
                    - Card body stays flat surface + dim border.
                    - Type marker = coloured icon container only (no
                      uppercase Promote / Bundle / Expand label any
                      more — the glyph + the body's lead phrase already
                      say what kind of row this is, and the duplicate
                      label was adding visual weight without info).
                    - Concept names keep the accent-orange mono treatment
                      so the "this is what links the suggestion to your
                      hub" signal stays visible.
                    - Doc title references render the doc's share-status
                      glyph (Globe / Users / Cloud) inline so the user
                      can tell at a glance whether a referenced doc is
                      public, shared, or private.
                    - Action buttons all share one bordered-neutral
                      style. Primary action sits leftmost; the label
                      text differentiates intent ("Publish" / "Create
                      bundle" / "Expand" / "Open"). No filled colour
                      buttons, no text-primary vs text-muted split. */}
              <div className="space-y-2">
                {promoteCards.map((s) => {
                  const key = `promote:${s.docId}`;
                  const busy = busySuggestionId === key;
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0 mt-0.5"
                        style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
                        title="Promote — publish this draft"
                      >
                        <ArrowUpRight width={14} height={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <InlineDocStatus docId={s.docId} variant="block" />
                          <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>{s.title}</span>
                        </div>
                        <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          Shares concepts with your published docs:{" "}
                          {s.sharedConcepts.slice(0, 3).map((c, i) => (
                            <span key={i} className="font-mono" style={{ color: "var(--text-primary)" }}>
                              {i > 0 ? ", " : ""}{c}
                            </span>
                          ))}
                          . Publishing makes it part of your hub.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => promoteDoc(s.docId)}
                          disabled={busy}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{
                            color: "var(--text-muted)",
                            border: "1px solid var(--border-dim)",
                            opacity: busy ? 0.4 : 1,
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          {busy ? "…" : "Publish"}
                        </button>
                        <button
                          onClick={() => onOpenDoc?.(s.docId)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Open
                        </button>
                        <button
                          onClick={() => dismissSuggestion(key)}
                          className="text-caption px-1.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-faint)" }}
                          title="Dismiss"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {bundleCards.map((s) => {
                  const key = `bundle:${s.concept.toLowerCase()}`;
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0 mt-0.5"
                        style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}
                        title="Bundle suggestion"
                      >
                        <Layers width={14} height={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                            {s.docIds.length} docs about “{s.concept}”
                          </span>
                        </div>
                        <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          Including:{" "}
                          {s.docTitles.slice(0, 3).map((t, i) => (
                            <span key={i}>
                              {i > 0 ? ", " : ""}
                              <InlineDocStatus docId={s.docIds[i]} />
                              <em style={{ color: "var(--text-primary)" }}>{t}</em>
                            </span>
                          ))}
                          {s.docIds.length > s.docTitles.length ? `, +${s.docIds.length - s.docTitles.length} more` : ""}.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onCreateBundleFromDocs?.(s.docIds, s.concept)}
                          disabled={!onCreateBundleFromDocs}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{
                            color: "var(--text-muted)",
                            border: "1px solid var(--border-dim)",
                            opacity: !onCreateBundleFromDocs ? 0.4 : 1,
                            cursor: !onCreateBundleFromDocs ? "not-allowed" : "pointer",
                          }}
                        >
                          Create bundle
                        </button>
                        <button
                          onClick={() => dismissSuggestion(key)}
                          className="text-caption px-1.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-faint)" }}
                          title="Dismiss"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {thinCards.map((s) => {
                  const key = `thin:${s.concept.toLowerCase()}`;
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0 mt-0.5"
                        style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}
                        title="Underexplored concept"
                      >
                        <Lightbulb width={14} height={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                            “{s.concept}” appears in only 1 doc
                          </span>
                        </div>
                        <p className="text-caption leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          But it&apos;s connected to{" "}
                          {s.neighbors.slice(0, 3).map((n, i) => (
                            <span key={i} className="font-mono" style={{ color: "var(--text-primary)" }}>
                              {i > 0 ? ", " : ""}{n}
                            </span>
                          ))}
                          {" "}— concepts you&apos;ve explored more elsewhere. Open{" "}
                          <InlineDocStatus docId={s.docId} />
                          <em style={{ color: "var(--text-primary)" }}>{s.docTitle}</em> and expand.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onExpandConcept?.(s.concept, s.docId, s.neighbors)}
                          disabled={!onExpandConcept}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{
                            color: "var(--text-muted)",
                            border: "1px solid var(--border-dim)",
                            opacity: !onExpandConcept ? 0.4 : 1,
                            cursor: !onExpandConcept ? "not-allowed" : "pointer",
                          }}
                          title="Start a new note on this concept"
                        >
                          Expand
                        </button>
                        <button
                          onClick={() => onOpenDoc?.(s.docId)}
                          className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                        >
                          Open
                        </button>
                        <button
                          onClick={() => dismissSuggestion(key)}
                          className="text-caption px-1.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-faint)" }}
                          title="Dismiss"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>)}
            </section>
          );
        })()}

        {/* ── Recent activity (last 12 events from hub_log) ── */}
        {data.recentActivity && data.recentActivity.length > 0 && (
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setRecentCollapsed((v) => !v)}
              className="w-full flex items-center gap-2 mb-3 text-left transition-opacity hover:opacity-90"
              aria-expanded={!recentCollapsed}
            >
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 22, height: 22, borderRadius: 6, background: "var(--toggle-bg)", color: "var(--text-muted)" }}
              >
                <Eye width={12} height={12} />
              </span>
              <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>Recent activity</h2>
              <span className="text-caption ml-auto flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
                <span>Last {data.recentActivity.length} events</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ transform: recentCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                >
                  <path d="M3 4.5L6 7.5L9 4.5" />
                </svg>
              </span>
            </button>
            {!recentCollapsed && (
            <ul className="space-y-0.5">
              {data.recentActivity.map((evt) => {
                const labels: Record<string, string> = {
                  "doc.created": "Created",
                  "doc.updated": "Updated",
                  "doc.deleted": "Deleted",
                  "doc.imported": "Imported",
                  "bundle.created": "Bundle created",
                  "bundle.deleted": "Bundle deleted",
                  "synthesis.created": "Synthesised",
                  "synthesis.updated": "Resynthesised",
                  "schema.updated": "Schema updated",
                };
                const label = labels[evt.event] || evt.event;
                const isClickable = evt.targetId && (evt.targetType === "document" || evt.targetType === "bundle");
                const onClick = isClickable
                  ? () => {
                      if (evt.targetType === "document") onOpenDoc?.(evt.targetId!);
                      else if (evt.targetType === "bundle") onOpenBundle?.(evt.targetId!);
                    }
                  : undefined;
                return (
                  <li key={evt.id}>
                    <button
                      onClick={onClick}
                      disabled={!onClick}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
                      style={{ cursor: isClickable ? "pointer" : "default" }}
                    >
                      <span
                        className="text-caption font-mono uppercase tracking-wider shrink-0"
                        style={{ color: "var(--text-primary)", fontSize: 9, letterSpacing: "0.06em", minWidth: 64 }}
                      >
                        {label}
                      </span>
                      <span className="flex-1 truncate text-caption" style={{ color: "var(--text-primary)" }}>
                        {evt.summary || (evt.targetId ? evt.targetId : "—")}
                      </span>
                      <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>
                        {relativeTime(evt.ts)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        )}

        {(() => {
          const rawGroups = data.mediaImages || [];
          const groups = rawGroups
            .map((g) => ({ ...g, urls: g.urls.filter((u) => !brokenImages.has(u)) }))
            .filter((g) => g.urls.length > 0);
          const total = groups.reduce((s, g) => s + g.urls.length, 0);
          if (total === 0) return null;
          const flatUrls = groups.flatMap((g) => g.urls);
          return (
            <section className="mb-8">
              <button
                type="button"
                onClick={() => setMediaCollapsed((v) => !v)}
                className="w-full flex items-center gap-2 mb-3 text-left transition-opacity hover:opacity-90"
                aria-expanded={!mediaCollapsed}
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 22, height: 22, borderRadius: 6, background: "var(--toggle-bg)", color: "var(--text-muted)" }}
                >
                  <ImageIcon width={12} height={12} />
                </span>
                <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>Media</h2>
                <span className="text-caption font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
                  {total}
                </span>
                <span className="text-caption ml-auto flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
                  <span>Across {groups.length} {groups.length === 1 ? "doc" : "docs"}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ transform: mediaCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" />
                  </svg>
                </span>
              </button>
              {!mediaCollapsed && (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <div key={g.docId}>
                      <button
                        onClick={() => onOpenDoc?.(g.docId)}
                        className="text-caption font-medium mb-1.5 inline-flex items-center gap-1 transition-colors hover:underline"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <FileText width={11} height={11} />
                        <span className="truncate" style={{ maxWidth: 320 }}>{g.docTitle}</span>
                        <span className="font-mono" style={{ color: "var(--text-faint)" }}>· {g.urls.length}</span>
                      </button>
                      <div
                        className="grid gap-1.5"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))" }}
                      >
                        {g.urls.map((url) => {
                          const flatIdx = flatUrls.indexOf(url);
                          return (
                            <button
                              key={url}
                              type="button"
                              onClick={() => { if (flatIdx >= 0) setLightboxIndex(flatIdx); }}
                              className="block rounded-md overflow-hidden transition-opacity hover:opacity-90 p-0"
                              style={{ aspectRatio: "1 / 1", background: "var(--surface)", border: "1px solid var(--border-dim)", cursor: "zoom-in" }}
                              title={url}
                              aria-label="Open image"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt=""
                                loading="lazy"
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                onError={() => setBrokenImages((prev) => {
                                  if (prev.has(url)) return prev;
                                  const next = new Set(prev);
                                  next.add(url);
                                  return next;
                                })}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })()}

        {/* ── Owner view — three sections by access tier, bundles
              above docs in each section. Non-owner falls through to
              the simpler public-only fallback below. ─────────────── */}
        {ov && (["public", "shared", "private"] as const).map((tier) => {
          const t = TIERS[tier];
          const bundles = ov.bundles[tier];
          const docs = ov.documents[tier];
          if (bundles.length === 0 && docs.length === 0) return null;
          const Icon = t.icon;
          const collapsed = tierCollapsed[tier];
          return (
            <section key={tier} className="mb-10">
              <button
                type="button"
                onClick={() => setTierCollapsed((prev) => ({ ...prev, [tier]: !prev[tier] }))}
                className="w-full flex items-baseline gap-2 mb-3 pb-2 text-left transition-opacity hover:opacity-90"
                style={{ borderBottom: `1px solid ${t.bg}` }}
                aria-expanded={!collapsed}
              >
                <span
                  className="flex items-center justify-center shrink-0 self-center"
                  style={{ width: 22, height: 22, borderRadius: 6, background: t.bg, color: t.color }}
                >
                  <Icon width={12} height={12} />
                </span>
                <h2 style={{ color: t.color, margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>{t.label}</h2>
                <span className="text-caption font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
                  {bundles.length + docs.length}
                </span>
                <span className="text-caption ml-auto flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
                  <span>{t.desc}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" />
                  </svg>
                </span>
              </button>

              {!collapsed && (<>
              {/* Bundles first — workspace primitive comes above docs */}
              {bundles.length > 0 && (
                <div className="mb-4">
                  <div className="text-caption uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)", fontSize: 10 }}>
                    Bundles ({bundles.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {bundles.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => onOpenBundle?.(b.id)}
                        className="text-left flex flex-col gap-1 p-3 rounded-lg transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Layers width={13} height={13} style={{ color: t.color }} className="shrink-0" />
                          <span className="text-body font-medium truncate" style={{ color: "var(--text-primary)" }}>{b.title}</span>
                          <span className="ml-auto text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>{relativeTime(b.updated_at)}</span>
                        </div>
                        {b.description && (
                          <p className="text-caption line-clamp-2 leading-relaxed" style={{ color: "var(--text-faint)" }}>
                            {b.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Docs — same row layout the sidebar uses, with the
                  same DocStatusIcon so a doc reads identically here
                  and in MDs. */}
              {docs.length > 0 && (
                <div>
                  <div className="text-caption uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)", fontSize: 10 }}>
                    Docs ({docs.length})
                  </div>
                  {/* Same row shape as the bundle Documents list:
                      icon + title (flex-1) + updated, all vertically
                      centered so the three atoms align on one
                      baseline. Bordered card to read as a discrete
                      entry, not a flat menu row. */}
                  <ul className="space-y-1.5">
                    {docs.slice(0, 30).map((d) => (
                      <li key={d.id}>
                        <button
                          onClick={() => onOpenDoc?.(d.id)}
                          className="w-full text-left rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ border: "1px solid var(--border-dim)" }}
                        >
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <div className="shrink-0">
                              <DocStatusIcon
                                tab={{
                                  isDraft: d.isDraft,
                                  editMode: d.editMode || undefined,
                                  cloudId: d.cloudId,
                                  permission: "mine",
                                  hasPassword: d.hasPassword,
                                  sharedWithCount: d.sharedWithCount,
                                }}
                                isActive={false}
                              />
                            </div>
                            <span className="flex-1 truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>{d.title}</span>
                            <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>{relativeTime(d.updated_at)}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {docs.length > 30 && (
                    <p className="text-caption mt-2" style={{ color: "var(--text-faint)" }}>
                      +{docs.length - 30} more, open the sidebar to browse all.
                    </p>
                  )}
                </div>
              )}
              </>)}
            </section>
          );
        })}

        {/* ── Non-owner fallback — when API didn't return ownerView,
              this is a public visitor. Show only what's public. ── */}
        {!ov && data.documents.length > 0 && (
          <section className="mb-10">
            <header className="flex items-baseline justify-between mb-3">
              <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>Public</h2>
              <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                {data.counts.bundles} bundle{data.counts.bundles === 1 ? "" : "s"}, {data.counts.documents} doc{data.counts.documents === 1 ? "" : "s"}
              </span>
            </header>
            <ul className="space-y-1">
              {data.documents.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => onOpenDoc?.(d.id)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
                  >
                    <DocStatusIcon tab={{ isDraft: false, cloudId: d.id, permission: "readonly" }} isActive={false} />
                    <span className="flex-1 truncate text-body" style={{ color: "var(--text-primary)" }}>{d.title}</span>
                    <span className="text-caption shrink-0 font-mono" style={{ color: "var(--text-faint)" }}>{relativeTime(d.updated_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Empty hub state */}
        {ov && totalCounts &&
          totalCounts.public === 0 && totalCounts.shared === 0 && totalCounts.private === 0 && (
          <div className="py-12 text-center">
            <ShieldAlert width={24} height={24} className="mx-auto mb-3" style={{ color: "var(--text-faint)", opacity: 0.5 }} />
            <p className="text-body mb-1" style={{ color: "var(--text-secondary)" }}>
              No content yet.
            </p>
            <p className="text-caption" style={{ color: "var(--text-faint)" }}>
              Create a doc or a bundle to fill your hub.
            </p>
          </div>
        )}
      </div>
      </div>
      <MediaLightbox
        urls={(data.mediaImages || [])
          .map((g) => ({ ...g, urls: g.urls.filter((u) => !brokenImages.has(u)) }))
          .filter((g) => g.urls.length > 0)
          .flatMap((g) => g.urls)}
        index={lightboxIndex}
        onChange={(n) => setLightboxIndex(n)}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}
