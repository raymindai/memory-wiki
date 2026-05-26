"use client";
import { useState } from "react";
import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import ThemeToggle from "@/components/ThemeToggle";

const mono =
  "var(--font-geist-mono), 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace";

export { mono };

/* ─── CodeBlock ─── */
export function CodeBlock({
  children,
  lang,
}: {
  children: string;
  lang?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked — silent */ }
  };
  return (
    <div className="group" style={{ position: "relative" }}>
      {lang && (
        <span
          style={{
            position: "absolute",
            // Push lang label left so it doesn't fight the copy
            // button's hit area. The button anchors top-right.
            top: 10,
            right: 56,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-faint)",
            fontFamily: mono,
            textTransform: "uppercase",
            letterSpacing: 1,
            pointerEvents: "none",
          }}
        >
          {lang}
        </span>
      )}
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy code"}
        title={copied ? "Copied" : "Copy"}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          padding: "4px 8px",
          fontSize: 11,
          fontWeight: 600,
          fontFamily: mono,
          color: copied ? "#22c55e" : "var(--text-faint)",
          background: "var(--background)",
          border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "var(--border-dim)"}`,
          borderRadius: 6,
          cursor: "pointer",
          opacity: 0.7,
          transition: "opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre
        style={{
          background: "var(--surface)",
          borderRadius: 10,
          padding: "18px 20px",
          overflow: "auto",
          fontSize: 13,
          lineHeight: 1.7,
          fontFamily: mono,
          color: "var(--text-secondary)",
          margin: 0,
          border: "none",
        }}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

/* ─── InlineCode ─── */
export function InlineCode({ children }: { children: string }) {
  return (
    <code
      style={{
        background: "var(--surface)",
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 13,
        fontFamily: mono,
        color: "var(--text-primary)",
      }}
    >
      {children}
    </code>
  );
}

/* ─── Card ─── */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-dim)",
        borderRadius: 14,
        padding: "28px 24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── SectionHeading ─── */
export function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: string;
}) {
  return (
    <h2
      id={id}
      style={{
        fontSize: 22,
        fontWeight: 800,
        color: "var(--text-primary)",
        marginTop: 64,
        marginBottom: 16,
        letterSpacing: "-0.02em",
        scrollMarginTop: 80,
      }}
    >
      {children}
    </h2>
  );
}

/* ─── SubLabel ─── */
export function SubLabel({ children }: { children: string }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: "var(--text-faint)",
        fontFamily: mono,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 8,
        marginTop: 24,
      }}
    >
      {children}
    </p>
  );
}

/* ─── DocsNav ─── */
export function DocsNav({ active = "docs", lang = "en" }: { active?: "about" | "plugins" | "docs" | "hubs"; lang?: "en" | "ko" } = {}) {
  const prefix = lang === "ko" ? "/ko" : "";
  // Hubs intentionally not surfaced in the top nav — the /hubs page
  // still exists and is reachable from the Start grid / Discover, but
  // it doesn't earn a slot next to About/Plugins/Docs.
  const navItems = [
    { label: "About", href: `${prefix}/about`, key: "about" },
    { label: "Plugins", href: `${prefix}/plugins`, key: "plugins" },
    { label: "Docs", href: `${prefix}/docs`, key: "docs" },
  ];

  /* Derive the current path's counterpart in the other language */
  const langSwitchPaths: Record<string, { en: string; ko: string }> = {
    about: { en: "/about", ko: "/ko/about" },
    plugins: { en: "/plugins", ko: "/ko/plugins" },
    docs: { en: "/docs", ko: "/ko/docs" },
    hubs: { en: "/hubs", ko: "/hubs" },
  };
  const currentPaths = langSwitchPaths[active] || langSwitchPaths.about;
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        borderBottom: "1px solid var(--border-dim)",
        background: "var(--header-bg)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <MemoryWikiLogo size={22} />
        </Link>
        <div className="site-nav-links" style={{ flex: 1, justifyContent: "center" }}>
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="site-nav-link"
              data-active={active === item.key}
            >
              {item.label}
            </Link>
          ))}
          <a
            href="https://github.com/raymindai/memory-wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="site-nav-link"
          >
            GitHub
          </a>
        </div>
        <div className="site-nav-right">
          <ThemeToggle />
          <details className="lang-dropdown">
            <summary className="lang-dropdown-toggle">
              {lang === "en" ? "EN" : "KO"}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 4 5 7 8 4" /></svg>
            </summary>
            <div className="lang-dropdown-menu">
              <a href={currentPaths.en} className={lang === "en" ? "active" : ""} onClick={() => { document.cookie = "mw-lang=en;path=/;max-age=31536000"; }}>English</a>
              <a href={currentPaths.ko} className={lang === "ko" ? "active" : ""} onClick={() => { document.cookie = "mw-lang=;path=/;max-age=0"; }}>한국어</a>
            </div>
          </details>
          <Link href="/" className="site-nav-cta">
            Open Editor
          </Link>
        </div>
        <details className="site-nav-hamburger-wrapper">
          <summary className="site-nav-hamburger" aria-label="Toggle menu">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </summary>
          <div className="site-nav-mobile-menu">
            {navItems.map((item) => (
              <Link key={item.key} href={item.href} data-active={active === item.key}>
                {item.label}
              </Link>
            ))}
            <details className="lang-dropdown">
              <summary className="lang-dropdown-toggle">
                {lang === "en" ? "EN" : "KO"}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 4 5 7 8 4" /></svg>
              </summary>
              <div className="lang-dropdown-menu">
                <a href={currentPaths.en} className={lang === "en" ? "active" : ""} onClick={() => { document.cookie = "mw-lang=en;path=/;max-age=31536000"; }}>English</a>
                <a href={currentPaths.ko} className={lang === "ko" ? "active" : ""} onClick={() => { document.cookie = "mw-lang=;path=/;max-age=0"; }}>한국어</a>
              </div>
            </details>
            <a href="https://github.com/raymindai/memory-wiki" target="_blank" rel="noopener noreferrer">GitHub</a>
            <Link href="/">Open Editor</Link>
          </div>
        </details>
      </div>
    </nav>
  );
}

/* ─── DocsFooter ─── */
export function DocsFooter({
  breadcrumb,
  lang = "en",
}: {
  breadcrumb?: string;
  lang?: "en" | "ko";
}) {
  // Used on every /docs/* sub-page. Was English-only ("Documentation"
  // breadcrumb + EN href). Accept lang so /ko/docs/* sub-pages route
  // back to /ko/docs and read the breadcrumb in Korean.
  const docsHref = lang === "ko" ? "/ko/docs" : "/docs";
  const docsLabel = lang === "ko" ? "문서" : "Documentation";
  return (
    <footer style={{ borderTop: "1px solid var(--border-dim)" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: "var(--text-faint)",
            fontFamily: mono,
            margin: 0,
          }}
        >
          {breadcrumb ? (
            <>
              <Link
                href={docsHref}
                style={{
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
              >
                {docsLabel}
              </Link>
              {" / "}
              {breadcrumb}
            </>
          ) : (
            <Link
              href={docsHref}
              style={{
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              {docsLabel}
            </Link>
          )}
        </p>
        <p
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            fontFamily: mono,
            margin: 0,
          }}
        >
          &copy; 2026 Memory.Wiki
        </p>
      </div>
    </footer>
  );
}

/* ─── SiteFooter ─── */
export function SiteFooter({ lang = "en" }: { lang?: "en" | "ko" } = {}) {
  // Footer was English-only despite being mounted on /ko/* pages too
  // (Korean readers saw "Product / Developers / Company / Your
  // Markdown, Beautifully Published" untouched). Accept a lang prop
  // and switch the surrounding labels. Internal-link labels stay in
  // their canonical product names (REST API / CLI / etc.) because
  // those are the same in both languages and match the page titles
  // they route to.
  const prefix = lang === "ko" ? "/ko" : "";
  const t = lang === "ko"
    ? {
        tagline: "당신의 마크다운을, 아름답게 발행합니다.",
        product: "제품",
        developers: "개발자",
        company: "회사",
        editor: "에디터",
        about: "소개",
        plugins: "플러그인",
        integrate: "AI 도구와 연결",
        spec: "공개 스펙",
        privacy: "개인정보 처리방침",
      }
    : {
        tagline: "Your AI memory, deployable to any AI.",
        product: "Product",
        developers: "Developers",
        company: "Company",
        editor: "Editor",
        about: "About",
        plugins: "Plugins",
        integrate: "Integrate",
        spec: "Open Spec",
        privacy: "Privacy Policy",
      };
  return (
    <footer style={{ borderTop: "1px solid var(--border-dim)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 32px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            gap: "32px 48px",
            marginBottom: 40,
          }}
        >
          <div>
            <div style={{ marginBottom: 12 }}>
              <MemoryWikiLogo size={18} />
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 260,
              }}
            >
              {t.tagline}
            </p>
          </div>
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 14,
                marginTop: 0,
                fontFamily: mono,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {t.product}
            </p>
            {[
              { label: t.editor, href: "/" },
              { label: t.about, href: `${prefix}/about` },
              { label: t.plugins, href: `${prefix}/plugins` },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "var(--text-faint)",
                  textDecoration: "none",
                  padding: "3px 0",
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 14,
                marginTop: 0,
                fontFamily: mono,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {t.developers}
            </p>
            {[
              { label: "REST API", href: `${prefix}/docs/api` },
              { label: "CLI", href: `${prefix}/docs/cli` },
              { label: "SDK", href: `${prefix}/docs/sdk` },
              { label: "MCP Server", href: `${prefix}/docs/mcp` },
              { label: t.integrate, href: `${prefix}/docs/integrate` },
              { label: t.spec, href: `${prefix}/spec` },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "var(--text-faint)",
                  textDecoration: "none",
                  padding: "3px 0",
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 14,
                marginTop: 0,
                fontFamily: mono,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {t.company}
            </p>
            {[
              { label: "GitHub", href: "https://github.com/raymindai/memory-wiki" },
              { label: "hi@raymind.ai", href: "mailto:hi@raymind.ai" },
              { label: t.privacy, href: "/privacy" },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "var(--text-faint)",
                  textDecoration: "none",
                  padding: "3px 0",
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
        <div
          style={{
            borderTop: "1px solid var(--border-dim)",
            paddingTop: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: "var(--text-faint)",
              fontFamily: mono,
              margin: 0,
            }}
          >
            A product of{" "}
            <a
              href="https://raymind.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              Raymind.AI
            </a>
          </p>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-faint)",
              fontFamily: mono,
              margin: 0,
            }}
          >
            &copy; 2026 Memory.Wiki. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── DocsSidebar ─── */

const docsNav = [
  { label: "Overview", href: "/docs" },
  // Integrate sits second — it's the "how do I wire Memory.Wiki into my AI
  // tools" page most users land on after Overview. Developer-platform
  // entries (REST API, CLI, SDK, MCP) follow.
  { label: "Integrate", href: "/docs/integrate" },
  { label: "REST API", href: "/docs/api" },
  { label: "CLI", href: "/docs/cli" },
  { label: "JavaScript SDK", href: "/docs/sdk" },
  { label: "MCP Server", href: "/docs/mcp" },
];

export function DocsSidebar({
  items,
  currentPath,
}: {
  items: { id: string; label: string }[];
  currentPath?: string;
}) {
  return (
    <aside
      className="docs-sidebar"
      style={{
        position: "sticky",
        top: 72,
        height: "fit-content",
        maxHeight: "calc(100vh - 72px)",
        overflowY: "auto",
        paddingTop: 40,
        paddingBottom: 40,
      }}
    >
      {/* Section navigation */}
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-faint)",
          fontFamily: mono,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 12,
          marginTop: 0,
        }}
      >
        Documentation
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 20 }}>
        {docsNav.map((item) => {
          const active = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                background: active ? "var(--border)" : "transparent",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: 6,
                display: "block",
                transition: "background 0.1s",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* On this page */}
      {items.length > 0 && (
        <>
          <div style={{ borderTop: "1px solid var(--border-dim)", marginBottom: 16, paddingTop: 16 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-faint)",
                fontFamily: mono,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 12,
                marginTop: 0,
              }}
            >
              On This Page
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  padding: "5px 12px",
                  borderRadius: 6,
                  display: "block",
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
