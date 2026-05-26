"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import "../styles/components/pure-feature-grid.css";
import { microVar, type PureMicroColor, type ProviderBrand } from "../types";
import { ProviderIcon } from "./ProviderIcon";

/**
 * PureFeatureGrid — small cards in N-column grid (no images).
 */
export function PureFeatureGrid({
  items,
  columns = 4,
}: {
  items: {
    title: string;
    body: ReactNode;
    color?: PureMicroColor;
    /** Brand icon shown beside the title (e.g. chrome, vscode, mcp). */
    brand?: ProviderBrand;
    /** Optional shortcut — renders an "Open ↗" link in the bottom-right. */
    href?: string;
    /** Override the shortcut label. Default: "Open". */
    hrefLabel?: string;
  }[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className="pure-feature-grid" data-cols={columns}>
      {items.map((f) => (
        <article key={f.title} className="pure-feature">
          {f.color && (
            <span className="pure-feature-dot" aria-hidden style={{ background: microVar(f.color) }} />
          )}
          <h3 className="pure-feature-title">
            {f.brand && (
              <span className="pure-feature-icon" aria-hidden>
                <ProviderIcon brand={f.brand} />
              </span>
            )}
            <span>{f.title}</span>
          </h3>
          <p className="pure-feature-body">{f.body}</p>
          {f.href && (
            <Link href={f.href} className="pure-feature-open mono">
              {f.hrefLabel ?? "Open"} <span aria-hidden>↗</span>
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}
