# How mdfy works

> Read this once and you'll be able to explain mdfy.app to anyone — a
> teammate, a journalist, an investor, the AI you're about to paste a
> URL into. It assumes nothing.

---

## The one idea

**A mdfy URL is an API for any AI.**

When you paste `mdfy.app/d/abc123` or `mdfy.app/b/xyz` or
`mdfy.app/hub/yourname` into ChatGPT, Claude, Gemini, or Cursor, the
LLM fetches that URL and gets back clean markdown — _your_ thinking,
already shaped for an AI to read. No app to install. No format to
learn. No JS to render. Just markdown over HTTPS.

That is the entire product. Every other feature exists to make the
markdown that comes back from those URLs more useful.

---

## The four moving parts

Inside mdfy there are exactly four things to know about:

| Part                 | What it is                                                           | Where it lives                       |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| **The markdown**     | Source of truth. What the human types.                               | `documents.markdown`                 |
| **The AI graph**     | What Claude/GPT extracted from a *bundle*: themes, insights, edges.  | `bundles.graph_data` (JSON)          |
| **The concept index**| The user's lifelong ontology — concepts pooled across every bundle.  | `concept_index` + `concept_relations`|
| **The embeddings**   | Vectors. Power semantic recall (“which docs cover X?”). Internal.    | `documents.embedding`, `bundles.embedding`, `document_chunks.embedding` |

The first three end up in the markdown an LLM fetches. Embeddings
never go to the LLM — they power the *second* way an LLM talks to
mdfy (via MCP search). See "Two ways an LLM talks to mdfy" below.

---

## What an LLM gets when it fetches a mdfy URL

There are three URL shapes. Each one returns markdown shaped for the
shape's purpose.

### 1. `mdfy.app/d/<docId>` — a single document

```
---
title: "..."
url: https://mdfy.app/d/abc123
updated: 2026-05-18T...
---
# Doc title

…the full markdown body…
```

No AI processing. Just the source markdown wrapped in frontmatter.
This is the cheapest payload — and the link target the bundle and
hub digests point _into_ when an LLM needs deeper context.

### 2. `mdfy.app/b/<bundleId>` — a bundle (default: **Compact**)

```
---
type: bundle
url: https://mdfy.app/b/xyz
analysis_stale: false
---
# Bundle title
> intent: "why I made this bundle"

## Summary           ← AI graph
## Themes            ← AI graph
## Cross-document insights
## Concepts          ← AI graph (this bundle's concept subgraph)
## Concept relations
## Documents
- [Doc A](https://mdfy.app/d/...) — annotation
- [Doc B](https://mdfy.app/d/...) — annotation
```

The bundle digest gives the LLM the **map** — what's in the bundle,
how the pieces relate, what the prior AI thought after reading the
whole set — plus a clickable index. The LLM follows the inline doc
links only when it needs full bodies. Same context, ~95% fewer
tokens than concatenating every doc.

Append `?full=1` to inline every doc body. Expensive, occasionally
the right call.

### 3. `mdfy.app/hub/<slug>` — a person's whole hub (default: **Compact**)

```
---
type: hub_digest
url: https://mdfy.app/hub/yourname
concept_count: 40
---
# Yourname's knowledge — concept digest

## Concepts
### Concept Label                   ← from concept_index
*tag • weight 14 • 4 docs*
> short description
- [Linked doc](https://mdfy.app/d/...)
…
_Related:_ depends on → **Other concept** · contradicts → **Another**
_In bundles:_ [Bundle A](https://mdfy.app/b/...) (3 docs) · [Bundle B](https://mdfy.app/b/...) (2)

## Concept relations
- **Concept X** part_of **Concept Y**
- **Concept Z** contradicts **Concept W**
…
```

A hub digest is the **shape of someone's thinking** — top 40
concepts by weight, the typed edges between them, which bundle each
concept lives in. Each entry is clickable, so the LLM navigates from
"I see this person cares about X" → "X is most discussed in bundle
Y" → fetch bundle Y for the rich AI graph.

Useful extras:
- `?full=1` — flat per-doc and per-bundle listing instead of the
  concept map.
- `?since=2026-04-01` — only concepts that emerged after that date.
  Lets an LLM ask "what's new in this hub since last month?".

---

## Two ways an LLM talks to mdfy

1. **URL fetch (pull)** — covered above. The LLM has the URL, it
   wants the content, it `GET`s and reads. Works in every AI tool
   that can fetch a webpage (ChatGPT, Claude.ai web, Gemini,
   Perplexity, Cursor, your terminal).

2. **MCP server (push + pull)** — `mdfy-mcp` is a published npm
   package. Hosts that speak MCP (Claude Desktop, Cursor, Cline,
   Windsurf) load it once and gain 26 tools the LLM can call by
   itself: `mdfy_create`, `mdfy_append`, `mdfy_search`,
   `mdfy_outline`, `mdfy_versions`, `mdfy_publish`, etc. This is
   where embeddings earn their keep — `mdfy_search` uses vector
   similarity, not keyword match.

So when someone asks "what does embeddings even do for me?" — the
answer is: they let the LLM _search_ your library by meaning. The
URL payload is for pasting; MCP is for living inside.

---

## What happens when you create things

