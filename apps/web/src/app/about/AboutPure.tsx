"use client";

/**
 * /about — v8 canonical content rendered via the pure/ component kit.
 * Localized via `locale` prop ("en" | "ko"). Content lives in ./content.
 */

import Link from "next/link";
import "./about.css";
import {
  PureShell,
  PureNav,
  PureHero,
  PureSection,
  PurePillarGrid,
  PureFeatureGrid,
  PureCompareTable,
  PurePricingGrid,
  PureGallery,
  PureCTABand,
  PureFooter,
  PureButton,
  PureEcoFlow,
  PureTrustStrip,
  PureFAQ,
  PureEmailSignup,
  PureStepFlow,
} from "@/components/pure";
import {
  SITE_NAV_EN,
  SITE_NAV_KO,
  SITE_NAV_MORE_EN,
  SITE_NAV_MORE_KO,
  SITE_NAV_MORE_LABEL_EN,
  SITE_NAV_MORE_LABEL_KO,
} from "@/components/pure/site-chrome";
import { getAboutContent, type Locale } from "./content";

const GALLERY_SLIDES = [
  { src: "/images/hero-editor.webp",        alt: "Memory.Wiki WYSIWYG editor",                  title: "Web editor",          desc: "Paste, drop, capture. URL in three seconds.",         href: "/",                linkText: "Open" },
  { src: "/images/hero-chromeext.webp",     alt: "Chrome extension capturing from Claude",      title: "Chrome extension",    desc: "One click on ChatGPT, Claude, Gemini.",               href: "/plugins#chrome",  linkText: "Open" },
  { src: "/images/hero-mcp.webp",           alt: "MCP server in Claude Code",                   title: "MCP server",          desc: "29 tools for Claude, Cursor, Windsurf, Codex.",       href: "/plugins#mcp",     linkText: "Open" },
  { src: "/images/plugin-vscode.webp",      alt: "VS Code extension with sidebar and preview",  title: "VS Code extension",   desc: "Sidebar to your cloud, one-click publish, WYSIWYG.",   href: "/plugins#vscode",  linkText: "Open" },
  { src: "/images/plugin-desktop.webp",     alt: "Memory.Wiki for Mac with sidebar",            title: "Memory.Wiki for Mac", desc: "Native sidebar, folders, offline.",                    href: "/plugins#desktop", linkText: "Open" },
  { src: "/images/feature-showcase-1.webp", alt: "Rendered document",                           title: "Beautiful rendering", desc: "Tables, lists, headings rendered with precision.",     href: "/",                linkText: "Open" },
  { src: "/images/feature-showcase-2.webp", alt: "Math and diagrams",                           title: "Math, diagrams, code", desc: "KaTeX, Mermaid, 190+ language highlighting.",         href: "/docs",            linkText: "Open" },
];

