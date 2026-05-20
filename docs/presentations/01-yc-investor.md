---
marp: true
theme: default
paginate: true
backgroundColor: '#0a0a0a'
color: '#f4f4f5'
title: 'mdfy — YC / Investor deck'
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

<span class="pill" style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,146,60,0.12);color:#fb923c;font-size:13px;font-weight:600;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">YC W2026 · memory.wiki</span>

# **mdfy**
## Your AI memory, deployable to any AI.

<br>

<span class="faint">Hyunsang Cho · hi@raymind.ai · 2026</span>

---

# The problem

**Every AI tool forgets you between sessions.**

ChatGPT, Claude, Cursor, Codex, Gemini — each builds its own memory layer, each scoped to its own walled garden.

The user pays the tax: re-explaining the same project context every time they switch tools. Trillions of tokens of high-quality AI-assisted thinking get created daily and lost to chat histories nobody returns to.

<h3>The most expensive forgetting machine in history.</h3>

---

# The insight

**LLMs read markdown. URLs cross every boundary.**

If your memory is a **markdown URL**, every AI you use can fetch it the same way. The same GET. The same parsing. The same context.

Memory shouldn't be a feature *inside* one AI. It should be a layer *above* all of them.

> *"The wiki is the codebase. The LLM is the programmer."* — Karpathy

We took that local-file shape and made it a URL.

---

# What mdfy is

A personal knowledge hub that lives at **one URL** — `memory.wiki/hub/you` — that every AI tool can read.

<br>

<div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

<div>

<h3>Capture from anywhere</h3>

- ChatGPT / Claude / Gemini share links
- Chrome extension (one-click)
- MCP server (Claude Code, Cursor)
- GitHub repos, Notion, PDFs, files
- Paste-anywhere editor

</div>

<div>

<h3>Deploy anywhere</h3>

- One line in `AGENTS.md` / `CLAUDE.md` / `.cursor/rules`
- Every AI session boots with your prior context
- `/llms.txt` + `?compact` keep token cost low
- No SDK, no vendor lock, no plugin

</div>

</div>

---

# How it works

```
  capture          organize             deploy
   ─────            ─────               ──────
  Chat URL ─┐    ┌─ Concept Index ─┐    Claude
  PDF      ─┤    │                  ├─  Cursor
  GitHub   ─┼──→ │  Bundles + Graph ├─→ Codex
  Notion   ─┤    │                  ├─  ChatGPT
  Paste    ─┘    └─ Hub @ /hub/you ─┘    Gemini
```

The hub URL response is **markdown + an inlined graph_data JSON block** — themes, insights, concept relations all in one fetch. Receiving AI inherits the prior AI's analysis for free.

<span class="faint footnote">Live: memory.wiki/hub/demo</span>

---

# Why now

**The category just collapsed into existing.**

Twelve months ago "AI memory" meant per-product hacks. Today every AI tool ships with at least one persistent context layer — but they're all walled.

<br>

<h3>The convergence</h3>

| | Persistent context | Cross-tool |
|---|---|---|
| Cursor | project context | ❌ |
| Claude Projects | project files | ❌ |
| ChatGPT | memory, GPTs | ❌ |
| Codex / Claude Code | AGENTS.md / CLAUDE.md | partial (file-shaped) |
| **mdfy** | **URL-shaped** | **✅** |

---

# The moat: cross-AI is structurally available only to a non-AI-company

<br>

**AI companies cannot build cross-AI memory.**

Their revenue depends on the wall. ChatGPT's memory works in ChatGPT because making it work in Cursor would teach users they don't need ChatGPT for memory.

The "layer above AI" is available only to a player whose revenue doesn't come from any one provider's wall.

<br>

<span class="accent">That's us. That's the structural moat.</span>

---

# Authored vs. extracted memory

Two questions, two products.

<br>

| | Question | Example |
|---|---|---|
| Extracted | *What should the AI remember about you?* | Mem0, Letta, OpenAI memory |
| **Authored** | ***What do you want to remember?*** | **mdfy** |

<br>

Both are legitimate. Authored is the harder problem because the user has to do work — but the artifact they produce is theirs forever and works in every tool.

---

# Graph-RAG-as-URL

**Not Graph-RAG-as-service.**

Microsoft GraphRAG / LlamaIndex KG build a graph and traverse it *internally* when an upstream system asks. The graph never leaves the service.

mdfy ships the graph **in the URL response**. Every bundle carries themes, insights, concept relations as markdown.

<br>

<h3>Result</h3>

The receiving AI inherits the prior AI's analysis for free — no second fetch, no SDK, no integration. Just paste the URL.

---

# Traction (as of 2026-05-15)

<div class="grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;">

<div>

<h3>Product</h3>

- memory.wiki live, Vercel
- 50-doc demo hub
- Chrome ext on the Store
- MCP server on npm
- Spec page public
- Engine MIT-licensed

</div>

<div>

<h3>Engineering</h3>

- 8 weeks to v6
- markdown-it shared render pipeline (editor + every viewer)
- pgvector + HNSW
- Hybrid retrieval + Haiku reranker
- 40+ migrations shipped
- CI green

</div>

<div>

<h3>Distribution</h3>

- Public Show HN ready
- 5 AI dev tools wired
- `llms.txt` shipped
- Hub URLs work in Claude / Cursor / Codex today
- Founder dogfood: this deck was built using mdfy

</div>

</div>

---

# Business model

**Free, then Pro.**

<br>

<h3>Free forever</h3>

Capture · hub · bundle · cross-AI deployment · public URLs · `llms.txt`

Badge ("Published with memory.wiki") on shared docs → viral loop.

<h3>Pro · price TBD (range $8-16/mo)</h3>

Custom domain · analytics · no badge · auto-analyze · MCP private hubs

<br>

No tier locks the core. The cross-AI thesis would die if we paywalled the URL.

---

# Competition

<div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

<div>

<h3>Not in our lane</h3>

- **Notion AI** — works only in Notion
- **Obsidian** — local file shape, not URL
- **Roam** — block-level, narrow audience
- **Mem0 / Letta** — extracted (different question)
- **GraphRAG** — service shape, not delivery

</div>

<div>

<h3>The honest pressure</h3>

- AI companies could interoperate. Won't, because their walls fund their model training. If they did, our fallback is *authored* memory — still valuable.
- A determined Notion could ship a cross-AI export. Speed + audience focus is the defense.

</div>

</div>

---

# Team

**One founder + AI pair-programming.**

<br>

**Hyunsang Cho** — Founder. Built mdfy v6 in 8 weeks of full-time work after 1 month nights/weekends. Prior: shipped 3 Chrome extensions; 10+ years building product. Korean-English bilingual.

<br>

<h3>What we'll hire for</h3>

Second engineer when revenue + roadmap demand clearly exceed solo capacity. Bar: ships, writes, changes mind in writing. Not before product-market fit signal.

---

<!-- _class: lead -->

# The ask

<br>

**Pre-seed, $X**

12 months of runway to:
1. **Public launch** (Aug 2026, Show HN)
2. **Pro tier** + Stripe (post-PMF signal)
3. **Second engineer**

<br>

<span class="muted">Try the demo: memory.wiki/hub/demo · Spec: memory.wiki/spec · Integrate: memory.wiki/docs/integrate</span>

<br>

<span class="faint">hi@raymind.ai · github.com/raymindai/mdcore</span>