### You write a new document
1. `POST /api/docs` writes the markdown.
2. An `extraction_jobs` row is enqueued (`kind=doc_ontology`,
   30-minute throttle per doc so autosaves don't burn LLM budget).
3. Fast path: same request runs the extractor inline — Claude
   Haiku reads the markdown and pulls out concepts/entities/tags.
   Each one upserts into your `concept_index`.
4. If the serverless instance dies mid-extraction, a cron worker
   picks the pending row up within a minute. Nothing silently
   fails.
5. Separately the doc gets embedded (`/api/embed/[id]`) — title +
   markdown for global search, plus each section as its own chunk
   for finer recall.
6. The moment you publish (un-draft), `mdfy.app/d/<id>` becomes
   fetchable by any AI in the world. Your hub digest already
   reflects the new concepts.

### You create a new bundle
1. `POST /api/bundles` creates the row.
2. You add N docs — `bundle_documents` join rows record order and
   per-doc annotations ("why this belongs").
3. First time you open the bundle (or click Analyze), the canvas
   triggers `POST /api/bundles/[id]/graph`. The first ~10 doc
   bodies (truncated to 2000 chars each) are sent to Claude/GPT
   with your bundle's _intent_ string prepended. The LLM returns
   a structured JSON: themes, insights, concept nodes, typed
   edges, takeaways, document summaries, open questions.
4. That JSON lands in `bundles.graph_data`. From this moment, the
   bundle URL serves the rich Compact payload above.
5. Same call also merges every concept into your `concept_index`
   (weights and `doc_ids` accumulate across bundles — this is
   how your hub digest grows).
6. A separate request embeds the bundle (`title + description +
   member titles`) for MCP search.

### You edit a doc that's in a bundle
The bundle's `graph_data` is now older than the source. The next
fetch of `mdfy.app/b/<id>` includes `analysis_stale: true` in the
frontmatter so the LLM knows the AI summary may not match the
current text. The owner sees a "stale" pill in the canvas and can
re-analyze.

---

## The galaxy: same graph, two readers

The **Galaxy** view at `mdfy.app/galaxy` is a constellation
visualization of your hub: concept nodes (sized by weight), typed
edges between them, doc nodes, bundle clusters, time-slider. It
reads from a single endpoint: `/api/user/hub/constellation`.

That endpoint pulls from the same four tables that feed every other
mdfy surface:

- `concept_index` — the nodes
- `concept_relations` — the typed edges
- `documents` — leaf nodes
- `bundles` + `bundle_documents` — clusters

This is important: **the visualization is not a separate dataset.**
What you see in the galaxy is what an LLM gets in the hub digest —
just rendered for eyes instead of for a context window. When you
extend one, you extend the other. (The 2026-05-18 change that added
`Related:` lines and `In bundles:` lines to the hub digest brought
the LLM payload up to parity with the galaxy's edges and clusters.)

The mental model: every mdfy surface — bundle canvas, hub galaxy,
raw markdown digest, MCP search results — is **a different reader
of the same underlying graph**. The graph is the product.

---

## Why this is different from a PDF, Notion, or Google Doc

| Property                                | PDF / Doc upload | Notion / Google Doc share | mdfy URL                |
| --------------------------------------- | ---------------- | ------------------------- | ----------------------- |
| Any AI can read it with no setup        | ✓                | ✗ (auth, JS, scraping)    | ✓                       |
| Updates automatically as you edit       | ✗                | ✓                         | ✓                       |
| AI gets pre-built navigation + summary  | ✗                | ✗                         | ✓ (bundle/hub digests)  |
| Single URL composes many docs           | ✗                | ✗                         | ✓ (bundle, hub)         |
| Cross-AI portable                       | per-AI re-upload | per-AI re-share           | one URL, every AI       |
| LLM can write back via standard tools   | ✗                | ✗                         | ✓ (MCP, 26 tools)       |

The thing AI companies cannot copy is the **delivery model**: a
universal URL that any LLM fetches into its context, carrying both
the source and the pre-built graph over it. That's the moat.

---

## Trust: permissions and staleness

- `is_draft=true` — never served to a public fetch. Owner-only.
- `allowed_emails: [...]` — served only if the request carries a
  verified token for one of those emails.
- `password_hash` — gates the raw endpoint with HTTP basic.
- `expires_at` — past expiry returns 410 Gone.
- `analysis_stale: true` in bundle frontmatter — LLM knows the
  graph reflects an older version of the docs.
- `embedding_source_hash` — embedding pipeline skips re-embedding
  unchanged content; you don't pay for no-op updates.

Every protection is enforced at the raw endpoint layer, so the
exact same rules apply whether the consumer is the browser, an MCP
host, a curl from a script, or an LLM following an inline link.

---

## Glossary

- **Document (MD)** — a markdown file. Lives at `mdfy.app/d/<id>`.
- **Bundle** — a curated set of docs analyzed as a group. URL:
  `mdfy.app/b/<id>`. Has its own AI graph.
- **Hub** — your personal home: every doc, every bundle, your
  concept index, your galaxy. URL: `mdfy.app/hub/<slug>`.
- **Compact** — the default URL response shape. AI graph or
  concept map + links instead of full bodies. ~30x cheaper to
  paste than Full.
- **Full** — `?full=1`. Concatenates everything.
- **Concept index** — the user-scoped ontology. Updated whenever
  a doc is saved (`doc_ontology` jobs) or a bundle is analyzed.
- **Galaxy** — the visual reader of your concept index and its
  relations.
- **Canvas** — the visual reader of a single bundle's AI graph.
- **Intent / annotation** — short text the user attaches to a
  bundle ("why I made this") or per-doc ("why this belongs"). Both
  get woven into the AI's analysis prompt and the rendered digest.
- **MCP** — Model Context Protocol. The standard hosts use to
  give LLMs structured tool access. mdfy-mcp ships 26 tools.

---

*Last updated 2026-05-18. If anything here drifts from the code,
the code wins — file an issue.*
