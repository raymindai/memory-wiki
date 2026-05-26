"use client";

/**
 * /manifesto — single 720px reading column. Hero, essay, beliefs,
 * why-now, roadmap, closing. Migrated to PureDocsShell for unified
 * left-sidebar nav + on-this-page TOC.
 */

import "./manifesto.css";
import { PureProse } from "@/components/pure";
import PureDocsShell, { memoryWikiNavGroups } from "@/components/PureDocsShell";
import { getManifestoContent, type Locale } from "./content";

const BADGE_COLORS: Record<"live" | "coming-soon" | "vision", string> = {
  "live":         "var(--micro-lime)",
  "coming-soon":  "var(--micro-orange)",
  "vision":       "var(--micro-ai)",
};

// Derive a deterministic anchor id from a section's index. Section
// headings come from translated content so we don't try to slugify
// them — index is stable across locales.
function sectionId(prefix: string, i: number) {
  return `${prefix}-${i + 1}`;
}

export default function ManifestoPure({ locale = "en" }: { locale?: Locale }) {
  const t = getManifestoContent(locale);
  const isKo = locale === "ko";

  // Build TOC from translated content (essay sections + fixed blocks).
  const toc: { id: string; label: string }[] = [
    ...t.sections.map((s, i) => ({ id: sectionId("section", i), label: s.heading })),
    { id: "beliefs", label: t.beliefs.title },
    { id: "why-now", label: t.whyNow.heading },
    { id: "roadmap", label: t.roadmap.heading },
  ];

  return (
    <PureDocsShell
      locale={locale}
      currentPath={isKo ? "/ko/manifesto" : "/manifesto"}
      navGroups={memoryWikiNavGroups(locale)}
      toc={toc}
    >
      <div className="pure-manifesto-page">
        {/* Hero */}
        <div className="pure-manifesto-readtime mono">{t.hero.readingTime}</div>
        <h1 className="pure-manifesto-title">{t.hero.title}</h1>
        {t.hero.intro.map((line, i) => (
          <p key={i} className="pure-manifesto-intro">{line}</p>
        ))}

        {/* Main essay */}
        <PureProse>
          {t.sections.map((section, sIdx) => (
            <section key={sIdx} id={sectionId("section", sIdx)}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((p, i) => (
                <p key={`p-${i}`} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
              {section.list && (
                <ul>
                  {section.list.map((item, i) => (
                    <li key={`l-${i}`} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
              )}
              {section.afterList?.map((p, i) => (
                <p key={`al-${i}`} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
              {section.highlight && (
                <blockquote>
                  <p dangerouslySetInnerHTML={{ __html: section.highlight }} />
                </blockquote>
              )}
              {section.afterHighlight?.map((p, i) => (
                <p key={`ah-${i}`} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </section>
          ))}
        </PureProse>

        {/* Seven beliefs */}
        <div id="beliefs" className="pure-manifesto-block-eyebrow mono">{t.beliefs.eyebrow}</div>
        <h2 className="pure-manifesto-block-title">{t.beliefs.title}</h2>
        <p className="pure-manifesto-block-lede">{t.beliefs.lede}</p>
        <div className="pure-manifesto-beliefs">
          {t.beliefs.items.map((belief, i) => (
            <article key={i} className="pure-manifesto-belief">
              <div className="pure-manifesto-belief-num mono">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <h3 className="pure-manifesto-belief-title">{belief.title}</h3>
                <p className="pure-manifesto-belief-text">{belief.body}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Why now */}
        <PureProse>
          <h2 id="why-now" style={{ marginTop: 96 }}>{t.whyNow.heading}</h2>
          {t.whyNow.paragraphs.map((p, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
          ))}
        </PureProse>

        {/* Roadmap */}
        <div id="roadmap" className="pure-manifesto-block-eyebrow mono">{t.roadmap.heading}</div>
        <div className="pure-manifesto-phases">
          {t.roadmap.items.map((r, i) => (
            <article key={i} className="pure-manifesto-phase">
              <div className="pure-manifesto-phase-meta">
                <span className="pure-manifesto-phase-tag mono">{r.phase}</span>
                <span
                  className="pure-manifesto-phase-badge mono"
                  style={{ color: BADGE_COLORS[r.badge] }}
                >
                  {r.badgeLabel}
                </span>
              </div>
              <div>
                <h3 className="pure-manifesto-phase-title">{r.title}</h3>
                <p className="pure-manifesto-phase-body">{r.items}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Closing */}
        <PureProse>
          <hr />
          {t.closing.paragraphs.map((p, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
          ))}
        </PureProse>
      </div>
    </PureDocsShell>
  );
}
