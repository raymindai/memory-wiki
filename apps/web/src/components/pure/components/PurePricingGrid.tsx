"use client";

import "../styles/components/pure-pricing-grid.css";
import { microVar, type PureMicroColor } from "../types";

export interface PureTier {
  name: string;
  badge?: string | null;
  badgeColor?: PureMicroColor;
  sub: string;
  highlighted?: boolean;
  items: {
    text: string;
    accent?: boolean;
    dim?: boolean;
    faint?: boolean;
    coming?: string;
  }[];
}

/**
 * PurePricingGrid — tier cards (responsive column count).
 */
export function PurePricingGrid({ tiers }: { tiers: PureTier[] }) {
  return (
    <div className="pure-price-grid" data-tiers={tiers.length}>
      {tiers.map((tier) => (
        <article
          key={tier.name}
          className={`pure-price${tier.highlighted ? " is-highlighted" : ""}`}
        >
          {tier.badge && (
            <div
              className="pure-price-badge mono"
              style={tier.badgeColor ? { color: microVar(tier.badgeColor), borderColor: "currentColor" } : undefined}
            >
              {tier.badge}
            </div>
          )}
          <div className="pure-price-name mono">{tier.name}</div>
          <div className="pure-price-sub mono">{tier.sub}</div>
          <ul className="pure-price-list">
            {tier.items.map((it, i) => (
              <li
                key={i}
                className={`${it.dim ? "is-dim" : ""} ${it.faint ? "is-faint" : ""}`}
              >
                <span className="pure-price-check" aria-hidden />
                <span>
                  {it.text.replace(/^[+\-]\s*/, "")}
                  {it.coming && <span className="pure-price-coming mono"> / {it.coming}</span>}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
