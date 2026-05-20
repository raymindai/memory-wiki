# memory.wiki presentations

Four Marp decks, one per audience. Each is a single self-contained
`.md` file — Marp front-matter + inline CSS theme + slide content.

| File | Audience | Length | Language |
|---|---|---:|---|
| `01-yc-investor.md` | YC / pre-seed investors | 14 slides | English |
| `02-hn-developer.md` | Hacker News / Show HN / devs | 10 slides | English |
| `03-competition.md` | 공모전 / 일반 심사 | 8 slides | 한국어 |
| `04-product-demo.md` | 사용자 / 제품 데모 | 6 slides | 한국어 |

`_theme.md` is the canonical theme; the four decks duplicate its
`style:` block so each one is runnable standalone (Marp doesn't have
a real include mechanism). Update once in `_theme.md`, then sync.

## Render

The fastest path is the Marp CLI:

```bash
# One-time install
npm i -g @marp-team/marp-cli

# Live preview while editing
marp --preview docs/presentations/01-yc-investor.md

# Export to PDF (good for sharing)
marp docs/presentations/01-yc-investor.md --pdf

# Export to PPTX (editable in Keynote / PowerPoint)
marp docs/presentations/01-yc-investor.md --pptx

# Export to HTML (good for embedding / publishing)
marp docs/presentations/01-yc-investor.md --html
```

Or use the **VS Code Marp extension** (`marp-team.marp-vscode`) for
live preview without a CLI install.

## Brand notes

- Background: `#0a0a0a` (near-black)
- Accent: `#fb923c` (memory.wiki orange)
- Text: `#f4f4f5` (zinc-100)
- Muted: `#a1a1aa` (zinc-400)
- Type: Inter / Pretendard / system stack
- No emojis. No purple. No middle-dot / em-dash separators.

If you swap fonts, keep Pretendard for Korean and Inter for English —
the metrics line up well together.

## What's where

Each deck stands alone for its audience. The YC deck is the longest
(traction + ask slides); the product-demo deck is the shortest
(skip the moat argument, keep the loop). The HN deck leans on the
"what's interesting" question because that's what gets HN
front-page traction. The competition deck merges the YC structure
with the demo brevity for live-judge contexts.

## Editing flow

The decks reference live URLs (`memory.wiki/hub/demo`, `/spec`, `/docs/integrate`).
If those URLs change, search-replace across this directory before re-rendering.
