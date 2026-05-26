"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import "../styles/components/pure-hero.css";
import type { PureTheme, ProviderBrand } from "../types";
import { PureButton } from "./PureButton";
import { ProviderIcon } from "./ProviderIcon";

function dotToClass(d: "lime" | "info" | "violet" | "warn" | "pink"): string {
  // map to existing status-dot color classes in frontier.css
  return d === "lime" ? "green"
    : d === "info" ? "blue"
    : d === "violet" ? "violet"
    : d === "warn" ? "yellow"
    : "pink";
}

/**
 * PureHero — centered hero with optional blob backdrop, kicker, h1,
 * lede, primary/secondary CTAs, and optional trust chip row.
 */
export function PureHero({
  theme,
  tagline,
  kicker,
  title,
  lede,
  tertiary,
  primary,
  secondary,
  microcopy,
  trustLabel,
  trustChips,
  trustMore,
  showBlob = false,
}: {
  theme: PureTheme;
  /** Small mono tagline above the H1. Use for brand line / pre-hero label. */
  tagline?: string;
  kicker?: string;
  title: ReactNode;
  lede?: ReactNode;
  tertiary?: ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** Short reassurance line directly under the CTA buttons.
   *  Use for "No install. No signup." friction-removal copy. */
  microcopy?: string;
  trustLabel?: string;
  /** Optional "+ more" pill at the end of the trust row.
   *  Renders as a muted chip linking to the surfaces page. */
  trustMore?: { label: string; href?: string };
  trustChips?: { label: string; href?: string; brand?: ProviderBrand; dot?: "lime" | "info" | "violet" | "warn" | "pink" }[];
  showBlob?: boolean;
}) {
  return (
    <section className="pure-hero">
      {showBlob && (
        <img
          className="hero-blob-animated"
          src={theme === "dark" ? "/brand/mwblob_morph.svg" : "/brand/mwblob_morph_dark.svg"}
          alt=""
          aria-hidden
        />
      )}
      <div className="pure-hero-inner">
        {tagline && <p className="pure-hero-tagline mono">{tagline}</p>}
        {kicker && (
          <div className="kicker">
            <span className="pulse-dot" />
            <span className="mono">{kicker}</span>
          </div>
        )}
        <h1 className="display-hero">{title}</h1>
        {lede && <p className="pure-hero-lede">{lede}</p>}
        {tertiary && <p className="pure-hero-tertiary mono">{tertiary}</p>}
        {(primary || secondary) && (
          <div className="pure-hero-actions">
            {primary && <PureButton href={primary.href} size="lg">{primary.label}</PureButton>}
            {secondary && (
              <Link href={secondary.href} className="btn-ghost btn-lg">
                {secondary.label}
              </Link>
            )}
          </div>
        )}
        {microcopy && <p className="pure-hero-microcopy mono">{microcopy}</p>}
        {trustChips && (
          <div className="pure-hero-trust">
            {trustLabel && (
              <span className="trust-label mono pure-hero-trust-label">
                {trustLabel}
              </span>
            )}
            <div className="trust-row">
              {trustChips.map((c) => {
                const dotClass = c.dot ? `status-dot ${dotToClass(c.dot)}` : "status-dot";
                const Inner = (
                  <>
                    {c.brand
                      ? <ProviderIcon brand={c.brand} />
                      : <span className={dotClass} />}
                    {c.label}
                  </>
                );
                return c.href ? (
                  <Link key={c.label} href={c.href} className="trust-chip">{Inner}</Link>
                ) : (
                  <span key={c.label} className="trust-chip">{Inner}</span>
                );
              })}
              {trustMore && (
                trustMore.href ? (
                  <Link href={trustMore.href} className="trust-chip trust-chip-more mono">
                    {trustMore.label}
                  </Link>
                ) : (
                  <span className="trust-chip trust-chip-more mono">{trustMore.label}</span>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
