import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, DocsNav, SiteFooter } from "@/components/docs";

const mono = { fontFamily: "var(--font-geist-mono), monospace" } as const;

export const metadata: Metadata = {
  title: "memori.wiki — Open Spec",
  description:
    "The URL contract, retrieval API, llms.txt, bundle digest, and concept index — the open spec that any AI tool can implement against. memori.wiki is an AI-era wiki: the AI does the linking, you write.",
  alternates: { canonical: "https://memory.wiki/spec" },
  openGraph: {
    title: "memori.wiki — Open Spec",
    description: "URL contract + retrieval API + llms.txt for the AI-era wiki. Open, MIT-licensed engine.",
    url: "https://memory.wiki/spec",
    images: [{ url: "/api/og?title=memori.wiki%20Spec", width: 1200, height: 630 }],
  },
};

/* ─── Small primitives ─── */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ ...mono, fontSize: 12.5, color: "var(--text-primary)", background: "var(--toggle-bg)", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border-dim)" }}>
      {children}
    </code>
  );
}

// Thin wrapper over the shared CodeBlock so /spec gets the same
// copy-button + theming as the rest of /docs. The wrapper just
// reserves vertical margin around the block to match the prose
// rhythm of this page.
function Block({ children, lang }: { children: string; lang?: string }) {
  return (
    <div style={{ margin: "12px 0 24px" }}>
      <CodeBlock lang={lang}>{children}</CodeBlock>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 96, marginBottom: 56 }}>
      <p style={{ ...mono, color: "var(--accent)", fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{eyebrow}</p>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 14px" }}>{title}</h2>
      <div style={{ fontSize: 14.5, lineHeight: 1.75, color: "var(--text-muted)", maxWidth: 720 }}>{children}</div>
    </section>
  );
}