export default function AboutPure({ locale = "en" }: { locale?: Locale }) {
  const t = getAboutContent(locale);
  const otherLocale: Locale = locale === "ko" ? "en" : "ko";
  const langSwitch = {
    label: otherLocale === "ko" ? "한국어" : "EN",
    href:  otherLocale === "ko" ? "/ko/about" : "/about",
    locale: otherLocale,
  };

  return (
    <PureShell locale={locale}>
      {(theme, toggleTheme) => (
        <>
          <PureNav
            theme={theme}
            toggleTheme={toggleTheme}
            links={locale === "ko" ? SITE_NAV_KO : SITE_NAV_EN}
            more={locale === "ko" ? SITE_NAV_MORE_KO : SITE_NAV_MORE_EN}
            moreLabel={locale === "ko" ? SITE_NAV_MORE_LABEL_KO : SITE_NAV_MORE_LABEL_EN}
            ctaLabel={t.navCta}
            ctaHref="/"
            langSwitch={langSwitch}
          />

          <PureHero
            theme={theme}
            title={<>{t.hero.title.map((line, i) => (
              <span key={i}>{line}{i < t.hero.title.length - 1 && <br />}</span>
            ))}</>}
            lede={<>{t.hero.ledeLines.map((line, i) => (
              <span key={i}>{line}{i < t.hero.ledeLines.length - 1 && <br />}</span>
            ))}</>}
            primary={{ label: t.hero.primaryCta, href: "/" }}
            secondary={{ label: t.hero.secondaryCta, href: "/benchmark" }}
            microcopy={t.hero.microcopy}
            trustLabel={t.hero.trustLabel}
            trustChips={t.trustChips}
            trustMore={t.trustMore}
          />

          <PureSection eyebrow={t.surfacesGallery.eyebrow} align="center" mark>
            <PureGallery slides={GALLERY_SLIDES} />
          </PureSection>

          {/* 01 — Framework (story spine: what the product does) */}
          <PureSection num={t.framework.num} eyebrow={t.framework.eyebrow} title={t.framework.title} lede={t.framework.lede} mark>
            <PureStepFlow steps={t.framework.items} />
          </PureSection>

          {/* How-it-works pointer — quick summary that lets the curious
              reader jump to the full /how walkthrough without breaking
              the page's marketing flow. */}
          <PureSection align="center" mark>
            <div className="pure-about-how-summary">
              <div className="pure-about-how-summary-eyebrow mono">{t.howSummary.eyebrow}</div>
              <p className="pure-about-how-summary-line">{t.howSummary.line}</p>
              <ul className="pure-about-how-summary-list">
                {t.howSummary.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <Link href={t.howSummary.ctaHref} className="pure-about-how-summary-cta mono">
                {t.howSummary.cta} <span aria-hidden>↗</span>
              </Link>
            </div>
          </PureSection>

          {/* 02 — Ecosystem (the big "one URL, every AI" claim) */}
          <PureSection num={t.ecosystem.num} eyebrow={t.ecosystem.eyebrow} title={t.ecosystem.title} lede={t.ecosystem.lede} mark>
            <PureEcoFlow
              theme={theme}
              leftTitle={t.ecosystem.leftTitle}
              centerTitle={t.ecosystem.centerTitle}
              rightTitle={t.ecosystem.rightTitle}
              leftChips={t.surfacesInput}
              rightChips={t.surfacesOutput}
              foot={t.ecosystem.foot}
            />
          </PureSection>

          {/* 03 — Nine surfaces (where you can use it) */}
          <PureSection num={t.surfaces.num} eyebrow={t.surfaces.eyebrow} title={t.surfaces.title} lede={t.surfaces.lede} mark>
            <PureFeatureGrid columns={3} items={t.surfaces.items} />
          </PureSection>

          {/* 04 — Primitives (URL structure reveal, after the reader has the WHY) */}
          <PureSection num={t.primitives.num} eyebrow={t.primitives.eyebrow} title={t.primitives.title} lede={t.primitives.lede} mark>
            <PurePillarGrid
              pillars={t.primitives.items.map((p, i) => ({
                tag: p.tag,
                title: <span className="mono">{p.url}</span>,
                body: p.body,
                items: p.bullets,
                badge: { label: p.badge, color: (["lime", "warn", "ai"] as const)[i] || "lime" },
              }))}
            />
          </PureSection>

          {/* 05 — Features inside the URL */}
          <PureSection num={t.features.num} eyebrow={t.features.eyebrow} title={t.features.title} lede={t.features.lede} mark>
            <PureFeatureGrid columns={4} items={t.features.items} />
          </PureSection>

          {/* 06 — Cross-AI verification proof */}
          <PureSection num={t.benchmark.num} eyebrow={t.benchmark.eyebrow} title={t.benchmark.title} lede={t.benchmark.lede} id="benchmark" mark>
            <PureCompareTable columns={t.benchmark.columns} rows={t.benchmark.rows} footnote={t.benchmark.footnote} />
            <div className="pure-about-benchmark-cta">
              <Link href="/benchmark" className="pure-about-how-summary-cta mono">
                {locale === "ko" ? "전체 벤치마크 보기" : "See the full benchmark"} <span aria-hidden>↗</span>
              </Link>
            </div>
          </PureSection>

          {/* 07 — vs vendor / agent memory (for readers thinking about category) */}
          <PureSection num={t.comparison.num} eyebrow={t.comparison.eyebrow} title={t.comparison.title} lede={t.comparison.lede} mark>
            <PureCompareTable columns={t.comparison.columns} rows={t.comparison.rows} footnote={t.comparison.footnote} />
          </PureSection>

          {/* 08 — Roadmap (temporal sequence — arrow flow variant) */}
          <PureSection num={t.roadmap.num} eyebrow={t.roadmap.eyebrow} title={t.roadmap.title} lede={t.roadmap.lede} mark>
            <PurePillarGrid
              flow
              pillars={t.roadmap.items.map((p, i) => ({
                tag: p.tag,
                title: p.title,
                body: p.body,
                items: p.bullets,
                badge: { label: p.badge, color: (["lime", "orange", "ai"] as const)[i] || "lime" },
              }))}
            />
          </PureSection>

          {/* Trust strip — anti-friction promises right before the price tag */}
          <PureSection align="center" mark>
            <PureTrustStrip items={t.trust.items} />
          </PureSection>

          {/* 09 — Pricing */}
          <PureSection num={t.pricing.num} eyebrow={t.pricing.eyebrow} title={t.pricing.title} id="pricing" mark>
            <PurePricingGrid tiers={t.pricing.tiers} />
          </PureSection>

          {/* 10 — FAQ */}
          <PureSection num={t.faq.num} eyebrow={t.faq.eyebrow} title={t.faq.title} lede={t.faq.lede} id="faq" mark>
            <PureFAQ items={t.faq.items} />
          </PureSection>

          {/* Primary CTA — fires right after objections are answered */}
          <PureCTABand
            eyebrow={t.cta.eyebrow}
            heading={t.cta.heading}
            lede={t.cta.lede}
            button={{ label: t.cta.button, href: "/" }}
          />

          {/* Launch list — capture readers who didn't convert above */}
          <PureSection
            eyebrow={t.emailSignup.eyebrow}
            title={t.emailSignup.title}
            lede={t.emailSignup.lede}
            align="center"
            id="launch-list"
            mark
          >
            <PureEmailSignup
              locale={locale}
              source="about"
              placeholder={t.emailSignup.placeholder}
              button={t.emailSignup.button}
              buttonSending={t.emailSignup.buttonSending}
              successMsg={t.emailSignup.successMsg}
              errorMsg={t.emailSignup.errorMsg}
              privacyNote={t.emailSignup.privacyNote}
            />
          </PureSection>

          {/* Manifesto link — quiet path for the philosophy-curious */}
          <PureSection eyebrow={t.manifesto.eyebrow} align="center" mark>
            <p className="pure-section-lede" style={{ textAlign: "center", margin: "0 auto 24px" }}>
              {t.manifesto.lede}
            </p>
            <div style={{ textAlign: "center" }}>
              <PureButton href={locale === "ko" ? "/ko/manifesto" : "/manifesto"}>{t.manifesto.cta}</PureButton>
            </div>
          </PureSection>

          <PureFooter
            theme={theme}
            columns={t.footer.columns}
            bottomLeft={t.footer.bottomLeft}
            bottomRight={t.footer.bottomRight}
            tagline={t.footer.tagline}
            parent={t.footer.parent}
          />
        </>
      )}
    </PureShell>
  );
}
