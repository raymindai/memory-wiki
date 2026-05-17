-- 036: Demo account seed for `demo@mdfy.app`.
--
-- This file is a `.sql.template` (NOT `.sql`) so `supabase db push`
-- ignores it. Intentional — the file contains `4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd`
-- placeholders that must be substituted before the SQL is valid.
--
-- HOW TO APPLY:
--   1. In Supabase Dashboard → Authentication → Users, create
--      `demo@mdfy.app` (any password — the account just exists to
--      own the rows). Confirm the user.
--   2. Copy the resulting user_id (UUID).
--   3. Copy this file to `036_demo_account_seed.sql` (drop the
--      `.template` suffix). Replace EVERY occurrence of
--      `4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd` with the UUID.
--   4. Run `supabase db push --include-all`.
--   5. Verify with `curl -s -X POST -H 'Content-Type: application/json' \`
--      `https://mdfy.app/api/hub/demo/recall -d '{"question":"cross-AI","k":3}'`
--      — should return results.
--   6. Browse: https://mdfy.app/hub/demo
--
-- The migration is mostly idempotent — documents/bundles use
-- ON CONFLICT (id) DO NOTHING, concept_index uses ON CONFLICT
-- (user_id, normalized_label) DO NOTHING, concept_relations uses
-- its 4-tuple UNIQUE. The profile UPSERT is intentional so re-runs
-- update the display name / bio if you tweak this file.
--
-- WHAT THIS SEEDS:
--   - profile row with hub_slug='demo', hub_public=true, a
--     curated bio + display name
--   - 6 documents covering capture / research / decisions /
--     formatting (mermaid + math + tables + code) / strategy /
--     internal planning
--   - 2 bundles with pre-computed graph_data (themes, insights,
--     connections, concept sub-graph) so the canvas paints
--     immediately
--   - bundle_documents rows wiring the bundles
--   - 12 concept_index rows + concept_relations edges so the hub
--     concept page surfaces real entries
--
-- The result: visiting mdfy.app/hub/demo shows a polished example
-- hub a reviewer can paste into Claude / Cursor and see end-to-end
-- behaviour without the founder having to demo it live.

