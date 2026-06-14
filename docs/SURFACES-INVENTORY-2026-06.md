# memory.wiki, Surface & Feature Inventory

> **Scope**: Every memory.wiki surface EXCEPT the web editor (`/`).
> Updated 2026-06-14. Maintained as the canonical reference for messaging
> alignment, /about page IA, and marketing.

This is **the** single source of truth for "what memory.wiki actually is
across all channels." When store listings, /about, /plugins, README, or
any channel description goes out of sync, this doc wins.

---

## Part 1 / The product in one sentence

**memory.wiki is a personal knowledge hub for the AI era, capture once
on any surface, deploy as a URL any AI reads.**

Three nouns the brand owns:
1. **Doc**, a single document at `memory.wiki/<8-char-id>`
2. **Bundle**, a multi-doc knowledge graph at `memory.wiki/b/<id>`
3. **Hub**, a personal wiki at `memory.wiki/@<slug>`

One verb the brand owns:
- **Deploy**, any URL drops cleanly into ChatGPT, Claude, Gemini,
  Cursor, Perplexity, MCP-aware agents, same payload, every reader.

---

## Part 2 / Surface-by-surface inventory

### A / Web viewer surfaces (memory.wiki/*)

The web is the **render layer + URL layer + AI access layer**. Every other
channel ultimately resolves to a memory.wiki URL.

| Path | What it is | Why it exists |
|---|---|---|
| `/<id>` | Single Doc viewer (TipTap read-only render) | The canonical doc URL. Public, password-restricted, email-allowlisted, or draft (owner-only). |
| `/b/<id>` | Bundle viewer (graph canvas + doc list + synthesis) | Multi-doc knowledge graph. Owner can re-run AI graph, resolve tensions, synthesize. |
| `/@<slug>` (aka `/hub/<slug>`) | Hub viewer (personal wiki feed) | Avatar + display name + description + 7-day Recent + Older feed + Frontier / Pulse / Constellation layers. |
| `/embed/<id>` | iframe-safe doc render | Same render pipeline, no chrome, no auth UI. |
| `/raw/<id>(.md)` | Plain-markdown payload | YAML frontmatter + body + optional context block (summary, themes, insights, concept relations, parent bundle pointers, hub pointer). 60s edge-cached. |
| `/raw/bundle/<id>` | Bundle Spec v1.0 markdown | Manifest of bundle metadata + member doc links. |
| `/raw/hub/<slug>` | Hub manifest markdown | Doc list + bundle list + concept index. Supports `?digest=1&compact=1` for AI-economy variant. |
| `/raw/hub/<slug>/c/<concept>` | Single concept definition | Atomic concept fetch from the hub ontology. |
| `/raw/hub/<slug>/log.md` | Hub activity log | Who did what, when. |
| `/raw/hub/<slug>/suggested-queries.md` | AI seed prompts | Conversation starters for hub chat. |

**Cross-AI guarantee (load-bearing for the brand):**
Middleware rewrites: `Accept: text/markdown`, known AI bot UA, or
`.md`/`.txt` suffix to routes to `/raw`. `Link` header advertises the
canonical browser URL so search ranks the human page, not the raw
endpoint. Every doc/bundle/hub URL therefore works as BOTH a human page
AND an AI-readable resource without the user thinking about which.

**Permission model (applies to docs + bundles + hubs):**
- `is_draft = true` to owner-only
- `password_hash` set to password-protected (legacy)
- `allowed_emails[]` populated to specific people, view or edit role per email
- otherwise to public

**Share modal** surfaces the choice as 3 radio states (Private / Specific
people / Anyone with the link) + edit-mode toggle (Owner / View / Public).

**Real-time collab (Yjs CRDT)**: when collab is active on a doc, conflict
detection is skipped, CRDT handles merging. Remote carets render as
CodeMirror decorations.

---

### B / Web API + AI pipeline (memory.wiki/api/*)

The web's HTTP surface. Used by all other channels.

**Docs CRUD**
- `POST /api/docs`, create. CORS-open to chatgpt.com / claude.ai /
  gemini.google.com for bookmarklet flows.
- `GET /api/docs/[id]`, fetch markdown.
- `PATCH /api/docs/[id]`, update. Actions: `publish` / `unpublish` /
  `soft-delete` / `set-allowed-emails` / `set-expiry` / `move-to-folder`.
- `DELETE /api/docs/[id]`, permanent delete.
- `GET /api/docs/[id]/versions`, history.
- `POST /api/docs/[id]/versions/[versionId]/restore`, roll back.

**Search & discovery**
- `GET /api/search?q=...`, FTS with ILIKE fallback for CJK.
- `GET /api/discover`, public trending / recent.

**User & auth**
- `GET /api/me`, current user.
- `POST /api/auth/demo-signin`, backdoor for YC / App Store reviewers.
  Allowlist: `yc@mdfy.app`, `demo@mdfy.app`, `demo@memory.wiki`.
- `GET /api/user/documents` / `folders` / `recent` / `hub/*`.

**AI surfaces (one cascade, 28 actions)**
- `POST /api/ai`, generic actions (polish, summary, tldr, translate,
  chat, beautify, compact, format, selection_*).
- `POST /api/docs/transform`, intent transform (the extension's
  "Capture with intent" textarea calls this).
- `POST /api/docs/[id]/decompose`, semantic chunking into typed nodes
  (concept / claim / example / definition / task / question / context /
  evidence) with typed edges (supports / elaborates / contradicts /
  exemplifies / depends_on / related).
- `POST /api/bundles/[id]/graph`, knowledge graph generation.
- `POST /api/bundles/[id]/resolve-tension`, AI identifies & resolves
  contradictions across the bundle's docs.
