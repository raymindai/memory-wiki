---
marp: true
theme: default
paginate: true
backgroundColor: '#0a0a0a'
color: '#f4f4f5'
title: 'Memory.Wiki — HN / developer deck'
style: |
  section { font-family: 'Inter', 'Pretendard', system-ui, sans-serif; padding: 64px 72px; letter-spacing: -0.01em; }
  section.lead { justify-content: center; text-align: left; }
  section.lead h1 { font-size: 64px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin-bottom: 24px; }
  section.lead h2 { font-size: 22px; font-weight: 500; color: #a1a1aa; margin-top: 0; border: none; }
  h1 { color: #fb923c; font-size: 40px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 24px; }
  h2 { color: #fafafa; font-size: 30px; font-weight: 700; letter-spacing: -0.015em; margin-top: 0; margin-bottom: 18px; }
  h3 { color: #fb923c; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 28px; margin-bottom: 10px; }
  p, li { font-size: 22px; line-height: 1.5; color: #e4e4e7; }
  strong { color: #fafafa; font-weight: 700; }
  em { color: #fb923c; font-style: normal; }
  code { background: #18181b; color: #fdba74; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-family: 'JetBrains Mono', monospace; }
  pre { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 20px; font-size: 17px; line-height: 1.4; }
  pre code { background: none; color: #fdba74; padding: 0; }
  blockquote { border-left: 3px solid #fb923c; padding-left: 20px; color: #d4d4d8; font-style: italic; margin: 18px 0; }
  table { border-collapse: collapse; font-size: 19px; width: 100%; }
  th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #27272a; }
  th { color: #fb923c; font-weight: 600; }
  hr { border: none; border-top: 1px solid #27272a; margin: 28px 0; }
  ul { padding-left: 24px; }
  li { margin-bottom: 8px; }
  section::after { color: #52525b; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
  .accent { color: #fb923c; }
  .muted { color: #a1a1aa; }
  .faint { color: #71717a; }
---

<!-- _class: lead -->

<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,146,60,0.12);color:#fb923c;font-size:13px;font-weight:600;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Show HN · 2026-08</span>

# **Memory.Wiki**
## Markdown URLs as a memory layer for Claude, ChatGPT, Cursor, Codex.

<br>

```
$ curl https://memory.wiki/hub/you?compact
# Your AI memory, deployable to any AI.
```

---

# The thesis, in one frame

**LLMs read markdown natively. URLs cross every tool boundary.**

If your memory is a markdown URL, every AI you use can fetch it the same way. The same `GET`. The same parse. The same context window.

<br>

So your personal memory should be:

- *not* a Notion block (vendor)
- *not* an extracted-fact graph (inference)
- *not* an SDK-shaped API (per-tool integration)
- **a markdown URL** that every AI tool can already read

---

# What it does today

```
                ┌───────────────────────┐
   capture ───→ │   Memory.Wiki hub @ /hub/you │ ───→ deploy
                └───────────┬───────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
          /llms.txt    /b/<bundle>     /d/<doc>
          (index)      (synthesised    (raw markdown,
                       graph_data       always fresh)
                       inlined)
```

<h3>Five capture surfaces, five+ deploy surfaces</h3>

- Capture: Chrome ext · MCP server · paste-anywhere editor · GitHub / Notion / Obsidian import · file drop (PDF, DOCX, code)
- Deploy: AGENTS.md · CLAUDE.md · .cursor/rules · MCP · raw URL paste

---

# What's interesting (1/4)

<h3>Cross-AI is a structural moat</h3>

Notion's AI works in Notion. ChatGPT's memory works in ChatGPT. Cursor's project context works in Cursor.

**AI companies cannot ship cross-AI memory** without cannibalising the wall that funds their model training. The "layer above AI" is structurally available only to a non-AI-company.

> *We're not chasing the Anthropic-loyal user. We're chasing the user who's already in three AI tools and tired of re-pasting context.*

---

# What's interesting (2/4)

<h3>Authored memory ≠ extracted memory</h3>

| | Question | What you get |
|---|---|---|
| Mem0 / Letta | *What should the AI remember about you?* | A generated profile from inference. |
| **Memory.Wiki** | ***What do you want to remember?*** | A curated hub from authorship. |

Both legitimate. Different artifacts, different audiences.

The extracted-memory companies make their tools smarter for you. Memory.Wiki makes **you** legible to every AI tool you use.

---

# What's interesting (3/4)

<h3>Graph-RAG-as-URL, not as service</h3>

Microsoft GraphRAG / LlamaIndex KG build a knowledge graph and traverse it internally when an upstream system queries. The graph is API-private.

Memory.Wiki ships the graph **in the URL response** — themes, insights, concept relations all inlined as markdown.

<br>

```bash
$ curl https://memory.wiki/b/<bundle-id>
# ... markdown body ...
```memory.wiki:graph
{ "themes": [...], "insights": [...], "connections": [...] }
``` 
```

The receiving AI gets the prior AI's analysis for free, single round trip.

---

# What's interesting (4/4)

<h3>The Karpathy wiki, deployed as URL</h3>

> *"Obsidian is the IDE. The LLM is the programmer. The wiki is the codebase."* — Karpathy

Right thesis, local file shape. We rebuilt it as a URL shape — and added **composable scopes**:

- `memory.wiki/d/<id>` — single doc
- `memory.wiki/b/<bundle-id>` — topical bundle with synthesised analysis
- `memory.wiki/hub/<you>` — full personal hub

Per-project context (bundles) maps cleanly onto AGENTS.md / .cursor/rules. The Obsidian shape can't reach there.

---

# Stack

<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

<div>

<h3>Engine</h3>

- **markdown-it** — single shared pipeline across editor + every viewer
- **Next.js 15** — editor + viewer + API
- Open source on GitHub

<h3>Retrieval</h3>

- **Supabase Postgres** + `pgvector` + HNSW
- `text-embedding-3-small` (OpenAI)
- BM25 + vector union → Haiku rerank

</div>

<div>

<h3>AI integrations</h3>

- Capture: Claude Sonnet 4.5 + GPT-4o-mini
- Concept extraction: Claude Haiku 4.5
- No fine-tuning. All off-the-shelf.

<h3>Deploy</h3>

- Vercel (web + API)
- Supabase Storage (assets)
- npm: `memory-wiki-mcp`, `memory-wiki-cli`

</div>

</div>

---

# Open

Everything that matters is documented or open source.

<br>

| Surface | Status |
|---|---|
| `/spec` — URL contract, bundle digest, recall API | public spec |
| `/llms.txt` per hub | shipped, follows the standard |
| Render pipeline (`apps/web/src/lib/render.ts`) | source on GitHub |
| `memory-wiki-mcp` | npm, source on GitHub |
| `memory-wiki-cli` | npm, source on GitHub |
| Chrome extension | source on GitHub |
| `/docs/integrate` worked examples (incl. GitHub Action) | public |

**Try it before reading anything else:** `memory.wiki/hub/demo`

---

# Anticipated questions

<h3>"Isn't this Notion + AI?"</h3>

Notion's AI works in Notion. Memory.Wiki works wherever the URL goes. The lock-in difference is the whole point.

<h3>"Won't AI companies build this themselves?"</h3>

They structurally can't. Their incentive is the wall.

<h3>"GitHub Pages + markdown is enough."</h3>

It's not. The hub layer (concept index, recall API, auto-graph), the capture surfaces, and the deploy primitives (`/llms.txt`, `?compact`, `?graph=0`) are the substantive product.

---

<!-- _class: lead -->

# Try it

<br>

```bash
# Browse the demo hub
open https://memory.wiki/hub/demo

# Paste into Claude / Cursor / Codex
echo 'https://memory.wiki/hub/demo' >> AGENTS.md

# Or call the recall API directly
curl -X POST https://memory.wiki/api/hub/demo/recall \
     -H 'Content-Type: application/json' \
     -d '{"question":"cross-AI memory","k":5}'
```

<br>

<span class="muted">Engine MIT-licensed · Spec at /spec · Source at github.com/raymindai/mdcore</span>