-- ─── 1. Profile ──────────────────────────────────────────────────
INSERT INTO profiles (id, email, display_name, hub_slug, hub_public, hub_description)
VALUES (
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  'demo@mdfy.app',
  'mdfy Demo',
  'demo',
  true,
  $$A hand-curated example hub showing what mdfy makes possible — captured AI conversations, research notes, project decisions, and the bundles that synthesise them. Paste any URL into Claude, ChatGPT, or Cursor to see the full payload.$$
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  hub_slug = EXCLUDED.hub_slug,
  hub_public = EXCLUDED.hub_public,
  hub_description = EXCLUDED.hub_description;

-- ─── 2. Documents ────────────────────────────────────────────────

-- 2.1 Capture: an AI conversation summary
INSERT INTO documents (id, user_id, markdown, title, edit_token, is_draft, edit_mode)
VALUES (
  'demo-ai-memory-chat',
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  $MD$# AI memory architectures: a Claude conversation

> Captured from a working session with Claude Opus, 2026-03-12. Cleaned, structured, and saved as a permanent URL so the next AI session can pick up where we left off.

## The question

What architecture should a personal memory layer use? Three patterns are in production today:

1. **Vector recall** — every message goes through an embedding model, gets stored, retrieved by cosine similarity on demand. ChatGPT memory beta works this way.
2. **Episodic snapshots** — full conversation transcripts are stored verbatim, indexed by date and topic. Claude Projects does this.
3. **Hub-shaped memory** — the user authors structured notes; the AI reads them as URL-addressable resources.

## What Claude argued

> Vector recall trades precision for breadth. Episodic snapshots trade verbosity for fidelity. Hub-shaped memory trades automation for author-control.

The third pattern wins for one reason: **the human stays the author**. Vector + episodic both let memory drift — once stored, the user can't easily edit or curate without leaving the AI's UI. Hub-shaped puts the artifact in a place the user already lives (a document) and the AI reads from there.

## Takeaway for mdfy

This is the existing direction. Worth checking against the spec page — `/spec` already documents the URL contract. No code change needed; this conversation just validates the choice.

## Related concepts

- Vector recall, episodic snapshot, hub-shaped memory
- Forgetting as a feature
- URL-addressable knowledge
$MD$,
  'AI memory architectures: a Claude conversation',
  'demo-token-ai-memory',
  false,
  'owner'
)
ON CONFLICT (id) DO NOTHING;

-- 2.2 Decision (ADR style)
INSERT INTO documents (id, user_id, markdown, title, edit_token, is_draft, edit_mode)
VALUES (
  'demo-decision-graph-url',
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  $MD$# Decision: ship graph_data inside the bundle URL

**Status**: shipped 2026-05-12 (commit `ba7344c4`)

## Context

A bundle URL returns a markdown digest. Before this change the digest contained only the doc list + annotations. The canvas analysis (themes, insights, concept relations) lived only inside the mdfy.app web canvas — paste the URL into Claude and the AI got the doc list but had to redo the cross-doc analysis itself.

## Decision

Embed the `graph_data` JSON as markdown sections inside the `/raw/bundle/<id>` response by default. Add `?graph=0` opt-out for callers that want the legacy doc-list-only digest.

## Why

The viral loop runs through URLs. If pasting a URL gives the receiving AI *more* than the sending AI could give without mdfy, the URL is genuinely portable. Without `graph_data` in the payload, the URL is just a doc inventory — useful but not differentiating.

## Trade-offs

- **Token cost**: typical bundle adds ~600 tokens for the analysis section. Caller can drop via `?graph=0`.
- **Staleness**: `analysis_stale: true` frontmatter flag warns the AI when member docs were edited after the last analysis run.
- **Recompute cost**: regenerating `graph_data` requires an LLM call. Today this is owner-triggered; Pro will background-run on stale fetch.

## Validation

- e2e: every public bundle URL now carries the section by default (test `28/28 passing 2.2m`)
- Hub digest still omits the section — different surface, different default
$MD$,
  'Decision: ship graph_data inside the bundle URL',
  'demo-token-decision-graph',
  false,
  'owner'
)
ON CONFLICT (id) DO NOTHING;

-- 2.3 Formatting variety — math + tables + mermaid + code
INSERT INTO documents (id, user_id, markdown, title, edit_token, is_draft, edit_mode)
VALUES (
  'demo-formatting-tour',
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  $MD$# Formatting tour: math, diagrams, code, tables

A reference for what renders in mdfy. Every block below appears in real docs across this hub.

## KaTeX math

Inline: $E = mc^2$. Display:

$$
\int_0^{\infty} e^{-x^2}\, dx = \frac{\sqrt{\pi}}{2}
$$

Matrix:

$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix} = \begin{pmatrix} ax + by \\ cx + dy \end{pmatrix}
$$

## Mermaid diagrams

```mermaid
flowchart LR
  Doc[(Doc)] --> Bundle((Bundle))
  Bundle --> Hub[/Hub/]
  Hub --> AI[Any AI]
  AI -. cites .-> Doc
```

```mermaid
sequenceDiagram
  participant U as You
  participant M as mdfy
  participant AI as Claude/ChatGPT
  U->>M: Publish doc
  M-->>U: Permanent URL
  U->>AI: Paste URL
  AI->>M: Fetch /raw/<id>
  M-->>AI: Clean markdown + graph
```

## Code with highlighting

```typescript
const res = await fetch("https://mdfy.app/api/hub/demo/recall", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: "react hooks", k: 5, rerank: true }),
});
const { results } = await res.json();
```

```python
import requests

r = requests.post("https://mdfy.app/api/docs",
  json={"markdown": "# Hello World"})
print(r.json()["url"])  # → "https://mdfy.app/abc123"
```

## Tables

| Scope | URL | Cost |
|:------|:----|:-----|
| Doc | `mdfy.app/<id>` | tightest |
| Bundle | `mdfy.app/b/<id>` | mid (+graph) |
| Hub | `mdfy.app/hub/<slug>` | broad |

That's the rendering vocabulary mdfy expects to handle on any doc.
$MD$,
  'Formatting tour: math, diagrams, code, tables',
  'demo-token-formatting',
  false,
  'owner'
)
ON CONFLICT (id) DO NOTHING;

