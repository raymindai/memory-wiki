"use client";

import { type ReactNode } from "react";
import "../styles/components/pure-pillar-grid.css";
// `is-flow` variant shares its → arrow connectors with PureStepFlow —
// the shared rules live in pure-step-flow.css. Import here so the
// arrows render even on pages that use PurePillarGrid in isolation.
import "../styles/components/pure-step-flow.css";
import { microVar, type PureMicroColor } from "../types";

/**
 * PurePillarGrid — 3-column pillar layout. `flow=true` switches to
 * separated cards with → arrow connectors (see PureStepFlow for the
 * arrow CSS — shared single source of truth).
 */
export function PurePillarGrid({
  pillars,
  flow = false,
}: {
  pillars: {
    tag: string;
    title: ReactNode;
    body: ReactNode;
    items?: string[];
    /** Optional small mono phase/status badge to the right of the title.
     *  Single micro color, ink-everywhere-else (matches Roadmap balance). */
    badge?: { label: string; color: PureMicroColor };
  }[];
  /** When true, render each pillar as a separate card with arrow
   *  connectors between (matches PureStepFlow). Use for temporal
   *  sequences (e.g. Roadmap: Shipped → Next → Vision). */
  flow?: boolean;
}) {
  return (
    <div className={`pure-pillar-grid${flow ? " is-flow" : ""}`}>
      {pillars.map((p) => (
        <article key={p.tag} className="pure-pillar">
          <span className="pure-pillar-tag mono">{p.tag}</span>
          <h3 className="pure-pillar-title">
            {p.title}
            {p.badge && (
              <span className="pure-pillar-badge mono" style={{ color: microVar(p.badge.color) }}>
                {p.badge.label}
              </span>
            )}
          </h3>
          <p className="pure-pillar-body">{p.body}</p>
          {p.items && (
            <ul className="pure-pillar-list">
              {p.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
