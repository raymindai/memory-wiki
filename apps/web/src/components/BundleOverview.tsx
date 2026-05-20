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
import { Layers, Copy, Check, ExternalLink, FileText, Globe, Cloud, Users, Sparkles, AlertTriangle, Clock, Network, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";

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

  const accessIcon = accessKind === "public" ? <Globe width={14} height={14} /> : accessKind === "shared" ? <Users width={14} height={14} /> : <Cloud width={14} height={14} />;
  const accessLabel = accessKind === "public" ? "PUBLIC" : accessKind === "shared" ? "SHARED" : "PRIVATE";
  const accessColor = accessKind === "public" ? "#4ade80" : accessKind === "shared" ? "#60a5fa" : "var(--text-faint)";

  const [showCopyHint, setShowCopyHint] = useState(false);
  useEffect(() => { if (!showCopyHint) return; const t = setTimeout(() => setShowCopyHint(false), 1600); return () => clearTimeout(t); }, [showCopyHint]);

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Identity hero — same card shape as Hub's hero so both
            surfaces read as one family. Big centered icon + title
            (inline-editable for owners) + AI digest + description
            + intent + meta with Canvas CTA. */}
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
          {onRenameBundle ? (
            <h1
              className="text-display font-bold tracking-tight mt-4 outline-none rounded transition-colors hover:bg-[var(--toggle-bg)] focus:bg-[var(--toggle-bg)]"
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
              className="text-display font-bold tracking-tight mt-4"
              style={{ color: "var(--text-primary)", lineHeight: 1.2 }}
            >
              {bundleTitle || "Untitled bundle"}
            </h1>
          )}
          {/* AI digest — 2-3 sentence summary from graph_data.summary.
              Sits directly under the title so the gist reads first,
              ahead of user-set description / intent / meta. Clamped
              to 3 lines by default; long summaries reveal a More
              chip that toggles the full text inline. */}
          {bundleSummary && (() => {
            const isLong = bundleSummary.length > 180;
            return (
              <div className="mt-3 mx-auto" style={{ maxWidth: 560 }}>
                <p
                  className="text-body leading-relaxed text-center"
                  style={{
                    color: "var(--text-secondary)",
                    ...(summaryExpanded ? {} : {
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }),
                  }}
                >
                  {bundleSummary}
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
          {/* Meta strip — centered row. */}
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
            {onSwitchToCanvas && (
              <button
                onClick={() => onSwitchToCanvas()}
                className="inline-flex items-center gap-1.5 text-caption font-mono px-2.5 py-1 rounded transition-colors hover:bg-[var(--accent-dim)]"
                style={{
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-dim)",
                  letterSpacing: 0.3,
                }}
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
            tab row, no "via mdfy:" grouping. */}
        {(() => {
          const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
          const digestTokens = 50 + documents.length * 35;
          const fullTokens = Math.max(tokens, digestTokens);
          const activeUrl = urlVariant === "full" ? `${bundleUrl}?full=1` : bundleUrl;
          const rawHref = urlVariant === "full" ? `/b/${bundleId}.md?full=1` : `/b/${bundleId}.md`;

          const projCtx = `# Project context

mdfy bundle: ${bundleUrl}

Fetch this URL on every session. The response carries the bundle's
markdown payload — title, annotations, links + concept analysis —
ready to paste as project context.`;
          const cursorRule = `---
description: mdfy bundle context
alwaysApply: true
---
mdfy bundle: ${bundleUrl}

Fetch this URL on every session for project-scoped context.`;
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
/mdfy bundle ${bundleId}
/mdfy search "topic"`;
          const cliUse = `npm install -g mdfy-cli

mdfy bundle ${bundleId}
mdfy search "topic"`;

          type Tool = {
            id: string;
            label: string;
            hint: string;
            savePath?: string;
            snippet: string;
            explanation: string;
            docHref: string;
          };
          const TOOLS: Tool[] = [
            { id: "claude", label: "Claude", hint: "Drop the URL into a Claude chat", snippet: bundleUrl, explanation: "Works the same in Claude.ai (web) and the Mac / Windows desktop app. Claude fetches the bundle payload and follows inline doc links as needed.", docHref: "/docs/integrate" },
            { id: "chatgpt", label: "ChatGPT", hint: "Drop the URL into a ChatGPT chat", snippet: bundleUrl, explanation: "Works in ChatGPT web and the Mac desktop app. ChatGPT fetches the URL via its built-in browser tool and reads the bundle's markdown.", docHref: "/docs/integrate" },
            { id: "gemini", label: "Gemini", hint: "Drop the URL into Gemini (web or app)", snippet: bundleUrl, explanation: "Gemini reads the URL via its built-in tool use. Same payload format as Claude and ChatGPT.", docHref: "/docs/integrate#gemini" },
            { id: "claude-code", label: "Claude Code", hint: "Save as CLAUDE.md in your project root", savePath: "CLAUDE.md", snippet: projCtx, explanation: "Claude Code auto-loads CLAUDE.md at the start of every session. Save this snippet to your project root and the bundle becomes ambient context for every conversation in the repo.", docHref: "/docs/integrate#claude-code" },
            { id: "cursor", label: "Cursor", hint: "Save as .cursor/rules/mdfy.mdc", savePath: ".cursor/rules/mdfy.mdc", snippet: cursorRule, explanation: "Cursor's Rules feature reads .mdc files from .cursor/rules/. alwaysApply: true keeps the bundle URL in context on every chat, including ad-hoc questions.", docHref: "/docs/integrate#cursor" },
            { id: "generic", label: "Generic", hint: "Paste the URL into any AI that can fetch a webpage", snippet: bundleUrl, explanation: "Any LLM with web-fetch (or a configured browser tool) works. Append ?full=1 for every doc inline, or use /b/<id>.md for the raw markdown payload.", docHref: "/docs/integrate" },
            { id: "mcp", label: "MCP", hint: "Add mdfy-mcp to your MCP host config", snippet: mcpConfig, explanation: "Compatible with Claude Desktop, Cursor, Cline, Windsurf, and any MCP-capable host. Exposes 26 tools across capture / bundle / search / share / version history.", docHref: "/docs/mcp" },
            { id: "skill", label: "Skill", hint: "Use /mdfy slash commands inside Claude Code", snippet: skillUse, explanation: "Install once with `claude skill install mdfy`. Then inside any Claude Code session, run /mdfy bundle <id> or /mdfy search to pull this bundle in.", docHref: "/docs/integrate" },
            { id: "cli", label: "CLI", hint: "Pull this bundle from your terminal", snippet: cliUse, explanation: "Globally-installed npm package. Run mdfy bundle <id> from any directory to fetch the bundle's content; useful for scripting or terminal-first workflows.", docHref: "/docs/cli" },
          ];
          const active = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];
          const URL_TOOL_IDS = new Set(["claude", "chatgpt", "gemini", "generic"]);
          const isUrlTool = URL_TOOL_IDS.has(active.id);

          return (
            <section className="mb-8 rounded-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", padding: "20px 20px 18px" }}>
              <h2 className="text-heading font-semibold" style={{ color: "var(--text-primary)", margin: 0 }}>
                How to use this bundle
              </h2>
              <p className="text-caption mt-1 mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
                Pick your AI tool. Each one shows exactly what to paste and where.
              </p>

              {/* Flat tab row — same style as the canvas's
                  Document / Insights / Decompose tabs. Active = text
                  + 2px accent underline, no chip backgrounds. */}
              <div className="flex flex-wrap items-center mb-3" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                {TOOLS.map((t) => {
                  const isActive = activeTool === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTool(t.id)}
                      className="px-3 pt-1.5 pb-2 text-caption font-medium transition-colors relative"
                      style={{
                        color: isActive ? "var(--text-primary)" : "var(--text-faint)",
                        background: "transparent",
                        border: "none",
                      }}
                    >
                      {t.label}
                      {isActive && (
                        <div
                          className="absolute left-0 right-0 -bottom-px h-[2px]"
                          style={{ background: "var(--accent)" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active tab content card */}
              <div className="rounded-lg overflow-hidden"
                style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}>
                <div className="flex items-baseline justify-between px-3 py-2 gap-2"
                  style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  <span className="text-caption truncate" style={{ color: "var(--text-secondary)" }}>
                    {active.savePath ? (
                      <>Save to{" "}<code className="font-mono" style={{ color: "var(--accent)" }}>{active.savePath}</code></>
                    ) : (
                      <>{active.hint}</>
                    )}
                  </span>
                  <span className="text-caption shrink-0" style={{ color: "var(--text-faint)" }}>
                    {active.label}
                  </span>
                </div>

                {isUrlTool ? (
                  <div className="px-3 py-3">
                    <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                      <div className="flex items-center">
                        {(["digest", "full"] as const).map((v) => {
                          const isActive = urlVariant === v;
                          const tokenLabel = v === "digest" ? `≈ ${fmt(digestTokens)} tok` : `≈ ${fmt(fullTokens)} tok`;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setUrlVariant(v)}
                              className="px-3 pt-1.5 pb-2 transition-colors relative flex items-center gap-1.5"
                              style={{
                                color: isActive ? "var(--text-primary)" : "var(--text-faint)",
                                background: "transparent",
                                border: "none",
                              }}
                            >
                              <span className="font-medium" style={{ fontSize: 12 }}>
                                {v === "digest" ? "Compact" : "Full"}
                              </span>
                              <span style={{ fontSize: 10, opacity: 0.7, fontFamily: "var(--font-mono)" }}>{tokenLabel}</span>
                              {isActive && (
                                <div
                                  className="absolute left-0 right-0 -bottom-px h-[2px]"
                                  style={{ background: "var(--accent)" }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-caption pb-1.5" style={{ color: "var(--text-faint)" }}>
                        {urlVariant === "digest" ? "concept map, cheap to paste" : "every doc inline"}
                      </span>
                    </div>
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
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono transition-colors hover:bg-[var(--toggle-bg)]"
                      style={{
                        fontSize: 13,
                        background: "var(--surface)",
                        color: copiedTool === active.id ? "#22c55e" : "var(--text-primary)",
                        border: `1px solid ${copiedTool === active.id ? "rgba(34,197,94,0.4)" : "var(--border-dim)"}`,
                      }}
                      title="Copy URL"
                    >
                      <span className="flex-1 text-left truncate">{activeUrl}</span>
                      <span className="flex items-center gap-1 shrink-0" style={{ color: copiedTool === active.id ? "#22c55e" : "var(--text-faint)" }}>
                        {copiedTool === active.id ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                        <span className="text-caption">{copiedTool === active.id ? "Copied" : "Copy"}</span>
                      </span>
                    </button>
                  </div>
                ) : (
                  <pre
                    className="px-3 py-2 text-caption font-mono whitespace-pre-wrap"
                    style={{ color: "var(--text-primary)", margin: 0, fontSize: 11, lineHeight: 1.6 }}
                  >{active.snippet}</pre>
                )}

                <div className="flex items-center justify-between gap-2 px-3 py-2"
                  style={{ borderTop: "1px solid var(--border-dim)" }}>
                  {isUrlTool ? (
                    <a
                      href={rawHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-caption transition-colors hover:underline"
                      style={{ color: "var(--text-muted)" }}
                      title="Raw .md payload — what the AI actually sees"
                    >
                      <ExternalLink width={11} height={11} />
                      See raw payload
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        if (typeof navigator === "undefined") return;
                        navigator.clipboard.writeText(active.snippet).then(() => {
                          setCopiedTool(active.id);
                          setTimeout(() => setCopiedTool(null), 1500);
                        });
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
                  )}
                  <a href={active.docHref} target="_blank" rel="noopener noreferrer"
                    className="text-caption font-mono" style={{ color: "var(--accent)" }}>
                    Full guide →
                  </a>
                </div>
              </div>
              {active.explanation && (
                <p
                  className="text-caption leading-relaxed"
                  style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap", margin: "12px 4px 0" }}
                >
                  {active.explanation}
                </p>
              )}
            </section>
          );
        })()}

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