-- 2.4 Strategy / positioning
INSERT INTO documents (id, user_id, markdown, title, edit_token, is_draft, edit_mode)
VALUES (
  'demo-strategy-moat',
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  $MD$# The structural moat: cross-AI portability

## One line summary

> A single AI vendor can build deeper integration against its own model than mdfy ever could. None of them can deliver a URL that works across their competitors. The portability is the product.

## Why this matters

Notion, Mem.ai, Roam, Obsidian — each is a destination. The user is asked to live inside the tool. mdfy is the opposite shape: the user lives wherever they already work (ChatGPT, Cursor, Claude Code) and mdfy is the thing that travels with them.

## What gets ported

- The doc body (clean markdown)
- The graph analysis (themes, insights, concept relations) attached to bundles
- The concept index attached to hubs
- Privacy gating (Public / Restricted / Private) — the URL behaves the same way the rendered viewer does

## Why the AI vendors can't replicate

OpenAI building "ChatGPT memory that Claude can read" is a competitive negative for them. Anthropic the same. The asymmetry is structural — mdfy benefits from being *not aligned* with any single vendor.

## Failure modes

- If one vendor builds a dominant memory layer that all AIs respect → mdfy still survives as the UX layer (curate, capture, share) but loses the "they can't" part
- If `llms.txt` adoption stalls → the URL contract weakens. Mitigate by treating `llms.txt` as one of multiple paths; raw markdown + clean URLs are the durable spec.

Bottom line: the moat depends on the URL contract, not on any one feature.
$MD$,
  'The structural moat: cross-AI portability',
  'demo-token-strategy',
  false,
  'owner'
)
ON CONFLICT (id) DO NOTHING;

-- 2.5 Tool integration note
INSERT INTO documents (id, user_id, markdown, title, edit_token, is_draft, edit_mode)
VALUES (
  'demo-cursor-rules',
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  $MD$# Wiring mdfy into Cursor

`.cursor/rules/mdfy.mdc`:

```
---
description: Project context from mdfy
alwaysApply: true
---

Project context lives at https://mdfy.app/b/<your-bundle-id>.

Fetch that URL when you need this project's spec, decisions, or
prior reasoning. The response carries the canvas analysis (themes,
insights, concept relations) in the same payload.
```

## How Cursor uses this

On every new chat or composer session, Cursor evaluates files matched by the rule and includes them as context. When mdfy URL is in the rule body, Cursor fetches the URL on demand — typically when the user asks a question that references concepts in the bundle.

## What we observed in practice

- First few messages: Cursor doesn't always fetch — it relies on its own RAG over the local repo. Fine.
- Once the user types something topic-specific ("how did we decide the pricing tier?"), Cursor fetches the bundle URL and the answer comes back cited to the right doc.
- Cursor's `[doc:N]` citations don't propagate the way Claude Chat's do — Cursor inlines snippets but doesn't link back. Acceptable for a code-editor surface.

## Recommended bundle structure for Cursor

Group docs by intent. Keep the bundle title concrete ("Auth migration", "API redesign 2026-04", "Pricing decision log"), not abstract.
$MD$,
  'Wiring mdfy into Cursor',
  'demo-token-cursor',
  false,
  'owner'
)
ON CONFLICT (id) DO NOTHING;

