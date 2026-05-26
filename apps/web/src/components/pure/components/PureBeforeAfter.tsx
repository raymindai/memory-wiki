"use client";

import "../styles/components/pure-before-after.css";

/**
 * PureBeforeAfter — 2-column lists (problem / solution).
 */
export function PureBeforeAfter({
  before,
  after,
}: {
  before: { title: string; items: string[] };
  after: { title: string; items: string[] };
}) {
  return (
    <div className="pure-ba">
      <article className="pure-ba-col">
        <div className="pure-ba-title mono">{before.title}</div>
        <ul className="pure-ba-list">
          {before.items.map((it) => <li key={it}>{it.replace(/^- /, "")}</li>)}
        </ul>
      </article>
      <article className="pure-ba-col pure-ba-col-after">
        <div className="pure-ba-title mono">{after.title}</div>
        <ul className="pure-ba-list">
          {after.items.map((it) => <li key={it}>{it.replace(/^- /, "")}</li>)}
        </ul>
      </article>
    </div>
  );
}
