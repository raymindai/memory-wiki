"use client";

import type { ReactNode } from "react";
import "../styles/components/pure-prose.css";

/**
 * PureProse — long-form article column.
 *
 * Use for essays, manifestos, docs — anywhere the page is mostly
 * prose rather than marketing cards. Wraps children in an <article>
 * with a comfortable max width and applies pure-token-based styling
 * to h2/h3/p/ul/ol/blockquote/code/em/strong/a/hr inside it.
 *
 * Compose freely:
 *   <PureProse>
 *     <h2>Section heading</h2>
 *     <p>Body.</p>
 *     <ul><li>Item</li></ul>
 *   </PureProse>
 */
export function PureProse({
  children,
  maxWidth = 720,
}: {
  children: ReactNode;
  /** Override the default 720px reading width. */
  maxWidth?: number;
}) {
  return (
    <article className="pure-prose" style={{ maxWidth }}>
      {children}
    </article>
  );
}
