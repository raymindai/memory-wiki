# v6 progress log

Per-week record of what shipped against the 12-week single-ship plan
(target: end of August 2026 public launch). Each week file lists the
commits, verified scenarios, and any deferred work.

## Index

| Week | Title | Commit(s) | Status |
|------|-------|-----------|--------|
| W1 | ChatGPT share-link import API | `aeb9c2f1` | shipped |
| W2 | Bookmarklet for cross-AI capture | `31e4f3a8` | shipped |
| W3 | Anonymous-first capture, claim flow, hub schema, demo CTA | `22dd6d4e`, `1598c2a1`, `e4113c90`, `075e413f` | shipped |
| W4 | Auto-synthesis with diff/accept (exceed move 1) | `31f17041` | shipped |
| W5 | PDF ingest (exceed move 2), hub log.md, hub lint v1 | `a6851d67`, `7c3e3019`, `9631b878` | shipped |
| W6 | Proactive bundle suggestions (exceed move 3) | `4368d47c` | shipped |
| W7 | Shared bundles MVP, confidence tags | `ae0b33fd` | shipped |
| W8 | `/memory.wiki` slash for Claude Code, suggested queries | `369e7755` | shipped |
| W9 | `/memory.wiki` for Cursor, hub-level graph view | `6e46b47a` | shipped |
| W10 | `/memory.wiki` for Codex+Aider, time-traveling hub, two-door landing draft | `d8e9e0f4` | shipped |
| W11 | Permission-aware AI fetching, shared bundles discoverable | `dfcb0f0a` | shipped |
| W12 | Social hub feed, cross-reference graph, launch readiness | `9e4c8413` | shipped (launch flip held for end of August 2026) |

## Conventions

- All work happens on `v6` branch and stays on `staging.memory.wiki`. Production `memory.wiki` stays on v1 until W12 single-ship.
- Supabase is shared between staging and production, so schema migrations apply to both at write time.
- Per-week files name the verified scenarios, not what's *intended* to work. If a path isn't verified, it's not in the file.
- Tests live under `apps/web/scripts/`; run any with `pnpm --filter web test:<name>`.

## Reference

- Strategy memo: `~/.claude/projects/-Users-hyunsangcho-Desktop-Projects-mdcore/memory/mdfy_wiki_layer_2026_05.md`
- Earlier launch artifacts: `docs/launch/`
