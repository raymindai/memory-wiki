"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import "../styles/components/pure-nav.css";
import type { PureTheme } from "../types";
import { PureButton } from "./PureButton";

/**
 * PureNav — fixed top nav with blob logo, links, theme toggle, CTA.
 *
 * Mobile (<760px): primary nav links + More dropdown + lang switch +
 * theme toggle collapse into a hamburger drawer. Only the brand on
 * the left and the primary CTA on the right stay in the top row, so
 * the marketing header reads cleanly on every viewport.
 */
export function PureNav({
  theme,
  toggleTheme,
  links,
  ctaLabel = "Open workspace",
  ctaHref = "/",
  langSwitch,
  more,
  moreLabel = "More",
}: {
  theme: PureTheme;
  toggleTheme: () => void;
  links: { label: string; href: string }[];
  ctaLabel?: string;
  ctaHref?: string;
  /** Optional language switch link. `locale` is the locale being
   *  switched TO — it is persisted to the `mw-lang` cookie so
   *  middleware respects the choice on the next request. */
  langSwitch?: { label: string; href: string; locale: "en" | "ko" };
  /** Secondary nav items, surfaced behind a small "More" dropdown
   *  so the top row stays tight (About / Plugins / Docs). */
  more?: { label: string; href: string }[];
  moreLabel?: string;
}) {
  const pathname = usePathname() ?? "";
  // Strip trailing anchors + treat /foo and /foo/ as equal
  const norm = (p: string) => p.replace(/[#?].*$/, "").replace(/\/+$/, "") || "/";
  const here = norm(pathname);
  const isCurrent = (href: string) => {
    if (href.startsWith("#") || href.includes("#")) return false;
    const target = norm(href);
    return target === here;
  };

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);
  const moreHasCurrent = !!more?.some((l) => isCurrent(l.href));

  // Mobile hamburger drawer. Open on hamburger tap; close on link
  // tap, backdrop tap, route change, or Escape. Body scroll is
  // locked while open so the page underneath doesn't drift.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  return (
    <header className="pure-nav">
      <div className="pure-nav-inner">
        <Link className="pure-nav-brand" href="/">
          <span className="pure-nav-mark" aria-hidden>
            <img
              src={theme === "dark" ? "/brand/mwblob_morph.svg" : "/brand/mwblob_morph_dark.svg"}
              alt=""
            />
          </span>
          <span className="pure-nav-word">
            <span className="brand-word-memory">memory</span><span className="brand-word-wiki">.wiki</span>
          </span>
        </Link>
        <nav className="pure-nav-links">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`pure-nav-link${isCurrent(l.href) ? " is-current" : ""}`}
              aria-current={isCurrent(l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
          {more && more.length > 0 && (
            <div className="pure-nav-more" ref={moreRef}>
              <button
                type="button"
                className={`pure-nav-link pure-nav-more-toggle${moreHasCurrent ? " is-current" : ""}`}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                {moreLabel}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {moreOpen && (
                <div className="pure-nav-more-menu" role="menu">
                  {more.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      role="menuitem"
                      className={`pure-nav-more-item${isCurrent(l.href) ? " is-current" : ""}`}
                      onClick={() => setMoreOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="pure-nav-right">
          {/* lang + theme are desktop-only — collapsed into the
              hamburger drawer on mobile. */}
          {langSwitch && (
            <a
              href={langSwitch.href}
              className="pure-nav-lang pure-nav-desktop-only"
              onClick={() => {
                document.cookie = `mw-lang=${langSwitch.locale}; path=/; max-age=31536000; SameSite=Lax`;
              }}
            >
              {langSwitch.label}
            </a>
          )}
          <button
            className="pure-nav-theme pure-nav-desktop-only"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Theme: ${theme}`}
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
          </button>
          <PureButton href={ctaHref} size="sm">{ctaLabel}</PureButton>
          {/* Mobile-only hamburger — opens the drawer with links +
              more items + lang switch + theme toggle. */}
          <button
            type="button"
            className="pure-nav-hamburger pure-nav-mobile-only"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="pure-nav-drawer"
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer — render outside the inner so it can take the
          full viewport width. Animation handled in CSS. */}
      {menuOpen && (
        <div
          id="pure-nav-drawer"
          className="pure-nav-drawer"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="pure-nav-drawer-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="pure-nav-drawer-panel">
            <nav className="pure-nav-drawer-links">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`pure-nav-drawer-link${isCurrent(l.href) ? " is-current" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              {more && more.length > 0 && (
                <>
                  <div className="pure-nav-drawer-sep" />
                  <div className="pure-nav-drawer-section">{moreLabel}</div>
                  {more.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`pure-nav-drawer-link${isCurrent(l.href) ? " is-current" : ""}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))}
                </>
              )}
            </nav>
            <div className="pure-nav-drawer-foot">
              {langSwitch && (
                <a
                  href={langSwitch.href}
                  className="pure-nav-drawer-util"
                  onClick={() => {
                    document.cookie = `mw-lang=${langSwitch.locale}; path=/; max-age=31536000; SameSite=Lax`;
                    setMenuOpen(false);
                  }}
                >
                  {langSwitch.label}
                </a>
              )}
              <button
                type="button"
                className="pure-nav-drawer-util"
                onClick={() => { toggleTheme(); setMenuOpen(false); }}
              >
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
