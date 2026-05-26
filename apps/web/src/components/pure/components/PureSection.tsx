"use client";

import { type ReactNode } from "react";
import "../styles/components/pure-section.css";

/**
 * PureSection — labelled section wrapper. Number + eyebrow + display
 * heading + optional lede.
 */
export function PureSection({
  num,
  eyebrow,
  title,
  lede,
  align = "left",
  children,
  id,
  mark = false,
}: {
  num?: string;
  eyebrow?: string;
  title?: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  children?: ReactNode;
  id?: string;
  /** When true, render a small crisp animated blob mark inline with
   *  the eyebrow row — a branded section opener that does not bleed
   *  into the background. */
  mark?: boolean;
}) {
  return (
    <section className="pure-section" id={id}>
      <div className={`pure-section-head${align === "center" ? " is-center" : ""}`}>
        {(num || eyebrow || mark) && (
          <div className="pure-section-eyebrow">
            {mark && <span className="pure-section-mark" aria-hidden />}
            {num && <span className="pure-section-num mono">{num}</span>}
            {eyebrow && <span className="eyebrow mono">{eyebrow}</span>}
          </div>
        )}
        {title && <h2 className="display-2">{title}</h2>}
        {lede && <p className="pure-section-lede">{lede}</p>}
      </div>
      <div className="pure-section-body">{children}</div>
    </section>
  );
}
