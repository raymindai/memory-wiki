"use client";

/**
 * /spec — open spec page rendered with the Pure design system.
 * Migrated to PureDocsShell so it shares the same left sidebar +
 * on-this-page TOC pattern as /how, /benchmark, /docs, etc.
 */

import "./spec.css";
import {
  PureProse,
  PureCodeBlock,
} from "@/components/pure";
import PureDocsShell, { memoryWikiNavGroups } from "@/components/PureDocsShell";
import {
  getSpecContent,
  type Locale,
  type SpecBlock,
} from "./content";

function Block({ block }: { block: SpecBlock }) {
  switch (block.kind) {
    case "p":
      return <p dangerouslySetInnerHTML={{ __html: block.html }} />;
    case "ul":
      return (
        <ul>
          {block.items.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol>
          {block.items.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ol>
      );
    case "pre":
      return <PureCodeBlock code={block.code} lang={block.lang} />;
    case "callout":
      return (
        <div className="pure-prose-callout" dangerouslySetInnerHTML={{ __html: block.html }} />
      );
  }
}

export default function SpecPure({ locale = "en" }: { locale?: Locale }) {
  const t = getSpecContent(locale);
  const isKo = locale === "ko";

  return (
    <PureDocsShell
      locale={locale}
      currentPath={isKo ? "/ko/spec" : "/spec"}
      navGroups={memoryWikiNavGroups(locale)}
      toc={t.toc.items.map((item) => ({ id: item.id, label: item.label }))}
      tocHeading={t.toc.heading}
    >
      <div className="pure-spec-page">
        {/* Hero */}
        <div className="pure-spec-eyebrow mono">{t.hero.eyebrow}</div>
        <h1 className="pure-spec-title">{t.hero.title}</h1>
        <p className="pure-spec-intro">{t.hero.intro}</p>
        <p
          className="pure-spec-meta"
          dangerouslySetInnerHTML={{ __html: t.hero.meta }}
        />

        {/* Sections — TOC moved to sidebar (PureDocsShell). */}
        {t.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="pure-spec-section"
          >
            <div className="pure-spec-section-eyebrow">{section.num}</div>
            <h2 className="pure-spec-section-title">{section.title}</h2>
            <PureProse>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </PureProse>
          </section>
        ))}

        <p className="pure-spec-footnote">{t.footnote}</p>
      </div>
    </PureDocsShell>
  );
}
