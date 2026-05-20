import type { Metadata } from "next";
import { CodeBlock, InlineCode, SectionHeading, DocsNav, DocsSidebar, SiteFooter, mono } from "@/components/docs";

export const metadata: Metadata = {
  title: "Integrate with AI dev tools — memory.wiki",
  description:
    "Plug your mdfy hub or bundle into Claude Code, Cursor, Codex, Gemini CLI, Windsurf, and Aider with a single URL. One line in AGENTS.md / CLAUDE.md / .cursor/rules and every AI tool reads your personal knowledge graph.",
  alternates: { canonical: "https://memory.wiki/docs/integrate" },
  openGraph: {
    title: "Integrate mdfy with AI dev tools",
    description: "One line in AGENTS.md / CLAUDE.md / .cursor/rules — every AI tool reads your hub or bundle as clean markdown.",
    url: "https://memory.wiki/docs/integrate",
    images: [{ url: "/api/og?title=Integrate%20with%20AI%20dev%20tools", width: 1200, height: 630 }],
  },
};

/* ─── Sidebar Items ─── */
const sidebarItems = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "30-second setup" },
  { id: "pick-url", label: "Pick the right URL" },
  { id: "permissions", label: "Privacy & sharing" },
  { id: "agents-md", label: "AGENTS.md (cross-tool)" },
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex CLI" },
  { id: "gemini", label: "Gemini CLI" },
  { id: "windsurf", label: "Windsurf" },
  { id: "aider", label: "Aider" },
  { id: "github-action", label: "GitHub Action sync" },
  { id: "staleness", label: "Staleness + auto-analyze" },
];

/* ─── Tool block ─── */
function ToolBlock({
  id,
  name,
  filePath,
  tagline,
  snippet,
  notes,
}: {
  id: string;
  name: string;
  filePath: string;
  tagline: string;
  snippet: string;
  notes?: React.ReactNode;
}) {
  return (
    <div
      id={id}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-dim)",
        borderRadius: 14,
        padding: "28px 24px",
        marginBottom: 20,
        scrollMarginTop: 80,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>{name}</h3>
        <code style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)" }}>{filePath}</code>
      </div>
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 0, marginBottom: 16, maxWidth: 640 }}>
        {tagline}
      </p>
      <CodeBlock lang="markdown">{snippet}</CodeBlock>
      {notes && (
        <p style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.7, marginTop: 12, marginBottom: 0, maxWidth: 640 }}>
          {notes}
        </p>
      )}
    </div>
  );
}

