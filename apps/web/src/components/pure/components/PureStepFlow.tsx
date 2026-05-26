"use client";

import "../styles/components/pure-step-flow.css";
import { microVar, type PureMicroColor } from "../types";

/**
 * PureStepFlow — numbered horizontal step flow (1 → 2 → 3).
 * Used for spine sections where the visual signal "this is a
 * sequence, not a list" matters. Cards include a big step number,
 * a short benefit headline, and detail bullets. Arrow connectors
 * render between cards on desktop; hide on mobile (cards stack).
 */
export function PureStepFlow({
  steps,
}: {
  steps: {
    /** Short step label (e.g. "CAPTURE"). Renders as a mono eyebrow. */
    label: string;
    /** One-line benefit headline (customer voice). */
    headline: string;
    /** Concrete capabilities, ~3-4 lines each. */
    bullets: string[];
    /** Accent for the step number. Cycles lime/orange/ai if unset. */
    color?: PureMicroColor;
  }[];
}) {
  return (
    <div className="pure-step-flow">
      {steps.map((s, i) => {
        const fallback: PureMicroColor[] = ["lime", "orange", "ai"];
        const color = s.color ?? fallback[i % fallback.length];
        return (
          <article key={s.label} className="pure-step">
            <div
              className="pure-step-num mono"
              aria-hidden
              style={{ color: microVar(color) }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="pure-step-label mono">{s.label}</div>
            <h3 className="pure-step-headline">{s.headline}</h3>
            <ul className="pure-step-bullets">
              {s.bullets.map((b, bi) => (
                <li key={bi}>{b}</li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