- `POST /api/bundles/[id]/synthesize`, single narrative combining all
  docs.
- `POST /api/bundles/[id]/suggest-title`, name suggestion.
- `POST /api/bundles/[id]/suggestions`, related bundles.
- `POST /api/bundles/ai-generate`, create bundle from a query.
- `GET /api/bundles/[id]/constellation`, concept graph filtered to the
  bundle.
- `GET /api/user/hub/frontier`, new concepts (7d), bundle hints, gaps.
- `GET /api/user/hub/pulse`, 365-day activity heatmap + streaks.
- `GET /api/user/hub/constellation`, full hub concept graph.
- `GET /api/user/hub/suggestions`, AI recommends bundles to create.
- `GET /api/user/hub/suggested-queries`, chat seed prompts.
- `POST /api/hub/[slug]/recall`, vector search + LLM rerank.
- `POST /api/hub/[slug]/chat`, streamed, concept-bridged RAG over the
  whole hub.

**Auto-processing crons** (Vercel cron, fire on doc save / nightly)
- `doc-summary`, summary, themes, insights (lite model)
- `doc-graph`, semantic takeaways (lite)
- `doc-ontology`, concept index + relations (primary)
- `doc-decompose`, semantic chunking (primary)
- `organize-doc`, heading / structure cleanup (lite)
- `citation-rot`, link-validity audit
- `lifecycle-sweep`, hard-delete expired docs

**Provider cascade:** OpenAI to Gemini to Anthropic (default order,
admin-configurable). Every call logged to `ai_usage` table with action,
provider, in/out tokens, USD cost, user_id, anonymous_id, timestamp.

**Import**
- `POST /api/import/url`, web page to markdown
- `POST /api/import/github`, repo .md files batch
- `POST /api/import/notion`, workspace dump
- `POST /api/import/obsidian`, vault
- `POST /api/import/office`, Word / PPT / Excel
- `POST /api/import/pdf`, text extraction

**Upload:** `POST /api/upload`, image. Quotas: 20MB free, 1GB Pro.

**Auth modes:** Bearer JWT (Supabase session), `x-user-id` header,
`x-anonymous-id` cookie, browser session cookie.

---

### C / Web admin (/admin, hi@raymind.ai only)

Live ops dashboard. Tabs:
- **Overview**, 7 KPI cards (docs / users / views / docs today / docs
  this week / active users 7d / storage MB).
- **Charts**, docs / views / users per day, doc sources bar.
- **Users**, sortable table.
- **Documents**, sortable table with private/shared badges.
- **Activity**, reverse-chronological feed of captures / edits / bundle
  creates.
- **Usage**, total cost USD, calls, in/out tokens, errors. Daily series.
  Top users by spend. Per-action breakdown. Per-provider breakdown.
- **Settings**, AI cascade order + per-provider primary / lite model
  selection. Save invalidates in-memory config cache; changes live
  immediately.

---

### D / Auth handoff pages (/auth/*)

One per channel. Same shell, channel-specific copy after sign-in.
- `/auth/chrome`, Chrome / Edge / Brave extension
- `/auth/safari`, Safari iOS + macOS extension
- `/auth/desktop`, Electron Mac app
- `/auth/vscode`, VS Code extension
- `/auth/mcp`, MCP server / Claude Desktop / Cursor
- `/auth/cli`, terminal CLI

OAuth providers: Google + GitHub + Email magic link + Apple (iOS only).
All routes through `/auth/callback`. The session cookie set on
memory.wiki is then read by the channel's auth-bridge content script
(extensions) or stored locally (desktop / CLI / MCP).

---

### E / Marketing surfaces

- **/about**, Current PureShell narrative. Sections: hero, surfaces
  gallery, framework (Capture to Bundle to Deploy), ecosystem flow,
  9-surfaces grid, primitives (Doc / Bundle / Hub), features grid (16
  items), cross-AI benchmark table, vs vendor-memory comparison,
  roadmap, trust strip, pricing, FAQ. Bilingual (`/about` EN,
  `/ko/about` KO).
- **/plugins**, Channels page. Lists Chrome / Safari / VS Code /
  Desktop / iOS / Android / CLI / MCP / QuickLook with version, size,
  install/store URL pulled from `apps/web/src/lib/channel-versions.ts`
  (the single source-of-truth file, never hardcode versions elsewhere).
- **/benchmark**, Cross-AI deployability table. Same raw URL fed to
  Claude / ChatGPT / Gemini / Cursor; rendered output side-by-side.

---

### F / Chrome extension (apps/chrome-extension, v2.7.6)

**Distribution:** Chrome Web Store
(`chromewebstore.google.com/detail/.../nkmkgmebaeaiapjgmmalbeilggfhnold`).

**Capture surfaces**
- Whole page (Cmd+Shift+E), Readability + html-to-markdown fallback,
  metadata from JSON-LD / OG / Twitter / standard meta. Image extraction
  walks `<picture>`, `srcset`, `data-src`, lazy-load variants. UI-image
  detection drops logos / icons / sprites / pixels.
- Selection (Cmd+Shift+X), highlighted text to standalone doc.
- AI chat scrape, ChatGPT / Claude / Gemini / Perplexity. Range chip
  picks last N turns (All / 1 / 3 / 5). Per-message mini buttons (opt-in
  via Settings "On AI pages" toggle).
- Social, X / Threads per-post inline button on hover.
- GitHub markdown, "Open in memory.wiki" button next to Raw on
  `/blob/*.md` pages.
- Image hover save, per-`<img>` floating button on every site.

