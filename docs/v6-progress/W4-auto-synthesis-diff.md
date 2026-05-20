# W4: auto-synthesis with diff/accept (exceed move 1)

**Commit.** `31f17041`. *W4: auto-synthesis with diff/accept (first
exceed move)*

## Why this is "exceed"

Karpathy's LLM-Wiki pattern can only **regenerate** wiki pages. Every
refresh blows away the previous version with no review surface. memory.wiki
lets the owner see a line-level diff between the existing synthesis
and the model's proposed update, then accept or reject as a whole.
This is the first capability memory.wiki ships that's structurally outside
what the source pattern covers.

## What shipped

### Backend

- **New `wiki` synthesis kind** in `lib/synthesize.ts` alongside the
  existing memo / faq / brief kinds. Prompt asks for cross-references,
  inline citations (`[doc-N]`), and per-doc provenance summaries. When
  the user has customized `MDFY.md` (W3d), the schema is injected into
  the system prompt so the LLM honors their tone / topic / lint
  preferences.

- **Auto-synthesis on bundle creation.** Next.js 15 `after()` keeps the
  function alive past the response so the synthesis call survives. The
  synthesis is persisted as a normal `documents` row with
  `compile_kind = "wiki"` and `source = "auto-synthesis"`. Authenticated
  users only. Anonymous bundles still work, they just don't get
  auto-synthesis.

- **Preview mode** on `/api/docs/[id]/recompile`. Pass `?preview=1` and
  the route synthesizes but doesn't save, returning both
  `currentMarkdown` and `proposedMarkdown` so the client can render a
  diff. Without the flag the existing direct-overwrite behavior is
  preserved (memo/faq/brief still use it).

### Diff library

`lib/markdown-diff.ts` wraps `jsdiff`'s `diffLines` with CRLF
normalization and forced trailing newlines (jsdiff treats unterminated
final lines as part of the previous line, which collapses pure-add /
pure-remove cases into a single replace hunk). Returns
`DiffSummary { lines, added, removed, totalLines, identical }`.

### UI

`components/SynthesisDiff.tsx` is a full-screen overlay that:

1. Calls the preview endpoint with the doc's auth credentials.
2. Renders the result as an inline diff (added green / removed red
   strikethrough / equal neutral, with `+`, `−`, ` ` gutter).
3. On Accept, PATCHes `/api/docs/[id]` with `proposedMarkdown` and
   notifies the parent so the active editor refreshes.
4. On Reject (or close), simply unmounts.

The "Update synthesis" button on compiled docs (replaces the previous
"Recompile") opens this overlay.

## Files

| Path | Role |
|------|------|
| `apps/web/src/lib/synthesize.ts` | New `wiki` kind + schema injection |
| `apps/web/src/app/api/bundles/route.ts` | Auto-synthesis on create via `after()` |
| `apps/web/src/app/api/docs/[id]/recompile/route.ts` | `?preview=1` mode |
| `apps/web/src/lib/markdown-diff.ts` | Line-level diff with normalization |
| `apps/web/src/components/SynthesisDiff.tsx` | Diff/accept overlay |
| `apps/web/src/components/MdEditor.tsx` | Toolbar button + state wiring |
| `apps/web/scripts/test-markdown-diff.ts` | 13 unit tests |

## Verified

- `pnpm --filter web test:diff` runs 13/13 pass (identical, pure addition,
  pure removal, mixed change, CRLF normalization, empty-current).
- `pnpm --filter web test:share` runs 56/56 still pass.
- `pnpm --filter web test:bookmarklet` runs 30/30 still pass.
- Live E2E on staging:
  - Created a 2-doc bundle from yc-demo content.
  - Auto-synthesis appeared in 13 seconds with `compile_kind=wiki`,
    `source=auto-synthesis`, AI-generated title.
  - `POST /api/docs/<id>/recompile?preview=1` returned both
    `currentMarkdown` (2385 chars) and `proposedMarkdown` (2359 chars)
    with meaningful content variation between runs.

## Deferred

- **Per-paragraph accept** vs whole-document accept. Current overlay
  accepts or rejects the entire proposal. Per-block accept is a
  follow-up post-launch.
- **Stale-synthesis indicator.** When a source doc updates after the
  synthesis was compiled, surface a *"sources changed → preview update"*
  hint on the synthesis doc. Currently the user has to click Update
  Synthesis to find out.
- **Background re-synthesis** when a source doc is edited. Right now
  the user manually triggers updates.
