# W10: `/memory.wiki` for Codex + Aider · time-traveling hub · two-door landing draft

**Commit.** `d8e9e0f4`. *W10: /memory.wiki for Codex+Aider, time-traveling hub, two-door landing draft*

## `/memory.wiki` for Codex CLI + Aider

### What ships

`public/skills/memory.wiki/agent-prompt.md` is a generic agent prompt that
documents the same three actions as W8/W9 — capture, bundle, hub —
in a tool-agnostic shape. Wrapped in `<!-- memory.wiki:start -->` /
`<!-- memory.wiki:end -->` markers so installers can replace just the
Memory.Wiki block when rerun.

`install.sh` gained two new `--target` branches:

- `--target=codex` appends the agent prompt to
  `~/.codex/AGENTS.md`. If a previous Memory.Wiki block is already there,
  a Python regex replaces just that block in place — the rest of
  the user's AGENTS.md is preserved. If AGENTS.md exists with no
  Memory.Wiki block, the prompt is appended; if it doesn't exist, the
  prompt is the new file.
- `--target=aider` drops the agent prompt at
  `~/.aider/conventions.md`. The post-install hint tells the user
  to add `read: ~/.aider/conventions.md` to their `.aider.conf.yml`.
  No idempotency hack needed — a global conventions file is
  whole-file write.

`/install` page now has four side-by-side sections (Claude Code,
Cursor, Codex CLI, Aider) — each with its own one-liner.

### Verified

- `/skills/memory.wiki/agent-prompt.md` served. 1981 bytes, HTTP 200.
- `--target=codex` first run: appends Memory.Wiki block, AGENTS.md = 51
  lines.
- `--target=codex` rerun against an AGENTS.md that already has user
  content + Memory.Wiki block: user's first 5 lines preserved verbatim,
  Memory.Wiki block replaced in place, exactly one `memory.wiki:start` and one
  `memory.wiki:end` marker remain.
- `--target=aider` writes `~/.aider/conventions.md` (51 lines).
- Unknown target rejected with "Supported targets: claude, cursor,
  codex, aider" and exit 2.
- `/install` page shows Codex CLI 4×, Aider 6×, conventions.md 4×,
  AGENTS.md 4×, target=codex 2×, target=aider 2×.

### Files

| Path | Role |
|------|------|
| `apps/web/public/skills/memory.wiki/agent-prompt.md` | Tool-agnostic agent prompt |
| `apps/web/public/skills/memory.wiki/install.sh` | Multi-target installer (claude, cursor, codex, aider) |
| `apps/web/src/app/install/page.tsx` | Landing with all four editor sections |

## Time-traveling hub

### What ships

`/hub/<slug>` accepts an optional `?at=<ISO date or timestamp>`
query param. When set, the hub query filters docs and bundles by
`created_at <= at`, so visitors see only what existed by that
moment. A banner at the top reports the cutoff and the resulting
counts, with a "Back to now" link that drops the query.

Implementation details:

- `parseAt()` accepts plain `YYYY-MM-DD` (resolved to end-of-day
  UTC) or any ISO timestamp. Future timestamps and unparseable
  values fall back to the live view — the banner doesn't render at
  all in those cases.
- The "this week" stat uses the time-travel anchor as its origin,
  so the recent panel shows docs whose `updated_at` lies in the
  7 days *before* the anchor.
- Empty state copy adapts: at the live view it stays the existing
  *"This hub doesn't have any public documents yet."*; under
  `?at=`, it reads *"No public docs or bundles existed in this
  hub on YYYY-MM-DD."*
- `generateMetadata` returns `robots: noindex, nofollow` whenever
  `?at=` parses to a valid date, so derived views don't pollute
  search.

### Caveats (deferred to versioning work)

Document content rendered at `?at=` is the *current* markdown,
not the markdown as it stood on that date. The filter only hides
docs/bundles created later. Per-doc snapshots already exist in
`document_versions`, so a true time-machine view is a follow-up,
not a v1 deliverable.

### Verified live on yc-demo

- `?at=2026-05-04` (the day yc-demo seed data was created): 23
  docs, 3 public bundles, banner shows "Hub as of 2026-05-04 — 23
  docs and 3 bundles that existed by then."
- `?at=2026-04-15`: 0 docs, banner reads correctly, empty-state
  copy is the time-travel variant.
- `?at=2025-01-01`: same, empty-state copy still time-travel.
- `?at=2099-01-01` (future): banner suppressed, live counts (23
  docs / 3 bundles) shown.
- `?at=garbage`: banner suppressed, live counts shown.

### Files

| Path | Role |
|------|------|
| `apps/web/src/app/hub/[slug]/page.tsx` | `?at=` parsing, query filter, banner, anchor-aware "recent" |

## Two-door landing draft

### What ships

`/v6-landing` (server component, `noindex`) is the draft of the
v6 launch landing. The structure:

- **Hero**: "Two doors. One hub." with one-line frame.
- **Door 1 — every LLM user**: *"Your AI memory, owned by you."*
  Anchors capture-from-anywhere → permanent URL → claim-on-signin.
  CTA drops the visitor at the live editor (`/`).
- **Door 2 — power users**: *"An LLM-maintained personal wiki."*
  Anchors auto-synthesis, semantic bundles, lint pass. CTA links
  to `/install` for the `/memory.wiki` skill.
- **Same actions, both doors**: a 3-card strip showing
  `/memory.wiki capture`, `/memory.wiki bundle`, `/memory.wiki hub` so each door knows
  the underlying surface is the same.
- **Why this matters**: one-paragraph framing — vendor memory
  layers are racing to own context inside walls; Memory.Wiki is the bet
  that the public URL is the universal context format.

It lives at `/v6-landing` because the live `/` is still the
editor. Switching the home route is a separate decision —
intentionally deferred until copy is signed off.

### Verified

- `GET /v6-landing` → 200, 53 740 bytes.
- All seven section headlines render verbatim.
- All three `/memory.wiki …` action codes render.
- `<meta name="robots" content="noindex,nofollow">` is in the head.

### Files

| Path | Role |
|------|------|
| `apps/web/src/app/v6-landing/page.tsx` | Two-door landing draft (noindex) |

## Test status

`test:share` 56/56, `test:bookmarklet` 30/30, `test:diff` 13/13
all still pass. No new test suite — Codex/Aider install paths are
shell branches verified by the live install harness above; the
hub `?at=` and v6-landing routes are verified by curl smoke
tests against the live yc-demo data.

## Deferred

- **Per-doc time-machine**. Render `?at=` content from the
  `document_versions` snapshot closest to the cutoff so the body
  matches the period, not just the doc set. W11+ work.
- **Time-travel on the graph view**. `/hub/<slug>/graph?at=` would
  need to filter the precomputed graph the same way; skip semantic
  edges that depend on docs created later. Easy follow-up once
  someone asks.
- **Two-door landing → live**. Copy is in place at `/v6-landing`
  but no decision yet on whether the editor moves to a sub-route
  (e.g. `/new`) at launch.