**Intent capture (THE flagship)**
"or capture with intent" textarea below the big Capture button. Free-
form instruction goes to `/api/docs/transform` along with the page
markdown. Cycling placeholder rotates example prompts. Site-aware chip
rail below the textarea suggests intents contextual to the active tab
(e.g. "extract code" on GitHub, "TL;DR" on news, "as recipe" on cooking
sites). Chips can be ⭐ pinned (persisted to `chrome.storage.local`) or
✕ dismissed.

**Recent captures**
Last 50 captures, local only. Click to open. "Clear all" button.
New-entry slide-in animation. Reuse-intent icon on rows whose original
capture used an intent prompt.

**Capturing overlay**
Animated morph blob + "Capturing..." to flips to "Captured" with View +
OK buttons when the URL lands. Scoped to popup body (position:absolute,
not fixed) so iPad Safari popover doesn't leak it onto the host page.

**Auth chip**
- Signed-out: full-width "Sign in to memory.wiki" pill in footer.
- Signed-in: avatar + name + "free during beta" plan.
- Sign-out clears `mw-auth-session` from chrome.storage.local AND
  broadcasts `force-signout` to all open memory.wiki tabs (auth-bridge
  expires sb-* cookies in page context, the only path that actually
  drops the Supabase session on Safari Storage Partitioning).

**URL strategy**
- Signed-in: `POST /api/docs` to returns `{id, editToken}` to opens
  `memory.wiki/?from={id}&token={editToken}` to clipboard:
  `Use memory.wiki/{id} as my context.`
- Signed-out: gzip markdown + base64url to `memory.wiki/#md=<payload>`.
  8KB URL cap. Over the cap to clipboard the raw markdown + toast.

**Other**
- Settings page: keyboard shortcut display (Cmd+Shift+E / X), floating-
  button toggle, account chip, link to Chrome's
  `chrome://extensions/shortcuts` for re-binding.
- Footer "Also on" chip rail: QuickLook / iOS / Mac / VS Code / CLI /
  MCP (only when signed in).
