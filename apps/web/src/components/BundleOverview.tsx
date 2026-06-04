"use client";

// Bundle overview — mini-hub shape for a single bundle. Mirrors the
// HubEmbed layout (Deploy panel + stats + grouped docs) so a bundle
// reads as "a hub with a topic" rather than a folder. Picked up when
// `view === "overview"` in BundleEmbed's parent.
//
// What it shows:
//   1. Header — bundle title + description + member count
//   2. Deploy panel — bundle URL + Copy + View as visitor + Raw + token estimate
//   3. Stat strip — total docs / total tokens / discoveries-run state
//   4. Documents list — click to open as tab
//
// What it doesn't (yet):
//   - Per-doc concept overlap (lives in canvas)
//   - Suggestions (TODO once we have a /api/bundles/[id]/suggestions surface)

import { useEffect, useState, useMemo } from "react";
import { Layers, Copy, Check, ExternalLink, FileText, Globe, Cloud, Users, Sparkles, AlertTriangle, Clock, Network, ArrowUpRight, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { ProviderIcon, type ProviderBrand } from "@/components/pure";
import DocStatusIcon from "@/components/DocStatusIcon";
import { collectDocImages } from "@/lib/extract-images";
import MediaLightbox from "@/components/MediaLightbox";

interface BundleDoc {
  id: string;
  title: string | null;
  markdown: string;
  updated_at: string;
  isDraft?: boolean;
  sharedWithCount?: number;
  /** AI-written one-line summary for this doc inside the bundle.
   *  Surfaced under the doc title when present so the user can scan
   *  the bundle's contents without opening each doc. */
  annotation?: string | null;
}

interface BundleOverviewProps {
  bundleId: string;
  bundleTitle: string;
  bundleDescription?: string | null;
  /** AI-generated 2-3 sentence digest from graph_data.summary. Rendered
   *  under the hero title so the user sees the gist before scrolling
   *  into "How to use" / docs. Absent on bundles that haven't been
   *  analyzed yet. */
  bundleSummary?: string | null;
  bundleIntent?: string | null;
  bundleIsDraft?: boolean;
  bundleAllowedEmails?: string[];
  documents: BundleDoc[];
  /** Whether AI discoveries have been run on this bundle. */
  hasDiscoveries?: boolean;
  /** Whether AI has built a knowledge graph for this bundle. */
  hasGraph?: boolean;
  /** Server-side flag — true when any member doc has been edited
   *  after the last analysis run, so the graph reflects a stale
   *  snapshot. Drives a banner CTA to re-run. */
  isAnalysisStale?: boolean;
  /** Counts surfaced from the persisted ai_graph. The AI stat card
   *  uses them to read as "12 themes · 7 insights" instead of a
   *  vague "Analyzed". Falls back to the bool flag when absent. */
  themeCount?: number;
  insightCount?: number;
  /** Most recent member-doc updated_at — used in the header so the
   *  user can tell at a glance how fresh the bundle is without
   *  scanning every row. */
  lastUpdatedAt?: string | null;
  onOpenDoc?: (docId: string) => void;
  onSwitchToCanvas?: () => void;
  onSwitchToList?: () => void;
  /** Inline rename. When provided, the hero title becomes
   *  contentEditable for the owner; absent for read-only viewers. */
  onRenameBundle?: (next: string) => void;
  /** v8 W4 — "Preparing this bundle for AI" status. Surfaces under
   *  the hero description, in the same content frame the user is
   *  already reading, instead of a fixed-position toast floating at
   *  the page bottom. Renders only when at least one stage is still
   *  in flight (the parent decides — absent prop = nothing shown). */
  prepStatus?: {
    graphReady: boolean;
    embedReady: boolean;
    hasMultipleDocs: boolean;
    onDismiss: () => void;
  } | null;
}

// Compact relative time. Mirrors HubEmbed's helper so freshness reads
// the same on both surfaces. "just now" under a minute; minute/hour/day
// granularity up to a week; absolute month-day after that.
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Cheap token estimate — 1.3 tokens / word + 8 token listing overhead per doc.
// Mirrors the same heuristic the hub page header uses so users see a
// consistent number across both surfaces.
function estimateBundleTokens(docs: BundleDoc[]): number {
  let words = 0;
  for (const d of docs) {
    const w = (d.markdown || "").trim().split(/\s+/).filter(Boolean).length;
    words += w;
  }
  return Math.round(words * 1.3 + docs.length * 8);
}

function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export default function BundleOverview({
  prepStatus,
  bundleId,
  bundleTitle,
  bundleDescription,
  bundleSummary,
  bundleIntent,
  bundleIsDraft,
  bundleAllowedEmails,
  documents,
  hasDiscoveries,
  hasGraph,
  isAnalysisStale,
  themeCount,
  insightCount,
  lastUpdatedAt,
  onOpenDoc,
  onSwitchToCanvas,
  onSwitchToList,
  onRenameBundle,
}: BundleOverviewProps) {
  const [copied, setCopied] = useState(false);
  // Hero AI digest — 3 lines by default with "More" toggle. Threshold is
  // a character count rather than a measured overflow because the hero
  // re-flows on resize and we don't want the More chip to flicker.
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  // Which URL variant the unified Copy button is currently bound to —
  // digest (default) or ?full=1. Single Copy means single "Copied"
  // flash, no juggling.
  const [urlVariant, setUrlVariant] = useState<"digest" | "full">("digest");
  // Per-tool tab inside the unified "How to use this bundle" panel.
  // Mirrors HubEmbed's surface so Hub + Bundle read as one family.
  const [activeTool, setActiveTool] = useState<string>("claude");
  const [copiedTool, setCopiedTool] = useState<string | null>(null);

  const bundleUrl = useMemo(() => `https://memory.wiki/b/${bundleId}`, [bundleId]);

  // Access classification — same vocabulary the hub uses:
  //   Public  = !draft && no allowed_emails
  //   Shared  = !draft && allowed_emails.length > 0
  //   Private = draft (only owner can view via the editor)
  const accessKind = useMemo<"public" | "shared" | "private">(() => {
    if (bundleIsDraft) return "private";
    if (bundleAllowedEmails && bundleAllowedEmails.length > 0) return "shared";
    return "public";
  }, [bundleIsDraft, bundleAllowedEmails]);

  const tokens = useMemo(() => estimateBundleTokens(documents), [documents]);
  const totalWords = useMemo(() => documents.reduce((s, d) => s + (d.markdown || "").split(/\s+/).filter(Boolean).length, 0), [documents]);
  const imageGroups = useMemo(
    () => collectDocImages(documents.map((d) => ({ id: d.id, title: d.title || "Untitled", markdown: d.markdown }))),
    [documents],
  );
  // Track URLs that fail to load so the gallery hides them entirely
  // (count, thumbnail tile, the lot). A dimmed broken-image tile reads
  // as "your stuff is broken" — silent hiding is what the user wants.
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const visibleImageGroups = useMemo(
    () => imageGroups
      .map((g) => ({ ...g, urls: g.urls.filter((u) => !brokenImages.has(u)) }))
      .filter((g) => g.urls.length > 0),
    [imageGroups, brokenImages],
  );
  const totalImages = useMemo(() => visibleImageGroups.reduce((s, g) => s + g.urls.length, 0), [visibleImageGroups]);
  // Flat list of all visible image URLs in display order — the
  // lightbox needs a single index space for prev/next navigation.
  const flatImageUrls = useMemo(
    () => visibleImageGroups.flatMap((g) => g.urls),
    [visibleImageGroups],
  );
  const [mediaCollapsed, setMediaCollapsed] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const accessIcon = accessKind === "public" ? <Globe width={14} height={14} /> : accessKind === "shared" ? <Users width={14} height={14} /> : <Cloud width={14} height={14} />;
  const accessLabel = accessKind === "public" ? "PUBLIC" : accessKind === "shared" ? "SHARED" : "PRIVATE";
  // Semantic micro-colors: public = live/lime, shared = info/blue, private = info-dim (cloud sync)
  const accessColor = accessKind === "public" ? "var(--micro-lime)" : accessKind === "shared" ? "var(--micro-info)" : "var(--micro-info)";

  const [showCopyHint, setShowCopyHint] = useState(false);
  useEffect(() => { if (!showCopyHint) return; const t = setTimeout(() => setShowCopyHint(false), 1600); return () => clearTimeout(t); }, [showCopyHint]);

  return (
    <div className="h-full relative overflow-hidden" style={{ background: "var(--canvas)" }}>
      {/* Animated MW-blob backdrop — lives OUTSIDE the scroll
          container so the blob stays anchored to the viewport while
          the user scrolls the content. (When the backdrop was inside
          the scroll area the absolute positioning still inherited
          the scrollable coordinate system and dragged the blob with
          the content.) */}
      <div className="mw-start-backdrop" aria-hidden>
        <img className="mw-start-backdrop-morph mw-logo-darktheme" src="/brand/mwblob_morph.svg" alt="" draggable={false} />
        <img className="mw-start-backdrop-morph mw-logo-lighttheme" src="/brand/mwblob_morph_dark.svg" alt="" draggable={false} />
      </div>
      <div className="h-full overflow-y-auto relative mw-start-backdrop-content">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Identity hero — same card shape as Hub's hero so both
            surfaces read as one family. Big centered icon + title
            (inline-editable for owners) + AI digest + description
            + intent + meta with Canvas CTA. */}
        <header
          className="mb-8 text-center"
          style={{ padding: "32px 24px 24px" }}
        >
          {/* Hero glyph — mirrors the sidebar BundleStatusIcon so the
              same bundle reads identically in two surfaces (sidebar
              row + viewer hero): Layers colored by access tier with a
              Globe / Users / Cloud overlay in the corner. */}
          {(() => {
            const layersColor = accessKind === "shared" ? "#60a5fa" : accessKind === "public" ? "#4ade80" : "var(--text-faint)";
            const OverlayIcon = accessKind === "public" ? Globe : accessKind === "shared" ? Users : Cloud;
            const overlayColor = accessKind === "shared" ? "#60a5fa" : accessKind === "public" ? "#4ade80" : "var(--text-faint)";
            return (
              <div
                className="mx-auto relative flex items-center justify-center"
                style={{ width: 64, height: 64 }}
                title={accessKind === "public" ? "Public bundle" : accessKind === "shared" ? "Shared bundle" : "Private bundle"}
              >
                <Layers width={56} height={56} strokeWidth={1.5} style={{ color: layersColor }} />
                <span
                  aria-hidden
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    right: -2, bottom: -2, width: 22, height: 22,
                    background: "var(--canvas)",
                    color: overlayColor,
                  }}
                >
                  <OverlayIcon width={14} height={14} />
                </span>
              </div>
            );
          })()}
          {/* Access badge — small pill under the icon so the share
              state is also surfaced as a readable label, not just an
              icon overlay. */}
          <div className="mt-3 flex justify-center">
            <span
              className="inline-flex items-center gap-1 text-caption font-mono px-2 py-0.5 rounded-full"
              style={{
                color: accessKind === "shared" ? "#60a5fa" : accessKind === "public" ? "#4ade80" : "var(--text-faint)",
                background: accessKind === "shared"
                  ? "rgba(96, 165, 250, 0.12)"
                  : accessKind === "public"
                    ? "rgba(74, 222, 128, 0.12)"
                    : "var(--toggle-bg)",
                letterSpacing: "0.04em",
              }}
            >
              {accessKind === "public" ? "Public" : accessKind === "shared" ? "Shared" : "Private"}
            </span>
          </div>
          {onRenameBundle ? (
            <h1
              className="text-display tracking-tight mt-4 outline-none rounded transition-colors hover:bg-[var(--toggle-bg)] focus:bg-[var(--toggle-bg)]"
              style={{ color: "var(--text-primary)", lineHeight: 1.2, padding: "2px 8px", display: "inline-block", minWidth: 120 }}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              title="Click to rename"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).blur();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).textContent = bundleTitle || "Untitled bundle";
                  (e.currentTarget as HTMLElement).blur();
                }
              }}
              onBlur={(e) => {
                const next = (e.currentTarget.textContent || "").trim();
                const prev = bundleTitle || "";
                if (!next || next === prev) {
                  e.currentTarget.textContent = prev || "Untitled bundle";
                  return;
                }
                onRenameBundle(next);
              }}
            >
              {bundleTitle || "Untitled bundle"}
            </h1>
          ) : (
            <h1
              className="text-display tracking-tight mt-4"
              style={{ color: "var(--text-primary)", lineHeight: 1.2 }}
            >
              {bundleTitle || "Untitled bundle"}
            </h1>
          )}
          {/* Single overview line — prefer the AI-generated summary
              from graph_data.summary (richer, content-derived); fall
              back to the user-set description when no analysis has
              been run. Showing BOTH read as two duplicate "summary"
              paragraphs to the user, so we collapse to one. Clamped
              to 3 lines by default; long copy reveals an inline
              More toggle. */}
          {(bundleSummary || bundleDescription) && (() => {
            const overview = bundleSummary || bundleDescription || "";
            const isLong = overview.length > 180;
            return (
              <div className="mt-3 mx-auto" style={{ maxWidth: 560 }}>
                <p
                  className="leading-relaxed text-center"
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    ...(summaryExpanded ? {} : {
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }),
                  }}
                >
                  {overview}
                </p>
                {isLong && (
                  <button
                    onClick={() => setSummaryExpanded((v) => !v)}
                    className="mt-2.5 mx-auto flex w-fit items-center gap-1 text-caption font-medium rounded-md transition-colors hover:bg-[var(--toggle-bg)] px-2.5 py-1"
                    style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                  >
                    {summaryExpanded ? (
                      <ChevronUp width={12} height={12} />
                    ) : (
                      <ChevronDown width={12} height={12} />
                    )}
                    <span>{summaryExpanded ? "Less" : "More"}</span>
                  </button>
                )}
              </div>
            );
          })()}
          {bundleIntent && (
            <p
              className="mt-2 mx-auto text-center italic"
              style={{ color: "var(--text-faint)", maxWidth: 560, fontSize: 12, lineHeight: 1.55 }}
            >
              Intent: {bundleIntent}
            </p>
          )}
          {/* v8 W4 — inline prep status. Renders in the hero frame
              the user is already reading, instead of a fixed-position
              toast at the page bottom. Mirrors the surface design
              language (soft chip pattern, micro color dots, mono
              ETA) rather than borrowing the toast/banner shape. */}
          {prepStatus && (() => {
            const { graphReady, embedReady, hasMultipleDocs, onDismiss } = prepStatus;
            const showGraph = hasMultipleDocs;
            const allDone = embedReady && (!showGraph || graphReady);
            if (allDone) return null;
            const Step = ({ label, ready, eta }: { label: string; ready: boolean; eta: string }) => (
              <span className="inline-flex items-center gap-1.5 text-caption" style={{ color: ready ? "var(--text-secondary)" : "var(--text-muted)" }}>
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: ready ? "var(--micro-lime)" : "var(--micro-info)",
                    animation: ready ? undefined : "bundlePrepInlinePulse 1.2s ease-in-out infinite",
                  }}
                />
                <span style={{ fontWeight: 500 }}>{label}</span>
                <span className="font-mono" style={{ color: "var(--text-faint)", fontSize: 10 }}>
                  {ready ? "done" : eta}
                </span>
              </span>
            );
            return (
              <div className="mt-5 mx-auto rounded-lg" style={{ maxWidth: 560, background: "var(--surface)", border: "1px solid var(--border-dim)", padding: "10px 14px" }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-caption font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                      Preparing this bundle for AI
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mb-1.5">
                      <Step label="Vector embed" ready={embedReady} eta="~5s" />
                      {showGraph && <Step label="Graph analysis" ready={graphReady} eta="~1 min" />}
                    </div>
                    <div className="text-caption" style={{ color: "var(--text-faint)", fontSize: 11, lineHeight: 1.4 }}>
                      The bundle URL works immediately for direct sharing. Semantic recall
                      {showGraph ? " and the concept graph become" : " becomes"} available once this finishes. You can keep editing in the meantime.
                    </div>
                  </div>
                  <button
                    onClick={onDismiss}
                    className="shrink-0 -mt-1 -mr-1 w-6 h-6 inline-flex items-center justify-center rounded transition-colors hover:bg-[var(--toggle-bg)]"
                    style={{ color: "var(--text-faint)" }}
                    aria-label="Dismiss"
                  >
                    <span style={{ fontSize: 12, lineHeight: 1 }}>×</span>
                  </button>
                </div>
                <style>{`@keyframes bundlePrepInlinePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
              </div>
            );
          })()}
          {/* Meta strip — neutral throughout. Color was reading as
              "everything here is important"; the meta row is just
              context, so all glyphs + text settle to text-faint. */}
          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "var(--text-faint)" }}>
              <Layers width={11} height={11} />
              <span>{documents.length} {documents.length === 1 ? "doc" : "docs"}</span>
            </span>
            {lastUpdatedAt && (
              <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                <Clock width={11} height={11} />
                <span>Updated {relativeTime(lastUpdatedAt)}</span>
              </span>
            )}
            {accessKind === "shared" && bundleAllowedEmails && bundleAllowedEmails.length > 0 && (
              <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                <Users width={11} height={11} />
                Shared with {bundleAllowedEmails.length}
              </span>
            )}
            {onSwitchToCanvas && (
              <button
                onClick={() => onSwitchToCanvas()}
                className="inline-flex items-center gap-1 text-caption font-mono transition-colors hover:underline"
                style={{ color: "var(--text-faint)" }}
                title="Open this bundle as a canvas"
              >
                <Network width={11} height={11} />
                <span>Canvas</span>
                <ArrowUpRight width={11} height={11} />
              </button>
            )}
          </div>
        </header>

        {/* Unified "How to use this bundle" — pick the tool, see
            exactly what to do. Mirrors HubEmbed: URL tools (chat
            AIs + Generic) show variant chip + URL row + Copy;
            snippet tools show their save-to-file snippet. Flat
            tab row, no "via memory.wiki:" grouping. */}
        {(() => {
          const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
          const digestTokens = 50 + documents.length * 35;
          const fullTokens = Math.max(tokens, digestTokens);
          const activeUrl = urlVariant === "full" ? `${bundleUrl}?full=1` : bundleUrl;
          // Point at the canonical raw route directly. The /b/{id}.md
          // alias is a Vercel rewrite that does NOT exist in `next dev`,
          // so this button 404'd locally. The canonical route works on
          // both dev and prod.
          const rawHref = urlVariant === "full" ? `/raw/bundle/${bundleId}?full=1` : `/raw/bundle/${bundleId}`;

          const projCtx = `# Project context

Memory.Wiki bundle: ${bundleUrl}

Fetch this URL on every session. The response carries the bundle's
markdown payload — title, annotations, links + concept analysis —
ready to paste as project context.`;
          const cursorRule = `---
description: Memory.Wiki bundle context
alwaysApply: true
---
Memory.Wiki bundle: ${bundleUrl}

Fetch this URL on every session for project-scoped context.`;
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
/memory.wiki bundle ${bundleId}
/memory.wiki search "topic"`;
          const cliUse = `npm install -g memory-wiki-cli

Memory.Wiki bundle ${bundleId}
Memory.Wiki search "topic"`;

          type Tool = {
            id: string;
            label: string;
            hint: string;
            savePath?: string;
            snippet: string;
            explanation: string;
            docHref: string;
            /** Brand mark from the Pure ProviderIcon set — surfaces in
             *  the tab so each tool is visually distinct. */
            brand: ProviderBrand;
          };
          const TOOLS: Tool[] = [
            { id: "claude",      label: "Claude",       brand: "claude",   hint: "Drop the URL into a Claude chat", snippet: bundleUrl, explanation: "Works the same in Claude.ai (web) and the Mac / Windows desktop app. Claude fetches the bundle payload and follows inline doc links as needed.", docHref: "/docs/integrate" },
            { id: "chatgpt",     label: "ChatGPT",      brand: "chatgpt",  hint: "Drop the URL into a ChatGPT chat", snippet: bundleUrl, explanation: "Works in ChatGPT web and the Mac desktop app. ChatGPT fetches the URL via its built-in browser tool and reads the bundle's markdown.", docHref: "/docs/integrate" },
            { id: "gemini",      label: "Gemini",       brand: "gemini",   hint: "Drop the URL into Gemini (web or app)", snippet: bundleUrl, explanation: "Gemini reads the URL via its built-in tool use. Same payload format as Claude and ChatGPT.", docHref: "/docs/integrate#gemini" },
            { id: "claude-code", label: "Claude Code",  brand: "claude",   hint: "Save as CLAUDE.md in your project root", savePath: "CLAUDE.md", snippet: projCtx, explanation: "Claude Code auto-loads CLAUDE.md at the start of every session. Save this snippet to your project root and the bundle becomes ambient context for every conversation in the repo.", docHref: "/docs/integrate#claude-code" },
            { id: "cursor",      label: "Cursor",       brand: "cursor",   hint: "Save as .cursor/rules/memorywiki.mdc", savePath: ".cursor/rules/memorywiki.mdc", snippet: cursorRule, explanation: "Cursor's Rules feature reads .mdc files from .cursor/rules/. alwaysApply: true keeps the bundle URL in context on every chat, including ad-hoc questions.", docHref: "/docs/integrate#cursor" },
            { id: "generic",     label: "Generic",      brand: "terminal", hint: "Paste the URL into any AI that can fetch a webpage", snippet: bundleUrl, explanation: "Any LLM with web-fetch (or a configured browser tool) works. Append ?full=1 for every doc inline, or use /b/<id>.md for the raw markdown payload.", docHref: "/docs/integrate" },
            { id: "mcp",         label: "MCP",          brand: "mcp",      hint: "Add memory-wiki-mcp to your MCP host config", snippet: mcpConfig, explanation: "Compatible with Claude Desktop, Cursor, Cline, Windsurf, and any MCP-capable host. Exposes 26 tools across capture / bundle / search / share / version history.", docHref: "/docs/mcp" },
            { id: "skill",       label: "Skill",        brand: "claude",   hint: "Use /memory.wiki slash commands inside Claude Code", snippet: skillUse, explanation: "Install once with `claude skill install Memory.Wiki`. Then inside any Claude Code session, run /memory.wiki bundle <id> or /memory.wiki search to pull this bundle in.", docHref: "/docs/integrate" },
            { id: "cli",         label: "CLI",          brand: "cli",      hint: "Pull this bundle from your terminal", snippet: cliUse, explanation: "Globally-installed npm package. Run Memory.Wiki bundle <id> from any directory to fetch the bundle's content; useful for scripting or terminal-first workflows.", docHref: "/docs/cli" },
          ];
          const active = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];
          const URL_TOOL_IDS = new Set(["claude", "chatgpt", "gemini", "generic"]);
          const isUrlTool = URL_TOOL_IDS.has(active.id);

          return (
            <section className="mb-8 rounded-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", padding: "20px 20px 18px" }}>
              <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>
                How to use this bundle
              </h2>
              <p className="text-caption mt-1 mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
                Pick your AI tool. Each one shows exactly what to paste and where.
              </p>

              {/* Quieter tab row — active tool gets a soft surface
                  fill (not the stark ink-fill that read as a button
                  pressed permanently); inactive tools stay plain text
                  at text-muted with a faint brand glyph. */}
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 mb-5">
                {TOOLS.map((t) => {
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
                })}
              </div>

              {/* Active tab content — borderless, padding-only. The
                  card outline was redundant chrome around an already-
                  outlined section. */}
              <div>
                {/* One-line hint above the action — no separate
                    header strip, no redundant tool-name badge. */}
                <p className="text-caption mb-3" style={{ color: "var(--text-secondary)" }}>
                  {active.savePath ? (
                    <>Save to{" "}<code className="font-mono" style={{ color: "var(--text-primary)" }}>{active.savePath}</code></>
                  ) : (
                    <>{active.hint}</>
                  )}
                </p>

                {isUrlTool ? (
                  <>
                    {/* Side-by-side option cards. Both variants shown
                        at once so the trade-off is visible without a
                        toggle interaction. Active option marked by a
                        lime dot + subtle surface fill, not the prior
                        stark white ink-fill. */}
                    <div className="grid grid-cols-2 gap-2 mb-3" role="tablist" aria-label="Payload size">
                      {(["digest", "full"] as const).map((v) => {
                        const isActive = urlVariant === v;
                        const tokens = v === "digest" ? digestTokens : fullTokens;
                        const label = v === "digest" ? "Compact" : "Full";
                        // Real cheaper-% computed from the two
                        // token estimates so the claim adapts to the
                        // bundle (a 4-doc bundle with tiny docs may
                        // only save 60%; a 30-doc one saves 95%+).
                        const cheaperPct = fullTokens > digestTokens
                          ? Math.round((1 - digestTokens / fullTokens) * 100)
                          : 0;
                        const desc = v === "digest"
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
                                ≈{fmt(tokens)} tokens
                              </span>
                            </div>
                            <div className="text-caption mt-0.5" style={{ color: "var(--text-faint)" }}>
                              {desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Hero — URL + Copy. Visually the loudest thing
                        in the card. Slightly stronger border + a
                        touch more padding so it reads as the action. */}
                    <button
                      onClick={() => {
                        if (typeof navigator === "undefined") return;
                        navigator.clipboard.writeText(activeUrl).then(() => {
                          setCopied(true);
                          setShowCopyHint(true);
                          setCopiedTool(active.id);
                          setTimeout(() => { setCopied(false); setCopiedTool(null); }, 1500);
                        });
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg font-mono transition-colors hover:bg-[var(--toggle-bg)] group/copy"
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

                    {/* Support row — just the small "raw / guide"
                        links. Variant description lives inside the
                        option cards above, so this row stays minimal. */}
                    <div className="flex items-center justify-end gap-3 mt-2.5 text-caption" style={{ color: "var(--text-muted)" }}>
                      <a
                        href={rawHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 transition-colors hover:underline"
                        title="Raw .md payload, what the AI actually sees"
                      >
                        <ExternalLink width={11} height={11} />
                        Raw
                      </a>
                      <a
                        href={active.docHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 transition-colors hover:underline"
                        title="Read the full integration guide"
                      >
                        Full guide
                        <ArrowUpRight width={11} height={11} />
                      </a>
                    </div>
                  </>
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
                        onClick={() => {
                          if (typeof navigator === "undefined") return;
                          navigator.clipboard.writeText(active.snippet).then(() => {
                            setCopiedTool(active.id);
                            setTimeout(() => setCopiedTool(null), 1500);
                          });
                        }}
                        className="inline-flex items-center gap-1 transition-colors hover:underline"
                        style={{ color: copiedTool === active.id ? "var(--micro-lime)" : "var(--text-muted)" }}
                        title="Copy snippet"
                      >
                        {copiedTool === active.id ? <Check width={11} height={11} /> : <Copy width={11} height={11} />}
                        {copiedTool === active.id ? "Copied" : "Copy snippet"}
                      </button>
                      <a
                        href={active.docHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 transition-colors hover:underline"
                        title="Read the full integration guide"
                      >
                        Full guide
                        <ArrowUpRight width={11} height={11} />
                      </a>
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
            </section>
          );
        })()}

        {/* ─── Stat strip ─── Typographic contrast: hero number in
            Cal Sans (display font, ~32px), descriptor in JetBrains
            Mono with a touch of letter-spacing so it reads as a
            "data label", and a quieter mono-cased context row at
            the bottom (access tier / scope / canvas link). The two
            type families do the visual work — no chip backgrounds
            or uppercase eyebrows fighting for attention. */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-7">
          {/* Documents — count + access tier */}
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
              {fmtCount(documents.length)}
            </div>
            <div
              className="mt-1"
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
              }}
            >
              {documents.length === 1 ? "Document" : "Documents"}
            </div>
            <div
              className="mt-auto pt-4 flex items-center gap-1.5"
              style={{
                color: "var(--text-faint)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
              }}
            >
              {accessIcon}
              <span>
                {accessKind === "public" ? "Public" : accessKind === "shared" ? "Shared" : "Private"}
              </span>
            </div>
          </div>

          {/* Words — pure scale */}
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
              {fmtCount(totalWords)}
            </div>
            <div
              className="mt-1"
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
              }}
            >
              {totalWords === 1 ? "Word" : "Words"}
            </div>
            <div
              className="mt-auto pt-4 flex items-center gap-1.5"
              style={{
                color: "var(--text-faint)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
              }}
            >
              <FileText width={13} height={13} />
              <span>Across all docs</span>
            </div>
          </div>

          {/* AI analysis — themes + insights count, with Canvas
              action + optional stale signal at the bottom. */}
          <div
            className="rounded-lg px-4 py-4 flex flex-col"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            {hasDiscoveries && (themeCount || insightCount) ? (
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
                  {(themeCount || 0) + (insightCount || 0)}
                </div>
                <div
                  className="mt-1"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                  }}
                >
                  {themeCount ? `${themeCount} ${themeCount === 1 ? "Theme" : "Themes"}` : null}
                  {themeCount && insightCount ? ", " : null}
                  {insightCount ? `${insightCount} ${insightCount === 1 ? "Insight" : "Insights"}` : null}
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
                  {hasGraph ? "Graph ready" : "Not analyzed"}
                </div>
                <div
                  className="mt-1"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                  }}
                >
                  {hasGraph ? "Open canvas to inspect" : "Run analysis to discover"}
                </div>
              </>
            )}
            <div className="mt-auto pt-4 flex items-center gap-1.5">
              {/* Canvas icon, not Sparkles. Color removed to match
                  the other stat cells — context icons stay neutral
                  text-faint here; the action itself is the link. */}
              <button
                onClick={() => onSwitchToCanvas?.()}
                className="inline-flex items-center gap-1.5 transition-colors hover:underline"
                style={{
                  color: "var(--text-faint)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                }}
              >
                <Network width={13} height={13} />
                <span>{hasDiscoveries ? "Open canvas" : "Run analysis"}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Stale analysis banner — "out of date" is an attention
            signal, not an error. Switched from micro-red (which
            read as "something broke") to micro-orange so the banner
            warns without alarming. */}
        {hasDiscoveries && isAnalysisStale && (
          <section
            className="mb-7 rounded-lg flex items-start gap-2.5 px-4 py-3"
            style={{ background: "rgba(255, 107, 26, 0.08)", border: "1px solid rgba(255, 107, 26, 0.28)" }}
          >
            <AlertTriangle width={16} height={16} className="shrink-0 mt-0.5" style={{ color: "var(--micro-orange)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold" style={{ color: "var(--micro-orange)" }}>
                Analysis is out of date
              </p>
              <p className="text-caption" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                One or more member docs have changed since the last run. Open the canvas and re-run analysis to refresh themes and insights.
              </p>
            </div>
            <button
              onClick={() => onSwitchToCanvas?.()}
              className="shrink-0 text-caption font-mono uppercase tracking-wider px-2 py-0.5 rounded transition-opacity hover:opacity-80"
              style={{ fontSize: 10, color: "var(--micro-orange)", border: "1px solid var(--micro-orange)" }}
            >
              Re-run
            </button>
          </section>
        )}

        {/* ─── Documents ─── */}
        <section className="mb-8">
          <header className="flex items-baseline justify-between mb-3">
            <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>
              Documents
            </h2>
            {/* Plain text link — supporting nav, not a primary
                action. Same weight as "Full guide" / "See raw
                payload" so the section header isn't pulled away
                from its title. */}
            <button
              onClick={() => onSwitchToList?.()}
              className="inline-flex items-center gap-1 text-caption transition-colors hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              List view
              <ArrowUpRight width={11} height={11} />
            </button>
          </header>
          {documents.length === 0 ? (
            <div className="text-caption px-3 py-6 rounded-lg text-center" style={{ color: "var(--text-faint)", background: "var(--surface)", border: "1px dashed var(--border-dim)" }}>
              No documents in this bundle yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {documents.map((d) => {
                const wordCount = (d.markdown || "").split(/\s+/).filter(Boolean).length;
                const annotation = (d.annotation || "").trim();
                const updated = relativeTime(d.updated_at);
                return (
                  <li key={d.id}>
                    {/* One-row primary entry: icon, title (flex-1),
                        updated, words — all vertically centered so
                        the four atoms share a single baseline.
                        Annotation, when present, drops to a second
                        row indented under the title (icon column
                        stays empty so the indent visually groups
                        with its title). */}
                    <button
                      onClick={() => onOpenDoc?.(d.id)}
                      className="w-full text-left rounded-md transition-colors group hover:bg-[var(--toggle-bg)]"
                      style={{ border: "1px solid var(--border-dim)" }}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="shrink-0">
                          <DocStatusIcon
                            tab={{
                              isDraft: d.isDraft,
                              sharedWithCount: d.sharedWithCount,
                              cloudId: d.id,
                            }}
                            isActive={false}
                          />
                        </div>
                        <span className="truncate flex-1 min-w-0 text-body font-medium" style={{ color: "var(--text-primary)" }}>
                          {d.title || "Untitled"}
                        </span>
                        {updated && (
                          <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>
                            {updated}
                          </span>
                        )}
                        <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>
                          {fmtCount(wordCount)} words
                        </span>
                      </div>
                      {annotation && (
                        <p
                          className="text-caption px-3 pb-2.5 -mt-1"
                          style={{ color: "var(--text-muted)", lineHeight: 1.45, paddingLeft: 42 }}
                        >
                          <span
                            className="font-mono uppercase mr-1.5"
                            style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 9, letterSpacing: 0.5 }}
                          >
                            AI
                          </span>
                          {annotation}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {totalImages > 0 && (
          <section className="mb-10">
            <button
              type="button"
              onClick={() => setMediaCollapsed((v) => !v)}
              className="w-full flex items-baseline gap-2 mb-3 pb-2 text-left transition-opacity hover:opacity-90"
              style={{ borderBottom: "1px solid var(--border-dim)" }}
              aria-expanded={!mediaCollapsed}
            >
              <span
                className="flex items-center justify-center shrink-0 self-center"
                style={{ width: 22, height: 22, borderRadius: 6, background: "var(--toggle-bg)", color: "var(--text-muted)" }}
              >
                <ImageIcon width={12} height={12} />
              </span>
              <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500 }}>Media</h2>
              <span className="text-caption font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
                {totalImages}
              </span>
              <span className="text-caption ml-auto flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
                <span>All images across {visibleImageGroups.length} {visibleImageGroups.length === 1 ? "doc" : "docs"}</span>
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
                {visibleImageGroups.map((g) => (
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
                        const flatIdx = flatImageUrls.indexOf(url);
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
        )}
      </div>
      </div>
      <MediaLightbox
        urls={flatImageUrls}
        index={lightboxIndex}
        onChange={(n) => setLightboxIndex(n)}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}
