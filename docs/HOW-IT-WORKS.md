# How Memory.Wiki works

> Read this once and you can explain Memory.Wiki to anyone — a teammate,
> a journalist, an investor, the AI you're about to paste a URL into.
> Assumes nothing. Pairs with `OVERVIEW.md` (what we have shipped).

---

## The one idea

**A Memory.Wiki URL is an API for any AI.**

Paste `memory.wiki/<id>`, `memory.wiki/b/<id>`, or `memory.wiki/hub/<slug>`
into ChatGPT, Claude, Gemini, or Cursor — the LLM fetches it and gets
back clean markdown shaped for an AI to read. No app to install. No
format to learn. No JavaScript to render. Just markdown over HTTPS.

That's the entire product. Every other feature exists to make the
markdown those URLs return more useful.

---

## The four moving parts

| Part                 | What it is                                                          | Where it lives                       |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| **The markdown**     | Source of truth. What the human types.                              | `documents.markdown`                 |
| **The AI graph**     | What an LLM extracted from a *bundle*: themes, insights, edges.     | `bundles.graph_data` (JSON)          |
| **The concept index**| User's lifelong ontology — concepts pooled across every bundle.     | `concept_index` + `concept_relations`|
| **The embeddings**   | Vectors. Power semantic recall ("which docs cover X?").             | `documents.embedding`, `bundles.embedding`, `document_chunks.embedding` |

First three end up in the markdown an LLM fetches. Embeddings never
go to the LLM directly — they back `mw_search` via MCP.

---

## What an LLM gets when it fetches a Memory.Wiki URL

Three URL shapes, each tuned for its purpose.

### `memory.wiki/<id>` — one document

```
---
title: "..."
url: https://memory.wiki/<id>
updated: 2026-05-20T...
---
# Doc title
…full markdown body…
```

No AI processing. Source markdown with a frontmatter wrapper. The
cheapest payload, and the target every bundle / hub digest links
into when an LLM wants the full body.

### `memory.wiki/b/<id>` — a bundle (default: **Compact**)

```
---
type: bundle
url: https://memory.wiki/b/<id>
analysis_stale: false
---
# Bundle title
> intent: "why I built this bundle"

## Summary                ← AI graph
## Themes                 ← AI graph
## Cross-document insights
## Concepts               ← this bundle's concept subgraph
## Concept relations
## Documents
- [Doc A](https://memory.wiki/<id>) — annotation
- [Doc B](https://memory.wiki/<id>) — annotation
```

The bundle digest is the **map** — what's in it, how the pieces
relate, what the prior LLM thought after reading the whole set, plus
a clickable index. The LLM follows inline doc links only when it
needs full bodies. Same context as concatenating every doc, ~95%
fewer tokens.

Append `?full=1` to inline every doc body. Expensive, occasionally
the right call.

### `memory.wiki/hub/<slug>` — a person's whole hub (default: **Compact**)

```
---
type: hub_digest
url: https://memory.wiki/hub/<slug>
concept_count: 40
---
# <name>'s knowledge — concept digest

## Concepts
### Concept Label
*tag • weight 14 • 4 docs*
> short description
- [Linked doc](https://memory.wiki/<id>)
…
_Related:_ depends on → **Other concept** · contradicts → **Another**
_In bundles:_ [Bundle A](https://memory.wiki/b/<id>) (3 docs) · …

## Concept relations
- **Concept X** part_of **Concept Y**
- **Concept Z** contradicts **Concept W**
…
```

A hub digest is the **shape of someone's thinking**: top-weighted
concepts, the typed edges between them, which bundle each concept
lives in. The LLM navigates "this person cares about X" → "X is most
discussed in bundle Y" → fetch bundle Y for the AI graph.

Useful extras: `?full=1` for a flat per-doc / per-bundle listing;
`?since=2026-04-01` for "what's new since".

---

## Two ways an LLM talks to Memory.Wiki

**Pull (URL fetch).** The LLM has a URL, it `GET`s, it reads. Works
in every AI tool that can hit a webpage — ChatGPT, Claude.ai web,
Gemini, Perplexity, Cursor, your terminal.

**Push + pull (MCP).** `memory-wiki-mcp` is a published npm package. Hosts
that speak MCP — Claude Desktop, Cursor, Cline, Windsurf — load it
once and get **29 tools** the LLM can call by itself: `mw_create`,
`mw_append`, `mw_search`, `mw_outline`, `mw_versions`,
`mw_publish`, `mw_diff`, `mw_render_preview`, … This is where
embeddings earn their keep — `mw_search` is vector similarity,
not keyword match.

So: URL payload is for pasting; MCP is for living inside.

---

## What happens when you create things

### Write a new doc
1. `PATCH /api/docs/<id>` with `action="auto-save"` writes the body
   (or `POST /api/docs` for a brand-new doc).