-- 2.6 Research / external reference
INSERT INTO documents (id, user_id, markdown, title, edit_token, is_draft, edit_mode)
VALUES (
  'demo-karpathy-llm-wiki',
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  $MD$# Karpathy's LLM Wiki concept, in one read

## Source

Andrej Karpathy, Twitter thread (2024). Topic: a personal LLM-readable wiki — one place a person writes their knowledge, the LLM reads it instead of building memory by inference.

## Core argument

> The most reliable AI memory is the one the human authored. Anything inferred from a chat transcript is lossy; anything written deliberately is durable.

This frames "memory" as a *curation problem*, not a *retrieval problem*. Most existing AI memory systems (Mem.ai, ChatGPT memory beta) treat it as the latter.

## Where Karpathy's vision stops

Single unified wiki. One person, one wiki. The structure is whatever the user makes inside that wiki.

## Where mdfy goes further

Three composable scopes instead of one: doc, bundle, hub. The same URL primitive scales from a one-note share to a project context to a full knowledge graph. Karpathy's single-wiki model can't deliver per-project context without folder discipline; mdfy's bundle model is *built* for it.

But mdfy and Karpathy's vision share the load-bearing claim: **the human stays the author**. The AI reads what was written; it doesn't try to infer memory from chat.

## Quote worth keeping

> The wiki you wrote yesterday is the context the AI gets today. The AI shouldn't be reconstructing your beliefs from session transcripts.

That's the philosophy. mdfy is one shape of the implementation.
$MD$,
  'Karpathy''s LLM Wiki concept, in one read',
  'demo-token-karpathy',
  false,
  'owner'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Bundle: AI Memory Research ──────────────────────────────
INSERT INTO bundles (id, user_id, title, description, edit_token, is_draft, intent, graph_data, graph_generated_at)
VALUES (
  'demo-bundle-memory',
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  'AI Memory Research',
  'Captured conversations + external reading on how AI memory architectures actually work. Reading order: the Claude conversation lays out the three patterns, the Karpathy summary names the philosophical frame, the formatting tour is a side-quest reference.',
  'demo-token-bundle-memory',
  false,
  'Decide how mdfy''s personal memory layer should compose with other AI tools.',
  $${
    "summary": "Three documents framing the AI memory landscape — a captured Claude conversation enumerating the architectures, Karpathy''s wiki philosophy as the upstream framing, and a side-quest formatting reference. The bundle''s thesis: AI memory is a curation problem, not a retrieval problem, and the human staying the author is the durable design choice.",
    "themes": [
      "AI memory is a curation problem, not a retrieval problem.",
      "URL-addressable knowledge is the portable substrate.",
      "The author stays human; the AI reads what was written."
    ],
    "insights": [
      "Karpathy''s single-wiki vision and the captured Claude conversation arrive at the same conclusion from opposite directions — Karpathy from first principles, Claude from architecture review. Convergent evidence the design is sound.",
      "Vector recall and episodic snapshots both fail the same way: they store everything the user said, not what the user *meant*. The hub-shaped pattern asks the user to commit to a meaning by writing it down."
    ],
    "keyTakeaways": [
      "Continue investing in hub-shaped memory — the cross-checked validation is now strong.",
      "Don''t try to compete with vendor memory (ChatGPT, Claude Projects) on retrieval depth. Compete on portability and author-control."
    ],
    "gaps": [
      "No data on how often users actually edit their hub after first authoring. Worth measuring.",
      "Cost models for vector-recall-at-scale aren''t covered."
    ],
    "connections": [
      { "doc1": "demo-ai-memory-chat", "doc2": "demo-karpathy-llm-wiki", "relationship": "Same conclusion from opposite directions — architecture review vs philosophical framing." }
    ],
    "documentSummaries": {
      "demo-ai-memory-chat": "Captured Claude conversation comparing vector recall, episodic snapshots, and hub-shaped memory. Lands on author-control as the differentiator.",
      "demo-karpathy-llm-wiki": "Karpathy''s personal LLM wiki vision in one read. Frames memory as curation, not retrieval.",
      "demo-formatting-tour": "Reference doc for what renders in mdfy — math, diagrams, code, tables. Side-quest from the memory thread."
    },
    "nodes": [
      { "id": "n-doc-mem-chat", "label": "AI memory architectures: a Claude conversation", "type": "document", "weight": 1, "documentId": "demo-ai-memory-chat" },
      { "id": "n-doc-karpathy", "label": "Karpathy LLM Wiki, in one read", "type": "document", "weight": 1, "documentId": "demo-karpathy-llm-wiki" },
      { "id": "n-doc-format", "label": "Formatting tour", "type": "document", "weight": 1, "documentId": "demo-formatting-tour" },
      { "id": "n-c-vector", "label": "Vector recall", "type": "concept", "weight": 2, "documentId": "demo-ai-memory-chat" },
      { "id": "n-c-episodic", "label": "Episodic snapshot", "type": "concept", "weight": 2, "documentId": "demo-ai-memory-chat" },
      { "id": "n-c-hub-memory", "label": "Hub-shaped memory", "type": "concept", "weight": 3, "documentId": "demo-ai-memory-chat" },
      { "id": "n-c-author", "label": "Author-control", "type": "concept", "weight": 3, "documentId": "demo-karpathy-llm-wiki" },
      { "id": "n-c-url-addressable", "label": "URL-addressable knowledge", "type": "concept", "weight": 2, "documentId": "demo-karpathy-llm-wiki" }
    ],
    "edges": [
      { "source": "n-doc-mem-chat", "target": "n-c-vector",     "label": "compares",       "weight": 2, "type": "elaborates" },
      { "source": "n-doc-mem-chat", "target": "n-c-episodic",   "label": "compares",       "weight": 2, "type": "elaborates" },
      { "source": "n-doc-mem-chat", "target": "n-c-hub-memory", "label": "argues for",     "weight": 3, "type": "elaborates" },
      { "source": "n-doc-karpathy", "target": "n-c-author",     "label": "argues for",     "weight": 3, "type": "elaborates" },
      { "source": "n-doc-karpathy", "target": "n-c-url-addressable", "label": "implies",   "weight": 2, "type": "elaborates" },
      { "source": "n-c-hub-memory", "target": "n-c-author",     "label": "depends on",     "weight": 2, "type": "supports" },
      { "source": "n-c-url-addressable", "target": "n-c-hub-memory", "label": "enables",   "weight": 2, "type": "supports" }
    ],
    "clusters": [
      { "id": "cl-arch", "label": "Architectures", "nodeIds": ["n-c-vector", "n-c-episodic", "n-c-hub-memory"], "color": "#fb923c" },
      { "id": "cl-philosophy", "label": "Philosophy", "nodeIds": ["n-c-author", "n-c-url-addressable"], "color": "#a78bfa" }
    ]
  }$$::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Bundle: Engineering & Strategy ──────────────────────────
INSERT INTO bundles (id, user_id, title, description, edit_token, is_draft, intent, graph_data, graph_generated_at)
VALUES (
  'demo-bundle-engineering',
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd',
  'Engineering decisions + cross-AI strategy',
  'A working bundle: the ADR for shipping graph_data in URLs, the cross-AI moat argument, and a hands-on integration note for Cursor. Three docs that explain *what we''re building and why* in 10 minutes of reading.',
  'demo-token-bundle-eng',
  false,
  'Frame the platform decisions a reviewer would want to verify in 10 minutes.',
  $${
    "summary": "Three docs covering the platform shape: a concrete engineering decision (graph_data in URL), the strategic frame that decision serves (cross-AI portability), and one tool-level integration to ground the abstract claims (Cursor wiring). Reading order: strategy → decision → integration, or reverse if the reader prefers concrete-to-abstract.",
    "themes": [
      "Cross-AI portability is the structural moat, not feature depth.",
      "Decisions are validated by the URL behaviour they produce.",
      "Tool integrations expose the contract; the contract is the spec."
    ],
    "insights": [
      "Shipping graph_data inside the URL is the engineering manifestation of the cross-AI moat: without it, the URL is just an inventory; with it, the URL is a transferable analysis.",
      "Cursor''s integration is the test case for the spec — any tool that respects llms.txt + raw markdown should behave identically to Cursor when wired the same way."
    ],
    "keyTakeaways": [
      "Don''t optimise for any single AI tool. Optimise for the URL response.",
      "Decisions ship when the resulting URL changes shape — not when a feature lands. Review through the URL response surface."
    ],
    "gaps": [
      "Need a third tool integration (besides Cursor) to triangulate the spec — Claude Code or Codex CLI next."
    ],
    "connections": [
      { "doc1": "demo-strategy-moat", "doc2": "demo-decision-graph-url", "relationship": "Strategy and the engineering decision that operationalises it." },
      { "doc1": "demo-decision-graph-url", "doc2": "demo-cursor-rules", "relationship": "The URL shape this ADR produces is what Cursor consumes — the integration is the validation." }
    ],
    "documentSummaries": {
      "demo-strategy-moat": "The cross-AI portability argument: vendors can''t build a URL that works across their competitors, mdfy can.",
      "demo-decision-graph-url": "ADR for shipping graph_data inside the bundle URL by default, with stale flag and opt-out knob.",
      "demo-cursor-rules": "Hands-on: writing a .cursor/rules/*.mdc that points at a mdfy bundle URL."
    },
    "nodes": [
      { "id": "n-doc-strategy", "label": "Cross-AI moat", "type": "document", "weight": 1, "documentId": "demo-strategy-moat" },
      { "id": "n-doc-decision", "label": "graph_data in URL ADR", "type": "document", "weight": 1, "documentId": "demo-decision-graph-url" },
      { "id": "n-doc-cursor", "label": "Cursor integration", "type": "document", "weight": 1, "documentId": "demo-cursor-rules" },
      { "id": "n-c-cross-ai", "label": "Cross-AI portability", "type": "concept", "weight": 4, "documentId": "demo-strategy-moat" },
      { "id": "n-c-url-contract", "label": "URL contract", "type": "concept", "weight": 3, "documentId": "demo-decision-graph-url" },
      { "id": "n-c-graph-data", "label": "graph_data payload", "type": "concept", "weight": 3, "documentId": "demo-decision-graph-url" },
      { "id": "n-c-stale-flag", "label": "analysis_stale flag", "type": "concept", "weight": 1, "documentId": "demo-decision-graph-url" },
      { "id": "n-c-cursor-rules", "label": ".cursor/rules", "type": "concept", "weight": 2, "documentId": "demo-cursor-rules" }
    ],
    "edges": [
      { "source": "n-doc-strategy", "target": "n-c-cross-ai",      "label": "argues for",  "weight": 3, "type": "elaborates" },
      { "source": "n-doc-decision", "target": "n-c-url-contract",  "label": "implements",  "weight": 3, "type": "elaborates" },
      { "source": "n-doc-decision", "target": "n-c-graph-data",    "label": "introduces",  "weight": 3, "type": "elaborates" },
      { "source": "n-doc-decision", "target": "n-c-stale-flag",    "label": "introduces",  "weight": 1, "type": "elaborates" },
      { "source": "n-doc-cursor",   "target": "n-c-cursor-rules",  "label": "demonstrates","weight": 2, "type": "contains" },
      { "source": "n-c-cross-ai",   "target": "n-c-url-contract",  "label": "requires",    "weight": 2, "type": "supports" },
      { "source": "n-c-url-contract", "target": "n-c-graph-data",  "label": "specifies",   "weight": 2, "type": "supports" },
      { "source": "n-c-cursor-rules", "target": "n-c-url-contract","label": "consumes",    "weight": 2, "type": "supports" }
    ],
    "clusters": [
      { "id": "cl-strategy", "label": "Strategy", "nodeIds": ["n-c-cross-ai"], "color": "#fb923c" },
      { "id": "cl-engineering", "label": "Engineering", "nodeIds": ["n-c-url-contract", "n-c-graph-data", "n-c-stale-flag"], "color": "#60a5fa" },
      { "id": "cl-integration", "label": "Tool integration", "nodeIds": ["n-c-cursor-rules"], "color": "#4ade80" }
    ]
  }$$::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Bundle membership ───────────────────────────────────────
INSERT INTO bundle_documents (bundle_id, document_id, sort_order, annotation)
VALUES
  ('demo-bundle-memory',      'demo-ai-memory-chat',     0, 'The captured Claude conversation. Read first — it names the three architectures.'),
  ('demo-bundle-memory',      'demo-karpathy-llm-wiki',  1, 'Karpathy''s philosophical frame. Same conclusion, opposite direction.'),
  ('demo-bundle-memory',      'demo-formatting-tour',    2, 'Reference for the rendering vocabulary used across the hub.'),

  ('demo-bundle-engineering', 'demo-strategy-moat',      0, 'Why cross-AI portability is the moat. Read first.'),
  ('demo-bundle-engineering', 'demo-decision-graph-url', 1, 'The ADR that operationalises the strategy.'),
  ('demo-bundle-engineering', 'demo-cursor-rules',       2, 'Concrete tool wiring — the URL shape this ADR produces flowing into Cursor.')
ON CONFLICT (bundle_id, document_id) DO NOTHING;

-- ─── 6. Concept index (hub-wide ontology) ───────────────────────
-- 12 concept rows + 8 concept_relations edges. Each concept's
-- doc_ids array carries the docs that mention it; this is what
-- the per-concept hub page (/hub/demo/c/<slug>) renders.

INSERT INTO concept_index (user_id, label, normalized_label, concept_type, weight, description, doc_ids, occurrence_count)
VALUES
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'Vector recall',           'vector recall',           'concept', 3, 'Embedding-based retrieval over stored messages. Cosine similarity surfaces past context.', ARRAY['demo-ai-memory-chat']::text[], 2),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'Episodic snapshot',       'episodic snapshot',       'concept', 3, 'Verbatim transcript storage indexed by date and topic. Claude Projects uses this shape.', ARRAY['demo-ai-memory-chat']::text[], 2),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'Hub-shaped memory',       'hub-shaped memory',       'concept', 5, 'User-authored, URL-addressable knowledge. The third architecture in the memory landscape.', ARRAY['demo-ai-memory-chat','demo-karpathy-llm-wiki']::text[], 5),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'Author-control',          'author-control',          'concept', 4, 'The user, not the AI, decides what enters memory and how it''s shaped. Karpathy''s frame.', ARRAY['demo-karpathy-llm-wiki','demo-ai-memory-chat']::text[], 4),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'URL-addressable knowledge','url-addressable knowledge','concept', 4, 'Every piece of knowledge has a permanent URL. AIs read by fetching, humans read by clicking.', ARRAY['demo-karpathy-llm-wiki','demo-strategy-moat']::text[], 3),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'Cross-AI portability',    'cross-ai portability',    'concept', 5, 'A URL that works across competing AI vendors. The structural moat single-vendor systems can''t reach.', ARRAY['demo-strategy-moat','demo-decision-graph-url']::text[], 4),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'URL contract',            'url contract',            'concept', 4, 'The shape of the markdown response every public mdfy URL returns. Doc / Bundle / Hub variants.', ARRAY['demo-decision-graph-url','demo-strategy-moat']::text[], 3),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'graph_data',              'graph_data',              'concept', 3, 'The pre-computed canvas analysis embedded in the bundle URL response — themes, insights, concept relations.', ARRAY['demo-decision-graph-url']::text[], 3),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'analysis_stale flag',     'analysis_stale flag',     'concept', 1, 'Frontmatter signal that a bundle''s graph_data was generated before the latest member doc edit.', ARRAY['demo-decision-graph-url']::text[], 1),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', '.cursor/rules',           'cursor rules',            'concept', 2, 'Cursor''s newer multi-rule format. Frontmatter scopes when the rule applies; body holds the mdfy URL.', ARRAY['demo-cursor-rules']::text[], 2),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'Mermaid',                 'mermaid',                 'concept', 1, 'Diagram dialect mdfy renders alongside ASCII. Demonstrated in the formatting tour.', ARRAY['demo-formatting-tour']::text[], 1),
  ('4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd', 'KaTeX math',              'katex math',              'concept', 1, 'Inline and display math rendered with LaTeX-quality precision.', ARRAY['demo-formatting-tour']::text[], 1)
