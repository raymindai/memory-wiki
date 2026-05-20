"use client";

import Link from "next/link";
import { DocsNav, SiteFooter } from "@/components/docs";
import { getPluginsTexts } from "@/lib/i18n/plugins";

export default function PluginsContent({ locale }: { locale: "en" | "ko" }) {
  const t = getPluginsTexts(locale);

  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100vh",
      }}
    >
      {/* ───────── NAV ───────── */}
      <DocsNav active="plugins" lang={locale} />

      {/* ───────── HERO ───────── */}
      <section
        style={{
          position: "relative",
          maxWidth: 1080,
          margin: "0 auto",
          padding: "80px 24px 60px",
        }}
      >
        <p
          style={{
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 20,
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          {t.hero.label}
        </p>

        <h1
          style={{
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            maxWidth: 640,
            margin: 0,
          }}
        >
          {t.hero.h1_prefix}<span style={{ color: "var(--accent)" }}>{t.hero.h1_accent}</span>{t.hero.h1_suffix}
        </h1>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.7,
            color: "var(--text-tertiary)",
            maxWidth: 560,
            marginTop: 24,
          }}
        >
          {t.hero.sub}
        </p>
      </section>

      {/* ───────── USE CASES ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 60px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)", marginBottom: 24, fontFamily: "var(--font-geist-mono), monospace" }}>
          {t.useCases.heading}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {t.useCases.items.map((uc, i) => {
            const colors = ["var(--accent)", "var(--text-success, #4ade80)", "var(--text-muted)", "var(--text-secondary)", "var(--accent)", "var(--text-muted)"];
            return (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 14, padding: "24px" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>{uc.scenario}</h3>
                <p style={{ fontSize: 11, color: colors[i], margin: "0 0 10px", fontFamily: "var(--font-geist-mono), monospace", lineHeight: 1.5 }}>{uc.steps}</p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>{uc.why}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────── SHORT URL AS AI REFERENCE ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 60px" }}>
        <div className="about-grid-2" style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 16, padding: "32px", gap: 32 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>
              {t.shortUrl.heading}
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.7 }}>
              {t.shortUrl.desc}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0, lineHeight: 1.6 }}>
              {t.shortUrl.note}
            </p>
          </div>
          <div style={{ background: "var(--background)", borderRadius: 12, padding: "20px", border: "1px solid var(--border-dim)" }}>
            <p style={{ fontSize: 11, fontFamily: "var(--font-geist-mono), monospace", color: "var(--text-faint)", margin: "0 0 12px" }}>{t.shortUrl.exampleLabel}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {t.shortUrl.lines.map((line, i) => (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-dim)", fontSize: 13, fontFamily: "var(--font-geist-mono), monospace" }}>
                  <span style={{ color: line.speaker === "AI:" ? "var(--accent)" : "var(--text-faint)" }}>{line.speaker}</span>{" "}
                  <span style={{ color: line.speaker === "AI:" ? "var(--text-muted)" : "var(--text-secondary)" }}>{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── CHROME EXTENSION ───────── */}
      <PluginSection id="chrome">
        <PluginHeader
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="4" fill="var(--accent)"/>
            </svg>
          }
          title={t.chrome.title}
          subtitle={t.chrome.subtitle}
          desc={t.chrome.desc}
          ctaLabel={t.chrome.ctaLabel}
          ctaHref="https://chromewebstore.google.com/detail/mdfycc-%E2%80%94-publish-ai-outpu/nkmkgmebaeaiapjgmmalbeilggfhnold"
        />

        {/* Screenshots */}
        <div style={{ padding: "16px 32px 24px" }}>
          <div className="about-grid-2" style={{ gap: 12 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="img-glow" style={{ borderRadius: 12, overflow: "hidden" }}>
                <img
                  src={`/images/plugin-chrome-${n}.webp`}
                  alt={`Memory.Wiki Chrome extension screenshot ${n}`}
                  className="lightbox-img"
                  style={{ width: "100%", display: "block" }}
                />
              </div>
            ))}
          </div>
        </div>

        <FeaturesGrid sections={t.chrome.features} />

        {/* Install */}
        <div style={{ padding: "28px 32px", borderTop: "1px solid var(--border-dim)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>
            {t.chrome.installHeading}
          </h3>
          <InstallSteps steps={t.chrome.installSteps} />
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <a
              href="/downloads/mw-chrome-extension-v2.2.2.zip"
              download
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--accent)",
                color: "var(--background)",
                padding: "10px 24px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {t.chrome.downloadLabel}
            </a>
            <span style={{ fontSize: 12, color: "var(--text-faint)", alignSelf: "center" }}>{t.chrome.downloadSize}</span>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: "20px 32px", borderTop: "1px solid var(--border-dim)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a
            href="https://chromewebstore.google.com/detail/mdfycc-%E2%80%94-publish-ai-outpu/nkmkgmebaeaiapjgmmalbeilggfhnold"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "#000", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
          >
            {t.chrome.ctaLabel}
          </a>
          <a
            href="/downloads/mw-chrome-extension-v2.2.2.zip"
            download
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", color: "var(--text-secondary)",
              padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              textDecoration: "none", border: "1px solid var(--border)"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t.chrome.downloadLabel}
          </a>
          <a href="https://memory.wiki/mcRfLTP7" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            {t.chrome.guideLabel}
          </a>
        </div>
      </PluginSection>

      {/* ───────── MCP SERVER ───────── */}
      <PluginSection id="mcp">
        <PluginHeader
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          }
          title={t.mcp.title}
          subtitle={t.mcp.subtitle}
          desc={t.mcp.desc}
          ctaLabel={t.mcp.ctaLabel}
          ctaHref="/docs/mcp"
          ctaIsExternal={false}
        />

        {/* Terminal mockup */}
        <div style={{ padding: "16px 32px 24px" }}>
          <div className="terminal-mock">
            <div className="terminal-mock-bar">
              <span className="terminal-mock-dot red" />
              <span className="terminal-mock-dot yellow" />
              <span className="terminal-mock-dot green" />
              <span className="terminal-mock-title">{t.mcp.terminal.title}</span>
            </div>
            <div className="terminal-mock-body">
              {t.mcp.terminal.lines.map((line, i) => {
                if (line.type === "prompt") return (
                  <span key={i} className="line"><span className="prompt">{line.label}</span><span className="cmd">{line.text}</span></span>
                );
                if (line.type === "output" && line.url) return (
                  <span key={i} className="line"><span className="output">{line.text}</span><span className="url">{line.url}</span></span>
                );
                if (line.type === "output" && line.label) return (
                  <span key={i} className="line"><span className="prompt">{line.label}</span><span className="output">{line.text}</span></span>
                );
                if (line.type === "output") return (
                  <span key={i} className="line"><span className="output">{line.text}</span></span>
                );
                if (line.type === "comment") return (
                  <span key={i} className="line"><span className="comment">{line.text}</span></span>
                );
                if (line.type === "success") return (
                  <span key={i} className="line"><span className="success">{line.text}</span></span>
                );
                return null;
              })}
            </div>
          </div>
        </div>

        <FeaturesGrid sections={t.mcp.features} />

        {/* Install */}
        <div style={{ padding: "28px 32px", borderTop: "1px solid var(--border-dim)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>
            {t.mcp.installHeading}
          </h3>

          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 0, marginBottom: 8 }}>
            {t.mcp.optionA.label}
          </p>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12, marginTop: 0 }}>
            {t.mcp.optionA.desc}
          </p>
          <pre
            style={{
              background: "var(--background)",
              borderRadius: 10,
              padding: "14px 18px",
              fontSize: 13,
              fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
              color: "var(--text-secondary)",
              margin: "0 0 24px",
              border: "1px solid var(--border-dim)",
            }}
          >
            <code>https://memory.wiki/api/mcp</code>
          </pre>

          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 0, marginBottom: 8 }}>
            {t.mcp.optionB.label}
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              marginBottom: 12,
              marginTop: 0,
            }}
          >
            {t.mcp.optionB.desc_prefix}{" "}
            <code
              style={{
                background: "var(--surface)",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 13,
                fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                color: "var(--accent)",
              }}
            >
              {t.mcp.optionB.desc_file}
            </code>{" "}
            {t.mcp.optionB.desc_suffix}
          </p>
          <pre
            style={{
              background: "var(--background)",
              borderRadius: 10,
              padding: "18px 20px",
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.7,
              fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
              color: "var(--text-secondary)",
              margin: 0,
              border: "1px solid var(--border-dim)",
            }}
          >
            <code>{`{
  "mcpServers": {
    "Memory.Wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}`}</code>
          </pre>
        </div>

        {/* Footer actions */}
        <div style={{ padding: "20px 32px", borderTop: "1px solid var(--border-dim)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/docs/mcp"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "#000", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
          >
            {t.mcp.footerLinks.setupGuideLabel}
          </Link>
          <a
            href="https://www.npmjs.com/package/memory-wiki-mcp"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", color: "var(--text-secondary)",
              padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              textDecoration: "none", border: "1px solid var(--border)"
            }}
          >
            {t.mcp.footerLinks.npmLabel}
          </a>
          <span style={{ color: "var(--border)", margin: "0 4px" }}>|</span>
          <a href="https://memory.wiki/r-um_oJp" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            {t.mcp.footerLinks.guideLabel}
          </a>
          <span style={{ color: "var(--border)", margin: "0 4px" }}>|</span>
          <Link href="/docs/mcp" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            {t.mcp.footerLinks.apiRefLabel}
          </Link>
        </div>
      </PluginSection>

      {/* ───────── VS CODE EXTENSION ───────── */}
      <PluginSection id="vscode">
        <PluginHeader
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 4v8l-8 4V4z"/><path d="M12 8l8-4v16l-8-4"/>
            </svg>
          }
          title={t.vscode.title}
          subtitle={t.vscode.subtitle}
          desc={t.vscode.desc}
          ctaLabel={t.vscode.ctaLabel}
          ctaHref="https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode"
        />

        {/* Screenshot */}
        <div style={{ padding: "16px 32px 24px" }}>
          <div className="img-glow" style={{ borderRadius: 12, overflow: "hidden" }}>
            <img
              src="/images/plugin-vscode.webp"
              alt="Memory.Wiki VS Code extension — WYSIWYG preview with sidebar, toolbar, and document outline"
              className="lightbox-img"
              style={{ width: "100%", display: "block", borderRadius: 12 }}
            />
          </div>
        </div>

        <FeaturesGrid sections={t.vscode.features} />

        <div style={{ padding: "28px 32px", borderTop: "1px solid var(--border-dim)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>
            {t.vscode.installHeading}
          </h3>
          <InstallSteps steps={t.vscode.installSteps} />
        </div>

        {/* Footer actions */}
        <div style={{ padding: "20px 32px", borderTop: "1px solid var(--border-dim)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a
            href="https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "#000", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
          >
            {t.vscode.ctaLabel}
          </a>
          <a
            href="https://github.com/raymindai/mdcore/releases"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", color: "var(--text-secondary)",
              padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              textDecoration: "none", border: "1px solid var(--border)"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t.vscode.downloadVsixLabel}
          </a>
          <a href="https://memory.wiki/zOjZPXY7" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            {t.vscode.guideLabel}
          </a>
        </div>
      </PluginSection>

      {/* ───────── DESKTOP APP ───────── */}
      <PluginSection id="desktop">
        <PluginHeader
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          }
          title={t.desktop.title}
          subtitle={t.desktop.subtitle}
          desc={t.desktop.desc}
          ctaLabel={t.desktop.ctaLabel}
          ctaHref="https://github.com/raymindai/mdcore/releases/latest"
        />

        {/* Screenshot */}
        <div style={{ padding: "16px 32px 24px" }}>
          <div className="img-glow" style={{ borderRadius: 12, overflow: "hidden" }}>
            <img
              src="/images/plugin-desktop.webp"
              alt="Memory.Wiki for Mac — sidebar with cloud folders, Mermaid diagrams, tables, and document outline"
              className="lightbox-img"
              style={{ width: "100%", display: "block", borderRadius: 12 }}
            />
          </div>
        </div>

        <FeaturesGrid sections={t.desktop.features} />

        <div style={{ padding: "28px 32px", borderTop: "1px solid var(--border-dim)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>
            {t.desktop.installHeading}
          </h3>
          <InstallSteps steps={t.desktop.installSteps} />
        </div>

        {/* Footer actions */}
        <div style={{ padding: "20px 32px", borderTop: "1px solid var(--border-dim)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a
            href="https://github.com/raymindai/mdcore/releases/latest"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "#000", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t.desktop.downloadLabel}
          </a>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{t.desktop.downloadSize}</span>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", color: "var(--text-faint)",
              padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              border: "1px solid var(--border-dim)", cursor: "default", opacity: 0.6
            }}
          >
            {t.desktop.appStoreLabel}
          </span>
          <a href="https://memory.wiki/CaQ31sfk" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            {t.desktop.guideLabel}
          </a>
        </div>
      </PluginSection>

      {/* ───────── CLI TOOL ───────── */}
      <section id="cli" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 60px", scrollMarginTop: 80 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s" }}>
          <div style={{ padding: "36px 32px 28px", borderBottom: "1px solid var(--border-dim)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-dim)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>
                </div>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{t.cli.title}</h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{t.cli.subtitle}</p>
                </div>
              </div>
              <p style={{ fontSize: 15, color: "var(--text-tertiary)", maxWidth: 480, lineHeight: 1.7, margin: 0 }}>
                {t.cli.desc}
              </p>
            </div>
            <code style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-geist-mono), monospace", color: "var(--accent)", flexShrink: 0 }}>
              {t.cli.installCmd}
            </code>
          </div>

          {/* Terminal mockup */}
          <div style={{ padding: "16px 32px 24px" }}>
            <div className="terminal-mock">
              <div className="terminal-mock-bar">
                <span className="terminal-mock-dot red" />
                <span className="terminal-mock-dot yellow" />
                <span className="terminal-mock-dot green" />
                <span className="terminal-mock-title">Terminal</span>
              </div>
              <div className="terminal-mock-body">
                <span className="line comment">{"# Publish a file"}</span>
                <span className="line"><span className="prompt">$ </span><span className="cmd">mw publish README.md</span></span>
                <span className="line"><span className="url">https://memory.wiki/abc123</span></span>
                <span className="line"><span className="success">  URL copied to clipboard</span></span>
                <span className="line-gap" />
                <span className="line comment">{"# Pipe anything"}</span>
                <span className="line"><span className="prompt">$ </span><span className="cmd">{"echo \"# Hello World\" | mw publish"}</span></span>
                <span className="line"><span className="url">https://memory.wiki/def456</span></span>
                <span className="line"><span className="success">  URL copied to clipboard</span></span>
                <span className="line-gap" />
                <span className="line comment">{"# Read in terminal"}</span>
                <span className="line"><span className="prompt">$ </span><span className="cmd">Memory.Wiki read abc123</span></span>
                <span className="line"><span className="output">{"# Hello World"}</span></span>
                <span className="line"><span className="output">{"This is a published document..."}</span></span>
              </div>
            </div>
          </div>

          <div style={{ padding: "24px 32px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {t.cli.examples.map((ex) => (
                <div key={ex.cmd} style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-dim)", background: "var(--background)" }}>
                  <code style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-geist-mono), monospace", display: "block", marginBottom: 4 }}>{ex.cmd}</code>
                  <p style={{ fontSize: 11, color: "var(--text-faint)", margin: 0 }}>{ex.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ padding: "20px 32px", borderTop: "1px solid var(--border-dim)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <code style={{ background: "var(--background)", border: "1px solid var(--border-dim)", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-geist-mono), monospace", color: "var(--accent)" }}>
              {t.cli.installCmd}
            </code>
            <a
              href="https://www.npmjs.com/package/memory-wiki-cli"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "transparent", color: "var(--text-secondary)",
                padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                textDecoration: "none", border: "1px solid var(--border)"
              }}
            >
              {t.cli.npmLabel}
            </a>
            <a href="https://memory.wiki/gIHYPRxD" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
              {t.cli.guideLabel}
            </a>
          </div>
        </div>
      </section>

      {/* ───────── MACOS QUICKLOOK ───────── */}
      <PluginSection id="quicklook">
        <PluginHeader
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M8 8h3M8 12h8M8 16h5"/>
            </svg>
          }
          title={t.quicklook.title}
          subtitle={t.quicklook.subtitle}
          desc={t.quicklook.desc}
          ctaLabel={t.quicklook.ctaLabel}
          ctaHref="https://github.com/raymindai/mdcore/releases/latest"
        />

        {/* Screenshot */}
        <div style={{ padding: "16px 32px 24px" }}>
          <div className="img-glow" style={{ borderRadius: 12, overflow: "hidden" }}>
            <img
              src="/images/plugin-quicklook.webp"
              alt="Memory.Wiki QuickLook — press Space in Finder to preview rendered Markdown with tables and code"
              className="lightbox-img"
              style={{ width: "100%", display: "block", borderRadius: 12 }}
            />
          </div>
        </div>

        <FeaturesGrid sections={t.quicklook.features} />

        <div style={{ padding: "28px 32px", borderTop: "1px solid var(--border-dim)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>
            {t.quicklook.installHeading}
          </h3>
          <InstallSteps steps={t.quicklook.installSteps} />
        </div>

        {/* Footer actions */}
        <div style={{ padding: "20px 32px", borderTop: "1px solid var(--border-dim)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a
            href="https://github.com/raymindai/mdcore/releases/latest"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "#000", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t.quicklook.downloadLabel}
          </a>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{t.quicklook.downloadSize}</span>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", color: "var(--text-faint)",
              padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              border: "1px solid var(--border-dim)", cursor: "default", opacity: 0.6
            }}
          >
            {t.quicklook.includedLabel}
          </span>
          <a href="https://memory.wiki/womPEbUm" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            {t.quicklook.guideLabel}
          </a>
        </div>
      </PluginSection>

      {/* ───────── MORE COMING ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 60px" }}>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 24,
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          {t.roadmap.heading}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {t.roadmap.items.map((p) => (
            <div
              key={p.name}
              style={{
                padding: "20px",
                borderRadius: 12,
                border: "1px solid var(--border-dim)",
                background: "var(--surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  {p.name}
                </h3>
                <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-faint)", background: "var(--toggle-bg)", padding: "2px 8px", borderRadius: 10 }}>
                  {p.status.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 80px", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 24 }}>
          {t.cta.text}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <a
            href="https://github.com/raymindai/mdcore"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              background: "var(--surface)",
            }}
          >
            {t.cta.githubLabel}
          </a>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "var(--background)",
              padding: "12px 28px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t.cta.editorLabel}
          </Link>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
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

/* ─── Helper Components ─── */

function PluginSection({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      style={{
        scrollMarginTop: 80,
        maxWidth: 1080,
        margin: "0 auto",
        padding: "0 24px 60px",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-dim)",
          borderRadius: 16,
          overflow: "hidden",
          transition: "border-color 0.2s",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function PluginHeader({
  icon,
  title,
  subtitle,
  desc,
  ctaLabel,
  ctaHref,
  ctaIsExternal = true,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  desc: string;
  ctaLabel: string;
  ctaHref: string;
  ctaIsExternal?: boolean;
}) {
  return (
    <div
      style={{
        padding: "36px 32px 28px",
        borderBottom: "1px solid var(--border-dim)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border-dim)",
            }}
          >
            {icon}
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {title}
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              {subtitle}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 15, color: "var(--text-tertiary)", maxWidth: 480, lineHeight: 1.7, margin: 0 }}>
          {desc}
        </p>
      </div>
      <a
        href={ctaHref}
        {...(ctaIsExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "var(--accent)",
          color: "#000",
          padding: "12px 28px",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        {ctaLabel}
      </a>
    </div>
  );
}

function FeaturesGrid({ sections }: { sections: { title: string; items: string[] }[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 1,
        background: "var(--border-dim)",
      }}
    >
      {sections.map((section) => (
        <div key={section.title} style={{ background: "var(--surface)", padding: "24px 28px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, marginTop: 0 }}>
            {section.title}
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {section.items.map((item) => (
              <li
                key={item}
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  padding: "4px 0",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--accent)", flexShrink: 0 }}>+</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function InstallSteps({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {steps.map((text, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "var(--accent-dim)",
              color: "var(--accent)",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {i + 1}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{text}</span>
        </div>
      ))}
    </div>
  );
}
