// Shared layout for /case-* pages.
//
// Each case follows the Pain → Action → Result shape that Hermes Agent
// uses for its 활용 사례 grid. The home onboarding's "What people put
// in mdfy" cards each link to one of these. Keep the body tight —
// readers should be able to scan in under a minute and decide whether
// the shape fits their week.
//
// The data shape is intentionally small so the 6 case page files
// can be one-import-one-export each.

import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav, SiteFooter } from "@/components/docs";

export interface CaseData {
  /** URL slug — used for canonical + back-link to the hub. */
  slug: string;
  /** Tagline above the headline (small, mono, accent). */
  kicker: string;
  /** The case headline. One sentence. */
  title: string;
  /** Sub-deck — one sentence that names the audience + outcome. */
  sub: string;
  /** Visual signature: 1-2 words + accent color. */
  accent: string;
  /** Pain — what's broken without mdfy. 3-5 bullets, short. */
  pain: string[];
  /** Action — what the user does in mdfy. Ordered steps. */
  action: { step: string; detail: string }[];
  /** Result — what they get back. 3-5 bullets, short. */
  result: string[];
  /** One concrete worked example with a URL the reader can click. */
  example?: {
    title: string;
    body: string;
    url?: string;
  };
  /** Related case slugs (with-out the /case- prefix). */
  related?: { slug: string; label: string }[];
}

const caseMetaBase = (slug: string, title: string, sub: string): Metadata => ({
  title: `${title} — memory.wiki`,
  description: sub,
  alternates: { canonical: `https://memory.wiki/case-${slug}` },
  openGraph: {
    title: `${title} — memory.wiki`,
    description: sub,
    url: `https://memory.wiki/case-${slug}`,
    images: [{ url: `/api/og?title=${encodeURIComponent(title)}`, width: 1200, height: 630 }],
  },
});

export const caseMetadata = caseMetaBase;

export default function CasePage({ data }: { data: CaseData }) {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <DocsNav />

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px 96px" }}>
        {/* Hero */}
        <p
          style={{
            color: data.accent,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2.5,
            textTransform: "uppercase",
            fontFamily: "var(--font-geist-mono), monospace",
            marginBottom: 12,
          }}
        >
          {data.kicker}
        </p>
        <h1
          style={{
            fontSize: "clamp(30px, 4.4vw, 44px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: "var(--text-primary)",
            margin: "0 0 16px",
          }}
        >
          {data.title}
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--text-muted)", marginBottom: 40 }}>
          {data.sub}
        </p>

        {/* Pain */}
        <Section heading="The pain" accent="#ef4444">
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {data.pain.map((p, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                <span style={{ color: "#ef4444", flexShrink: 0 }}>—</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Action */}
        <Section heading="What you do in mdfy" accent={data.accent}>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {data.action.map((a, i) => (
              <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    background: data.accent,
                    color: "#000",
                    fontWeight: 700,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{a.step}</div>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 2 }}>{a.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* Result */}
        <Section heading="What you get back" accent="#4ade80">
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {data.result.map((r, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                <span style={{ color: "#4ade80", flexShrink: 0 }}>✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Worked example */}
        {data.example && (
          <Section heading="Worked example" accent="var(--text-faint)">
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-dim)",
                borderRadius: 12,
                padding: "20px 22px",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{data.example.title}</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{data.example.body}</p>
              {data.example.url && (
                <Link
                  href={data.example.url}
                  style={{
                    display: "inline-block",
                    marginTop: 14,
                    fontSize: 12,
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "var(--accent)",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  See it live →
                </Link>
              )}
            </div>
          </Section>
        )}

        {/* CTA */}
        <section style={{ marginTop: 48, padding: "32px 28px", borderRadius: 14, background: "var(--accent-dim)", border: "1px solid var(--accent)", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            Try it with what&apos;s on your desk right now.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18 }}>
            No signup. Drop in your first doc and the URL is yours.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "11px 22px",
              borderRadius: 10,
              background: "var(--accent)",
              color: "#000",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Open mdfy →
          </Link>
        </section>

        {/* Related */}
        {data.related && data.related.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 16, fontFamily: "var(--font-geist-mono), monospace" }}>
              Other shapes the URL takes
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }}>
              {data.related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/case-${r.slug}`}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "var(--surface)",
                    border: "1px solid var(--border-dim)",
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  {r.label} →
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({ heading, accent, children }: { heading: string; accent: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: accent,
          marginBottom: 14,
          fontFamily: "var(--font-geist-mono), monospace",
        }}
      >
        {heading}
      </h2>
      {children}
    </section>
  );
}
