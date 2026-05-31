# memory.wiki — Brand & UI/UX System

**Canonical source (web, always up-to-date):**
<https://memory.wiki/L2SHNVir>

**Design tokens (single source of truth):** `/design-tokens/` at
repo root. JSON files (DTCG format) for color / typography /
spacing / radii / motion. Run `npm run tokens:build` to emit
per-platform files. Every visual decision flows from here.

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
| Accent picker keys | full 16 (10 vivid + 6 muted: sage/slate/sand/mauve/rose/iris) in **all four** SOT files (theme-options.ts, globals.css, profile/route.ts ACCENT_KEYS, Brand.kt enum) | editing only one or two — server whitelist drops native PATCHes silently |

Everything else is in the wiki doc.

---

## Updating

### Brand decisions (visual, tone, copy)

1. Edit the wiki at <https://memory.wiki/L2SHNVir>
2. Bump the wiki doc's "Updated" date
3. (Optional) refresh this stub's date below

### Design tokens (colors, typography, spacing, radii, motion)

1. Edit the JSON under `/design-tokens/` (DTCG format)
2. Run `npm run tokens:build` at repo root
3. Style Dictionary emits to every platform automatically:
   - `apps/web/src/app/_tokens.{dark,light}.generated.css`
   - `apps/ios-native/MemoryWiki/BrandTokens.generated.swift`
   - `apps/android-native/.../ui/theme/BrandTokens.generated.kt`
   - `apps/vscode-extension/media/_tokens.{dark,light}.generated.css`
   - `apps/desktop/renderer/_tokens.{dark,light}.generated.css`
4. Commit both the JSON source AND the regenerated outputs so
   contributors don't have to run the build to consume tokens
5. No more 4-mirror hand-sync. One edit propagates everywhere.

The `Brand.swift` / `Brand.kt` files are thin facades that
delegate to `BrandTokens` (the generated file). Translucent
variants (`accentDim`, `borderDim`) compose on top of generated
opaque hex via `.opacity()` / `.copy(alpha = ...)`.

*Last refreshed: 2026-05-31 (added accent picker SOT row to cheat sheet; wiki section 2.6 has the full palette)*
