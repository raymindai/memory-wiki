# Changelog

All meaningful work on this repo, grouped by release. Per-package
versions advance independently (`packages/mcp`, `apps/web`,
`apps/desktop`, `apps/vscode-extension`, `apps/cli`,
`apps/chrome-extension`) — the repo-wide tag below marks the
synchronized snapshot they shipped from.

Format roughly follows [Keep a Changelog](https://keepachangelog.com/).

---

## [v6.1.0] — 2026-05-17

Repo tag pins:
`packages/mcp@1.5.0`, `apps/web@1.1.0`.

### Added

#### LLM-facing payload + MCP surface
- **Hub digest gains a real concept map.** `/raw/hub/<slug>` now
  surfaces per-concept `Related:` lines (typed edges from
  `concept_relations`), per-concept `In bundles:` lines (which
  bundles contain the supporting docs), and a `## Concept relations`
  section with the top-20 highest-weight edges. Brings the LLM
  markdown payload up to parity with what the galaxy view already
  showed.
- **`?since=YYYY-MM-DD`** on hub digests — filters concepts to those
  born after the date. Lets agents ask "what's new in this hub since
  last month?".
- **`mdfy_hub_constellation` MCP tool** — returns the user's whole
  hub as a structured graph (nodes + typed edges + doc clusters).
  Caps concepts by weight, strips dangling edges so every reference
  resolves.
- **`mdfy_bundle_constellation` MCP tool** — same shape, scoped to
  one bundle. Returns the user's hub-level ontology sliced to the
  bundle's docs, complementing `/raw/bundle/<id>`'s graph_data
  narrative.
- **`GET /api/bundles/[id]/constellation`** — the web endpoint that
  backs `mdfy_bundle_constellation`. Public bundles served without
  auth, drafts owner-only.

#### Editor — AI everywhere
- **AI on selection (Tiptap toolbar).** ✨AI button in the selection
  toolbar opens a popup with a free-form prompt input at the top
  (Enter to send) and Polish / Shorten / Expand quick actions + a
  Translate submenu with eight languages. Selection range is stashed
  across focus loss so the popup's input field can take focus
  without losing the target.
- **Compact (full document).** New AI action that halves the
  document length while keeping every heading, code block, table,
  math expression, and diagram intact.
- **Selection preview** — popup top shows what the AI is about to
  act on, since opening the popup hides the native selection
  highlight.
- **Per-language busy state** — only the clicked language's button
  spins, not all of them.

#### Bundle + Hub UX
- **Inline-rename bundle title** — hero `<h1>` is contentEditable for
  owners. Enter / blur commits via `PATCH /api/bundles/[id]`,
  Escape reverts.
- **Layout-aware loading skeleton** for bundles — mirrors the
  eventual frame (List → Contents rail + doc column, Overview →
  hero) so the swap to real content doesn't read as a layout shift.
- **Collapsible Contents column** in the List view — mirrors the
  Library rail. Preference persists to `localStorage`.
- **Auto-analyze single-doc bundles.** Threshold dropped from `>= 2`
  docs to `>= 1` (owner-only). Founders adding docs one at a time
  no longer hit the "feature looks broken" state.
- **Floating toolbar AI integration also reaches the legacy editor.**
- **Hub + Bundle "How to use" panel** matches the canvas's tab
  style — flat text, 2px accent underline on the active tab, no
  chip backgrounds. Applies to both the tool picker (Claude /
  ChatGPT / …) and the Compact / Full row.

#### Imports
- **URL import SSE progress.** `/api/import/url` streams stage /
  done / error events so the importer UI shows actual progress
  instead of a spinner.
- **YouTube handler** — `mdfy_import_url` now detects YouTube URLs
  and extracts the title, channel, and transcript. Includes:
  - Android innertube fallback (works from residential IPs).
  - Optional `SUPADATA_API_KEY` env var path (works from Vercel
    datacenter IPs).
  - Honest fallback message linking to
    [youtubetranscript.com](https://youtubetranscript.com) when
    every server-side path is bot-walled.
- **Parallel image rehost** — concurrency 8, per-image timeout,
  cap of 60 images. Fixes large-page imports timing out.
- **Auto-open** the imported doc after success.

#### Background extraction queue (A1)
- **Persistent `extraction_jobs` queue** replaces process-local
  `after()` fire-and-forget for ontology / bundle-graph /
  embedding work. Failures retry with exponential backoff, cron
  worker (`/api/jobs/run` every minute) sweeps stale rows, status
  surfaces in the Hub Compact CTA (Building... / Failed —
  Retry).
- **30-minute per-doc cooldown** — regression from the queue
  migration restored; an autosave-heavy doc no longer burns LLM
  budget every 5 seconds.

#### Docs
- **[docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md)** — ground-up
  explanation of how mdfy is structured for LLM consumption.
  Covers the four data parts, three URL shapes (doc / bundle /
  hub × Compact / Full), URL-fetch vs MCP entry routes, lifecycle
  of a new doc and a new bundle, the galaxy as "the same graph
  rendered for eyes", trust / staleness signaling, and a glossary.

### Fixed

- **Duplicate deleting source.** Clicking "Duplicate" on an MD in
  the sidebar was removing the original from the tab list. Root
  cause was server-side: `POST /api/docs` recomputes `title` from
  the markdown's H1, so even though the client sent
  `title="X (copy)"`, the server stored `title="X"` and the dedup
  helper matched the original. Three-part fix: splice "(copy)"
  into the body H1 too, surface a `deduplicated` flag from the
  create-document hook, tighten the post-create dedup filter so it
  only ever strips unattached drafts.
- **AI action results not showing up in Live tab.** `handleAIAction`
  was updating React state + the source-view CodeMirror but missing
  the imperative `tiptapRef.current?.setMarkdown` call. Affected
  every doc-level AI action (Compact, Polish, Translate, Summary,
  TL;DR, chat).
- **Translate selection split paragraphs.** Markdown-it's `<p>`
  wrapper was kept for multi-sentence single-paragraph
  translations because the old regex only checked for `\n`.
  Replaced with DOM-parse logic that unwraps any single-`<p>`
  result while preserving inline `<strong>` / `<em>` / `<a>`.
- **Embed chip silently failed.** Hash-unchanged skips and 4xx /
  5xx responses returned no feedback; clicking the chip looked
  like a no-op. Now toasts on every outcome and surfaces the
  existing `embedding_updated_at` on skip so the chip stops
  reading "Not yet" for bundles that are in fact embedded.
- **Stale cache paint on bundle reopen.** Cached snapshots up to N
  seconds old were painting with empty meta until the background
  refresh landed (~2-3s of visible "Updated info missing"). Cache
  paint now used only when ≤ 30 s old; otherwise the spinner holds
  until the fresh response arrives.
- **`Math.max(-Infinity)` crash potential** when every member doc
  lacked `updated_at` — rewrote `lastUpdatedAt` computation
  defensively.
- **Prefer-const build break** that took Vercel down briefly.
- **`Open in browser`** in the bundle hero was redundant with the
  URL card directly below — removed.

### Changed

- **Selection toolbar lives in the right component now.** The
  earlier "✨AI on selection" work touched `FloatingToolbar.tsx`
  which had already been replaced by `SelectionToolbar` inside
  `TiptapLiveEditor`. Moved the implementation to where the editor
  actually mounts it; deleted the dead file.
- **MdEditor lint pass** — 40 warnings → 9, leftover 9 are
  `react-hooks/exhaustive-deps` that need per-case judgment.

### Notes

- YouTube transcripts are blocked at every free server-side path
  from Vercel's IP range (ANDROID / IOS / TVHTML5 all return
  `LOGIN_REQUIRED`). The fallback message links to a one-click
  transcript helper. Setting `SUPADATA_API_KEY` in Vercel env
  switches to a hosted bypass; opting in is a founder decision.
- Demo seed migrations 036–039 + their `_demo_*_generator.py`
  companions landed in the repo (per the file headers, they
  contain UUID placeholders and are applied manually via the
  Supabase dashboard, not auto-run by `db push`).

---

## Older history

Pre-v6.1.0 history lives in `git log`. Tags `v2.0.0` / `v2.1.0`
mark earlier mdcore-era releases.
