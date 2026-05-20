# W9: `/memory.wiki` for Cursor + hub-level graph view

**Commit.** `6e46b47a`. *W9: /memory.wiki for Cursor + hub-level graph view*

## `/memory.wiki` in Cursor

### What ships

`public/skills/memory.wiki/cursor-rule.mdc` is Cursor's `.mdc` rule
counterpart to the Claude Code SKILL.md from W8. Same three actions
(capture / bundle / hub), same hub-aware copy, formatted for
Cursor's rule loader. `alwaysApply: true` so the rule is in every
chat; the rule body documents the natural-language triggers ("save
this," "bundle my docs about X," "give me my hub URL") so the
model only acts when the user actually wants it.

`install.sh` gained a `--target` flag. Default installs the Claude
Code skill at `~/.claude/skills/memory.wiki/`. `--target=cursor` drops
`mdfy.mdc` into `~/.cursor/rules/` (Cursor's global rules
directory). Both targets share the same fetch helper, error path,
and post-install hint.

`/install` page now has two side-by-side sections, one per editor,
each with its own one-line installer.

### Verified

- `/skills/memory.wiki/cursor-rule.mdc` served. 2781 bytes, HTTP 200.
- `install.sh --target=cursor` branch reachable in the shipped
  script. Lands the rule at `~/.cursor/rules/mdfy.mdc`.
- `/install` page renders both sections; "Cursor" appears 14
  times, "Claude Code" 12 times, `mdfy.mdc` 2 times.

### Files

| Path | Role |
|------|------|
| `apps/web/public/skills/memory.wiki/cursor-rule.mdc` | Cursor rule body |
| `apps/web/public/skills/memory.wiki/install.sh` | Multi-target installer |
| `apps/web/src/app/install/page.tsx` | Landing with both editor sections |

## Hub-level graph view

### What ships

`lib/hub-graph.ts` builds the user's whole-hub graph in one pass:

- **Nodes**: every published doc and bundle (capped at 200 docs / 30
  bundles per render).
- **Edges**:
  - `bundle_member` for every `bundle_documents` row (weight 2).
  - `semantic` for every doc pair with cosine distance under 0.42
    via the existing `match_documents_by_embedding` RPC. Weight is
    `1 - distance`.
- **Layout**: bundles distributed on an outer ring (radius 380),
  docs orbit their first-bundle anchor at radius 110. Orphans (docs
  not in any bundle) sit on a smaller inner ring at radius 90.
  Positions are precomputed server-side so the client never runs a
  force simulation.

`/api/user/hub/graph` GET serves the precomputed graph as JSON.
Owner-only.

`/hub/<slug>/graph` is the SSR shell. It verifies the hub is public
(`hub_public = true`) and mounts the client canvas.

`HubGraphCanvas.tsx` is the rendering. Pan + zoom in plain SVG.
Hover surfaces a doc title; click on any node navigates to the
underlying URL.

### Verified live on yc-demo

- 25 docs, 5 bundles, 33 semantic edges.
- Bundle nodes anchored on outer ring (e.g. Project Acme at
  (380, 0), AI Memory Stack at (117, 361)).
- Doc orbits around their first-bundle anchor; orphans on inner
  ring.
- `/hub/yc-demo/graph` page renders 33.7 KB with all canvas markup
  intact.

### Files

| Path | Role |
|------|------|
| `apps/web/src/lib/hub-graph.ts` | Graph builder + radial layout |
| `apps/web/src/app/api/user/hub/graph/route.ts` | JSON endpoint |
| `apps/web/src/app/hub/[slug]/graph/page.tsx` | SSR shell + ownership / public check |
| `apps/web/src/app/hub/[slug]/graph/HubGraphCanvas.tsx` | Pan + zoom SVG canvas |

## Test status

`test:share` 56/56, `test:bookmarklet` 30/30, `test:diff` 13/13 all
still pass. No new test suite for the graph since cluster shape
depends on real data; the live yc-demo verification above is the
regression baseline.

## Deferred

- **Codex / Aider versions** of `/memory.wiki`. Both are simpler in shape
  than Cursor (Aider has its own `.aider.md` convention; Codex CLI
  has prompt files). W10 work.
- **Public `/raw/hub/<slug>/graph.json`**. AI fetchers could
  consume the graph directly. The JSON shape is already stable;
  exposing it publicly is a one-route follow-up.
- **Graph-level filtering**. Click a bundle to highlight its
  members and dim the rest. Click a doc to show its semantic
  neighbors. Polish for W11.
