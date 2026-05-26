# Pure — Design System

Self-contained component kit for v8 Pure pages. Drop `<PureShell>` into any page and you have tokens, typography, layout, and 23 ready-to-compose components. No external CSS imports required.

## Quick start

```tsx
import { PureShell, PureNav, PureHero, PureSection, PureFooter } from "@/components/pure";

export default function MyPage() {
  return (
    <PureShell locale="en">
      {(theme, toggleTheme) => (
        <>
          <PureNav theme={theme} toggleTheme={toggleTheme} links={…} ctaLabel="…" ctaHref="/" />
          <PureHero theme={theme} title={…} lede={…} primary={{ label, href }} />
          <PureSection num="01" eyebrow="…" title="…" lede="…">
            {/* … */}
          </PureSection>
          <PureFooter theme={theme} columns={…} tagline="…" parent={{ label, href }} />
        </>
      )}
    </PureShell>
  );
}
```

For a Korean page, mirror the path under `/ko/*` and pass `locale="ko"` — Pretendard loads automatically and CJK word-wrap kicks in.

## File layout

```
pure/
  index.tsx              barrel re-export only (no logic)
  types.ts               PureTheme, ProviderBrand, PureMicroColor, microVar()
  README.md              you are here
  components/            one TSX file per component (23 total)
  styles/
    index.css            aggregator — imports tokens + base + every component CSS
    tokens.css           single source of truth for all CSS variables
    base.css             font loading + low-level utilities + hover/transform overrides
    components/          one CSS file per component, kebab-case
```

Every component file imports its own CSS, so tree-shaking + debugging stay clean. Touch one component, browse to one file pair.

## Tokens

All values live in [`styles/tokens.css`](./styles/tokens.css). Dark + light values share names so component CSS never branches on theme.

| Category    | Tokens                                                                |
| ----------- | --------------------------------------------------------------------- |
| Canvas      | `--bg`, `--bg-deep`                                                   |
| Hairlines   | `--hair`, `--hair-strong`, `--hair-soft`                              |
| Text ramp   | `--ink`, `--strong`, `--body`, `--muted`, `--faint`                   |
| Micro color | `--micro-{lime, orange, ai, info, warn, pink}`                        |
| Radius      | `--r-sm`, `--r-md`, `--r-lg`, `--r-pill`                              |
| Font        | `--font-display` (Cal Sans), `--font-sans`, `--font-mono` (inherited) |

If you reach for a color or radius value that isn't in this table, stop and ask whether a token should be added — don't hardcode.

## Components

| Name              | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `PureShell`       | Root wrapper — owns theme + locale state, mounts backdrop     |
| `PureNav`         | Fixed glass top nav — links, theme toggle, lang switch, CTA   |
| `PureFooter`      | Brand block + columns + bottom row (parent + copyright)       |
| `PureHero`        | Centered hero — title, lede, CTAs, microcopy, trust row       |
| `PureSection`     | Numbered eyebrow + title + lede wrapper for body sections     |
| `PureCTABand`     | Full-width CTA strip with backdrop                            |
| `PurePillarGrid`  | 3-col pillar cards (+ `flow` variant with arrow connectors)   |
| `PureFeatureGrid` | N-col feature cards with optional brand icon + "Open" link    |
| `PureFigureGrid`  | Image + caption grid                                          |
| `PureBeforeAfter` | 2-col compare                                                 |
| `PureTimeline`    | Step timeline                                                 |
| `PureGallery`     | Slideshow + lightbox + drag + autoplay                        |
| `PureEcoFlow`     | 3-col Write → URL → Read flow                                 |
| `PureCompareTable`| Comparison matrix                                             |
| `PurePricingGrid` | Pricing tiers                                                 |
| `PureChip`        | Generic pill chip                                             |
| `PureProviderChip`| Pill with brand icon (Claude/ChatGPT/etc.)                    |
| `PureButton`      | Primary CTA — white pill with multi-color halo                |
| `ProviderIcon`    | Official brand SVG marks (14 brands)                          |
| `PureTrustStrip`  | 4-promise anti-friction row                                   |
| `PureFAQ`         | Native `<details>` accordion                                  |
| `PureEmailSignup` | Waitlist form (`POST /api/waitlist`)                          |
| `PureStepFlow`    | Numbered horizontal step flow with arrows                     |

## Rules of the kit

These are non-obvious constraints baked into the design language. Following them keeps new pages consistent without thinking.

1. **Color only when it carries meaning.** Body, headings, buttons, chips, body bullets stay ink. Color appears strictly inside small visual signals: badges, step numbers, status dots. If a color doesn't communicate state, drop it.
2. **No hover transforms.** No `translateY`, no scale. Hover changes color, border, or shadow only. There's a global `transform: none !important` override in `base.css` to enforce this.
3. **No middle dot or em-dash as UI separators.** Slash, comma, parens, or spacing only.
4. **No accent-coloured side bars** (`border-left: 2px solid accent`). Use spacing or background fill instead.
5. **Pill border-radius on all buttons.** Pure mode forces `border-radius: 9999px` on every button class.
6. **Sequential flows get arrows, not commas.** `Capture → Organize → Use`, `Shipped → Next → Vision` — explicit direction.
7. **Cal Sans display + Pretendard Korean.** Display headings use Cal Sans. Pretendard auto-applies when `locale="ko"`. Both load from CDN in `base.css`.
8. **`text-wrap: pretty` on body, `balance` on short heads.** Already applied in component CSS — keep that discipline when adding new copy surfaces.

## New-page checklist

1. **Plan content first**, then pick components. Hero, gallery, 4-8 sections, FAQ, CTA, footer is the canonical shape.
2. **Wrap in `<PureShell locale={…}>`** — never render Pure components without it. The shell sets the root class and backdrop.
3. **Pass `theme` through** to `<PureHero>`, `<PureFooter>`, `<PureEcoFlow>` — they need it for asset/color choices.
4. **Localize via a content file.** Pattern: `apps/web/src/app/<page>/content.ts` with `en` + `ko` objects + a `getContent(locale)` helper. Mirrors `/about/content.ts`.
5. **Set anchor IDs on important sections** so internal nav can jump (`id="benchmark"`, `id="pricing"`, `id="faq"`).
6. **Mirror the page at `/ko/<page>/page.tsx`** with the same client component + `locale="ko"`.
7. **Run `npx tsc --noEmit` + open both routes in a browser** before saying done.
8. **No new global CSS** — if a style doesn't exist as a token or a component class, add it to the right Pure CSS file, not as inline style or a one-off rule in `globals.css`.

## Extending the kit

- **New component:** create `components/PureFoo.tsx` + `styles/components/pure-foo.css`. Import the CSS at the top of the TSX. Re-export from `index.tsx`. That's it.
- **New token:** add to `tokens.css` with a 1-line comment explaining where it's used. Provide both dark and light values. Reference from component CSS via `var(--…)`.
- **New brand icon:** add to `components/ProviderIcon.tsx`'s switch, extend `ProviderBrand` type in `types.ts`. Match the 14px viewBox size.
- **New rule of the kit:** add to the section above so the next person learns it.