/* ─── Page ─── */
export default function IntegrateDocsPage() {
  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100vh",
      }}
    >
      <DocsNav />

      <div className="docs-layout">
        <DocsSidebar items={sidebarItems} currentPath="/docs/integrate" />

        <main style={{ paddingTop: 40, paddingBottom: 80, minWidth: 0 }}>
          {/* ─── Overview ─── */}
          <div id="overview" style={{ scrollMarginTop: 80 }}>
            <p
              style={{
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 12,
                fontFamily: mono,
              }}
            >
              Integrate
            </p>
            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
                margin: "0 0 16px",
              }}
            >
              Your AI tools forget you between sessions. Fix it with one line.
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 16,
                maxWidth: 680,
              }}
            >
              Claude Code, Cursor, Codex, and every other agent boot with whatever you wrote in <InlineCode>{"CLAUDE.md"}</InlineCode> / <InlineCode>{"AGENTS.md"}</InlineCode> / <InlineCode>{".cursor/rules"}</InlineCode>. Add a single line that points at your mdfy bundle or hub, and the next session opens with your prior decisions, notes, and analysis already loaded.
            </p>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 32,
                maxWidth: 680,
              }}
            >
              The URL response carries the bundle&apos;s pre-computed graph (themes, insights, concept relations) in the same payload &mdash; the receiving AI inherits the prior AI&apos;s work for free. No vendor lock-in, no API keys, no per-tool plug-in.
            </p>
          </div>

          {/* ─── 30-second setup ─── */}
          <SectionHeading id="quickstart">30-second setup</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            The same three steps apply to every tool below. The only thing that changes per tool is which file you drop the line into.
          </p>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 16,
            }}
          >
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8 }}>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Pick the bundle URL</strong> for the project (or the hub URL for personal context). Copy from the bundle&apos;s Deploy panel.
              </li>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Open your AI tool&apos;s context file</strong> (<InlineCode>{"AGENTS.md"}</InlineCode> works for most; tool-specific names below).
              </li>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Paste one line</strong>, commit, done.
              </li>
            </ol>
          </div>
          <CodeBlock lang="markdown">{`# Project context

Working bundle: https://memory.wiki/b/<bundle-id>

Re-read on every session for spec, decisions, prior reasoning.
The bundle carries its own graph (themes, insights, concept relations).`}</CodeBlock>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginTop: 12,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            That&apos;s the entire integration. Everything below is the per-tool variation of the same three steps.
          </p>

          {/* ─── Pick the right URL ─── */}
          <SectionHeading id="pick-url">Pick the right URL</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            mdfy exposes three URL shapes. For project-scoped tool config, the bundle URL is almost always the right choice — it carries the canvas analysis with it.
          </p>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "200px 100px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>memory.wiki/&#123;docId&#125;</code>
              <span style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)" }}>single doc</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>One spec, one decision, one note. Tightest token cost.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "200px 100px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>memory.wiki/b/&#123;bundleId&#125;</code>
              <span style={{ fontSize: 12, fontFamily: mono, color: "var(--accent)" }}>bundle</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text-primary)" }}>Recommended for AGENTS.md / .cursor/rules.</strong> 3-20+ docs grouped by intent, plus the canvas analysis (themes, insights, concept relations) shipped in the same response.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "200px 100px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>memory.wiki/hub/&#123;you&#125;</code>
              <span style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)" }}>whole hub</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>Your entire knowledge graph with concept_index. Use sparingly — broad context costs more tokens.</span>
            </div>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            Append <InlineCode>{"?compact"}</InlineCode> to trim whitespace, <InlineCode>{"?full=1"}</InlineCode> (bundle only) to inline every member doc, <InlineCode>{"?graph=0"}</InlineCode> (bundle only) to drop the analysis section.
          </p>

          {/* ─── Privacy & sharing ─── */}
          <SectionHeading id="permissions">Privacy &amp; sharing</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            The raw-markdown endpoint mirrors the viewer&apos;s gating exactly. If a person can&apos;t see the rendered page, an AI agent can&apos;t fetch the markdown either &mdash; the three states below apply equally to docs, bundles, and hubs.
          </p>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>Public</code>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Published, no allowed_emails. Any AI fetches anonymously &mdash; no headers required. This is the right setting for an open-source project&apos;s bundle that you want every contributor&apos;s AI tools to read.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>Restricted</code>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Published, with <InlineCode>{"allowed_emails"}</InlineCode> set. The fetcher must identify itself: either an owner JWT in <InlineCode>{"Authorization: Bearer <token>"}</InlineCode>, or an <InlineCode>{"X-User-Email"}</InlineCode> header that matches one of the allowed addresses. Otherwise 403 / 404.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>Private</code>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Not yet published. Only the owner (via JWT) can fetch. Private items return 404 to everyone else &mdash; including AI tools that don&apos;t know your auth. Publish the bundle first before referencing it in tool config.
              </span>
            </div>
          </div>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 16,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            Practical recipes
          </h3>
          <ul
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 24,
              paddingLeft: 20,
              maxWidth: 680,
            }}
          >
            <li>
              <strong style={{ color: "var(--text-primary)" }}>Open-source project</strong>: bundle public, paste in <InlineCode>{"AGENTS.md"}</InlineCode>. Every contributor&apos;s AI tool fetches anonymously. Zero coordination.
            </li>
            <li>
              <strong style={{ color: "var(--text-primary)" }}>Internal / team project</strong>: bundle with <InlineCode>{"allowed_emails"}</InlineCode> of teammates. Each teammate&apos;s AI tool needs to send <InlineCode>{"X-User-Email"}</InlineCode> &mdash; most CLIs let you template request headers via env or rc files. The bundle&apos;s rendered viewer also gates on the same list, so non-teammates see 404 in both surfaces.
            </li>
            <li>
              <strong style={{ color: "var(--text-primary)" }}>Solo / private notes</strong>: hub URL referenced from <InlineCode>{"~/.claude/CLAUDE.md"}</InlineCode>. Hub-wide visibility is per-item, not per-hub &mdash; public docs surface, private docs stay hidden until you publish them.
            </li>
          </ul>

          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            <strong style={{ color: "var(--text-muted)" }}>Invariant</strong>: every gating decision happens server-side in the raw-fetch route. There&apos;s no way for the URL to leak content the rendered viewer wouldn&apos;t already show. Switching gating (e.g. removing an email from <InlineCode>{"allowed_emails"}</InlineCode>) takes effect on the next fetch &mdash; AI tools that already cached the markdown locally won&apos;t see the revocation until they re-fetch.
          </p>

          {/* ─── AGENTS.md cross-tool (start here) ─── */}
          <SectionHeading id="agents-md">AGENTS.md — start here</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 12,
              maxWidth: 680,
            }}
          >
            If you only want to maintain one file, this is the one. <InlineCode>{"AGENTS.md"}</InlineCode> is the open
            cross-tool convention for &ldquo;agent instructions at the repo root&rdquo; — Codex CLI, Claude Code, and Aider all read it. Drop your bundle URL here and most of your agents pick it up immediately, no per-tool config.
          </p>
          <ToolBlock
            id="agents-md-tool"
            name="AGENTS.md"
            filePath="AGENTS.md (project root)"
            tagline="One file, covered by Codex CLI, Claude Code, Aider, and any future agent that respects the convention. Use the tool-specific files below only for nuances that don't belong at the cross-tool layer."
            snippet={`# Project agents

## Working context

Bundle: https://memory.wiki/b/<bundle-id>

Fetch this URL when you need this project's spec, decisions, or
cross-doc reasoning. The bundle's pre-computed graph (themes,
insights, concept relations) is in the same response — no separate
index call needed.`}
          />
          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            Pattern: keep tool-specific overrides in their respective files (<InlineCode>{".cursor/rules/"}</InlineCode>, <InlineCode>{"GEMINI.md"}</InlineCode>, <InlineCode>{".windsurfrules"}</InlineCode>) but put the mdfy URL in <InlineCode>{"AGENTS.md"}</InlineCode>. The URL is the portable bit; per-tool nuance stays per-tool.
          </p>

          {/* ─── Per-tool blocks (alternatives + tool-specific notes) ─── */}
          <SectionHeading id="claude-code">Claude Code</SectionHeading>
          <ToolBlock
            id="claude-code-tool"
            name="Claude Code"
            filePath="CLAUDE.md (project root) — and AGENTS.md"
            tagline="Claude Code auto-loads CLAUDE.md from the project root and every parent directory, plus AGENTS.md when present. Either file works; CLAUDE.md is the right home for Claude-specific overrides."
            snippet={`## Project context (from mdfy)

Bundle: https://memory.wiki/b/<bundle-id>

This bundle carries the project's spec, ADRs, and decisions —
plus a pre-computed graph (themes, insights, concept relations).
Re-read it whenever you need cross-doc context.`}
            notes={
              <>
                For user-global memory across all projects, use <InlineCode>{"~/.claude/CLAUDE.md"}</InlineCode> with your hub URL instead.
              </>
            }
          />

          <SectionHeading id="cursor">Cursor</SectionHeading>
          <ToolBlock
            id="cursor-tool"
            name="Cursor"
            filePath=".cursor/rules/mdfy.mdc"
            tagline="Cursor's newer multi-rule format. Frontmatter scopes when the rule applies; body holds the mdfy URL. Use one file per bundle for clean separation."
            snippet={`---
description: Project context from mdfy
alwaysApply: true
---

Project context lives at https://memory.wiki/b/<bundle-id>.

When you need spec / decisions / prior reasoning, fetch that URL.
The response is clean markdown with the bundle's graph analysis
(themes, insights, gaps, connections) included by default.`}
            notes={
              <>
                Legacy single-file <InlineCode>{".cursorrules"}</InlineCode> works too — just drop the body content (without the frontmatter) into the root <InlineCode>{".cursorrules"}</InlineCode> file.
              </>
            }
          />

          <SectionHeading id="codex">Codex CLI</SectionHeading>
          <ToolBlock
            id="codex-tool"
            name="Codex CLI"
            filePath="AGENTS.md (project root)"
            tagline="OpenAI's Codex CLI is the agent AGENTS.md was originally defined for. If you've already followed the AGENTS.md section above, Codex is already covered — this block is here for completeness."
            snippet={`# Project Agents Manifest

## Working context

Bundle: https://memory.wiki/b/<bundle-id>

Fetch on demand for spec, decisions, prior reasoning.`}
          />

          {/* ─── Secondary ─── */}
          <SectionHeading id="gemini">Gemini CLI</SectionHeading>
          <ToolBlock
            id="gemini-tool"
            name="Gemini CLI"
            filePath="GEMINI.md (project root)"
            tagline="Google's Gemini CLI reads GEMINI.md as its session-instructions file. Same content shape as the others."
            snippet={`# Gemini context

Project memory lives at https://memory.wiki/b/<bundle-id>.
Fetch on demand for spec, decisions, and cross-doc reasoning.`}
          />

          <SectionHeading id="windsurf">Windsurf</SectionHeading>
          <ToolBlock
            id="windsurf-tool"
            name="Windsurf"
            filePath=".windsurfrules (project root)"
            tagline="Windsurf reads .windsurfrules at the project root for its Cascade agent."
            snippet={`Project context: https://memory.wiki/b/<bundle-id>

When you need this project's spec / decisions / prior reasoning,
fetch that URL. It returns clean markdown with the bundle's graph
analysis included.`}
          />

          <SectionHeading id="aider">Aider</SectionHeading>
          <ToolBlock
            id="aider-tool"
            name="Aider"
            filePath="CONVENTIONS.md (project root)"
            tagline="Aider's terminal-first AI pair programmer reads CONVENTIONS.md as part of the chat context (add it via aider --read CONVENTIONS.md or list it under read: in .aider.conf.yml)."
            snippet={`# Project conventions

External context for this project lives at:
https://memory.wiki/b/<bundle-id>

Fetch that URL when you need spec, decisions, or cross-doc reasoning.`}
          />

          {/* ─── GitHub Action sync ─── */}
          <SectionHeading id="github-action">GitHub Action sync — keep one mdfy doc in step with your repo</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            Treat one mdfy doc as your repo&apos;s &ldquo;working knowledge URL&rdquo;. Every push to <InlineCode>main</InlineCode> that touches <InlineCode>{"CLAUDE.md"}</InlineCode>, <InlineCode>{"AGENTS.md"}</InlineCode>, or <InlineCode>{"docs/**.md"}</InlineCode> PATCHes the combined markdown to your mdfy doc. Paste the doc URL into Claude, Cursor, or Codex and they always see the latest state of your repo&apos;s docs.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            One-time setup (under 5 minutes):
          </p>
          <ol style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16, maxWidth: 680, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              Create the target doc on memory.wiki. The URL chip in the editor shows the id (the <InlineCode>{"<id>"}</InlineCode> in <InlineCode>{"memory.wiki/d/<id>"}</InlineCode>) — that&apos;s your <InlineCode>{"MDFY_DOC_ID"}</InlineCode>.
            </li>
            <li style={{ marginBottom: 8 }}>
              On the same doc, open the <strong style={{ color: "var(--text-primary)" }}>Share</strong> modal (top-right of the editor). Scroll to the <em>Developer access</em> footer and click <strong style={{ color: "var(--text-primary)" }}>Copy edit token</strong>. That&apos;s your <InlineCode>{"MDFY_EDIT_TOKEN"}</InlineCode>. Treat it like a password — anyone with it can write to the doc.
            </li>
            <li style={{ marginBottom: 8 }}>
              On GitHub: <em>Settings → Secrets and variables → Actions → New repository secret</em>. Add both <InlineCode>{"MDFY_DOC_ID"}</InlineCode> and <InlineCode>{"MDFY_EDIT_TOKEN"}</InlineCode>.
            </li>
            <li style={{ marginBottom: 8 }}>
              Drop the workflow file below at <InlineCode>{".github/workflows/sync-mdfy.yml"}</InlineCode> and push. Run it once via <em>Actions → Sync repo docs → mdfy → Run workflow</em> to verify.
            </li>
          </ol>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4, marginBottom: 6, fontFamily: mono }}>
            .github/workflows/sync-mdfy.yml
          </p>
          <CodeBlock lang="yaml">{`name: Sync repo docs → mdfy

on:
  push:
    branches: [main]
    paths:
      - 'CLAUDE.md'
      - 'AGENTS.md'
      - 'docs/**.md'
      - '.github/workflows/sync-mdfy.yml'
  workflow_dispatch: {}

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build the combined markdown
        id: build
        run: |
          set -euo pipefail
          OUT="$(mktemp)"
          {
            echo "# Repo working knowledge (synced from \${GITHUB_REPOSITORY}@\${GITHUB_SHA:0:7})"
            echo
            echo "> Auto-updated by .github/workflows/sync-mdfy.yml on push to main."
            echo "> Source: https://github.com/\${GITHUB_REPOSITORY}/commit/\${GITHUB_SHA}"
            echo
            for f in CLAUDE.md AGENTS.md; do
              if [ -f "$f" ]; then
                echo; echo "---"; echo
                echo "## $f"; echo
                cat "$f"
              fi
            done
            if [ -d docs ]; then
              find docs -maxdepth 2 -name '*.md' -type f | LC_ALL=C sort | while read -r f; do
                echo; echo "---"; echo
                echo "## $f"; echo
                cat "$f"
              done
            fi
          } > "$OUT"
          echo "payload_path=$OUT" >> "$GITHUB_OUTPUT"

      - name: PATCH /api/docs/{id}
        env:
          MDFY_DOC_ID: \${{ secrets.MDFY_DOC_ID }}
          MDFY_EDIT_TOKEN: \${{ secrets.MDFY_EDIT_TOKEN }}
          PAYLOAD_PATH: \${{ steps.build.outputs.payload_path }}
        run: |
          set -euo pipefail
          BODY="$(jq -Rn \\
            --rawfile md "$PAYLOAD_PATH" \\
            --arg token "$MDFY_EDIT_TOKEN" \\
            --arg summary "ci: sync from \${GITHUB_SHA:0:7}" \\
            '{markdown: $md, editToken: $token, changeSummary: $summary}')"
          STATUS=$(curl -sS -o /tmp/resp.json -w '%{http_code}' \\
            -X PATCH "https://memory.wiki/api/docs/\${MDFY_DOC_ID}" \\
            -H 'Content-Type: application/json' \\
            --data "$BODY")
          echo "HTTP $STATUS"
          cat /tmp/resp.json
          [ "$STATUS" = "200" ]`}</CodeBlock>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginTop: 8,
              marginBottom: 24,
              maxWidth: 680,
            }}
          >
            <strong style={{ color: "var(--text-muted)" }}>What you get.</strong> One URL like <InlineCode>{"memory.wiki/d/<your-id>"}</InlineCode> that&apos;s always your repo&apos;s current docs. Paste it into Claude Code, Cursor, or any AI tool — they fetch the latest state on every session. Bonus: it makes a clean &ldquo;we use our own product&rdquo; artifact you can link from a README.
          </p>

          {/* ─── Staleness ─── */}
          <SectionHeading id="staleness">Staleness + auto-analyze</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            Doc content is auto-saved on every edit — the URL response always reflects the latest markdown without any push step. The <em>analysis</em> layer (bundle <InlineCode>{"graph_data"}</InlineCode>, hub <InlineCode>{"concept_index"}</InlineCode>) is computed once and cached.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            When a member doc was edited after the last analysis run, the URL response flags it: <InlineCode>{"analysis_stale: true"}</InlineCode> in the frontmatter plus a warning blockquote at the top of the body. Receiving AI tools can weigh the analysis accordingly. The doc bodies themselves are always fresh; only the synthesised layer (themes / insights / concepts) may lag.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            Free tier: re-analyze is explicit — open the canvas and click <strong>Re-analyze</strong> when you&apos;re ready. Pro tier (after beta) adds <strong>auto-analyze</strong>: stale fetches trigger a background regeneration so the next fetch is fresh, hands-free.
          </p>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