export default function SpecPage() {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <DocsNav />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "56px 24px 96px" }}>
        {/* Hero */}
        <p style={{ ...mono, color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          memori.wiki / spec
        </p>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 16px", lineHeight: 1.15 }}>
          An open spec for an AI-era wiki.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--text-muted)", marginBottom: 24, maxWidth: 720 }}>
          memori.wiki is a personal knowledge wiki that any AI can read. This page documents the URL contract, the
          retrieval API, the llms.txt manifest, and the bundle digest — the same primitives the Memory.Wiki reference
          implementation ships today. Other tools can implement this spec and interop with no platform lock-in.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-faint)", marginBottom: 48, maxWidth: 720 }}>
          Engine licence: MIT. Reference implementation:{" "}
          <Link href="https://memory.wiki" style={{ color: "var(--accent)" }}>Memory.Wiki</Link>. Spec version: 0.1 (draft, 2026-05-15).
        </p>

        {/* TOC */}
        <nav style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: "16px 20px", marginBottom: 56 }}>
          <p style={{ ...mono, fontSize: 10, color: "var(--text-faint)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Contents</p>
          <ol style={{ listStyle: "decimal inside", margin: 0, padding: 0, fontSize: 14, lineHeight: 2, color: "var(--text-secondary)" }}>
            {[
              ["why-this-spec", "Why this spec"],
              ["url-contract", "URL contract"],
              ["raw-markdown", "Raw markdown variant"],
              ["query-knobs", "Query knobs (compact / full / graph)"],
              ["llms-txt", "llms.txt manifest"],
              ["bundle-digest", "Bundle digest shape"],
              ["retrieval-api", "Retrieval API"],
              ["concept-index", "Concept index"],
              ["privacy", "Privacy gates"],
              ["why-no-wikilinks", "Why no [[wikilinks]]"],
              ["partner-impl", "Implementing this spec"],
            ].map(([id, label]) => (
              <li key={id}>
                <Link href={`#${id}`} style={{ color: "var(--text-secondary)" }}>{label}</Link>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="why-this-spec" eyebrow="00" title="Why this spec exists">
          <p>
            Every AI dev tool — Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Aider — wants per-project context.
            Today users hand-curate that context in <Code>CLAUDE.md</Code> / <Code>AGENTS.md</Code> / <Code>.cursor/rules</Code> and
            it goes stale within a week. memori.wiki replaces the curation step with an AI-readable URL that returns
            a structured representation of a person&apos;s knowledge graph. Any tool that follows this spec can
            fetch the same payload and stay in sync.
          </p>
          <p>
            The spec is intentionally minimal. Markdown for content, URLs for addressability, query parameters for
            token-economy knobs. No bespoke schema, no SDK lock-in. <strong>This is on purpose</strong> — the only
            way the spec earns adoption is by being cheap to implement.
          </p>
        </Section>

        <Section id="url-contract" eyebrow="01" title="URL contract">
          <p>Three scopes, each addressable, each AI-readable.</p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: "16px 20px", marginTop: 12 }}>
            <p style={{ marginBottom: 12 }}><Code>memori.wiki/&#123;user&#125;/&#123;slug&#125;</Code> &nbsp; — &nbsp; a single doc. Tightest token cost; one note, one decision.</p>
            <p style={{ marginBottom: 12 }}><Code>memori.wiki/&#123;user&#125;/b/&#123;bundle&#125;</Code> &nbsp; — &nbsp; a curated bundle of docs plus its pre-computed graph analysis (themes, insights, concept relations). Recommended scope for project-level tool config.</p>
            <p style={{ marginBottom: 0 }}><Code>memori.wiki/&#123;user&#125;</Code> &nbsp; — &nbsp; the whole hub. Broad context, hub-wide concept index attached. Use sparingly.</p>
          </div>
          <p style={{ marginTop: 20 }}>
            During the rebrand transition, <Code>memory.wiki/&#123;id&#125;</Code>, <Code>memory.wiki/b/&#123;id&#125;</Code>, and
            <Code>memory.wiki/hub/&#123;slug&#125;</Code> resolve to the same payloads. <Code>mori.wiki/...</Code> 301s to <Code>memori.wiki/...</Code>.
          </p>
        </Section>

        <Section id="raw-markdown" eyebrow="02" title="Raw markdown variant">
          <p>
            Every public URL has a clean-markdown sibling at <Code>/raw/...</Code>:
          </p>
          <Block lang="endpoints">{`GET /raw/{docId}
GET /raw/b/{bundleId}
GET /raw/hub/{slug}
GET /raw/hub/{slug}/c/{concept}`}</Block>
          <p>
            Response is <Code>text/markdown</Code>, charset UTF-8, with a YAML frontmatter block telling the AI which
            scope it just received. Browsers viewing these URLs see plain markdown.
          </p>
          <p>
            The middleware also routes <Code>{`{id}.md`}</Code> / <Code>{`/b/{id}.md`}</Code> / <Code>{`/hub/{slug}.md`}</Code> as
            convenience aliases so users can paste a <Code>.md</Code> suffix and get the raw form directly.
          </p>
        </Section>

        <Section id="query-knobs" eyebrow="03" title="Query knobs">
          <p>Three knobs control token economy on raw responses:</p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: "16px 20px", marginTop: 12 }}>
            <p style={{ marginBottom: 12 }}><Code>?compact</Code> &nbsp; — &nbsp; strip whitespace, drop noisy quote blocks, condense long lines. Works on every raw URL. Typical 30–50% token reduction.</p>
            <p style={{ marginBottom: 12 }}><Code>?full=1</Code> &nbsp; — &nbsp; bundle only. Inline every member doc body after the analysis section. Default returns the digest (link list).</p>
            <p style={{ marginBottom: 0 }}><Code>?graph=0</Code> &nbsp; — &nbsp; bundle only. Drop the canvas analysis section. Use when the receiving AI only wants the doc inventory.</p>
          </div>
          <p style={{ marginTop: 20 }}>
            Knobs combine. <Code>?compact&full=1</Code> returns every doc inline, whitespace stripped — useful for one-shot
            full-bundle context. <Code>?compact&graph=0</Code> returns the doc inventory only, no analysis.
          </p>
        </Section>

        <Section id="llms-txt" eyebrow="04" title="llms.txt manifest">
          <p>
            Following the <Link href="https://llmstxt.org/" style={{ color: "var(--accent)" }}>llms.txt standard</Link>: every public hub
            publishes a crawl manifest at:
          </p>
          <Block lang="endpoint">{`GET /hub/{slug}/llms.txt`}</Block>
          <p>
            The body lists every public doc and bundle with title, URL, and ≤200-char description, plus pointers to the
            <Code>?compact</Code> and <Code>?digest</Code> variants. Agents that prefer a manifest crawl over a one-shot
            payload fetch <Code>llms.txt</Code> first, then walk to specific docs on demand.
          </p>
          <p>
            <Code>{`/hub/{slug}/llms-full.txt`}</Code> serves a denser variant capped at 80k tokens by default
            (override with <Code>?cap=</Code>) for AI tools that prefer one fetch over many.
          </p>
        </Section>

        <Section id="bundle-digest" eyebrow="05" title="Bundle digest shape">
          <p>
            Bundle responses ship the canvas analysis inline so the receiving AI inherits the prior AI&apos;s work
            for free:
          </p>
          <Block lang="markdown">{`---
mw_bundle: 1
id: <bundleId>
title: "..."
url: https://memory.wiki/b/<id>
document_count: N
updated: <ISO>
analysis_generated_at: <ISO>
analysis_stale: true        # only when a member doc was edited after the analysis
source: "Memory.Wiki"
---

# <Bundle title>
> <description>
**Intent:** <intent>

## Summary
<canvas summary>

## Themes
- ...

## Cross-document insights
- ...

## Key takeaways
- ...

## Open questions / gaps
- ...

## Notable connections
- **doc A** ↔ **doc B** — <relationship>

## Concepts (this bundle)
- **concept** (from **doc title**)

## Concept relations
- **conceptA** ↔ **conceptB** — <edge label>

1. [Doc 1](https://memory.wiki/<docId>) — annotation
2. [Doc 2](https://memory.wiki/<docId>) — annotation
...`}</Block>
        </Section>

        <Section id="retrieval-api" eyebrow="06" title="Retrieval API">
          <p>
            One endpoint, hybrid retrieval (semantic + keyword + optional rerank). Hub-scoped, public.
          </p>
          <Block lang="request">{`POST /api/hub/{slug}/recall
Content-Type: application/json

{
  "question": "react hooks vs context",
  "k": 5,
  "level": "doc",         // doc | chunk | bundle
  "hybrid": true,         // chunk-level only — BM25 + vector reciprocal rank fusion
  "rerank": true          // Anthropic Haiku cross-encoder; doubles latency, raises precision
}`}</Block>
          <Block lang="response">{`{
  "hub": { "slug": "you", "display_name": "..." },
  "results": [
    {
      "id": "abc123",
      "title": "React hooks crash course",
      "url": "https://memory.wiki/abc123",
      "snippet": "...react hooks let you...",
      "distance": 0.13,
      "updated_at": "2026-04-10T..."
    }
  ]
}`}</Block>
          <p>
            <strong>k</strong> capped at 20. <strong>distance</strong> is cosine — lower is more relevant.
            <strong>level=chunk</strong> returns paragraph-level matches with doc id + heading path.
            <strong>level=bundle</strong> matches against bundle titles + descriptions.
          </p>
        </Section>

        <Section id="concept-index" eyebrow="07" title="Concept index">
          <p>
            The hub-wide concept index is the AI-era replacement for hand-typed categories and tags. Built
            incrementally by the bundle analysis pipeline — every Analyze run upserts concepts the LLM extracted
            from that bundle&apos;s docs.
          </p>
          <p>
            Public surface:
          </p>
          <Block lang="endpoints">{`GET /hub/{slug}/c/{concept}           # rendered per-concept page (HTML)
GET /raw/hub/{slug}/c/{concept}        # same, raw markdown variant`}</Block>
          <p>
            Per-concept page returns: canonical label, description, source documents, neighbour concepts.
            The neighbours come from <Code>concept_relations</Code> typed edges (supports / elaborates / contradicts /
            exemplifies / contains). Same edge vocabulary the bundle canvas uses.
          </p>
        </Section>

        <Section id="privacy" eyebrow="08" title="Privacy gates">
          <p>Three states, applied uniformly to docs, bundles, and hubs.</p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: "16px 20px", marginTop: 12 }}>
            <p style={{ marginBottom: 12 }}><Code>Public</Code> &nbsp; — &nbsp; published; no <Code>allowed_emails</Code>. Anonymous AI fetches succeed.</p>
            <p style={{ marginBottom: 12 }}><Code>Restricted</Code> &nbsp; — &nbsp; published; <Code>allowed_emails</Code> set. Fetcher must pass <Code>Authorization: Bearer &lt;token&gt;</Code> as the owner, or <Code>X-User-Email</Code> matching an allowed address. Otherwise 403/404.</p>
            <p style={{ marginBottom: 0 }}><Code>Private</Code> &nbsp; — &nbsp; not published. Owner JWT only.</p>
          </div>
          <p style={{ marginTop: 20 }}>
            Every gating decision happens server-side in the raw-fetch routes — there&apos;s no path by which a URL
            can leak content the rendered viewer wouldn&apos;t already show. Revoking <Code>allowed_emails</Code> takes
            effect on the next fetch.
          </p>
        </Section>

        <Section id="why-no-wikilinks" eyebrow="09" title="Why no [[wikilinks]]">
          <p>
            Traditional wikis (Wikipedia, Roam, Obsidian) build their graph by having humans type
            <Code>[[other page]]</Code>. memori.wiki doesn&apos;t ship that syntax. It&apos;s a deliberate omission.
          </p>
          <p>
            <Code>[[wikilink]]</Code> is a 2003-era mechanism for compensating for AI&apos;s absence. A user typing
            <Code>[[React Hooks]]</Code> tells the system &ldquo;these pages are related.&rdquo; In 2026 the AI does that work
            without being asked: <Code>concept_index</Code> extracts &quot;React Hooks&quot; as a concept from any doc that
            meaningfully discusses it, and <Code>concept_relations</Code> wires those concepts to neighbours by
            typed edges.
          </p>
          <p>
            The user-facing replacement is the <strong>Related in this hub</strong> panel rendered below every public
            doc — other docs that share concepts with the current one, surfaced by the AI&apos;s analysis. Same
            information traditional backlinks would give, without anyone having to type the link.
          </p>
          <p>
            <strong>The AI does the linking; you write.</strong>
          </p>
        </Section>

        <Section id="partner-impl" eyebrow="10" title="Implementing this spec">
          <p>Three integration paths, all stable.</p>
          <ol style={{ paddingLeft: 20, margin: "12px 0 24px", lineHeight: 1.9 }}>
            <li>
              <strong>URL paste.</strong> Drop a memori.wiki URL into any AI chat. The model fetches the raw
              variant automatically. Zero config, works today across Claude / ChatGPT / Cursor / Gemini.
            </li>
            <li>
              <strong>Context file reference.</strong> Add the URL to <Code>AGENTS.md</Code> / <Code>CLAUDE.md</Code> /
              <Code>.cursor/rules</Code>. The AI dev tool fetches on every session boot. See{" "}
              <Link href="/docs/integrate" style={{ color: "var(--accent)" }}>/docs/integrate</Link> for per-tool snippets.
            </li>
            <li>
              <strong>API integration.</strong> Call <Code>POST /api/hub/&#123;slug&#125;/recall</Code> directly for
              precise retrieval. No SDK required — plain HTTP. The endpoint is hub-public, no API key needed.
            </li>
          </ol>
          <p>
            The reference renderer is <Code>markdown-it</Code> with footnotes + GFM, configured identically to TipTap so
            authoring and viewing surfaces produce the same DOM. Source:{" "}
            <Link href="https://github.com/raymindai/memory-wiki" style={{ color: "var(--accent)" }}>github.com/raymindai/memory-wiki</Link>.
          </p>
        </Section>

        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 64, paddingTop: 24, borderTop: "1px solid var(--border-dim)" }}>
          Spec version 0.1 (draft) — open for feedback. PRs welcome via the repo.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
