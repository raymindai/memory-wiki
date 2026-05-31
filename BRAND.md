# memory.wiki — Brand & UI/UX System

**Canonical source (web, always up-to-date):**
<https://memory.wiki/L2SHNVir>

This file is a pointer, not a mirror. The wiki version is the
source of truth. Read it before:

- spinning up a new channel surface
- reviewing a screenshot or mock
- writing copy that ships to users
- picking a color, font size, corner radius, timing curve
- adding an icon, empty state, or loading affordance
- deciding between toast / banner / modal

If you have to make a brand or UI decision and the answer isn't
on the wiki yet, **edit the wiki first, then come back and ship**.

## Quick-fire cheat sheet

These are the rules most often broken:

| Rule | Always | Never |
| --- | --- | --- |
| Brand name | `memory.wiki` (lowercase) | `Memory.Wiki`, `MemoryWiki`, `MEMORY.WIKI` |
| User-visible separators | comma, slash, colon, parens, spaces | `·`, `—`, `→`, `←`, `↑`, `↓`, emoji |
| Body / chip / button colors | ink (`--text-primary` / `Brand.TextPrimary`) | accent / micro-color fills |
| Color use | small dots, badges, icon glyphs | gradients, glows, accent rails, glassmorphism |
| Loading | `BrandLoader` (blob + "LOADING") full-screen | `CircularProgressIndicator` > 16 dp |
| Tap targets | ≥ 36 dp | 13 dp clickable on bare icon |
| Icon library | Lucide | Material, Heroicons, Feather, mixed |
| Empty states | glyph + title + caption + optional CTA | plain text only |
| Auth provider order | Google, GitHub, Email, Apple | random order, Apple missing |
| Copy for AI sentence | `Use https://memory.wiki/<id> as my context.` | invented phrasings |
| Picker selection | quiet (surface lift + ink check + mono `01 02 03` order) | colored fills, numbered pills |
| Document data safety | dirty check = `markdown !== baseline` (NOT `isSaving` alone) | clobbering local typing on refetch |

Everything else is in the wiki doc.

---

## Updating

1. Edit the wiki at <https://memory.wiki/L2SHNVir>
2. If the change touches tokens, update `globals.css` (web),
   `Brand.swift` (iOS), `Brand.kt` (Android) in lockstep
3. Bump the wiki doc's "Updated" date
4. (Optional) refresh this stub's date below

*Last refreshed: 2026-05-31*
