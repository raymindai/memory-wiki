"use client";

import "../styles/components/pure-trust-strip.css";

/**
 * PureTrustStrip — single-row strip of trust/policy promises. Sits
 * between heavy sections to answer "is this safe?" objections in
 * one glance. Each item is a short label + body line.
 */
export function PureTrustStrip({
  items,
}: {
  items: { label: string; body: string }[];
}) {
  return (
    <div className="pure-trust-strip">
      {items.map((it) => (
        <div key={it.label} className="pure-trust-item">
          <div className="pure-trust-label mono">{it.label}</div>
          <div className="pure-trust-body">{it.body}</div>
        </div>
      ))}
    </div>
  );
}
