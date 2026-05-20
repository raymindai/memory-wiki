# Show HN draft — Memory.Wiki v6 (Hub layer)

**Status**: draft for founder review. Voice is the founder's, not Claude's. Keep first-person, keep technical, drop adjectives the founder wouldn't say out loud.

**Last revised**: 2026-05-16 (post-rebrand-prep ship + wedge-narrative refactor).

---

## Title options (pick one before posting)

1. **Show HN: Memory.Wiki – One URL that Cursor, Claude Code, and ChatGPT can all read as memory**
2. **Show HN: Memory.Wiki – Your AI memory, deployable to any AI**
3. **Show HN: Memory.Wiki – Markdown URLs as a memory layer for Claude, ChatGPT, Cursor**
4. **Show HN: Memory.Wiki – I built the personal wiki Karpathy described, then deployed it as a URL**

(My preference: #1 — leads with the *recognizable specific situation* before the abstract thesis. HN audience self-identifies in line 1.)

---

## Body (target: ~400 words; opens with a wedge story, not a feature list)

I use Claude Code and Cursor on the same project. They both need context — auth pattern, DB schema, the actual reason we picked Postgres over Dynamo six months ago. Today that context lives in `CLAUDE.md`, `.cursor/rules`, sometimes a stale Notion page. They drift. Last Tuesday I explained the rate-limit pattern to four different AI sessions across two tools in one afternoon.

Memory.Wiki is what I built to stop doing that.

Each saved doc is a markdown URL. Group them into a Bundle URL. Group bundles into your Hub URL. Drop the same URL into Cursor's `.cursor/rules`, Claude Code's `CLAUDE.md`, ChatGPT's "knowledge" — every AI now reads the same project memory. When a new decision lands, you save it once. Next session in any tool, the AI sees it.

**The 30-second demo**: paste `https://memory.wiki/b/p_mdtSk0` into Claude Code or Cursor's rules. It's a sample project's living context — 7 docs (README, auth pattern, DB schema, API conventions, UI patterns, decision log, open questions). The bundle URL fetches as markdown, with `?full=1` inlining every member doc (≈3.3k tokens) for the AI to ingest. Same URL works in any AI tool.

**What v6 ships beyond the wedge** (everything's free, no signup to try):

- **Capture** — Chrome extension for ChatGPT / Claude / Gemini; MCP server (26 tools) for Claude Code, Cursor, Claude Desktop; ingest from GitHub repos, Notion pages, Obsidian vaults, any URL, files (PDF/DOCX/code).
- **Hub auto-organises** — saved docs cluster into a concept index. Cross-doc themes surface as you add. Recall API at `POST /api/hub/<slug>/recall` (hybrid BM25 + pgvector + optional Haiku reranker). Per-hub auto-published `index.md`, `SCHEMA.md`, `log.md`, `llms.txt`.
- **Bundle as thinking surface** — group N docs, add an Intent, AI synthesises tensions/gaps/threads across them. The bundle URL ships the analysis inline — receiving AIs inherit the prior synthesis for free, no re-computation.

**Why I think it works**:

1. **Cross-AI is the structural moat.** Notion's AI works in Notion. ChatGPT's memory works in ChatGPT. Memory.Wiki is just a URL — AI companies can't replicate that without abandoning walled gardens.
2. **Authored ≠ extracted memory.** Mem0 and Letta extract facts from conversations. Memory.Wiki answers a different question: *what do you want to remember?* You write it. You edit it. You decide.
3. **The Karpathy wiki, deployed as a URL.** "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase" — that's a local-file shape. Memory.Wiki rebuilt it as URL + composable scopes (doc / bundle / hub) so per-project context maps cleanly to `AGENTS.md` / `CLAUDE.md` / `.cursor/rules`.

Stack: Next.js 15, Supabase Postgres + pgvector + HNSW, OpenAI text-embedding-3-small, Anthropic Haiku for concept extraction + reranking, markdown-it as the shared render pipeline across editor + every viewer (TipTap on top for WYSIWYG). Open source. Bundle spec at [/spec](https://memory.wiki/spec).

Try it: paste `memory.wiki/b/p_mdtSk0` into any AI tool. Or open the example hub: [`memory.wiki/hub/demo`](https://memory.wiki/hub/demo). Or paste a ChatGPT share link at Memory.Wiki — your URL is yours forever, no signup.

Happy to dig into the cross-AI thesis, the wedge use case, why authored beats extracted, the bundle digest format, or where this goes if it works.

---

## Anticipated comments + responses

**"Isn't this just Notion + AI?"**
> Notion's AI works in Notion. Memory.Wiki works wherever you paste the URL — Cursor, Claude, ChatGPT, Codex. The lock-in difference is the whole point.

**"What about Mem0 / Letta / extracted memory?"**
> Different question. Mem0 asks "what should the AI remember about you?" Memory.Wiki asks "what do *you* want to remember?" Both are legitimate. The first is inference; the second is authorship.

**"How is this different from publishing markdown to GitHub Pages?"**
> Three things: (a) capture surfaces (Chrome ext / MCP / 5 ingest sources), (b) the hub layer (auto-concept-index, recall API, lint surface), (c) cross-AI deployability (every URL is a citable context address with `/raw` + `?compact` + `/llms.txt`).

**"Won't AI companies just build this themselves?"**
> They can't. Their incentive is to keep you in their walled garden. The cross-AI position is mine to win precisely because every AI company is structurally one of the AIs, not the layer above them.

**"Why a separate URL instead of just MCP?"**
> MCP needs setup per tool, per machine. A URL is universal — paste it anywhere markdown is read (which is everywhere an LLM exists). MCP and URL coexist: Memory.Wiki ships both. MCP for write paths and rich tools; URL for read-anywhere distribution.

**"Pricing?"**
> Free during beta. Pro tier after launch (price TBD — announced when beta ends). No tier locks the core: capture / hub / cross-AI deployability are free forever. The Pro split today is around no-badge, custom domain, analytics, auto-analyze (stale-fetch triggers background graph regen).

**"Why are you doing this?"**
> Trillions of tokens of high-quality AI-assisted thinking are being created every day and lost to chat histories nobody returns to. The most expensive forgetting machine in history. I want to build the layer that catches the part you actually meant to keep.

---

## Launch day timing

- Post at 7 AM PT (peak HN traffic) on a Tuesday or Wednesday
- Have the founder online for the next 6 hours to respond personally
- Don't recruit upvotes. Don't post the link in Slack. Organic ranking only.
- After post: tweet a single thread (5-6 tweets), email Substack list, Slack the news in 2-3 friendly group chats (not "vote me up" — just "shipped this, would love feedback").

## Demo URLs to have ready

- Wedge demo: `memory.wiki/b/p_mdtSk0` (Cross-tool dev workflow bundle, 7 docs, ~3.3k tokens at `?full=1`)
- Full hub demo: `memory.wiki/hub/demo` (Memory.Wiki Demo's hub — 50 docs, 7 bundles, 40 concepts)
- Spec: `memory.wiki/spec`
- Integrate doc with per-tool snippets: `memory.wiki/docs/integrate`

---

## What I do NOT want in the post

- "Revolutionary" / "disrupt" / "AI-powered" / "next-gen" — auto-downvotes on HN
- Buzzword pile-up
- Pitching-investors language ("scalable", "platform play")
- More than one Karpathy mention (we already use it carefully in body)
- Reddit-style "let me know what you think!" tail
- Feature lists longer than 3 bullets in the body — those go in /docs, not the pitch
