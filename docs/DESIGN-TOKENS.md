# Design Tokens

Single source of truth for memory.wiki's visual system. Adopted at the start of
the design polish sprint that followed the Bundle / Discoveries / Compile
/ Concepts feature push.

**Why tokens.** The product had drifted to 10 text sizes, 9 semantic colors,
and 7 different modal shells. This file caps the vocabulary so every new
component looks like it belongs to the same product.

---

## Color

### Brand
| Token | Dark | Light | Used for |
|---|---|---|---|
| `--accent` | `#fb923c` | `#ea580c` | Primary action, brand highlights, claim/argument chunks |
| `--accent-dim` | `rgba(251,146,60,0.15)` | `rgba(234,88,12,0.10)` | Subtle accent backgrounds (badges, hover) |

### Semantic palette (5 only — anything else gets remapped)
| Token | Dark | Light | Used for |
|---|---|---|---|
| `--color-cool` | `#60a5fa` | `#3b82f6` | Analytical surfaces, definitions, summaries, info, knowledge concepts |
| `--color-warm` | `#fbbf24` | `#d97706` | Attention, action items, insights, pending state |
| `--color-success` | `#4ade80` | `#16a34a` | Positive state, examples, successful save |
| `--color-danger` | `#ef4444` | `#dc2626` | Tensions, errors, destructive actions |
| `--color-neutral` | `#94a3b8` | `#64748b` | Context, low-emphasis info |

Each comes with a `-dim` rgba variant at 10–15% alpha for backgrounds.

### Chunk types → color mapping (5 colors, distinguished by icon)
| Type | Color | Icon (Lucide) |
|---|---|---|
| `concept` | cool | `Lightbulb` |
| `definition` | cool | `BookOpen` |
| `context` | neutral | `FileText` |
| `claim` | accent | `Megaphone` |
| `evidence` | accent (dim) | `Quote` |
| `insight` | warm | `Sparkles` |
| `task` | warm | `CheckSquare` |
| `question` | warm (dim) | `HelpCircle` |
| `example` | success | `Lightbulb` |
| `tension` | danger | `AlertTriangle` |

The icon alone is enough to distinguish two types that share a color; the
color carries the broader category (knowledge / argument / action / positive
/ problem).

### Neutral scale (text + surfaces)
| Token | Dark | Light |
|---|---|---|
| `--text-primary` | `#fafafa` | `#09090b` |
| `--text-secondary` | `#d4d4d8` | `#3f3f46` |
| `--text-muted` | `#a1a1aa` | `#71717a` |
| `--text-faint` | `#737373` | `#a1a1aa` |
| `--bg-base` | `#09090b` | `#faf9f7` |
| `--bg-elevated` | `#18181b` | `#f4f4f5` |
| `--bg-overlay` | `rgba(9,9,11,0.95)` | `rgba(255,255,255,0.95)` |
| `--border` | `#27272a` | `#e4e4e7` |
| `--border-dim` | `rgba(39,39,42,0.6)` | `rgba(228,228,231,0.6)` |

(`text-tertiary` is deprecated — was almost never distinguishable from `text-muted`. Map to `text-muted`.)

---

## Typography

**Four sizes only.** Anything outside this scale must justify itself.

| Token | Size | Use |
|---|---|---|
| `--text-caption` | 11px | Tags, metadata, small labels, timestamps |
| `--text-body` | 12px | Body text, controls, sidebar items, default |
| `--text-heading` | 14px | Section titles, modal titles, prominent labels |
| `--text-display` | 20px | Stat numbers, hero headlines |

Tailwind helper classes for migration:
```
text-[11px] → text-caption       (replace ALL 8/9/10/11 with caption)
text-[12px] → text-body          (replace 12/13 with body)
text-[14px] → text-heading       (replace 14 with heading)
text-[20px] → text-display       (replace 18/20 with display)
```

Line height: caption=1.4, body=1.5, heading=1.4, display=1.2. Default
`leading-tight` / `leading-relaxed` only when explicitly contextual.

---

## Spacing (4-grid)

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Tight inline gaps, icon padding |
| `--space-2` | 8px | Default gap, button padding |
| `--space-3` | 12px | Section internal padding |
| `--space-4` | 16px | Component padding, card spacing |
| `--space-6` | 24px | Section spacing, modal padding |
| `--space-8` | 32px | Major section breaks |

**Forbidden in new code**: 5px, 6px, 7px, 9px, 10px, 14px, 18px, 20px, 22px.
Use the closest grid value.

---

## Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | Inline tags, chips, small inputs |
| `--radius-md` | 8px | Buttons, inputs, small cards |
| `--radius-lg` | 12px | Modals, large cards, panels |
| `--radius-pill` | 9999px | Pill buttons, full-round badges |

Mixing radii arbitrarily is the #1 visual incoherence bug.

---

## Shadows

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.1)` | Subtle elevation, hover lift |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.18)` | Cards, dropdowns |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.35)` | Sidepanels, large overlays |
| `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.5)` | Modal dialogs |

---

## Animation

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120ms | Micro-interactions, hover state |
| `--duration-base` | 200ms | Default transitions, panel open |
| `--duration-slow` | 350ms | Complex state changes, fly-to camera |

Default easing: `cubic-bezier(0.32, 0.72, 0, 1)` (rolled-off, expressive).

---

## Component primitives

These ship as React components in `src/components/ui/`. Anything new must
use these — no inline `<button className="px-3 py-1.5 ...">` allowed.

| Component | Variants | Sizes | Notes |
|---|---|---|---|
| `<Button>` | `primary` / `secondary` / `ghost` / `danger` | `xs` / `sm` / `md` | Has `loading` + `disabled` built in |
| `<Chip>` | `default` / `accent` / `cool` / `warm` / `success` / `danger` | `xs` / `sm` | Used for filter pills, type tags |
| `<Badge>` | `default` / `accent` / `success` / `danger` | — | Small status counts |
| `<ModalShell>` | — | `sm` / `md` / `lg` | Single modal frame for all dialogs |
| `<EmptyState>` | — | — | Icon + heading + 1-line guidance + optional CTA |
| `<Pill>` (nav/tab) | `default` / `active` | `sm` / `md` | For toolbar segments |

---

## Migration policy

1. **No new code uses inline tokens.** Use vars or primitives.
2. **Old code is migrated surface-by-surface in sprint phases.** Until a surface is migrated, old vars (`--toggle-bg`, `--menu-hover`, etc.) stay aliased.
3. **Grep gates:**
   - `text-\[\(8\|9\|10\|13\|18\)px\]` — must be 0 in `src/` after sprint
   - `#fb923c|#60a5fa|...` — only allowed inside `globals.css` (variable definitions)

---

## Out of scope (separate sprint)

- Mobile redesign
- Dark/light contrast WCAG audit
- Marketing site
- Logo / brand identity refresh