ON CONFLICT (user_id, normalized_label) DO NOTHING;

-- Edges between concepts. concept_relations uses BIGINT FKs to
-- concept_index, so we join the normalized labels back to ids per
-- edge. Idempotent via the UNIQUE constraint on
-- (user_id, source_concept_id, target_concept_id, relation_label).
INSERT INTO concept_relations (user_id, source_concept_id, target_concept_id, relation_label, weight)
SELECT
  '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd'::uuid,
  s.id,
  t.id,
  rels.rel,
  rels.w::real
FROM (VALUES
  ('hub-shaped memory',         'author-control',             'depends_on', 3),
  ('hub-shaped memory',         'url-addressable knowledge',  'requires',   3),
  ('url-addressable knowledge', 'cross-ai portability',       'enables',    3),
  ('cross-ai portability',      'url contract',               'requires',   3),
  ('url contract',              'graph_data',                 'specifies',  2),
  ('graph_data',                'analysis_stale flag',        'pairs_with', 1),
  ('cursor rules',              'url contract',               'consumes',   2),
  ('vector recall',             'hub-shaped memory',          'contrasts',  2),
  ('episodic snapshot',         'hub-shaped memory',          'contrasts',  2)
) AS rels(src_label, tgt_label, rel, w)
JOIN concept_index s ON s.user_id = '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd'::uuid AND s.normalized_label = rels.src_label
JOIN concept_index t ON t.user_id = '4438fefc-9b1a-48b8-a9e6-9b9f1b7c76bd'::uuid AND t.normalized_label = rels.tgt_label
ON CONFLICT (user_id, source_concept_id, target_concept_id, relation_label) DO NOTHING;