- Brand: dark popup (#08080a), Cal Sans display, JetBrains Mono mono.
  Lime (#B5FF1A) reserved for 6–12px dots / badges / icon glyphs only.
- Toolbar icons: 16 / 19 / 32 / 38 / 48 / 128 PNG, full-bleed (no
  internal padding, fills the toolbar slot at every DPI).

---

### G / Safari extension (apps/safari-extension, v2.7.5 build 2)

**Distribution:**
- iOS App Store: live (`apps.apple.com/us/app/memory-wiki/id6774713489`)
 , wait, that's the **native** iOS app. The Safari extension is a
  **separate** App Store record (in review as of 2026-06-14, name
  "memory.wiki Clipper", bundle `wiki.memory.clipper.ios`).
- Mac App Store: separate record "memory.wiki Clipper for Mac",
  bundle `wiki.memory.clipper.mac`, in review.

**Functional parity with Chrome**: identical popup-v25.html + popup-v25.js
+ content scripts + intent capture + recent + capturing overlay + sign-
in chip. The differences are purely platform-driven:

- **Auth bridge** (`auth-bridge.js`): runs in page context at
  `document_start` on memory.wiki tabs. Reads document.cookie for
  `sb-*-auth-token` cookies, decodes Supabase session, relays to
  background via `chrome.runtime.sendMessage`. Background caches as
  `mw-auth-session`. Necessary because Safari Storage Partitioning
  blocks `chrome.cookies.getAll` and credentialed fetch to `/api/me`
  from extension context.
- **Force sign-out** listener (added 2026-06-14): when popup signs out,
  it broadcasts `{action:"force-signout"}` to all memory.wiki tabs;
  auth-bridge runs the cookie + localStorage cleanup in page context
  and immediately pushes a null session to background.
- **Container app onboarding** (Mac + iOS): WKWebView hosts
  `Main.html`, animated blob mark + Cal Sans "memory.wiki Clipper"
  brand + tagline + "Enable in Safari" card with mockup of Safari
  Settings > Extensions panel + 3 steps + big "Quit and Open Safari
  Extensions Settings…" button + live state ("on" / "off" / "unknown").
  Mac window 1280×800 (resizable, centered on first launch).
- **iPad popup width gate**: `popup-v25.js` detects iPad (UA + multi-
  touch + screen width ≥ 600) and adds `html.is-ipad`. CSS only forces
  `min-width: 500px` on iPad, iPhone sheet uses 100%.
- **macOS Safari popup arrow color**: `theme-color #08080a` +
  `color-scheme: dark` meta tags so Safari paints the popover arrow
  dark to match the popup body.
- **Auto-focus suppression**: macOS Safari auto-focuses the first
  focusable element when the popover opens; popup-v25.js force-blurs
  on DOMContentLoaded + RAF + 100ms. Focus-within highlight CSS is
  gated on `body.user-active` (flips on first real
  mousedown/keydown/touchstart) so the popup looks idle on open.

---

### H / iOS native app (apps/ios-native, v1.1 build 1)

**Distribution:** App Store, name "memory.wiki", id 6774713489.

**Five-tab floating capsule bar**
MDs / Bundles / **Start** (animated blob, center) / Capture / Settings.
Double-tap active tab at root to haptic confirmation. Floating glass
isolation strip behind the bar.

**Start (dashboard)**
Time-of-day greeting using display name. Today's pulse strip (captures,
week streak, total memories). Quick actions row (New Capture / Search /
Open hub). Recent memories (6 tiles). Starred memories pinned list.
Featured bundle preview with deploy-URL chip. Per-block stagger entrance.

**Capture**
Six modes: Write / URL / Photo (with OCR) / Voice (dictation) / Import.
Title + body draft with markdown toolbar. Toast banners for each mode.
OCR preview chip with Insert / Discard. Live-transcript banner during
dictation. Sticky processing indicator for long uploads / imports.

**Timeline (MDs)**
Cards grouped by time bucket (Today / Yesterday / This week / This
month / Earlier). Status icons (Cloud / Globe / Users + sync badge).
300ms-debounced semantic search (server) + local title-match filter
(8-result cap). 30s cache, pull-to-refresh. Spotlight indexing.

**Document detail**
Status icon + "Copy for AI" pill (clipboard the canonical AI sentence).
Share button (canonical short URL). Mono URL chip. MarkdownBody render
with syntax highlighting. Inline TOC sheet. Edit mode. Delete (30-day
trash recovery). Add-to-bundle modal. AI panel (ChatSheet) scoped to
the doc.

**Bundles**
Glass card rows. Segmented filter All / Private / Shared / Public.
Bundle detail with deploy URL + access state. 30s cache + pull-to-refresh.

**Profile / Settings**
Hub card with `@<slug>` URL. Copy-for-AI wedge. Hub stats (memory count,
bundle count). Inline edits for email / username / display name.
Appearance / accent picker. Dictation locale picker (KR / EN primary).
Help / About / Legal. Sign out. Version + build.

**Auth**
Apple Sign-In (App Store 4.8 required), Google, GitHub, Email. Staggered
entrance: blob to wordmark to "iOS COMPANION" chip to providers to footer.

**Share extension**
Accepts URL / plain text / Safari JS preprocessor result (title + body).
Forwards to Capture pre-filled. No UI of its own.

**Siri / App Shortcuts intents**
- "Capture a memory" (pre-fill text param)
- "Search Memory.Wiki" (query param to timeline + search modal)
- "Open my Memory.Wiki hub" (opens `@slug` in Safari)

Discoverable in Shortcuts, Spotlight, Siri, Action Button (iOS 16+).

**Brand**
Dark-only. `BrandTokens.generated.swift` from Style Dictionary. Cal Sans
display, Noto Sans body, JetBrains Mono captions/URLs. Sheet chrome
forced dark, 28pt corner radius.

**Offline**
NWPathMonitor banner above tab bar. Cached data readable; saves queued
+ retried on reconnect.

---

### I / Android native app (apps/android-native, v1.0 build 1)

**Distribution:** Google Play, package `wiki.memory.MemoryWiki`, name
"memory.wiki", in review.

**Five-tab bottom nav** mirrors iOS exactly: MDs / Bundles / Start /
Capture / Settings.

**Start**, same shape as iOS. Time-of-day greeting (28pt display).
AI URL strip (mono 9pt label, Copy-for-AI button with sparkles to 1.6s
check swap). Ask-your-hub CTA. Hairline-bordered 3-column pulse row.
Three quick action tiles. Recent + Starred. Featured bundle. Stagger
0.08s per block.

**Capture**, six mode pills: Write / URL / Photo / OCR / Voice /
Import. Title + body BasicTextField pair. Sticky toolbar pill row
above IME (imePadding). Capture-paste deep link integration (clipboard
fill on `RouterEvent.CapturePaste`).

**Timeline / Bundles / Document detail / Settings**, feature parity
with iOS.

**Auth**, same staggered entrance. "ANDROID COMPANION" chip. Provider
stack: Google / GitHub / Email / Apple (52dp glass rows, gradient
stroke, press scale 0.985 + brightness dim).

**App Shortcuts (static, long-press launcher)**
- Capture (`memorywiki://capture`)
- Ask hub (`memorywiki://chat-hub`)
- Search (`memorywiki://search`)
- Paste (`memorywiki://capture-paste`, auto-fills clipboard)

**Google Assistant App Actions**
- CREATE_NOTE to capture
- GET_THING to search

**Quick Settings tile**
Long-swipe to Quick Settings to tap to fast-action capture.

**Share intent** (silent, no UI)
SEND text/plain, SEND image/*, SEND_MULTIPLE image/*. Forwards body +
subject via deep link.

**Widgets**
- `MemoryWikiWidget`, full home screen (quick capture, recent, hub
  stats).
- `MemoryWikiMiniWidget`, compact variant.

**Brand**
Dark-only. `BrandTokens.generated.kt` from Style Dictionary. No
Material You dynamic color (intentional, brand consistency).

---

### J / Desktop (apps/desktop, Electron Mac DMG v2.7.5)

**Distribution:** GitHub Releases DMG. Developer ID signed + notarized.
Mac App Store version is a separate Safari container app (NOT this
Electron app).

**Architecture**
Single Compose host (Electron BrowserWindow). Renderer = web UI bundled
locally (offline-safe). Main process owns AuthManager + SyncEngine +
workspace folder scanning + file watcher + recent files cache.

**Editor & renderer**
TipTap ProseMirror WYSIWYG (Phase B full). markdown-it WASM renderer
matching web. CodeMirror 6 for raw markdown source pane. Split-pane
(left preview / right source or sidebar file list).

**Sidebar**
Filter tabs ALL / SYNCED / LOCAL / CLOUD. Sort: newest / oldest / a-z /
z-a. Cloud search via `/api/search`. Per-file status icon. Recently
visited cache. Workspace folder picker.

**Sync engine**
30s poll, 2s push debounce (per-file mutex), 5-retry offline queue
(persisted to `offline-queue.json`). Yjs CRDT for real-time multi-user
editing. Conflict detection + resolution with `suppressConflictUntil`
guard to prevent edit to remote to merge loops.

**File support**
Text: .md / .markdown / .mdown / .mkd / .txt
Imports: .pdf / .docx / .pptx / .xlsx / .html / .csv / .json

**QuickLook integration**
Detects whether `memory.wiki QuickLook.app` is registered. IPC
`is-quicklook-installed` polls QLSupportedContentTypes. IPC
`open-quicklook-settings` deep-links to Finder System Settings.
Auto-repair on launch (re-registers if missing).

**Theme**
Follows `nativeTheme` (system dark/light follow).

---

### K / QuickLook plugin (apps/quicklook, bundled with Desktop DMG)

**File types:** `.md`, `.markdown` (UTIs `net.daringfireball.markdown`,
`public.markdown`).

**Render stack:**
- marked.js to HTML
- highlight.js to code (190+ languages)
- KaTeX to math
- Mermaid to diagrams
- Vendored `preview.css` mirrors `apps/web/src/app/globals.css`
  `.mdcore-rendered` tokens

**UX**
Space-bar in Finder on any .md to live preview panel. "Open in
memory.wiki" button + copy-code buttons. macOS dark/light auto-follow.

**CLI variant**
`memory-wiki-quicklook file.md [--open] [-o output.html]` generates a
standalone HTML preview from the command line.

---

### L / VS Code extension (apps/vscode-extension, v1.7.0)

**Distribution:** VS Code Marketplace, `raymindai.memory-wiki-vscode`.

**Sidebar TreeView**
Lists cloud docs filtered by state (public / shared / private /
view-only). Folder hierarchy. Star pinning. Bi-directional sync.
Webview-based with real-time refresh.

**Live preview panel**
markdown-it + KaTeX + Mermaid + 190+ language highlighting + GFM.
Local render (no roundtrip).

**Sync engine**
Auto-save on file write when `autoSync` enabled. Configurable interval
10–300s. Conflict resolution queues remote changes during concurrent
edits.

**Commands** (palette + keybindings)
- `memorywiki.publish`, Cmd+Alt+P
- `memorywiki.update`
- `memorywiki.pull`
- `memorywiki.preview`, Cmd+Shift+M
- `memorywiki.export`, Cmd+Alt+E
- AI actions: polish / summary / tldr / translate / chat
- Copy-for-AI

**Status bar**, collaborating peer count + sync indicator.

**Per-workspace config**
`memorywiki.apiBaseUrl` / `.theme` (auto/dark/light) / `.autoSync` /
`.autoPreview` / `.syncInterval`.

**Auth**, `/auth/vscode` OAuth handoff; JWT in secure storage.

---

### M / CLI (apps/cli, npm `memory-wiki-cli` v1.4.3)

**Binary:** `mw`

**Commands**
- `mw publish [file]`, reads stdin if no file; extracts H1 title;
  prints URL + AI-paste sentence. Pipeline-friendly:
  `cat file.md | mw publish`, `pbpaste | mw publish`,
  `tmux capture-pane -p | mw publish`.
- `mw update <id> <file>`, patch using stored edit token from
  `~/.memory.wiki/tokens.json`.
- `mw pull <id> [-o file]`, markdown to stdout or save.
- `mw list`, auth-required.
- `mw open <id>`, open in browser.
- `mw render <file>`, local HTML render.
- `mw login` / `mw logout` / `mw whoami`, auth state.

**Config**
Token in `~/.memory.wiki/config.json`. Respects `MEMORY_WIKI_URL`
(legacy `MDFY_URL`).

---

### N / MCP server (packages/mcp, npm `memory-wiki-mcp` v1.5.4)

**Distribution:** npm. Used by Claude Desktop, Cursor, Windsurf, Codex,
any MCP-aware client.

**22 tools** (the moat, full bidirectional access for AI agents):

| Group | Tools |
|---|---|
| Core CRUD | `mw_create` / `mw_read` / `mw_update` / `mw_delete` / `mw_list` / `mw_search` |
| Sharing & access | `mw_publish` / `mw_set_allowed_emails` / `mw_set_expiry` / `mw_get_share_url` / `mw_for_ai` |
| Content manipulation | `mw_append` / `mw_prepend` / `mw_outline` / `mw_extract_section` / `mw_replace_section` |
| Versions | `mw_versions` / `mw_restore_version` / `mw_diff` |
| Import & duplicate | `mw_duplicate` / `mw_import_url` |
| Folders | `mw_folder_list` / `mw_folder_create` / `mw_move_to_folder` |
| Knowledge graph | `mw_hub_constellation` / `mw_bundle_constellation` |
| Stats & history | `mw_stats` / `mw_recent` |
| Utility | `mw_render_preview` |

**Auth**, JWT via `mw login` (shared with CLI). Env:
`MEMORY_WIKI_BASE_URL`.

**`mw_for_ai`**, generates the canonical "Use memory.wiki/<id> as my
context." sentence. Accepts bare ID, full URL, `b/<id>` for bundles, or
`@<slug>` for hubs. This is the one tool that bridges everything.

---

## Part 3 / Cross-surface feature matrix

| Capability | Web | Chrome | Safari iOS | Safari Mac | iOS native | Android | Desktop | QuickLook | VS Code | CLI | MCP |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Capture web page |, | ✓ | ✓ | ✓ | URL paste | URL paste | URL paste |, |, | URL via API | `mw_import_url` |
| Capture AI chat |, | ✓ | ✓ | ✓ | Share sheet | Share intent | Paste |, |, | Paste |, |
| Capture social post |, | ✓ | ✓ | ✓ | Share | Share | Paste |, |, | Paste |, |
| Capture selection |, | ✓ | ✓ | ✓ | Share | Share | Paste |, |, | stdin |, |
| Capture image |, | ✓ hover | ✓ hover | ✓ hover | Photo + OCR | Photo + OCR | Drag-drop |, |, |, |, |
| Capture voice |, |, |, |, | ✓ dictation | ✓ dictation |, |, |, |, |, |
| Intent capture (AI transform) |, | ✓ | ✓ | ✓ | Doc-level AI panel | Doc-level AI panel | Editor AI |, | Palette AI |, | `mw_update` after generate |
| Recent captures | ✓ /user/recent | ✓ local | ✓ local | ✓ local | Timeline | Timeline | Sidebar |, | Sidebar |, | `mw_recent` |
| Hub view | ✓ /@slug | Footer link | Footer link | Footer link | Open in Safari | Open hub |, |, |, |, | `mw_hub_constellation` |
| Bundle view | ✓ /b/id |, |, |, | Bundles tab | Bundles tab | Sidebar |, | Sidebar |, | `mw_bundle_constellation` |
| Sign in | OAuth + email | Chip to /auth/chrome | Chip to /auth/safari | Chip to /auth/safari | Apple/Google/GH/Email | Google/GH/Email/Apple | OAuth |, | OAuth | `mw login` | `mw login` |
| Sign out (drops session) | ✓ | ✓ | ✓ (force-signout) | ✓ (force-signout) | ✓ | ✓ | ✓ |, | ✓ | `mw logout` |, |
| Offline mode |, | URL hash fallback | URL hash fallback | URL hash fallback | ✓ NWPath | ✓ | ✓ offline queue | ✓ (read-only) | partial |, |, |
| Real-time collab | ✓ Yjs |, |, |, |, |, | ✓ Yjs |, | peer count |, |, |
| AI chat with hub | ✓ |, |, |, | ChatSheet (doc) | (doc-level) | (doc-level) |, | (doc-level) |, | (read tools) |
| Cross-AI URL | ✓ /raw | ✓ Use as my context | ✓ | ✓ | ✓ Copy-for-AI | ✓ Copy-for-AI | ✓ | "Open in memory.wiki" | ✓ Copy-for-AI | ✓ paste-friendly | `mw_for_ai` |
| Keyboard shortcuts |, | ⇧⌘E / ⇧⌘X | (system) | ⇧⌘E / ⇧⌘X | Shortcuts app | Long-press |, |, | Cmd+Alt+P, ⇧⌘M | (terminal) |, |
| Brand tokens source | globals.css | (web tokens) | (web tokens) | (web tokens) | BrandTokens.swift | BrandTokens.kt | nativeTheme + globals | preview.css | (theme inherit) |, |, |

**Parity gaps to close** (visible from the matrix):
1. **Voice capture**, only on iOS / Android. Could add to Desktop via
   system dictation.
2. **Hub view in extensions**, only footer link. Could deep-link to a
   hub-aware popup mode when the active tab is `@<slug>`.
3. **Real-time collab**, only Web + Desktop. iOS / Android / VS Code
   show last-saved.
4. **AI chat with hub**, only Web. Native apps + Desktop scope chat to
   the current doc, not the hub.
5. **MCP write tools**, every other channel can write docs; MCP also
   can, but Cursor / Claude Desktop users may not realize.

---

## Part 4 / Messaging alignment

### 4.1 Canonical terms (use these exact words)

| Concept | Canonical | Don't say |
|---|---|---|
| The product | memory.wiki | mdfy, mdcore, Memory.Wiki, Memory Wiki, memorywiki |
| The browser clipper | memory.wiki Clipper | Clipper, mwClipper, memory.wiki Chrome, memory.wiki for Safari |
| The native iOS app | memory.wiki (iOS app, id6774713489) | memory.wiki Native, memory.wiki Mobile |
| The native Android app | memory.wiki (Android app) |, |
| The Electron app | memory.wiki Desktop | memory.wiki for Mac (that's the Safari container) |
| A single document | Doc | document, note, memo, file |
| A multi-doc collection | Bundle | collection, folder, pack |
| A personal wiki | Hub | profile, page, wiki, knowledge base |
| The 8-char URL | the doc URL / `memory.wiki/<id>` | shortlink, share link |
| The mono one-liner you paste into ChatGPT | "Use memory.wiki/<id> as my context." | Copy this link, Share to AI |
| The animated mark | the blob | the icon (use "the blob" when you mean the morphing SVG specifically) |

### 4.2 Voice & typography rules

- No middle-dot (the centered dot), em-dash (the long dash), arrow (the right-pointing arrow), or emoji in product UI.
  Use slash `/`, comma, parens, or whitespace instead.
- Cal Sans always at `letter-spacing: 0`.
- Lime `#B5FF1A` is reserved for 6–12px dots / badges / icon glyphs.
  Never as button background, overlay, headline, or section eyebrow.
- "memory.wiki" is lowercase in body copy. "memory.wiki Clipper" stays
  lowercase too. App Store titles can use TitleCase when the platform
  forces it.
- Verbs are present tense: "captures", "deploys", "renders", not
  "captured", "will deploy", "is able to render".

### 4.3 Three-line elevator pitch (recyclable)

> **Capture from any AI chat, any web page, any thought.**
> **Bundle by topic into a knowledge graph.**
> **Deploy as a URL that any AI reads.**

Use this in store listings, /plugins, /about hero, README, and the
extension popup signin blurb.

---

## Part 5 / /about page restructure proposal

**Current /about problem**: Tries to do too much in one scroll, hero,
9 surfaces, primitives, benchmarks, comparison table, pricing, FAQ.
Reads like a feature list, not a story. New visitors bounce because
they don't get "what is this in 5 seconds."

**Proposed new IA** (top-to-bottom):

1. **Hero, what it IS, in 8 words**
   > Capture anywhere. Bundle by topic. Deploy to any AI.
   - CTA: "Try it free" to web editor
   - Sub-CTA: "Get the Clipper" to /plugins#chrome

2. **Live demo strip, show, don't tell**
   - Animated 4-second loop: browser to click Clipper to intent typed  to 
     memory.wiki URL opens to URL pasted into Claude chat to Claude reads
     the page. Same URL also shown in ChatGPT side-by-side.
   - Caption: **"One capture. Every AI reads it."**

3. **Three primitives** (the URL architecture is the brand)
   - Doc, `memory.wiki/<id>`, single page or thought.
   - Bundle, `memory.wiki/b/<id>`, multi-doc knowledge graph.
   - Hub, `memory.wiki/@<slug>`, personal wiki.
   - Each shown as a card with a real example URL the visitor can click.

4. **Capture surfaces, where it lives**
   Grouped, not 9-up grid:
   - **Browser**, Chrome / Safari extensions (one card, two store links)
   - **Mobile**, iOS / Android (one card, two store links)
   - **Desktop**, Mac DMG (Electron) + Mac App Store (Safari container)
   - **AI agents**, MCP server (Claude Desktop, Cursor, Windsurf,
     Codex) + CLI (`mw publish`)
   - **Editor**, VS Code extension + browser editor at memory.wiki
   - **Finder**, QuickLook preview (Space bar)

5. **Cross-AI proof**, the benchmark table stays, but headline becomes:
   > **The same URL. The same payload. Every AI.**
   Same `/raw/<id>` fed to Claude / ChatGPT / Gemini / Cursor /
   Perplexity. Rendered output side-by-side. No fork, no per-AI
   adapter.

6. **What the AI sees**, show the `/raw/<id>` page. Surfaces the
   YAML frontmatter + body + context block. The brand's secret weapon
   is that this is **just markdown**, no proprietary format.

7. **Versus vendor memory**, comparison table:
   |  | memory.wiki | ChatGPT Memory | Claude Projects | Notion |
   |---|---|---|---|---|
   | Portable across AIs | ✓ | ✗ | ✗ | ✗ |
   | Owned by user | ✓ | ✗ vendor | ✗ vendor | ✓ |
   | URL-addressable | ✓ | ✗ | ✗ | ✓ |
   | AI-readable as markdown | ✓ /raw | ✗ | ✗ | ✗ (paywalled API) |
   | Auto-captured on the way out | ✓ | ✗ user must save | ✗ | ✗ |

8. **Trust strip**
   - Open source (link to repo)
   - No login required for first capture (anon hash URL)
   - URLs are permanent (never expire, pricing memory backs this)
   - Cross-AI inheritance is the guarantee, not a feature

9. **Pricing**, Free during beta, Pro later. Repeats the no-expiry
   promise.

10. **FAQ**, keep, but trim to 6 high-intent questions:
    - Do I own my data?
    - Does it work with ChatGPT / Claude / Cursor / Gemini?
    - What happens to URLs if I stop paying?
    - Can I import from Notion / Obsidian / Roam?
    - Is the editor required? (No, capture-only flows are valid.)
    - What's a Bundle vs a Hub?

11. **Footer**, channel rail (every distribution channel as a chip with
    version + size, pulled from `channel-versions.ts`).

**Removed from current /about:**
- 16-item features grid (overwhelms; moves to /plugins channel pages)
- Roadmap (lives in `docs/ROADMAP.md` + tracked in admin only)
- 9-surfaces literal grid (replaced by 6-grouped capture surfaces above)

**Tone**:
- Less "look at all these features"
- More "here's what you can do today, in 60 seconds"
- The benchmark and primitives sections are the moat, keep them
  prominent. Everything else supports them.

---

## Part 6 / Marketing strategy

### 6.1 Positioning (one sentence)

**"memory.wiki is the personal knowledge layer that every AI inherits
the moment you paste a URL."**

What this kills:
- Notion-as-AI-memory (Notion's AI is bound to Notion's surface)
- ChatGPT Memory / Claude Projects (vendor-locked, not portable)
- Bookmark managers (no AI consumption)
- "Save for later" apps (no AI deployment)
- Local markdown editors (not URL-addressable)

What this competes with directly: **none head-on**. memory.wiki sits
between "AI memory I can't move" and "files I can move but no AI
reads", the only product whose URL is both human-browsable and
AI-deployable.

### 6.2 Three growth loops to ship

**Loop 1, Capture viral (built into extensions)**
- Every clipped doc page footer carries: "Captured with **memory.wiki
  Clipper**" with chip link to /plugins.
- Every `/raw/<id>` response includes a footer line in the context
  block: `Generated by memory.wiki, capture with the Chrome extension
  or `mw publish` from your terminal`.
- The AI sentence "Use memory.wiki/<id> as my context." IS the viral
  unit, every time a user pastes it into Claude / ChatGPT, the URL
  goes into AI training-set telemetry too.

**Loop 2, Hub-as-portfolio (built into hubs)**
- Hub URLs `memory.wiki/@<slug>` are public-by-default and indexable.
- Hub OG image shows avatar + doc count + concept count to social-share
  friendly.
- Targeted at builders, researchers, indie hackers, anyone with a
  Twitter / LinkedIn / personal site link to their work.

**Loop 3, AI agent integration (built into MCP)**
- Cursor / Windsurf / Codex / Claude Desktop install the MCP server  to 
  the agent can READ + WRITE to memory.wiki autonomously.
- Use case: "Cursor saves every README it reads into your memory.wiki
  hub." Or: "Claude Desktop drafts a memo and publishes the URL back
  to itself the next session."

### 6.3 Channel-by-channel playbook

| Channel | Audience | Wedge message | Asset |
|---|---|---|---|
| Twitter / X | AI builders, indie hackers | "Stop re-explaining context to every AI. One URL, every AI reads it." | 30-second loop GIF: chip click to URL to paste into 3 different AIs. |
| Hacker News | engineers, devtools enthusiasts | Show HN: memory.wiki, paste this URL into any AI as your context. | /benchmark page + open-source repo + MCP support. |
| Product Hunt | productivity nerds | "Your knowledge hub for the AI era." | Featured channel: Chrome ext + iOS app + Mac app launches all stacked. |
| Reddit r/ChatGPT, r/ClaudeAI, r/LocalLLaMA | power users | "I built a thing that lets me carry context between Claude and ChatGPT." | Bare-bones post linking /benchmark; no marketing fluff. |
| LinkedIn | knowledge workers, PMs | Hub-as-portfolio angle. "My memory.wiki is my AI-readable resume." | Founder hub as the proof. |
| Designer / dev Twitter | brand-conscious folks | The animated blob + brand polish. Aesthetic as the wedge. | Brand kit assets + the /about page itself as a portfolio. |
| Newsletter sponsorships | TLDR, Bytes, etc. | "Bookmarks are for browsers. memory.wiki is for AIs." | One-line CTA with the extension link. |
| AI Dev communities (Cursor / Claude Discord / Windsurf) | agentic dev users | MCP-first pitch. Live demo: Cursor reads/writes memory.wiki autonomously. | Setup video + 1-min MCP install guide. |

### 6.4 Launch sequence (12 weeks, ending late August 2026)

(Aligns with `v6_12week_plan_state` memory, all twelve weeks landed on
v6 branch by 2026-05-05; public flip held for end of August 2026.)

- **W -4 to -1 (now)**, finish all submissions:
  - iOS native (live)
  - iOS Safari Clipper (in review)
  - Android (in review)
  - Mac App Store Safari Clipper (in review)
  - Chrome Web Store 2.7.6 (in review)
- **W -3**, `/about` page restructure ships per Part 5 above.
- **W -2**, `/benchmark` page polished. Three demo videos recorded
  (capture to paste / Hub portfolio / MCP autonomous).
- **W -1**, soft launch to friends + Twitter circle, gather feedback,
  fix top 3 bugs.
- **W 0 (Aug 27, 2026, Wednesday)**, public flip:
  - Show HN
  - Product Hunt launch (book a Tuesday slot)
  - Founder Twitter thread + LinkedIn post
  - r/ChatGPT + r/ClaudeAI cross-post
  - Press: TLDR sponsorship, Bytes sponsorship
- **W +1 to W +4**, community engagement, MCP-focused content (Cursor
  + Claude Desktop demos), targeted Reddit replies, top hubs as case
  studies.
- **W +6**, Pro pricing turn-on (free during beta ends).
- **W +8 to +12**, partnership outreach (Anthropic / OpenAI dev
  relations, Cursor / Windsurf integrations as featured installs).

### 6.5 What NOT to do

- **Don't lead with "AI memory."** Vendor memory ate that phrase.
  Lead with "URL any AI reads."
- **Don't show the editor as the hero.** The editor is fine, but the
  hero is the capture to URL to AI chain. Showing the editor first
  makes it look like another Notion clone.
- **Don't claim "the best for X."** Claim "the only one that does Y
  across N AIs." Specific facts beat superlatives.
- **Don't write blog posts pre-launch.** Write demos. Every demo links
  to a live `/raw/<id>` the reader can copy-paste.
- **Don't bundle the Pro tier with the launch.** Free-for-now keeps the
  signup friction at zero. Pricing turns on when DAU stabilizes.
- **Don't run paid ads before W+6.** Organic loops first, paid
  re-amplification of what already worked.

### 6.6 KPIs to watch

- **Captures / day**, primary product KPI. 1k/day at W+4 is the
  internal goal.
- **Unique users who pasted a URL into an AI**, the moat KPI. Tracked
  via the AI sentence clipboard event + downstream UA on `/raw/<id>`
  fetches (Claude / ChatGPT bot UAs).
- **Hubs with ≥ 5 docs**, engagement KPI. Hub = retained user.
- **MCP installs**, agent integration KPI. Tracked via npm download
  stats.
- **Cross-AI fetch ratio**, `/raw/<id>` hits broken down by AI bot UA.
  Healthy = no single AI > 60% of fetches.

---

## Part 7 / Maintenance

When any channel ships a new feature OR changes copy:
1. Update its section in **Part 2** above.
2. Update the matrix in **Part 3** if a parity gap closes / opens.
3. Update the canonical terms in **Part 4.1** if a name changes.
4. If the change touches /about, update **Part 5**.
5. If the change opens a new growth angle, add to **Part 6.3**.

The doc is dated `2026-06-14` in the title. Re-date when a substantial
revision lands.

**File locations referenced** (for future-self / collaborators):
- Web: `apps/web/src/app/**`
- Web tokens: `apps/web/src/app/globals.css`
- Channel versions: `apps/web/src/lib/channel-versions.ts`
- Chrome ext: `apps/chrome-extension/**`
- Safari ext: `apps/safari-extension/memory.wiki Clipper/**`
- iOS: `apps/ios-native/**`
- Android: `apps/android-native/**`
- Desktop: `apps/desktop/**`
- QuickLook: `apps/quicklook/**`
- VS Code: `apps/vscode-extension/**`
- CLI: `apps/cli/**`
- MCP: `packages/mcp/**`
- Design tokens source: `design-tokens/**`
- Canonical brand wiki: <https://memory.wiki/L2SHNVir>
