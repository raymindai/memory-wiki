"use client";

/**
 * /case-* — persona-driven essay rendered with the Pure design system.
 * Single 720px reading column. Pain → Action → Result spine + worked
 * example + CTA + related cases.
 *
 * Drop the per-case accent color (Pure discipline: color only when it
 * carries meaning; per-case accents don't, they just decorate).
 */

import Link from "next/link";
import {
  PureShell,
  PureNav,
  PureFooter,
  PureButton,
} from "@/components/pure";
import {
  SITE_NAV_EN,
  SITE_NAV_KO,
  SITE_NAV_MORE_EN,
  SITE_NAV_MORE_KO,
  SITE_NAV_MORE_LABEL_EN,
  SITE_NAV_MORE_LABEL_KO,
  SITE_NAV_CTA,
  SITE_NAV_CTA_KO,
  SITE_FOOTER_COLUMNS_EN,
  SITE_FOOTER_BOTTOM_LEFT_EN,
  SITE_FOOTER_BOTTOM_RIGHT,
  SITE_FOOTER_TAGLINE_EN,
  SITE_FOOTER_PARENT_EN,
} from "@/components/pure/site-chrome";
import "./case-pure.css";

export interface CaseData {
  /** URL slug — used for canonical + back-link. */
  slug: string;
  /** Tagline above the headline. */
  kicker: string;
  /** The case headline. One sentence. */
  title: string;
  /** Sub-deck — one sentence that names the audience + outcome. */
  sub: string;
  /** Legacy field — kept in the type for backwards compat; not rendered. */
  accent?: string;
  /** What's broken without memory.wiki. */
  pain: string[];
  /** What the user does in memory.wiki. */
  action: { step: string; detail: string }[];
  /** What they get back. */
  result: string[];
  /** One concrete worked example. */
  example?: {
    title: string;
    body: string;
    url?: string;
  };
  /** Related case slugs (without /case- prefix). */
  related?: { slug: string; label: string }[];
}

export default function CasePure({ data, locale = "en" }: { data: CaseData; locale?: "en" | "ko" }) {
  const isKo = locale === "ko";
  const otherLocale = isKo ? "en" : "ko";
  const langSwitch = {
    label: otherLocale === "ko" ? "한국어" : "EN",
    href: otherLocale === "ko" ? `/ko/case-${data.slug}` : `/case-${data.slug}`,
    locale: otherLocale as "en" | "ko",
  };

  return (
    <PureShell locale={locale}>
      {(theme, toggleTheme) => (
        <>
          <PureNav
            theme={theme}
            toggleTheme={toggleTheme}
            links={isKo ? SITE_NAV_KO : SITE_NAV_EN}
            more={isKo ? SITE_NAV_MORE_KO : SITE_NAV_MORE_EN}
            moreLabel={isKo ? SITE_NAV_MORE_LABEL_KO : SITE_NAV_MORE_LABEL_EN}
            ctaLabel={isKo ? SITE_NAV_CTA_KO.label : SITE_NAV_CTA.label}
            ctaHref={isKo ? SITE_NAV_CTA_KO.href : SITE_NAV_CTA.href}
            langSwitch={langSwitch}
          />

          <div className="pure-case-page">
            {/* Hero */}
            <div className="pure-case-kicker mono">{data.kicker}</div>
            <h1 className="pure-case-title">{data.title}</h1>
            <p className="pure-case-sub">{data.sub}</p>

            {/* Pain */}
            <section className="pure-case-section">
              <div className="pure-case-section-eyebrow mono">
                {isKo ? "지금의 고통" : "The pain"}
              </div>
              <ul className="pure-case-list">
                {data.pain.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </section>

            {/* Action */}
            <section className="pure-case-section">
              <div className="pure-case-section-eyebrow mono">
                {isKo ? "당신이 하는 일" : "What you do"}
              </div>
              <ol className="pure-case-steps">
                {data.action.map((a, i) => (
                  <li key={i} className="pure-case-step">
                    <div className="pure-case-step-num mono">{String(i + 1).padStart(2, "0")}</div>
                    <div>
                      <div className="pure-case-step-title">{a.step}</div>
                      <div className="pure-case-step-detail">{a.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Result */}
            <section className="pure-case-section">
              <div className="pure-case-section-eyebrow mono">
                {isKo ? "돌려받는 것" : "What you get back"}
              </div>
              <ul className="pure-case-list">
                {data.result.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </section>

            {/* Worked example */}
            {data.example && (
              <section className="pure-case-section">
                <div className="pure-case-section-eyebrow mono">
                  {isKo ? "구체 예시" : "Worked example"}
                </div>
                <div className="pure-case-example">
                  <div className="pure-case-example-title">{data.example.title}</div>
                  <p className="pure-case-example-body">{data.example.body}</p>
                  {data.example.url && (
                    <Link href={data.example.url} className="pure-case-example-link mono">
                      {isKo ? "라이브로 보기 ↗" : "See it live ↗"}
                    </Link>
                  )}
                </div>
              </section>
            )}

            {/* CTA */}
            <section className="pure-case-cta">
              <p className="pure-case-cta-line">
                {isKo ? "지금 책상에 있는 것으로 바로 해보세요." : "Try it with what’s on your desk right now."}
              </p>
              <p className="pure-case-cta-sub">
                {isKo ? "회원가입 없음. 첫 문서 넣으면 URL은 당신 것." : "No signup. Drop in your first doc and the URL is yours."}
              </p>
              <PureButton href="/">{isKo ? "memory.wiki 열기" : "Open memory.wiki"}</PureButton>
            </section>

            {/* Related */}
            {data.related && data.related.length > 0 && (
              <section className="pure-case-related">
                <div className="pure-case-section-eyebrow mono">
                  {isKo ? "URL이 띠는 다른 모양" : "Other shapes the URL takes"}
                </div>
                <div className="pure-case-related-grid">
                  {data.related.map((r) => (
                    <Link key={r.slug} href={isKo ? `/ko/case-${r.slug}` : `/case-${r.slug}`} className="pure-case-related-link">
                      {r.label} <span aria-hidden>→</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <PureFooter
            theme={theme}
            columns={SITE_FOOTER_COLUMNS_EN}
            bottomLeft={SITE_FOOTER_BOTTOM_LEFT_EN}
            bottomRight={SITE_FOOTER_BOTTOM_RIGHT}
            tagline={SITE_FOOTER_TAGLINE_EN}
            parent={SITE_FOOTER_PARENT_EN}
          />
        </>
      )}
    </PureShell>
  );
}
