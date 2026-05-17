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
  Network, Clock, FolderClosed,
} from "lucide-react";
import DocStatusIcon from "@/components/DocStatusIcon";
import MdfyLogo from "@/components/MdfyLogo";

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
  lintResolved?: HubLintResolved;
  onResolveOrphan?: (docId: string, docTitle: string | null) => void;
  onResolveDuplicate?: (aId: string, aTitle: string | null, bId: string, bTitle: string | null) => void;
  onResolveTitleMismatch?: (docId: string, docTitle: string | null, suggestedConcept: string) => void;
  /** Auto-management settings — drives the status panel above
   *  Needs Review. When omitted, the panel doesn't render. */
  autoLevel?: "off" | "conservative" | "standard" | "aggressive";
  autoTrigger?: "manual" | "on-open" | "interval";
  /** Run the auto-management pass right now. Wired to the panel's
   *  "Run now" button. */
  onAutoResolveRun?: () => void;
  /** Deep-link to the auto-management section of Settings. */
  onOpenAutoSettings?: () => void;
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
const HUB_CACHE_KEY = "mdfy-hub-data-cache-v1";

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
  lintResolved,
  onResolveOrphan,
  onResolveDuplicate,
  onResolveTitleMismatch,
  autoLevel,
  autoTrigger,
  onAutoResolveRun,
  onOpenAutoSettings,
}: HubEmbedProps) {
  // Needs Review + Suggestions default to COLLAPSED when auto-
  // management is on — the assumption is mdfy is handling them
  // for you, so the user shouldn't have to scroll past detailed
  // lists every Hub visit. When auto-management is off, both
  // sections default OPEN so manual triage is still front-and-
  // centre. The user can toggle each independently and that
  // override persists for the session via the click state.
  const autoOn = !!autoLevel && autoLevel !== "off";
  const [needsReviewCollapsed, setNeedsReviewCollapsed] = useState(autoOn);
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(autoOn);
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
        <div className="mdfy-loader-enter">
          <MdfyLogo size={26} />
        </div>
        <div style={{ width: 96, height: 2, background: "var(--border-dim)", borderRadius: 1, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, height: "100%", width: "40%", background: "var(--accent)", borderRadius: 1, animation: "mdfyLoaderBar 1.1s ease-in-out infinite" }} />
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
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* ── Identity row. The eyebrow "Public knowledge hub"
              previously sat above this header, but the slug pill
              (/hub/<slug>) and the Deploy-to-AI block already say
              the same thing — removing it keeps the page top
              quieter. */}
        {/* Identity strip — small, supporting. Title + slug as one
            visual unit, bio as a single line beneath. Stays out of
            the way so the Deploy URL card below can be the hero. */}
        <header className="flex items-start gap-3 mb-5">
          <img
            src={data.hub.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(slug)}`}
            alt=""
            className="shrink-0 rounded-xl"
            style={{ width: 40, height: 40, border: "1px solid var(--border-dim)" }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline flex-wrap gap-x-3 gap-y-0.5">
              <h1
                className="text-display font-bold tracking-tight"
                style={{ color: "var(--text-primary)", lineHeight: 1.2 }}
              >
                {data.hub.display_name || slug}
              </h1>
              <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                /hub/{slug}
              </span>
            </div>
            {data.hub.description && (
              <p className="text-body mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {data.hub.description}
              </p>
            )}
          </div>
        </header>

        {/* Deploy URL card — THE focal point. One large URL field
            with a tiny variant toggle above (Digest / Full); meta +
            Galaxy entry tucked into the card's footer. Replaces the
            old "intro para + Digest URL + Full URL" stack which
            spread the same info across three rows. */}
        <section
          className="mb-6 rounded-xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
        >
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-1">
                {(["digest", "full"] as const).map((v) => {
                  const active = urlVariant === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setUrlVariant(v)}
                      className="text-caption font-mono uppercase px-2 py-0.5 rounded transition-colors"
                      style={{
                        fontSize: 10,
                        letterSpacing: 0.5,
                        color: active ? "var(--accent)" : "var(--text-muted)",
                        background: active ? "var(--accent-dim)" : "transparent",
                        border: `1px solid ${active ? "var(--accent-dim)" : "var(--border-dim)"}`,
                      }}
                    >
                      {v === "digest" ? "Digest" : "Full"}
                    </button>
                  );
                })}
              </div>
              <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                {urlVariant === "digest" ? "compact concept map, cheap to paste" : "every doc inline, heavier"}
              </span>
            </div>
            <button
              onClick={copyUrl}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono transition-colors hover:bg-[var(--toggle-bg)]"
              style={{
                fontSize: 13,
                background: "var(--background)",
                color: copied ? "#22c55e" : "var(--text-primary)",
                border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "var(--border-dim)"}`,
              }}
              title="Copy URL"
            >
              <span className="flex-1 text-left truncate">
                {urlVariant === "full" ? `${data.hub.url}?full=1` : data.hub.url}
              </span>
              <span className="flex items-center gap-1 shrink-0" style={{ color: copied ? "#22c55e" : "var(--text-faint)" }}>
                {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                <span className="text-caption">{copied ? "Copied" : "Copy"}</span>
              </span>
            </button>
          </div>
          {/* Footer — meta + Galaxy. Sits inside the same card as the
              URL so "what this is / how big / open as constellation"
              read as one cohesive deploy unit. */}
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
              <div
                className="px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap"
                style={{ borderTop: "1px solid var(--border-dim)", background: "var(--background)" }}
              >
                <div className="flex items-center gap-3 flex-wrap">
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
                </div>
                <Link
                  href="/galaxy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-caption font-mono px-2.5 py-1 rounded transition-colors hover:bg-[var(--accent-dim)]"
                  style={{
                    color: "var(--accent)",
                    textDecoration: "none",
                    letterSpacing: 0.3,
                  }}
                  title="Open your hub as a constellation"
                >
                  <Network width={11} height={11} />
                  <span>Galaxy</span>
                  <ArrowUpRight width={11} height={11} />
                </Link>
              </div>
            );
          })()}
        </section>

        {/* Setup card — per-tool snippets. Demoted to a secondary
            card so the Deploy URL above stays the focal point. */}
        <section
          className="mb-8 px-5 py-4 rounded-xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
        >
          {/* Per-tool setup. Two-row tab layout:
                Row 1 — "where you do AI" (Claude / ChatGPT / Gemini /
                Claude Code / Cursor / Generic), ordered by likely-
                use frequency (chat surfaces first, IDE next).
                Row 2 — "mdfy native" runtime (MCP / Skill / CLI)
                under a small "via mdfy:" label so users see them
                as add-on capabilities, not yet-another-vendor.
              The active tab's snippet card carries a one-line hint,
              the snippet itself, a multi-sentence user-friendly
              explanation, a Copy button, and a "Full guide →" link
              to the relevant /docs page. */}
          {(() => {
            const url = data.hub.url;
            const projCtx = `# Project context

mdfy hub: ${url}

Fetch this URL on every session. The response carries clean
markdown of the user's knowledge graph (concept index, bundle
analyses, doc list) — paste-and-go context.`;
            const cursorRule = `---
description: mdfy hub context
alwaysApply: true
---
mdfy hub: ${url}

Fetch this URL on every session for the user's knowledge graph
(concept index, bundle analyses, doc list).`;
            const mcpConfig = `{
  "mcpServers": {
    "mdfy": {
      "command": "npx",
      "args": ["-y", "mdfy-mcp"]
    }
  }
}`;
            const skillUse = `# Install once
claude skill install mdfy

# Inside any Claude Code session
/mdfy capture "your idea"
/mdfy search "topic"
/mdfy hub`;
            const cliUse = `npm install -g mdfy-cli

mdfy capture "your idea"
mdfy search "topic"
mdfy hub`;

            type Tool = {
              id: string;
              label: string;
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
                group: "user",
                hint: "Drop the URL into a Claude chat",
                snippet: url,
                explanation:
                  "Works the same in Claude.ai (web) and the Mac / Windows desktop app. Claude fetches the digest — a compact concept map of your hub — and follows the inline links to specific docs as needed. Append ?full=1 if you want every doc inlined up-front.",
                docHref: "/docs/integrate",
              },
              {
                id: "chatgpt",
                label: "ChatGPT",
                group: "user",
                hint: "Drop the URL into a ChatGPT chat",
                snippet: url,
                explanation:
                  "Works in ChatGPT web and the Mac desktop app. ChatGPT fetches the URL with its built-in browser tool, reads the digest, and follows the inline links into specific docs when it needs more context.",
                docHref: "/docs/integrate",
              },
              {
                id: "gemini",
                label: "Gemini",
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
                group: "user",
                hint: "Save as .cursor/rules/mdfy.mdc in your project root",
                snippet: cursorRule,
                savePath: ".cursor/rules/mdfy.mdc",
                explanation:
                  "Cursor's Rules feature reads .mdc files from .cursor/rules/. The alwaysApply: true frontmatter keeps your hub URL in context on every chat in the repo, including ad-hoc questions.",
                docHref: "/docs/integrate#cursor",
              },
              {
                id: "generic",
                label: "Generic",
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
                group: "native",
                hint: "Add mdfy-mcp to your MCP host config",
                snippet: mcpConfig,
                explanation:
                  "Compatible with Claude Desktop, Cursor, Cline, Windsurf, and any MCP-capable host. Exposes 26 tools across capture / bundle / search / share / version history — so the AI can write into your hub, not just read it.",
                docHref: "/docs/mcp",
              },
              {
                id: "skill",
                label: "Skill",
                group: "native",
                hint: "Use /mdfy slash commands inside Claude Code",
                snippet: skillUse,
                explanation:
                  "Install once with `claude skill install mdfy`. Then in any Claude Code session, run slash commands like /mdfy capture, /mdfy search, /mdfy hub. The skill is namespaced so it doesn't collide with Claude's built-ins.",
                docHref: "/docs/integrate",
              },
              {
                id: "cli",
                label: "CLI",
                group: "native",
                hint: "Capture and search from your terminal",
                snippet: cliUse,
                explanation:
                  "Globally-installed npm package. Run mdfy capture, mdfy search, mdfy hub from any directory. Handy for scripting, terminal-first workflows, or piping shell output into your hub.",
                docHref: "/docs/cli",
              },
            ];
            const active = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];
            const userTools = TOOLS.filter((t) => t.group === "user");
            const nativeTools = TOOLS.filter((t) => t.group === "native");

            const TabBtn = ({ t }: { t: Tool }) => {
              const isActive = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  className="text-caption font-mono px-2.5 py-1 rounded transition-colors"
                  style={{
                    background: isActive ? "var(--accent-dim)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${isActive ? "var(--accent-dim)" : "var(--border-dim)"}`,
                    letterSpacing: 0.3,
                  }}
                >
                  {t.label}
                </button>
              );
            };

            return (
              <div className="mb-3">
                {/* Section label */}
                <div className="text-caption font-mono uppercase tracking-wider mb-2"
                  style={{ color: "var(--text-faint)", fontSize: 10, letterSpacing: 0.5 }}>
                  Setup snippet for your tool
                </div>

                {/* Row 1 — user surfaces */}
                <div className="flex flex-wrap gap-1.5 items-center mb-1.5">
                  {userTools.map((t) => <TabBtn key={t.id} t={t} />)}
                </div>

                {/* Row 2 — mdfy native runtime */}
                <div className="flex flex-wrap gap-1.5 items-center mb-3">
                  <span className="text-caption font-mono mr-1"
                    style={{ color: "var(--text-faint)", letterSpacing: 0.3 }}>
                    via mdfy:
                  </span>
                  {nativeTools.map((t) => <TabBtn key={t.id} t={t} />)}
                </div>

                {/* Active tab card */}
                <div className="rounded-lg overflow-hidden"
                  style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}>
                  {/* Header: where to put it + tool name */}
                  <div className="flex items-baseline justify-between px-3 py-2 gap-2"
                    style={{ borderBottom: "1px solid var(--border-dim)" }}>
                    <span className="text-caption font-mono uppercase tracking-wider truncate"
                      style={{ color: "var(--accent)", fontSize: 10, letterSpacing: 0.5 }}>
                      {active.savePath ? (
                        <>Save to <span style={{ color: "var(--text-primary)" }}>{active.savePath}</span></>
                      ) : (
                        <>{active.hint}</>
                      )}
                    </span>
                    <span className="text-caption shrink-0" style={{ color: "var(--text-faint)" }}>
                      {active.label}
                    </span>
                  </div>

                  {/* Snippet */}
                  <pre
                    className="px-3 py-2 text-caption font-mono whitespace-pre-wrap"
                    style={{ color: "var(--text-primary)", margin: 0, fontSize: 11, lineHeight: 1.6 }}
                  >{active.snippet}</pre>

                  {/* Explanation — user-friendly multi-sentence */}
                  <div className="px-3 py-2.5 text-caption leading-relaxed"
                    style={{ color: "var(--text-secondary)", background: "var(--surface)", borderTop: "1px solid var(--border-dim)" }}>
                    {active.explanation.split("\n").map((line, i) => (
                      <div key={i} style={{ whiteSpace: "pre" }}>{line || " "}</div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2"
                    style={{ borderTop: "1px solid var(--border-dim)" }}>
                    <button
                      onClick={async () => {
                        if (typeof navigator === "undefined" || !navigator.clipboard) return;
                        try {
                          await navigator.clipboard.writeText(active.snippet);
                          setCopiedTool(active.id);
                          setTimeout(() => setCopiedTool(null), 1500);
                        } catch { /* clipboard blocked */ }
                      }}
                      className="flex items-center gap-1 text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                      style={{
                        background: "var(--surface)",
                        color: copiedTool === active.id ? "#22c55e" : "var(--text-primary)",
                        border: `1px solid ${copiedTool === active.id ? "rgba(34,197,94,0.4)" : "var(--border-dim)"}`,
                      }}
                      title="Copy snippet"
                    >
                      {copiedTool === active.id ? <Check width={11} height={11} /> : <Copy width={11} height={11} />}
                      <span>{copiedTool === active.id ? "Copied" : "Copy"}</span>
                    </button>
                    <Link
                      href={active.docHref}
                      target="_blank"
                      className="text-caption font-mono"
                      style={{ color: "var(--accent)" }}
                    >
                      Full guide →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}
          {/* Secondary actions sit on the surface-tinted card, so a
              bordered-only treatment fades into the card background.
              Adding var(--background) fill puts them one step darker
              than the surrounding card; the dim border still says
              "secondary action, not the lead". */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/hub/${slug}`}
              target="_blank"
              className="flex items-center gap-1 text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
              style={{ background: "var(--background)", color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
            >
              <Eye width={11} height={11} />
              View as visitor
            </Link>
            <Link
              href={`/hub/${slug}.md`}
              target="_blank"
              className="flex items-center gap-1 text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
              style={{ background: "var(--background)", color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
            >
              <ExternalLink width={11} height={11} />
              Raw .md
            </Link>
          </div>
          {/* Token economy badge — author-facing feedback loop. The
              number is what an AI actually pays to read this hub.
              When the digest path is populated (concept_index has
              rows), we surface BOTH so authors can see how much
              cheaper the dense path is vs. the full index. */}
          {(() => {
            const totalWords = data.counts.totalWords ?? 0;
            if (totalWords === 0) return null;
            const indexTokens = Math.round(totalWords * 1.3 + (data.counts.documents ?? 0) * 8);
            const conceptCount = Math.min(data.counts.concepts ?? 0, 40);
            const digestTokens = conceptCount > 0 ? Math.round(conceptCount * 25 + 200) : 0;
            const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
            return (
              <p
                className="text-caption mt-1 font-mono leading-relaxed"
                style={{ color: "var(--text-faint)", fontSize: 10 }}
                title="Estimated tokens an AI pays to consume this hub. The digest path uses your concept ontology so broad queries can be answered without reading every doc."
              >
                {digestTokens > 0 ? `Digest ≈ ${fmt(digestTokens)} tokens   ` : ""}Full ≈ {fmt(indexTokens)} tokens
              </p>
            );
          })()}
        </section>

        {/* ── Stat strip — counts by access tier ──────────────────── */}
        {totalCounts && (
          <section className="grid grid-cols-3 gap-2 mb-8">
            {(["public", "shared", "private"] as const).map((tier) => {
              const t = TIERS[tier];
              const Icon = t.icon;
              return (
                <div
                  key={tier}
                  className="px-4 py-3 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                >
                  <div className="flex items-center gap-1.5 mb-1" style={{ color: t.color }}>
                    <Icon width={12} height={12} />
                    <span className="text-caption uppercase tracking-wider font-semibold">{t.label}</span>
                  </div>
                  <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {totalCounts[tier]}
                  </div>
                  <div className="text-caption mt-0.5" style={{ color: "var(--text-faint)" }}>
                    {ov ? `${ov.bundles[tier].length} bundle${ov.bundles[tier].length === 1 ? "" : "s"}, ${ov.documents[tier].length} doc${ov.documents[tier].length === 1 ? "" : "s"}` : ""}
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
                style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-dim)", color: "var(--accent)" }}
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
                  <p className="text-caption mt-2 font-mono" style={{ color: ontologyError ? "#ef4444" : "var(--accent)" }}>
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
                  background: "var(--accent)",
                  // Matches every other accent-fill button in Settings /
                  // BundleOverview / Hub — black text on the accent
                  // works in both light + dark across the eight schemes.
                  color: "#000",
                  opacity: ontologyBuilding ? 0.5 : 1,
                  cursor: ontologyBuilding ? "not-allowed" : "pointer",
                }}
              >
                {ontologyBuilding ? "Building…" : "Build ontology"}
              </button>
            </div>
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
                    onClick={onAutoResolveRun}
                    className="text-caption px-2.5 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                    style={{ background: "var(--background)", color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                  >
                    Run now
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
          const total = visibleOrphans.length + visibleDuplicates.length + visibleTitleMismatches.length;
          if (total === 0) return null;
          return (
            <section className="mb-8">
              <button
                onClick={() => setNeedsReviewCollapsed((v) => !v)}
                className="w-full flex items-center gap-2 mb-3 text-left transition-colors hover:opacity-90"
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(245,158,11,0.14)", color: "#f59e0b" }}
                >
                  <ShieldAlert width={12} height={12} />
                </span>
                <h2 className="text-heading" style={{ color: "var(--text-primary)" }}>Needs review</h2>
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
                        Title doesn&apos;t mention any of this doc&apos;s concepts. Consider renaming to surface <span className="font-mono" style={{ color: "var(--accent)" }}>{m.topConcept}</span>
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
                  style={{ width: 22, height: 22, borderRadius: 6, background: "var(--accent-dim)", color: "var(--accent)" }}
                >
                  <Sparkles width={12} height={12} />
                </span>
                <h2 className="text-heading" style={{ color: "var(--accent)" }}>Suggestions</h2>
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
                            <span key={i} className="font-mono" style={{ color: "var(--accent)" }}>
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
                            <span key={i} className="font-mono" style={{ color: "var(--accent)" }}>
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
            <div className="flex items-center gap-2 mb-3">
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 22, height: 22, borderRadius: 6, background: "var(--toggle-bg)", color: "var(--text-muted)" }}
              >
                <Eye width={12} height={12} />
              </span>
              <h2 className="text-heading" style={{ color: "var(--text-secondary)" }}>Recent activity</h2>
              <span className="text-caption ml-auto" style={{ color: "var(--text-faint)" }}>
                Last {data.recentActivity.length} events
              </span>
            </div>
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
                        style={{ color: "var(--accent)", fontSize: 9, letterSpacing: "0.06em", minWidth: 64 }}
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
          </section>
        )}

        {/* ── Owner view — three sections by access tier, bundles
              above docs in each section. Non-owner falls through to
              the simpler public-only fallback below. ─────────────── */}
        {ov && (["public", "shared", "private"] as const).map((tier) => {
          const t = TIERS[tier];
          const bundles = ov.bundles[tier];
          const docs = ov.documents[tier];
          if (bundles.length === 0 && docs.length === 0) return null;
          const Icon = t.icon;
          return (
            <section key={tier} className="mb-10">
              <div className="flex items-baseline gap-2 mb-3 pb-2" style={{ borderBottom: `1px solid ${t.bg}` }}>
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 22, height: 22, borderRadius: 6, background: t.bg, color: t.color }}
                >
                  <Icon width={12} height={12} />
                </span>
                <h2 className="text-heading" style={{ color: t.color }}>{t.label}</h2>
                <span className="text-caption font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
                  {bundles.length + docs.length}
                </span>
                <span className="text-caption ml-auto" style={{ color: "var(--text-faint)" }}>{t.desc}</span>
              </div>

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
                  <ul className="space-y-0.5">
                    {docs.slice(0, 30).map((d) => (
                      <li key={d.id}>
                        <button
                          onClick={() => onOpenDoc?.(d.id)}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
                        >
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
                          <span className="flex-1 truncate text-body" style={{ color: "var(--text-primary)" }}>{d.title}</span>
                          <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>{relativeTime(d.updated_at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {docs.length > 30 && (
                    <p className="text-caption mt-2" style={{ color: "var(--text-faint)" }}>
                      +{docs.length - 30} more — open the sidebar to browse all.
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* ── Non-owner fallback — when API didn't return ownerView,
              this is a public visitor. Show only what's public. ── */}
        {!ov && data.documents.length > 0 && (
          <section className="mb-10">
            <header className="flex items-baseline justify-between mb-3">
              <h2 className="text-heading" style={{ color: "var(--accent)" }}>Public</h2>
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
  );
}
