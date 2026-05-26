"use client";

import { type ReactNode } from "react";
import "../styles/components/pure-compare-table.css";

/**
 * PureCompareTable — comparison table with yes / no / partial cells.
 */
export function PureCompareTable({
  columns,
  rows,
  footnote,
}: {
  columns: string[];
  rows: { feature: string; vals: string[] }[];
  footnote?: ReactNode;
}) {
  return (
    <>
      <div className="pure-table-wrap">
        <table className="pure-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} className={i === 0 ? "pure-table-feature" : "mono"}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.feature}>
                <td className="pure-table-feature">{r.feature}</td>
                {r.vals.map((v, i) => (
                  <td key={i} className="pure-table-cell">
                    {v === "yes" ? <span className="pure-table-yes mono">yes</span> :
                     v === "no" ? <span className="pure-table-no mono">no</span> :
                     v === "partial" ? <span className="pure-table-partial mono">partial</span> :
                     v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="pure-table-footnote">{footnote}</p>}
    </>
  );
}
