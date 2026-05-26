"use client";

import { type ReactNode } from "react";
import "../styles/components/pure-faq.css";

/**
 * PureFAQ — accordion-style Q&A list using native <details>. No JS
 * state — keeps it server-renderable and accessible.
 */
export function PureFAQ({
  items,
}: {
  items: { q: string; a: ReactNode }[];
}) {
  return (
    <div className="pure-faq">
      {items.map((it, i) => (
        <details key={i} className="pure-faq-item">
          <summary className="pure-faq-q">
            <span>{it.q}</span>
            <span className="pure-faq-mark" aria-hidden>+</span>
          </summary>
          <div className="pure-faq-a">{it.a}</div>
        </details>
      ))}
    </div>
  );
}
