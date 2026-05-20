"use client";

import Link from "next/link";
import { DocsNav, SiteFooter } from "@/components/docs";
import HeroCarousel from "@/components/HeroCarousel";
import { getAboutTexts } from "@/lib/i18n/about";

export default function AboutContent({ locale }: { locale: "en" | "ko" }) {
  const t = getAboutTexts(locale);
  const manifestoHref = locale === "ko" ? "/ko/manifesto" : "/manifesto";

  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100vh",
      }}
    >
      {/* ───────── NAV ───────── */}
      <DocsNav active="about" lang={locale} />

      {/* ───────── 1. HERO ───────── */}
      <section
        style={{
          position: "relative",
          maxWidth: 1080,
          margin: "0 auto",
          padding: "100px 24px 80px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(251,146,60,0.06) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        <h1
          style={{
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            maxWidth: 720,
            margin: 0,
          }}
        >
          {t.hero.h1_1}
          <br />
          <span style={{ color: "var(--accent)" }}>{t.hero.h1_2}</span>
        </h1>

        <p
          style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: "var(--text-tertiary)",
            maxWidth: 600,
            marginTop: 28,
          }}
        >
          {t.hero.sub}
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
          {t.platforms.map((p) => (
            <Link
              key={p.name}
              href={p.href}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-faint)",
                fontFamily: "var(--font-geist-mono), monospace",
                padding: "4px 10px",
                borderRadius: 6,
                background: "var(--surface)",
                border: "1px solid var(--border-dim)",
                textDecoration: "none",
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              {p.name}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "#000",
              padding: "14px 32px",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            {t.hero.cta_primary}
          </Link>
          <a
            href="https://chromewebstore.google.com/detail/mdfycc-%E2%80%94-publish-ai-outpu/nkmkgmebaeaiapjgmmalbeilggfhnold"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              padding: "14px 32px",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid var(--border-dim)",
              letterSpacing: "-0.01em",
            }}
          >
            {t.hero.cta_secondary}
          </a>
          <Link
            href="/how-mdfy-works"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "14px 24px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-muted)",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            How Memory.Wiki works &rarr;
          </Link>
        </div>
      </section>

      {/* ───────── HERO CAROUSEL ───────── */}
      <section style={{ padding: "0 0 60px", overflow: "hidden" }}>
        <HeroCarousel slides={[...t.carousel]} />
      </section>

      {/* ───────── 2. CAPTURE / EDIT / SHARE — THREE PILLARS ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px" }}>
        <div className="about-grid-3" style={{ gap: 20 }}>
          {t.pillars.map((pillar) => (
            <div
              key={pillar.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-dim)",
                borderRadius: 16,
                padding: "32px 28px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${pillar.color}08, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ marginBottom: 20 }}>
                <PillarIcon label={pillar.label} color={pillar.color} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: pillar.color, letterSpacing: 2, marginBottom: 10, fontFamily: "var(--font-geist-mono), monospace" }}>{pillar.label}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px", lineHeight: 1.3 }}>{pillar.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>{pillar.desc}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {pillar.items.map((item) => (
                  <li key={item} style={{ fontSize: 13, color: "var(--text-faint)", padding: "6px 0", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: pillar.color, fontSize: 10 }}>{"\u25CF"}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Footer teaser */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0 }}>
            {t.pillars_footer}{" "}
            <Link href="/plugins" style={{ color: "var(--accent)", textDecoration: "none" }}>{t.pillars_footer_link} &rarr;</Link>
          </p>
        </div>
      </section>

      {/* ───────── ECOSYSTEM ───────── */}
      <section id="how-it-works" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px", scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)", marginBottom: 12, fontFamily: "var(--font-geist-mono), monospace" }}>
          {t.ecosystem.heading}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 40, lineHeight: 1.6, maxWidth: 600 }}>
          {t.ecosystem.sub}
        </p>

        {/* Flow: Sources -> Memory.Wiki -> Outputs */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 20, padding: "40px 32px", overflow: "hidden" }}>
          {/* Row 1: Input sources */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {t.ecosystem.sources.map((s) => (
              <span key={s} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border-dim)", fontFamily: "var(--font-geist-mono), monospace" }}>{s}</span>
            ))}
          </div>

          {/* Arrow down */}
          <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
            <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round"><line x1="8" y1="0" x2="8" y2="20" /><polyline points="4 16 8 20 12 16" /></svg>
          </div>

          {/* Row 2: Surfaces -> Memory.Wiki hub -> Outputs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", margin: "16px 0" }}>
            {/* Input surfaces */}
            <div style={{ display: "flex", gap: 6 }}>
              {t.ecosystem.input_surfaces.map((s) => (
                <Link key={s.name} href={s.href} style={{ fontSize: 10, fontWeight: 700, color: s.color, padding: "4px 8px", borderRadius: 6, background: `${s.color}10`, fontFamily: "var(--font-geist-mono), monospace", textDecoration: "none" }}>{s.name}</Link>
              ))}
            </div>

            {/* Arrow */}
            <svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="8" x2="20" y2="8" /><polyline points="16 4 20 8 16 12" /></svg>

            {/* Central hub */}
            <div style={{ background: "var(--accent)", color: "#000", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: "var(--font-geist-mono), monospace", boxShadow: "0 0 30px rgba(251,146,60,0.15)", whiteSpace: "nowrap" }}>
              memory.wiki/*
            </div>

            {/* Arrow */}
            <svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="8" x2="20" y2="8" /><polyline points="16 4 20 8 16 12" /></svg>

            {/* Output targets */}
            <div style={{ display: "flex", gap: 6 }}>
              {t.ecosystem.output_targets.map((s) => (
                <Link key={s.name} href={s.href} style={{ fontSize: 10, fontWeight: 700, color: s.color, padding: "4px 8px", borderRadius: 6, background: `${s.color}10`, fontFamily: "var(--font-geist-mono), monospace", textDecoration: "none" }}>{s.name}</Link>
              ))}
            </div>
          </div>

          {/* Bottom label */}
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-faint)", marginTop: 24, marginBottom: 0, fontFamily: "var(--font-geist-mono), monospace" }}>
            {t.ecosystem.bottom_label}
          </p>
        </div>
      </section>

      {/* ───────── 2.5. INTEGRATE WITH AI DEV TOOLS ─────────
            The ecosystem section above shows where Memory.Wiki *captures*
            from. This section closes the loop: where the URL goes
            back into. Single block linking to /docs/integrate which
            carries the per-tool snippets (AGENTS.md / CLAUDE.md /
            .cursor/rules etc.). Lives between ecosystem and
            features so the marketing arc reads: capture → deploy →
            features. */}
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
        id="integrate"
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 12,
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          {locale === "ko" ? "통합" : "Integrate"}
        </h2>
        <p style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 12px", maxWidth: 720 }}>
          {locale === "ko" ? (
            <>AI 도구는 세션 사이를 기억하지 못합니다. <span style={{ color: "var(--accent)" }}>한 줄</span>이면 해결됩니다.</>
          ) : (
            <>Your AI tools forget you between sessions. <span style={{ color: "var(--accent)" }}>One line</span> fixes it.</>
          )}
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 24, maxWidth: 640 }}>
          {locale === "ko" ? (
            <>Claude Code, Cursor, Codex, 그리고 모든 에이전트가 이미 <code style={{ fontFamily: "var(--font-geist-mono), monospace" }}>AGENTS.md</code> / <code style={{ fontFamily: "var(--font-geist-mono), monospace" }}>CLAUDE.md</code> / <code style={{ fontFamily: "var(--font-geist-mono), monospace" }}>.cursor/rules</code> 의 내용으로 부팅합니다. Memory.Wiki 번들을 가리키는 한 줄을 추가하면, 다음 세션은 이전 결정, 노트, 그래프 분석이 *이미 로드된 상태로* 시작됩니다. API 키 없음, vendor lock-in 없음.</>
          ) : (
            <>Claude Code, Cursor, Codex, and every other agent already boot with whatever sits in <code style={{ fontFamily: "var(--font-geist-mono), monospace" }}>AGENTS.md</code> / <code style={{ fontFamily: "var(--font-geist-mono), monospace" }}>CLAUDE.md</code> / <code style={{ fontFamily: "var(--font-geist-mono), monospace" }}>.cursor/rules</code>. Add a line that points at your Memory.Wiki bundle and the next session opens with your prior decisions, notes, and graph analysis already loaded. No API key, no vendor lock-in.</>
          )}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {[
            { tool: "Claude Code", file: "CLAUDE.md" },
            { tool: "Cursor", file: ".cursor/rules/*.mdc" },
            { tool: "Codex CLI", file: "AGENTS.md" },
            { tool: "Gemini CLI", file: "GEMINI.md" },
            { tool: "Windsurf", file: ".windsurfrules" },
            { tool: "Aider", file: "CONVENTIONS.md" },
          ].map((row) => (
            <div
              key={row.tool}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-dim)",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{row.tool}</div>
              <code style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-geist-mono), monospace" }}>{row.file}</code>
            </div>
          ))}
        </div>
        <Link
          href={locale === "ko" ? "/ko/docs/integrate" : "/docs/integrate"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--accent)",
            color: "#000",
            padding: "12px 24px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          {locale === "ko" ? "스니펫 보기 →" : "See the snippets →"}
        </Link>
      </section>

      {/* ───────── 3. FEATURES ───────── */}
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 12,
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          {t.features_heading}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 32, lineHeight: 1.6, maxWidth: 600 }}>
          {t.features_sub}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: 16,
          }}
        >
          {t.features.map((f) => (
            <div
              key={f.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-dim)",
                borderRadius: 14,
                padding: "24px 22px",
                transition: "border-color 0.2s",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-geist-mono), monospace",
                  color: f.color,
                  background: `${f.color}15`,
                  padding: "3px 10px",
                  borderRadius: 6,
                  marginBottom: 12,
                }}
              >
                {f.label}
              </span>
              <p
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── 4. FEATURE DETAIL IMAGES ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px" }}>
        <div className="about-grid-3">
          {t.feature_images.map((img) => (
            <div key={img.src} style={{ borderRadius: 12, overflow: "hidden" }}>
              <img src={img.src} alt={img.alt} className="lightbox-img" style={{ width: "100%", display: "block" }} />
              <div style={{ padding: "12px 16px", background: "var(--surface)", borderTop: "1px solid var(--border-dim)" }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{img.title}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-faint)" }}>{img.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── CUSTOMIZATION ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)", marginBottom: 12, fontFamily: "var(--font-geist-mono), monospace" }}>
          {locale === "ko" ? "커스터마이징" : "Customization"}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 32, lineHeight: 1.6, maxWidth: 600 }}>
          {locale === "ko"
            ? "8가지 스킨 테마와 8가지 키 컬러를 조합하여 나만의 에디터를 만들 수 있습니다."
            : "Combine 8 skin themes with 8 key colors to make the editor yours."}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: 16 }}>
          {/* Skin Themes */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 14, padding: "24px 22px" }}>
            <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-geist-mono), monospace", color: "var(--accent)", background: "var(--accent-dim)", padding: "3px 10px", borderRadius: 6, marginBottom: 12 }}>
              {locale === "ko" ? "스킨 테마" : "Skin Themes"}
            </span>
            <p style={{ color: "var(--text-tertiary)", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
              {locale === "ko"
                ? "전체 색상 팔레트를 변경합니다. 배경, 텍스트, 보더, 표면 색상이 모두 바뀝니다."
                : "Change the entire color palette — background, text, borders, and surfaces all adapt."}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Default", "Nord", "Dracula", "Solarized", "Monokai", "One Dark", "Paper", "Ocean"].map(name => (
                <span key={name} style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-dim)", color: "var(--text-muted)", fontFamily: "var(--font-geist-mono), monospace" }}>{name}</span>
              ))}
            </div>
          </div>

          {/* Key Colors */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 14, padding: "24px 22px" }}>
            <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-geist-mono), monospace", color: "var(--accent)", background: "var(--accent-dim)", padding: "3px 10px", borderRadius: 6, marginBottom: 12 }}>
              {locale === "ko" ? "키 컬러" : "Key Color"}
            </span>
            <p style={{ color: "var(--text-tertiary)", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
              {locale === "ko"
                ? "강조 색상을 선택합니다. 모든 스킨 테마에서 독립적으로 작동합니다."
                : "Pick an accent color. Works independently on any skin theme."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { name: "Orange", color: "#fb923c" }, { name: "Blue", color: "#60a5fa" },
                { name: "Purple", color: "#a78bfa" }, { name: "Pink", color: "#f472b6" },
                { name: "Green", color: "#4ade80" }, { name: "Teal", color: "#2dd4bf" },
                { name: "Red", color: "#f87171" }, { name: "Yellow", color: "#fbbf24" },
              ].map(c => (
                <span key={c.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-dim)", color: "var(--text-muted)", fontFamily: "var(--font-geist-mono), monospace" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── 5. HOW IT WORKS ───────── */}
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 12,
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          {t.how_it_works_heading}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 32, lineHeight: 1.6, maxWidth: 600 }}>
          {t.how_it_works_sub}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: 1,
            background: "var(--border-dim)",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--border-dim)",
          }}
        >
          {t.timeline.map((step, i) => (
            <div
              key={step.marker}
              style={{
                background: "var(--surface)",
                padding: "28px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    color: "var(--accent)",
                    fontFamily: "var(--font-geist-mono), monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    background: "var(--accent-dim)",
                    padding: "3px 8px",
                    borderRadius: 6,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {step.marker}
                </span>
              </div>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── 6. BEFORE / WITH MDFY (anchored as #use-cases) ───────── */}
      <section id="use-cases" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px", scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)", marginBottom: 12, fontFamily: "var(--font-geist-mono), monospace" }}>
          {t.before_after.heading}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 32, lineHeight: 1.6, maxWidth: 600 }}>
          {t.before_after.sub}
        </p>
        <div className="img-glow" style={{ margin: "0 auto 32px", maxWidth: 720, borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
          <img src="/images/before-after.webp" alt={t.before_after.image_alt} className="lightbox-img" style={{ width: "100%", display: "block" }} />
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-dim)" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{t.before_after.image_title}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-faint)" }}>{t.before_after.image_sub}</p>
          </div>
        </div>
        <div className="about-grid-2" style={{ gap: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 14, padding: "28px 24px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-faint)", marginTop: 0, marginBottom: 16, textDecoration: "line-through" }}>{t.before_after.before_title}</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--text-faint)" }}>
              {t.before_after.before_items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 14, padding: "28px 24px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)", marginTop: 0, marginBottom: 16 }}>{t.before_after.after_title}</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--text-secondary)" }}>
              {t.before_after.after_items.map((item) => (
                <li key={item}><span style={{ color: "var(--accent)" }}>+</span> {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── VISUAL BREAK ───────── */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ height: 1, background: "linear-gradient(to right, transparent, var(--border), transparent)" }} />
      </div>

      {/* ───────── 7. VISION: WHERE MDFY IS GOING ───────── */}
      <section id="vision" data-secondary-anchor="memory" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px", scrollMarginTop: 80 }}>
        {/* `#memory` also lands here — the AI Memory thesis is the heart of the Vision section. */}
        <span id="memory" style={{ position: "absolute", marginTop: -80 }} aria-hidden />
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)", marginBottom: 12, fontFamily: "var(--font-geist-mono), monospace" }}>
          {t.vision.heading}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 40, lineHeight: 1.6, maxWidth: 640 }}>
          {t.vision.sub}
        </p>

        <div className="about-grid-3" style={{ gap: 16 }}>
          {/* Today */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 14, padding: "28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{t.vision.today_title}</h3>
              <span className="live-badge">{t.vision.today_badge}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>{t.vision.today_phase}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
              {t.vision.today_items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {/* Tomorrow */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 14, padding: "28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{t.vision.tomorrow_title}</h3>
              <span className="coming-soon-badge">{t.vision.tomorrow_badge}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>{t.vision.tomorrow_phase}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
              {t.vision.tomorrow_items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {/* Beyond */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 14, padding: "28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{t.vision.beyond_title}</h3>
              <span className="vision-badge">{t.vision.beyond_badge}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>{t.vision.beyond_phase}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
              {t.vision.beyond_items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <Link href={manifestoHref} style={{ color: "var(--accent)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            {t.vision.manifesto_link} &rarr;
          </Link>
        </div>
      </section>

      {/* ───────── 8a. MARKDOWN TOOLS COMPARISON ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)", marginBottom: 12, fontFamily: "var(--font-geist-mono), monospace" }}>
          {t.comparison_md.heading}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 32, lineHeight: 1.6, maxWidth: 640 }}>
          {t.comparison_md.sub}
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--font-geist-mono), monospace" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {t.comparison_md.columns.map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: h === "" ? "left" : "center", fontSize: 12, fontWeight: h === "Memory.Wiki" ? 800 : 600, color: h === "Memory.Wiki" ? "var(--accent)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.comparison_md.rows.map((row) => (
                <tr key={row.feature} style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontSize: 12 }}>{row.feature}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} style={{ padding: "10px 16px", textAlign: "center", fontSize: 14 }}>
                      {v === "yes"
                        ? <span style={{ color: i === 0 ? "var(--accent)" : "#4ade80" }}>{"\u2713"}</span>
                        : <span style={{ color: "var(--text-faint)", opacity: 0.3 }}>{"\u2014"}</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ───────── 8b. AI MEMORY COMPARISON TABLE ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)", marginBottom: 12, fontFamily: "var(--font-geist-mono), monospace" }}>
          {t.comparison_ai.heading}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 32, lineHeight: 1.6, maxWidth: 640 }}>
          {t.comparison_ai.sub}
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--font-geist-mono), monospace" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {t.comparison_ai.columns.map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: h === "" ? "left" : "center", fontSize: 12, fontWeight: h === "Memory.Wiki" ? 800 : 600, color: h === "Memory.Wiki" ? "var(--accent)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.comparison_ai.rows.map((row) => (
                <tr key={row.feature} style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontSize: 12 }}>{row.feature}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} style={{ padding: "10px 16px", textAlign: "center", fontSize: 14 }}>
                      {v === "yes"
                        ? <span style={{ color: i === 0 ? "var(--accent)" : "#4ade80" }}>{"\u2713"}</span>
                        : v === "partial"
                        ? <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>{"\u25B3"}</span>
                        : <span style={{ color: "var(--text-faint)", opacity: 0.3 }}>{"\u2014"}</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 24, lineHeight: 1.7, maxWidth: 720 }}>
          {t.comparison_ai.footer}
        </p>
      </section>

      {/* ───────── 9. PRICING ───────── */}
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 32,
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          {t.pricing_heading}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: 16,
          }}
        >
          {t.pricing_tiers.map((tier) => (
            <div
              key={tier.name}
              style={{
                background: "var(--surface)",
                border: `1px solid ${tier.border}`,
                borderRadius: 14,
                padding: "28px 24px",
                opacity: tier.opacity,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: tier.nameColor, margin: 0, marginTop: 0 }}>{tier.name}</h3>
                {tier.badge && <span className={tier.name === "Beta" ? "live-badge" : "coming-soon-badge"}>{tier.badge}</span>}
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{tier.sub}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: tier.opacity < 1 ? "var(--text-faint)" : "var(--text-muted)" }}>
                {tier.items.map((item) => (
                  <li key={item.text} style={{ opacity: item.dim ? 0.5 : 1, color: (item as { faint?: boolean }).faint ? "var(--text-faint)" : undefined }}>
                    {item.accent && <span style={{ color: "var(--accent)" }}>+</span>}{item.accent ? " " : ""}{item.text}
                    {(item as { coming?: string }).coming && <span className="coming-soon-badge"> {(item as { coming?: string }).coming}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── 10. THE BIGGER PICTURE + CTA ───────── */}
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <div
          style={{
            borderLeft: "3px solid var(--accent)",
            paddingLeft: 24,
          }}
        >
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.4,
              color: "var(--text-primary)",
              margin: "0 0 12px",
            }}
          >
            {t.bigger_picture.heading}
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              maxWidth: 640,
              margin: 0,
            }}
          >
            {t.bigger_picture.sub}
          </p>
          <Link
            href={manifestoHref}
            style={{
              display: "inline-block",
              color: "var(--accent)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              marginTop: 16,
            }}
          >
            {t.bigger_picture.manifesto_link} &rarr;
          </Link>
        </div>
      </section>

      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 100px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          {t.cta.heading}
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 16,
            marginBottom: 32,
          }}
        >
          {t.cta.sub}
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "var(--accent)",
            color: "#000",
            padding: "14px 36px",
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 700,
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          {t.cta.button}
        </Link>
      </section>

      {/* ───────── 11. FOOTER ───────── */}
      <SiteFooter />

      {/* ───────── LIGHTBOX ───────── */}
      <div id="lightbox-overlay" className="lightbox-overlay" />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('click', function(e) {
              if (e.target && e.target.classList && e.target.classList.contains('lightbox-img')) {
                var overlay = document.getElementById('lightbox-overlay');
                if (!overlay) return;
                overlay.innerHTML = '<img src="' + e.target.src + '" alt="' + (e.target.alt || '') + '" />';
                overlay.classList.add('active');
              }
            });
            document.addEventListener('click', function(e) {
              var overlay = document.getElementById('lightbox-overlay');
              if (!overlay) return;
              if (e.target === overlay || (e.target && e.target.parentElement === overlay)) {
                overlay.classList.remove('active');
                overlay.innerHTML = '';
              }
            });
            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') {
                var overlay = document.getElementById('lightbox-overlay');
                if (!overlay) return;
                overlay.classList.remove('active');
                overlay.innerHTML = '';
              }
            });
          `,
        }}
      />
    </div>
  );
}

/* ─── Pillar Icons ─── */
function PillarIcon({ label, color }: { label: string; color: string }) {
  if (label === "CAPTURE") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  if (label === "EDIT") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }
  // SHARE
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}
