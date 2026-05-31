# Memory.Wiki — Product, Features, Technology (2026-05)

> One-page reference. Skim it before any meeting, pitch, or
> onboarding. Pairs with `HOW-IT-WORKS.md` (mental model) and
> `ROADMAP`-style notes (what's next).

---

## 1. Product

**Tagline.** The fastest way from thought to shared document.

**One sentence.** Memory.Wiki turns any markdown — typed, pasted from an AI,
imported from a file — into a clean public URL that any human reads
in a browser and any LLM (Claude, ChatGPT, Gemini, Cursor) ingests
as native context.

**Why it has a moat.**

| Moat                 | What it means                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Viral badge loop** | Every shared doc carries a "Published with Memory.Wiki" badge → free distribution.                |
| **Cross-AI layer**   | Memory.Wiki sits between *every* LLM and the human. No single AI company can replicate that position. |
| **URL-native**       | The doc isn't a file behind an app — it's an address. AI agents pull it directly.              |
| **Rendering quality**| GFM + KaTeX + Mermaid + ASCII diagrams + footnotes share one renderer across every surface.    |

**Strategic anchor.** A Memory.Wiki URL is an API for any AI. See
`HOW-IT-WORKS.md` for the full mental model.

---

## 2. URL architecture (the user-facing shape)

Three tiers, each with its own page route and its own LLM-ready
`/raw` payload.

| Tier       | URL                  | Holds                                                                 |
| ---------- | -------------------- | --------------------------------------------------------------------- |
| **Doc**    | `memory.wiki/<id>`      | A single markdown document. The atom.                                 |
| **Bundle** | `memory.wiki/b/<id>`    | An ordered set of docs + an AI-extracted graph (themes, edges).       |
| **Hub**    | `memory.wiki/hub/<slug>`| A user's whole bundle library + cross-bundle concept ontology.        |

Auxiliary surfaces:

- `memory.wiki/d/<id>` — reader-only viewer for non-owners.
- `memory.wiki/embed/<id>` — iframe-friendly stripped render.
- `memory.wiki/raw/...` — plain-markdown payload for AIs / scrapers / RSS-like consumers.

---

## 3. Feature inventory

### Editing & rendering
- Tiptap (ProseMirror) **MD** tab — WYSIWYG over the same markdown-it parser the viewers use, so output is identical across editor / viewer / embed.
- CodeMirror 6 **Source** tab — raw markdown editing with selection, paste, image-upload handlers.
- **Split** view that wires Source ↔ Preview.
- GFM tables, task lists, footnotes, KaTeX (`$..$`, `$$..$$`), Mermaid (dark/light aware), code highlighting (highlight.js), ASCII box-diagram detection.

### AI integration
- Three-provider failover: Anthropic → OpenAI → Gemini, runtime-chosen via `lib/ai-providers.ts`.
- In-doc actions (selection toolbar): polish / shorten / expand / translate.
- AI side panel (chat about the active doc / bundle / hub).
- Visitor "Ask AI about this doc" on the public viewer — uses a dedicated `visitor_chat` action so the LLM answers, never echoes the doc.
- Concept index (ontology extraction per doc) → cross-bundle graph at the Hub level.
- Embeddings: per-doc + per-chunk pgvector vectors backing semantic search via MCP.

### Real-time collaboration
- Yjs CRDT over **Supabase Realtime broadcast** (`yjs-doc-{cloudId}` channel).
- Storage shape is markdown-string Y.Text, not y-prosemirror — sync works the same whether you're on MD, Source, or Split.
- Remote cursor presence:
  - Source pane: line/col carets via a CM6 StateField.
  - MD pane: ProseMirror Decoration plugin keyed on `pmPos` (both peers parse identical markdown to identical PM docs, so positions match across clients without y-prosemirror).
- Header presence avatars (`usePresence`): up to **5 collaborator avatars**, then an overflow `+N` chip. Self is filtered out. Per-user color from a stable 8-hue palette (`lib/user-color.ts`) so identity persists across reconnects/devices.

### Permissions
- Three roles per doc: `owner` (created by you, full control) / `editor` (in `allowed_editors`) / `readonly` (in `allowed_emails` only).
- `edit_mode`: `owner` / `account` / `token` / `view` / `public`.
- Editor-role users land on the live editor, not the read-only viewer (the `/d/<id>` route auto-redirects them).
- Snapshot + auto-save endpoints both accept owner-or-editor (verified via JWT bearer OR `x-user-*` header fallback).

### Sharing & visibility
- Short URLs (nanoid).
- Per-user nanoid Hub slug (auto-created on sign-in).
- Restricted docs gate non-allowed visitors with a password / sign-in flow.
- Permanent URLs — docs **never expire** (pricing policy: free during beta, future Pro for auto-analysis; expiry never).
- Public viewer carries a "Published with Memory.Wiki" badge.

### Multi-channel app surfaces
| Channel                     | Status                                  |
| --------------------------- | --------------------------------------- |
| `memory.wiki` web              | Live on Vercel                          |
| VS Code (memory-wiki-vscode)       | Marketplace v1.4.5                      |
| Desktop (DMG)               | v2.3.6, Developer ID signed + notarized |
| Chrome Web Store            | v2.2.4                                  |
| CLI (memory-wiki-cli)              | npm v1.4.3                              |
| MCP server (memory-wiki-mcp)       | npm v1.5.4 (29 tools)                   |
| macOS QuickLook plugin      | Bundled inside Desktop DMG              |

### Misc UX
- Dark / light themes with CSS-variable token system; mobile-responsive.
- Drag-and-drop import, paste-as-markdown, GitHub repo import, GFM tables paste support.
- "Start" landing — Recent / Create / Drop zone / Deploy to AI sections, foldable.
- Sidebar tabs with persistence, multi-select, drag-reorder.
- Export all user data as JSON (`/api/user/export`).
- Visit log per signed-in user (Shared with Me, Recently Visited).

---

## 4. Technology stack

```text
                   ┌───────────────────────────────┐
   typing ───────► │  Tiptap MD    (ProseMirror)   │
                   │   ↕ tiptap-markdown serializer│
                   │  CodeMirror 6 Source pane     │
                   └──────────────┬────────────────┘
                                  │ markdown string
                                  ▼
                   ┌───────────────────────────────┐
                   │  lib/render.ts                │
                   │   markdown-it + footnote      │
                   │   + KaTeX, Mermaid,           │
                   │   highlight.js, ASCII boxes   │
                   └──────────────┬────────────────┘
                                  ▼
                   ┌───────────────────────────────┐
                   │  HTML in every viewer/embed/  │
                   │  /raw payload (one renderer)  │
                   └───────────────────────────────┘
```

### Frontend
- **Next.js 15** (App Router), client-rendered editor via `dynamic({ ssr: false })`.
- **Tiptap** for the Live tab; **CodeMirror 6** for Source.
- **TailwindCSS** + CSS-variable token system (`globals.css`).
- **Lucide** icons.

### Persistence & sync
- **Supabase Postgres** — `documents`, `bundles`, `concept_index`, `document_chunks`, `document_versions`, `notifications`, `user_visits`, …
- **Supabase Auth** — OAuth (Google), email; JWT bearer + `x-user-id` / `x-user-email` header fallback so non-browser clients (CLI, MCP, Chrome ext) still resolve identity.
- **Supabase Realtime** — broadcast channels:
  - `yjs-doc-{cloudId}` — Yjs CRDT updates.
  - `doc-cursor:{cloudId}` — remote-cursor presence.
  - `doc-presence-{cloudId}` — durable "who's here" via `usePresence`.

### AI infrastructure
- `lib/ai-providers.ts` failover (Anthropic → OpenAI → Gemini).
- `lib/embeddings.ts` — OpenAI text-embedding-3-small for doc + chunk vectors.
- `lib/chunk-doc.ts` — heading-aware chunking for RAG retrieval.
- pgvector for similarity search.

### Hosting & CI
- **Vercel** — `git push origin main` → Actions CI → auto-deploy Memory.Wiki.
- **GitHub Actions** (`.github/workflows/ci.yml`) — build-web + e2e-test.
- Domains: **Memory.Wiki** primary; memorywiki.online redirects in; mdcore.ai / .org / .md parked (historical, sunset planned).

### One renderer everywhere
Every non-edit surface — web viewer, embed, bundle, hub, VS Code preview, Desktop preview, Chrome extension popup, raw payload — runs the **same `lib/render.ts`** (vendored to each channel). That's why "looks different in viewer than in editor" can't structurally happen.

---

## 5. Repository layout

```text
mdcore/                          # repo name is historical — product is "Memory.Wiki"
├── apps/
│   ├── web/                     # Next.js 15 web app → Memory.Wiki (the main product)
│   ├── vscode-extension/        # memory-wiki-vscode (Marketplace)
│   ├── desktop/                 # Memory.Wiki Desktop (Electron DMG)
│   ├── chrome-extension/        # Memory.Wiki Chrome (Web Store)
│   ├── cli/                     # memory-wiki-cli (npm)
│   └── quicklook/               # macOS QuickLook
├── packages/
│   └── mcp/                     # memory-wiki-mcp (npm, MCP server)
├── docs/                        # strategy notes, gap analyses, this file
├── .github/workflows/ci.yml
└── vercel.json
```

The Rust → WASM engine that used to live in `packages/engine` was
fully sunset on 2026-05-16. All surfaces are now JS-only via the
markdown-it pipeline.

---

## 6. Strategic notes (Aug 2026 launch context)

- Public launch held for end of August 2026; beta is free.
- Two-door product framing: **personal knowledge hub for the AI era**, accessed via memory (capture / publish) AND wiki (curate / share).
- Brand rename is deferred until ~2 weeks before public launch (shortlist: brains.wiki, mind.wiki, itsmy.wiki).
- Memory.Wiki IS Graph RAG, but the differentiation is **delivery model, not retrieval** — the graph ships in the URL payload so any external AI inherits it.
- vs Karpathy's LLM Wiki: Memory.Wiki is hub + N bundles + M docs (scope composition); Karpathy is one unified wiki. Per-project AGENTS.md / .cursor/rules want context shaped like bundles, not like one wiki.