2. An `extraction_jobs` row is enqueued (`kind=doc_ontology`, 30 min
   throttle per doc so autosaves don't burn LLM budget).
3. Fast path: the same request runs the extractor inline — an LLM
   pulls out concepts / entities / tags and upserts them into your
   `concept_index`.
4. If the serverless instance dies mid-extraction, a cron worker
   picks the pending row up within a minute. Nothing silently fails.
5. Embedding pipeline (`/api/embed/<id>`) embeds title + body for
   global search and chunks each section for finer recall. Skips
   re-embedding via `embedding_source_hash` when nothing changed.
6. The moment you publish (un-draft), `memory.wiki/<id>` is fetchable
   by any AI in the world. Your hub digest already reflects the new
   concepts.

### Create a new bundle
1. `POST /api/bundles` creates the row.
2. You add N docs — `bundle_documents` join rows record order + per-
   doc annotations ("why this belongs").
3. On open (or on Analyze click), `POST /api/bundles/<id>/graph`
   sends the first ~10 doc bodies (truncated to 2000 chars each)
   plus the bundle's *intent* string to an LLM. The LLM returns a
   structured JSON: themes, insights, concept nodes, typed edges,
   takeaways, doc summaries, open questions.
4. JSON lands in `bundles.graph_data`. From now on the bundle URL
   serves the rich Compact payload above.
5. Same call merges every concept into your `concept_index` —
   weights and `doc_ids` accumulate across bundles. That's how your
   hub digest grows.
6. A separate request embeds the bundle (title + description +
   member titles) for MCP search.

### Edit a doc that's in a bundle
The bundle's `graph_data` is now older than its source. The next
fetch of `memory.wiki/b/<id>` carries `analysis_stale: true` in the
frontmatter so the LLM knows the AI summary may not match the
current text. The owner sees a "stale" pill in the canvas and can
re-analyze.

### Collaborate live
1. Owner shares with `someone@example.com` as Editor — server adds
   to `allowed_editors`.
2. Editor opens `memory.wiki/<id>` — `/d/<id>` viewer detects
   `isEditor=true` and redirects them to the live editor.
3. Both browsers subscribe to `yjs-doc-<id>` (Yjs CRDT) and
   `doc-cursor:<id>` (presence). Edits flow as Y.Doc updates;
   carets flow as broadcast events.
4. `Y.applyUpdate` keeps the peer's clientId ids in your Y.Doc, so
   subsequent deltas anchor correctly — sync converges on every
   keystroke.

---

## Same graph, many readers

The hub digest, the bundle canvas, the constellation view at
`/galaxy`, MCP search results — they all read from the **same four
tables**: `concept_index`, `concept_relations`, `documents`,
`bundles` + `bundle_documents`.

The visualization is not a separate dataset. What you see in the
galaxy is what the LLM gets in the hub digest, just rendered for
eyes instead of for a context window. Extend one, you extend the
other.

The mental model: **every Memory.Wiki surface is a different reader of
the same underlying graph**. The graph is the product.

---

## Why this is different from a PDF, Notion, or Google Doc

| Property                                | PDF upload    | Notion / GDoc share | Memory.Wiki URL              |
| --------------------------------------- | ------------- | ------------------- | --------------------- |
| Any AI reads it with no setup           | ✓             | ✗ (auth / JS)       | ✓                     |
| Updates automatically as you edit       | ✗             | ✓                   | ✓                     |
| AI gets pre-built navigation + summary  | ✗             | ✗                   | ✓ (bundle / hub)      |
| Single URL composes many docs           | ✗             | ✗                   | ✓ (bundle, hub)       |
| Cross-AI portable                       | re-upload     | re-share            | one URL, every AI     |
| LLM can write back via standard tools   | ✗             | ✗                   | ✓ (MCP, 29 tools)     |

The thing AI companies cannot copy is the **delivery model**: a
universal URL that any LLM fetches into its context, carrying both
the source and the pre-built graph over it. That's the moat.

---

## Trust: permissions, gates, freshness

- `is_draft=true` — never served to public fetch. Owner-only.
- `allowed_emails: [...]` — viewers must be signed in as one of
  these.
- `allowed_editors: [...]` — editors can save + collaborate live
  (separate from view access).
- `edit_mode`: `owner` / `account` / `token` / `view` / `public`.
- `password_hash` — gates the raw endpoint with HTTP basic.
- `analysis_stale: true` in bundle frontmatter — LLM knows the
  graph reflects an older version of the docs.
- `embedding_source_hash` — embedding pipeline skips re-embedding
  unchanged content; you don't pay for no-op updates.
- **No expiry, ever.** Pricing policy: docs are permanent. Free
  during beta, future Pro is for auto-analysis features, never for
  keeping a URL alive.

Every protection enforces at the raw endpoint, so the same rules
apply whether the consumer is a browser, an MCP host, a curl from
a script, or an LLM following an inline link.

---

## Glossary

- **Document** — a markdown file. URL: `memory.wiki/<id>`.
- **Bundle** — a curated set of docs analyzed as a group. URL:
  `memory.wiki/b/<id>`. Has its own AI graph.
- **Hub** — your personal home: every doc, every bundle, your
  concept index, your galaxy. URL: `memory.wiki/hub/<slug>`.
- **Compact** — the default URL response shape. AI graph or concept
  map + links instead of full bodies. ~30× cheaper to paste than
  Full.
- **Full** — `?full=1`. Inlines every body. Expensive but complete.
- **Concept index** — the user-scoped ontology. Updated on doc save
  (`doc_ontology` jobs) and bundle analyze.
- **Galaxy** — the visual reader of your concept index + relations.
- **Canvas** — the visual reader of a single bundle's AI graph.
- **Intent / annotation** — short text attached to a bundle ("why
  I made this") or to a doc-in-bundle ("why this belongs"). Both
  feed the LLM analysis prompt and the rendered digest.
- **MCP** — Model Context Protocol. The standard hosts use to give
  LLMs structured tool access. memory-wiki-mcp ships 29 tools.

---

*Last updated 2026-05-20. If anything here drifts from the code,
the code wins — file an issue.*
