"use client";

import { type ReactNode } from "react";
import "../styles/components/pure-eco-flow.css";
import type { PureTheme, ProviderBrand } from "../types";
import { PureChip } from "./PureChip";
import { PureProviderChip } from "./PureProviderChip";

/**
 * PureEcoFlow — three-column "Write from → One URL → Read in" flow
 * with the animated brand blob at the center.
 */
export function PureEcoFlow({
  theme,
  leftTitle = "Write from",
  centerTitle = "One URL",
  rightTitle = "Read in",
  leftChips,
  rightChips,
  centerUrl = "memory.wiki/@you",
  moreHref = "/plugins",
  foot,
}: {
  theme: PureTheme;
  leftTitle?: string;
  centerTitle?: string;
  rightTitle?: string;
  leftChips: { name: string; brand?: ProviderBrand; href?: string }[];
  rightChips: { name: string; brand?: ProviderBrand; href?: string }[];
  centerUrl?: string;
  moreHref?: string;
  foot?: ReactNode;
}) {
  const Arrow = (
    <span className="pure-eco-arrow" aria-hidden>
      <svg width="34" height="10" viewBox="0 0 34 10">
        <path d="M0 5h30M25 1l5 4-5 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
  return (
    <>
      <div className="pure-eco">
        <div className="pure-eco-col">
          <div className="pure-eco-col-title mono">{leftTitle}</div>
          <div className="pure-eco-chiprow">
            {leftChips.map((c) => (
              c.brand
                ? <PureProviderChip key={c.name} brand={c.brand} label={c.name} href={c.href} />
                : <PureChip key={c.name} href={c.href}>{c.name}</PureChip>
            ))}
            {moreHref && <PureChip href={moreHref} muted>+ more</PureChip>}
          </div>
        </div>
        {Arrow}
        <div className="pure-eco-col pure-eco-center">
          <div className="pure-eco-col-title mono">{centerTitle}</div>
          <div className="pure-eco-blob" aria-hidden>
            <img src={theme === "dark" ? "/brand/mwblob_morph.svg" : "/brand/mwblob_morph_dark.svg"} alt="" />
          </div>
          <div className="pure-eco-url mono">{centerUrl}</div>
        </div>
        {Arrow}
        <div className="pure-eco-col">
          <div className="pure-eco-col-title mono">{rightTitle}</div>
          <div className="pure-eco-chiprow">
            {rightChips.map((c) => (
              c.brand
                ? <PureProviderChip key={c.name} brand={c.brand} label={c.name} href={c.href} />
                : <PureChip key={c.name} href={c.href}>{c.name}</PureChip>
            ))}
            {moreHref && <PureChip href={moreHref} muted>+ more</PureChip>}
          </div>
        </div>
      </div>
      {foot && <p className="pure-eco-foot mono">{foot}</p>}
    </>
  );
}
