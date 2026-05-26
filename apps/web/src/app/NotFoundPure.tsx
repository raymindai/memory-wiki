"use client";

import Link from "next/link";
import {
  PureShell,
  PureNav,
  PureButton,
  PureFooter,
} from "@/components/pure";
import {
  SITE_NAV_EN,
  SITE_NAV_MORE_EN,
  SITE_NAV_CTA,
  SITE_FOOTER_COLUMNS_EN,
  SITE_FOOTER_BOTTOM_LEFT_EN,
  SITE_FOOTER_BOTTOM_RIGHT,
  SITE_FOOTER_TAGLINE_EN,
  SITE_FOOTER_PARENT_EN,
} from "@/components/pure/site-chrome";
import "./not-found.css";

export default function NotFoundPure() {
  return (
    <PureShell locale="en">
      {(theme, toggleTheme) => (
        <>
          <PureNav
            theme={theme}
            toggleTheme={toggleTheme}
            links={SITE_NAV_EN}
            ctaLabel={SITE_NAV_CTA.label}
            ctaHref={SITE_NAV_CTA.href}
            more={SITE_NAV_MORE_EN}
          />

          <section className="pure-notfound">
            <div className="pure-notfound-inner">
              <div className="pure-notfound-code mono">404</div>
              <h1 className="pure-notfound-title">Page not found.</h1>
              <p className="pure-notfound-lede">
                That URL doesn&apos;t exist on Memory.Wiki. Maybe it was renamed, or the link is wrong.
              </p>
              <p className="pure-notfound-hint mono">
                Memory.Wiki URLs look like <code>memory.wiki/&lt;id&gt;</code>, <code>memory.wiki/b/&lt;id&gt;</code>, or <code>memory.wiki/@&lt;you&gt;</code>.
              </p>
              <div className="pure-notfound-actions">
                <PureButton href="/">Go home</PureButton>
                <Link href="/about" className="btn-ghost btn-lg">
                  What is Memory.Wiki?
                </Link>
              </div>
            </div>
          </section>

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
