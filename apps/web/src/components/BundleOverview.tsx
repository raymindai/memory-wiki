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
import { Layers, Copy, Check, Eye, ExternalLink, FileText, Globe, Cloud, Users, Sparkles, AlertTriangle, Clock, ArrowUpRight } from "lucide-react";

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
  bundleId,
  bundleTitle,
  bundleDescription,
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
}: BundleOverviewProps) {
  const [copied, setCopied] = useState(false);
  // Which URL variant the unified Copy button is currently bound to —
  // digest (default) or ?full=1. Single Copy means single "Copied"
  // flash, no juggling.
  const [urlVariant, setUrlVariant] = useState<"digest" | "full">("digest");

  const bundleUrl = useMemo(() => `https://mdfy.app/b/${bundleId}`, [bundleId]);

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

  const accessIcon = accessKind === "public" ? <Globe width={14} height={14} /> : accessKind === "shared" ? <Users width={14} height={14} /> : <Cloud width={14} height={14} />;
  const accessLabel = accessKind === "public" ? "PUBLIC" : accessKind === "shared" ? "SHARED" : "PRIVATE";
  const accessColor = accessKind === "public" ? "#4ade80" : accessKind === "shared" ? "#60a5fa" : "var(--text-faint)";

  const [showCopyHint, setShowCopyHint] = useState(false);
  useEffect(() => { if (!showCopyHint) return; const t = setTimeout(() => setShowCopyHint(false), 1600); return () => clearTimeout(t); }, [showCopyHint]);

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Identity hero — big centered icon, title, bio, intent,
            meta + Open-in-browser CTA. Same shape as Hub's hero so
            both surfaces read as one family. Slug intentionally
            omitted; the full URL lives in the Deploy card below. */}
        <header
          className="mb-6 rounded-xl text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", padding: "32px 24px 24px" }}
        >
          <div
            className="mx-auto flex items-center justify-center rounded-2xl"
            style={{ width: 80, height: 80, background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            <Layers width={40} height={40} />
          </div>
          <h1
            className="text-display font-bold tracking-tight mt-4"
            style={{ color: "var(--text-primary)", lineHeight: 1.2 }}
          >
            {bundleTitle || "Untitled bundle"}
          </h1>
          {bundleDescription && (
            <p
              className="text-body mt-3 mx-auto leading-relaxed"
              style={{ color: "var(--text-secondary)", maxWidth: 480 }}
            >
              {bundleDescription}
            </p>
          )}
          {bundleIntent && (
            <p
              className="text-caption mt-2 mx-auto italic"
              style={{ color: "var(--text-faint)", maxWidth: 480 }}
            >
              Intent: {bundleIntent}
            </p>
          )}
          {/* Meta + Open-in-browser CTA — centered row. Matches
              Hub's "meta + Galaxy" row. */}
          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "var(--text-faint)" }}>
              <Layers width={11} height={11} />
              {documents.length} {documents.length === 1 ? "doc" : "docs"}
            </span>
            {lastUpdatedAt && (
              <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                <Clock width={11} height={11} />
                Updated {relativeTime(lastUpdatedAt)}
              </span>
            )}
            {accessKind === "shared" && bundleAllowedEmails && bundleAllowedEmails.length > 0 && (
              <span className="inline-flex items-center gap-1 text-caption font-mono" style={{ color: "#60a5fa" }}>
                <Users width={11} height={11} />
                Shared with {bundleAllowedEmails.length}
              </span>
            )}
            <a
              href={bundleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-caption font-mono px-2.5 py-1 rounded transition-colors hover:bg-[var(--accent-dim)]"
              style={{
                color: "var(--accent)",
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-dim)",
                textDecoration: "none",
                letterSpacing: 0.3,
              }}
              title="Open the rendered HTML view"
            >
              <Eye width={11} height={11} />
              <span>Open in browser</span>
              <ArrowUpRight width={11} height={11} />
            </a>
          </div>
        </header>

        {/* Deploy URL card — clearly labeled. Header + variant
            chips + ONE URL row + a small "Agent payload" link.
            Meta + Open-in-browser already live in the identity
            hero so they're not duplicated here. */}
        {(() => {
          const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
          const digestTokens = 50 + documents.length * 35;
          const fullTokens = Math.max(tokens, digestTokens);
          const activeUrl = urlVariant === "full" ? `${bundleUrl}?full=1` : bundleUrl;
          const rawHref = urlVariant === "full" ? `/b/${bundleId}.md?full=1` : `/b/${bundleId}.md`;
          const onCopy = () => {
            if (typeof navigator === "undefined") return;
            navigator.clipboard.writeText(activeUrl).then(() => {
              setCopied(true);
              setShowCopyHint(true);
              setTimeout(() => setCopied(false), 1200);
            });
          };
          return (
            <section
              className="mb-6 rounded-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", padding: "16px 18px" }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="flex items-center justify-center shrink-0 mt-0.5"
                  style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent-dim)", color: "var(--accent)" }}
                >
                  <Globe width={14} height={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>
                    Deploy this bundle to any AI
                  </p>
                  <p className="text-caption mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Paste the URL into <strong>Claude</strong>, <strong>ChatGPT</strong>, or <strong>Cursor</strong> — the AI fetches the markdown payload directly.
                  </p>
                </div>
              </div>
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
                <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>
                  {urlVariant === "digest"
                    ? `≈ ${fmt(digestTokens)} tokens / cheap concept map`
                    : `≈ ${fmt(fullTokens)} tokens / every doc inline`}
                </span>
              </div>
              <button
                onClick={onCopy}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono transition-colors hover:bg-[var(--toggle-bg)]"
                style={{
                  fontSize: 13,
                  background: "var(--background)",
                  color: copied ? "#22c55e" : "var(--text-primary)",
                  border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "var(--border-dim)"}`,
                }}
                title="Copy URL"
              >
                <span className="flex-1 text-left truncate">{activeUrl}</span>
                <span className="flex items-center gap-1 shrink-0" style={{ color: copied ? "#22c55e" : "var(--text-faint)" }}>
                  {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                  <span className="text-caption">{copied ? "Copied" : "Copy"}</span>
                </span>
              </button>
              {/* Small "agent payload" peek — what the AI receives.
                  Single thin link, not a footer row, so the URL stays
                  the only visual emphasis. */}
              <a
                href={rawHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-caption mt-2 transition-colors hover:underline"
                style={{ color: "var(--text-muted)" }}
                title="Raw .md payload — exactly what an AI sees"
              >
                <ExternalLink width={11} height={11} />
                See what the AI sees (raw payload)
              </a>
            </section>
          );
        })()}

        {/* Wire-it hint — small standalone link, no longer a card.
            Bundles don't have per-tool tabs (only Hub does), so this
            sits between the Deploy URL and the stat strip as a thin
            "want to automate? read this" pointer. */}
        <a
          href="/docs/integrate"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-caption mb-6 transition-colors hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          <Sparkles width={11} height={11} />
          <span>Wire it into AGENTS.md / CLAUDE.md / .cursor/rules</span>
          <span style={{ color: "var(--accent)" }}>→</span>
        </a>

        {/* ─── Stat strip ─── */}
        <section className="grid grid-cols-3 gap-2 mb-7">
          <div
            className="rounded-lg px-4 py-3.5"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: accessColor }}>
              {accessIcon}
              <span className="text-caption font-mono uppercase tracking-wider font-semibold">{accessLabel}</span>
            </div>
            <div className="text-display font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmtCount(documents.length)}
            </div>
            <div className="text-caption" style={{ color: "var(--text-faint)" }}>
              {documents.length === 1 ? "document" : "documents"}
            </div>
          </div>
          <div
            className="rounded-lg px-4 py-3.5"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--text-muted)" }}>
              <FileText width={14} height={14} />
              <span className="text-caption font-mono uppercase tracking-wider font-semibold">WORDS</span>
            </div>
            <div className="text-display font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmtCount(totalWords)}
            </div>
            <div className="text-caption" style={{ color: "var(--text-faint)" }}>
              total prose
            </div>
          </div>
          <div
            className="rounded-lg px-4 py-3.5"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: hasDiscoveries ? "var(--accent)" : "var(--text-faint)" }}>
              <Sparkles width={14} height={14} />
              <span className="text-caption font-mono uppercase tracking-wider font-semibold">AI</span>
              {hasDiscoveries && isAnalysisStale && (
                <span
                  className="text-caption font-mono px-1 rounded uppercase tracking-wider"
                  style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b", fontSize: 9, fontWeight: 700, marginLeft: "auto" }}
                  title="Member docs have changed since the last analysis"
                >
                  STALE
                </span>
              )}
            </div>
            {/* Concrete counts when we have them; falls back to a
                status label so the card stays readable for bundles
                that haven't been analyzed yet. */}
            {hasDiscoveries && (themeCount || insightCount) ? (
              <div className="text-body font-semibold tabular-nums" style={{ color: "var(--text-primary)", lineHeight: 1.2 }}>
                {themeCount ? `${themeCount} theme${themeCount === 1 ? "" : "s"}` : null}
                {themeCount && insightCount ? <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>, </span> : null}
                {insightCount ? `${insightCount} insight${insightCount === 1 ? "" : "s"}` : null}
              </div>
            ) : (
              <div className="text-body font-semibold" style={{ color: "var(--text-primary)", lineHeight: 1.2 }}>
                {hasDiscoveries ? "Analyzed" : hasGraph ? "Graph ready" : "Not analyzed"}
              </div>
            )}
            <button
              onClick={() => onSwitchToCanvas?.()}
              className="text-caption mt-0.5 transition-colors hover:underline"
              style={{ color: "var(--text-faint)" }}
            >
              {hasDiscoveries ? "Open canvas →" : "Run analysis →"}
            </button>
          </div>
        </section>

        {/* Stale analysis banner — surfaces the same signal the canvas
            shows, but on the overview surface so users see it before
            opening the canvas tab. Only renders when there IS an
            analysis and member docs have moved on since then. */}
        {hasDiscoveries && isAnalysisStale && (
          <section
            className="mb-7 rounded-lg flex items-start gap-2.5 px-4 py-3"
            style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)" }}
          >
            <AlertTriangle width={16} height={16} className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>
                Analysis is out of date
              </p>
              <p className="text-caption" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                One or more member docs have changed since the last run. Open the canvas and re-run analysis to refresh themes and insights.
              </p>
            </div>
            <button
              onClick={() => onSwitchToCanvas?.()}
              className="shrink-0 text-caption font-medium px-2.5 py-1 rounded transition-colors hover:bg-[rgba(245,158,11,0.18)]"
              style={{ color: "#f59e0b", border: "1px solid rgba(245,158,11,0.5)" }}
            >
              Re-run →
            </button>
          </section>
        )}

        {/* ─── Documents ─── */}
        <section className="mb-8">
          <header className="flex items-baseline justify-between mb-3">
            <h2 className="text-heading" style={{ color: "var(--accent)" }}>
              Documents
            </h2>
            <button
              onClick={() => onSwitchToList?.()}
              className="text-caption transition-colors hover:underline"
              style={{ color: "var(--text-faint)" }}
            >
              List view →
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
                    <button
                      onClick={() => onOpenDoc?.(d.id)}
                      className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors group hover:bg-[var(--toggle-bg)]"
                      style={{ border: "1px solid var(--border-dim)" }}
                    >
                      <FileText width={13} height={13} className="shrink-0 mt-1" style={{ color: "var(--accent)" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-body font-medium" style={{ color: "var(--text-primary)" }}>
                            {d.title || "Untitled"}
                          </span>
                          {updated && (
                            <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>
                              {updated}
                            </span>
                          )}
                        </div>
                        {annotation && (
                          <p className="text-caption mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.45 }}>
                            <span
                              className="font-mono uppercase mr-1.5"
                              style={{ color: "var(--accent)", fontWeight: 700, fontSize: 9, letterSpacing: 0.5 }}
                            >
                              AI
                            </span>
                            {annotation}
                          </p>
                        )}
                      </div>
                      <span className="text-caption font-mono shrink-0 mt-1" style={{ color: "var(--text-faint)" }}>
                        {fmtCount(wordCount)} words
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
