"use client";

/**
 * Shared "long-content" shell. Provides Pure chrome (Nav + Footer),
 * a sticky left sidebar (page nav grouped by heading + on-this-page
 * TOC), and a 2-column main area. Used by /docs/*, /plugins,
 * /install, /how, /benchmark, /cases, /spec, /manifesto, /bookmarklet.
 *
 * The component is generic: pass `navGroups` to control what shows in
 * the left rail. Docs pages default to the documentation nav so they
 * don't have to repeat it.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  PureShell,
  PureNav,
  PureFooter,
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
import "./pure-docs-shell.css";

type Locale = "en" | "ko";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

interface PureDocsShellProps {
  locale?: Locale;
  /** Pathname of the current page so the sidebar can highlight it. */
  currentPath: string;
  /** Sidebar nav groups. Defaults to the documentation nav so /docs/*
   *  pages can omit this prop. */
  navGroups?: NavGroup[];
  /** Optional on-this-page anchor list. */
  toc?: { id: string; label: string }[];
  /** Label above the on-this-page TOC. Defaults to "On this page". */
  tocHeading?: string;
  children: React.ReactNode;
}

const DOCS_NAV_EN: NavItem[] = [
  { label: "Overview",   href: "/docs" },
  { label: "Integrate",  href: "/docs/integrate" },
  { label: "REST API",   href: "/docs/api" },
  { label: "CLI",        href: "/docs/cli" },
  { label: "MCP Server", href: "/docs/mcp" },
];
const DOCS_NAV_KO: NavItem[] = [
  { label: "Overview",   href: "/ko/docs" },
  { label: "Integrate",  href: "/ko/docs/integrate" },
  { label: "REST API",   href: "/ko/docs/api" },
  { label: "CLI",        href: "/ko/docs/cli" },
  { label: "MCP Server", href: "/ko/docs/mcp" },
];

function defaultDocsGroups(locale: Locale, heading: string): NavGroup[] {
  return [{
    heading,
    items: locale === "ko" ? DOCS_NAV_KO : DOCS_NAV_EN,
  }];
}

export default function PureDocsShell({
  locale = "en",
  currentPath,
  navGroups,
  toc = [],
  tocHeading,
  children,
}: PureDocsShellProps) {
  const isKo = locale === "ko";
  const groups = navGroups ?? defaultDocsGroups(locale, isKo ? "문서" : "Documentation");
  const tocLabel = tocHeading ?? (isKo ? "이 페이지에서" : "On this page");

  const otherLocale = isKo ? "en" : "ko";
  const langSwitch = {
    label: otherLocale === "ko" ? "한국어" : "EN",
    // Toggle /ko prefix on the same path.
    href: otherLocale === "ko"
      ? (currentPath.startsWith("/ko") ? currentPath : `/ko${currentPath === "/" ? "" : currentPath}`)
      : currentPath.replace(/^\/ko/, "") || "/",
    locale: otherLocale as Locale,
  };

  // Active-section tracking for the on-this-page TOC.
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);
  useEffect(() => {
    if (typeof window === "undefined" || toc.length === 0) return;
    const elements: HTMLElement[] = toc
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const firstVisible = toc.find((it) => visible.has(it.id));
        if (firstVisible) setActiveId(firstVisible.id);
      },
      { rootMargin: "-80px 0px -40% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [toc]);

  function handleTocClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }

  // Honor an initial URL #hash on load (and on later hashchange). The TOC
  // CLICK path scrolls explicitly above, but landing on /plugins#chrome
  // directly had nothing and relied on the browser's native scroll — which
  // is unreliable here (fixed-nav offset + content above shifting as
  // images/fonts load), so the page appeared to "not jump". Scroll
  // explicitly with the same 80px nav offset as handleTocClick.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollToHash = (behavior: ScrollBehavior) => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior });
      setActiveId(id);
    };
    let raf = 0;
    const onLoad = () => scrollToHash("auto");
    if (window.location.hash) {
      // After first paint, then again once images/fonts finish (they shift
      // the layout above the target).
      raf = requestAnimationFrame(() => scrollToHash("auto"));
      if (document.readyState === "complete") window.setTimeout(() => scrollToHash("auto"), 80);
      else window.addEventListener("load", onLoad, { once: true });
    }
    const onHashChange = () => scrollToHash("smooth");
    window.addEventListener("hashchange", onHashChange);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("load", onLoad);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  // For sidebar nav active check: strip /ko prefix so both locales
  // hit the same comparison.
  const stripLocale = (p: string) => p.replace(/^\/ko/, "") || "/";
  const currentStripped = stripLocale(currentPath);

  // Use the localized current path so we can pass /ko/foo when isKo,
  // /foo when not. Pre-fix groups items the same way to compare.
  const sidebarRef = useRef<HTMLElement>(null);

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

          <div className="pure-docs-shell">
            <aside className="pure-docs-sidebar" aria-label={isKo ? "사이드 네비" : "Page navigation"} ref={sidebarRef}>
              {groups.map((group, gi) => (
                <div key={gi} className="pure-docs-sidebar-section">
                  <div className="pure-docs-sidebar-heading mono">{group.heading}</div>
                  <nav className="pure-docs-sidebar-nav">
                    {group.items.map((item) => {
                      const isActive = stripLocale(item.href) === currentStripped;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`pure-docs-sidebar-link${isActive ? " is-active" : ""}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}

              {toc.length > 0 && (
                <div className="pure-docs-sidebar-section">
                  <div className="pure-docs-sidebar-heading mono">{tocLabel}</div>
                  <nav className="pure-docs-sidebar-toc">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={(e) => handleTocClick(e, item.id)}
                        className={`pure-docs-sidebar-toc-link${activeId === item.id ? " is-active" : ""}`}
                      >
                        {item.label}
                      </a>
                    ))}
                  </nav>
                </div>
              )}
            </aside>

            <main className="pure-docs-main">
              {children}
            </main>
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

/* ───────── Shared nav-group helper for non-/docs pages ───────── */

/** Sidebar groups for the long marketing pages (More + Plugins).
 *  Localized; pass `isKo` from the caller. */
export function memoryWikiNavGroups(locale: Locale): NavGroup[] {
  const isKo = locale === "ko";
  const prefix = isKo ? "/ko" : "";
  return [
    {
      heading: isKo ? "설치" : "Set up",
      items: [
        { label: isKo ? "플러그인" : "Plugins",      href: `${prefix}/plugins` },
        { label: isKo ? "설치"     : "Install",       href: `${prefix}/install` },
        { label: isKo ? "북마클릿" : "Bookmarklet",   href: `${prefix}/bookmarklet` },
      ],
    },
    {
      heading: isKo ? "이해" : "Learn",
      items: [
        { label: isKo ? "동작 원리"   : "How it works",   href: `${prefix}/how` },
        { label: isKo ? "벤치마크/Eval" : "Benchmark/Eval", href: `${prefix}/benchmark` },
        { label: isKo ? "사용 사례"   : "Use cases",      href: `${prefix}/cases` },
        { label: isKo ? "스펙"        : "Spec",           href: `${prefix}/spec` },
        { label: isKo ? "선언문"      : "Manifesto",      href: `${prefix}/manifesto` },
      ],
    },
  ];
}
