"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import "../styles/components/pure-footer.css";
import type { PureTheme } from "../types";

/**
 * PureFooter — multi-column footer + bottom row with parent line.
 */
export function PureFooter({
  columns,
  bottomLeft,
  bottomRight,
  tagline,
  parent,
  theme = "dark",
}: {
  columns: { title: string; links: { label: string; href: string }[] }[];
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  /** One-line tagline under the brand wordmark. */
  tagline?: string;
  /** Parent-company line (e.g. "A product of Raymind.AI"). */
  parent?: { label: string; href?: string };
  /** Drives which morph variant shows for the brand symbol. */
  theme?: PureTheme;
}) {
  return (
    <footer className="pure-footer">
      <div className="pure-footer-inner">
        <div className="pure-footer-top">
          <Link href="/" className="pure-footer-brand" aria-label="Memory.Wiki">
            <img
              className="pure-footer-symbol"
              src={theme === "dark" ? "/brand/mwblob_morph.svg" : "/brand/mwblob_morph_dark.svg"}
              alt=""
              aria-hidden
            />
            <span className="pure-footer-brand-word">
              <span className="brand-word-memory">memory</span>
              <span className="brand-word-wiki">.wiki</span>
            </span>
            {tagline && <span className="pure-footer-tagline">{tagline}</span>}
          </Link>
          <div className="pure-footer-cols">
            {columns.map((c) => (
              <div key={c.title} className="pure-footer-col">
                <div className="pure-footer-col-title mono">{c.title}</div>
                {c.links.map((l) => (
                  l.href.startsWith("mailto:")
                    ? <a key={l.label} href={l.href} className="pure-footer-link">{l.label}</a>
                    : <Link key={l.label} href={l.href} className="pure-footer-link">{l.label}</Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="pure-footer-bottom">
          <span className="caption mono pure-footer-bottom-left">
            {parent ? (
              parent.href ? (
                <a href={parent.href} className="pure-footer-parent" target="_blank" rel="noopener noreferrer">
                  {parent.label}
                </a>
              ) : (
                <span className="pure-footer-parent">{parent.label}</span>
              )
            ) : bottomLeft}
          </span>
          <span className="caption mono">{bottomRight}</span>
        </div>
      </div>
    </footer>
  );
}
