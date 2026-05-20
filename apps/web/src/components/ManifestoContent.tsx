"use client";

import Link from "next/link";
import { DocsNav, SiteFooter } from "@/components/docs";
import { getManifestoTexts } from "@/lib/i18n/manifesto";

interface ManifestoContentProps {
  locale: "en" | "ko";
}

export default function ManifestoContent({ locale }: ManifestoContentProps) {
  const t = getManifestoTexts(locale);

  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <DocsNav active="about" lang={locale} />

      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "80px 24px 120px",
          lineHeight: 1.75,
        }}
      >
        {/* Back link */}
        <Link
          href={t.backHref}
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 48,
          }}
        >
          {t.backLabel}
        </Link>

        {/* Reading time */}
        <p
          style={{
            fontSize: 13,
            color: "var(--text-faint)",
            fontFamily: "var(--font-geist-mono), monospace",
            letterSpacing: 1,
            marginBottom: 40,
          }}
        >
          {t.readingTime}
        </p>

        {/* Title */}
        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            margin: "0 0 24px",
          }}
        >
          {t.title}
        </h1>

        {/* Intro */}
        {t.intro.map((line, i) => (
          <p key={i} style={prose}>
            {line}
          </p>
        ))}

        {/* Main sections */}
        {t.sections.map((section, sIdx) => (
          <div key={sIdx}>
            <h2 style={h2Style}>{section.heading}</h2>

            {section.paragraphs.map((p, pIdx) => (
              <p
                key={pIdx}
                style={prose}
                dangerouslySetInnerHTML={{ __html: p }}
              />
            ))}

            {section.list && (
              <ul style={ulStyle}>
                {section.list.map((item, lIdx) => (
                  <li
                    key={lIdx}
                    style={listItem}
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                ))}
              </ul>
            )}

            {section.highlight && (
              <p
                style={{
                  ...prose,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                {section.highlight}
              </p>
            )}

            {section.afterHighlight &&
              section.afterHighlight.map((p, aIdx) => (
                <p
                  key={`ah-${aIdx}`}
                  style={prose}
                  dangerouslySetInnerHTML={{ __html: p }}
                />
              ))}

            {section.afterList &&
              section.afterList.map((p, aIdx) => (
                <p
                  key={`al-${aIdx}`}
                  style={prose}
                  dangerouslySetInnerHTML={{ __html: p }}
                />
              ))}
          </div>
        ))}

        {/* Five beliefs */}
        <h2 style={h2Style}>{t.beliefsHeading}</h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            margin: "32px 0 48px",
          }}
        >
          {t.beliefs.map((belief, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 20,
                padding: "24px 24px",
                background: "var(--surface)",
                border: "1px solid var(--border-dim)",
                borderRadius: 14,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                {i + 1}
              </span>
              <div>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                  }}
                >
                  {belief.title}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {belief.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Why now */}
        <h2 style={h2Style}>{t.whyNowHeading}</h2>
        {t.whyNow.map((p, i) => (
          <p key={i} style={prose}>
            {p}
          </p>
        ))}

        {/* Why Memory.Wiki (Korean only) */}
        {t.whyMdfyHeading && t.whyMdfy && (
          <>
            <h2 style={h2Style}>{t.whyMdfyHeading}</h2>
            {t.whyMdfy.map((p, i) => (
              <p key={i} style={prose}>
                {p}
              </p>
            ))}
          </>
        )}

        {/* Roadmap */}
        <h2 style={h2Style}>{t.roadmapHeading}</h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            margin: "32px 0 48px",
          }}
        >
          {t.roadmap.map((row) => (
            <div key={row.phase} style={roadmapCard}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <strong
                  style={{ color: "var(--text-primary)", fontSize: 16 }}
                >
                  {row.phase}
                </strong>
                <span
                  className={
                    row.badge === "live"
                      ? "live-badge"
                      : row.badge === "coming-soon"
                      ? "coming-soon-badge"
                      : "vision-badge"
                  }
                >
                  {row.badgeLabel}
                </span>
              </div>
              <p style={roadmapDesc}>{row.items}</p>
            </div>
          ))}
        </div>

        {/* Invitation */}
        <h2 style={h2Style}>{t.invitationHeading}</h2>

        {t.invitation.length > 0 ? (
          /* English style: 4 cards */
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
              gap: 16,
              margin: "32px 0 48px",
            }}
          >
            {t.invitation.map((inv, i) => (
              <div key={i} style={inviteCard}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {inv.audience}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {inv.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          /* Korean style: paragraphs + buttons */
          <>
            {t.invitationParagraphs &&
              t.invitationParagraphs.map((p, i) => (
                <p key={i} style={prose}>
                  {p}
                </p>
              ))}
            {t.invitationButtons && (
              <div
                style={{
                  marginTop: 32,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href="/"
                  style={{
                    display: "inline-block",
                    background: "var(--accent)",
                    color: "#000",
                    padding: "12px 28px",
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {t.invitationButtons.start}
                </Link>
                <a
                  href="https://github.com/raymindai/mdcore"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                    padding: "12px 28px",
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    textDecoration: "none",
                    border: "1px solid var(--border-dim)",
                  }}
                >
                  {t.invitationButtons.github}
                </a>
                <a
                  href="mailto:hi@raymind.ai"
                  style={{
                    display: "inline-block",
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                    padding: "12px 28px",
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    textDecoration: "none",
                    border: "1px solid var(--border-dim)",
                  }}
                >
                  {t.invitationButtons.email}
                </a>
              </div>
            )}
          </>
        )}

        {/* How-Memory.Wiki-works deep dive — outside the EN/KO style ternary
            so both locales render it. EN page goes through the first
            branch (audience cards); without this hoist, the link only
            showed up on KO. */}
        <div style={{ marginTop: 20 }}>
          <Link
            href="/how-memorywiki-works"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            How Memory.Wiki works (deep dive) &rarr;
          </Link>
        </div>

        {/* Closing (English style) */}
        {locale === "en" && (
          <>
            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--border-dim)",
                margin: "48px 0 32px",
              }}
            />
            <div
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                lineHeight: 1.8,
                fontStyle: "italic",
              }}
            >
              <p
                style={{ margin: "0 0 4px" }}
                dangerouslySetInnerHTML={{ __html: t.closing.line1Html }}
              />
              <p
                style={{ margin: "0 0 4px" }}
                dangerouslySetInnerHTML={{ __html: t.closing.line2Html }}
              />
              <p style={{ margin: "0 0 4px" }}>{t.closing.line3}</p>
              <p
                style={{ margin: 0 }}
                dangerouslySetInnerHTML={{ __html: t.closing.line4Html }}
              />
            </div>
          </>
        )}
      </article>

      <SiteFooter />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .manifesto-em { color: var(--text-secondary); }
            .manifesto-link { color: var(--accent); text-decoration: none; }
            .manifesto-code {
              font-size: 14px;
              font-family: var(--font-geist-mono), monospace;
              background: var(--surface);
              border: 1px solid var(--border-dim);
              padding: 2px 6px;
              border-radius: 4px;
            }
          `,
        }}
      />
    </div>
  );
}

/* ───── Shared styles ───── */

const prose: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.75,
  color: "var(--text-tertiary)",
  margin: "0 0 24px",
};

const h2Style: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "var(--text-primary)",
  letterSpacing: "-0.02em",
  margin: "56px 0 24px",
  lineHeight: 1.3,
};

const ulStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.75,
  color: "var(--text-tertiary)",
  margin: "0 0 24px",
  paddingLeft: 24,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const listItem: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.8,
  color: "var(--text-secondary)",
};

const roadmapCard: React.CSSProperties = {
  padding: "20px 24px",
  background: "var(--surface)",
  border: "1px solid var(--border-dim)",
  borderRadius: 14,
};

const roadmapDesc: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

const inviteCard: React.CSSProperties = {
  padding: "20px 24px",
  background: "var(--surface)",
  border: "1px solid var(--border-dim)",
  borderRadius: 14,
  borderLeft: "3px solid var(--accent)",
};
