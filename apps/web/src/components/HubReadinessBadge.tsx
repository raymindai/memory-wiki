"use client";

import { useState } from "react";

// Per-(scope × mode) accuracy 0..1
type Mode = "paste_full" | "paste_compact" | "browse";
type Scope = "hub" | "bundle" | "doc";
type Scores = Partial<Record<Scope, Partial<Record<Mode, number>>>>;
type RunnerBreakdown = {
  accuracy: number;
  perRunner: Record<string, number>;
  tool_use_rate: number | null;
  cells_total: number;
  cells_passing: number;
};
type Breakdown = Partial<Record<Scope, Partial<Record<Mode, RunnerBreakdown | null>>>>;

export interface HubReadinessProps {
  headline: string | null;
  roundLabel: string | null;
  totalCells: number;
  passingCells: number;
  scores: Scores;
  breakdown: Breakdown;
  lastRunAt: string | null;
}

const SCOPE_LABEL: Record<Scope, string> = {
  hub: "Hub URL",
  bundle: "Bundle URL",
  doc: "Doc URL",
};
const MODE_LABEL: Record<Mode, string> = {
  paste_full: "Paste · full",
  paste_compact: "Paste · compact",
  browse: "Browse (AI fetches)",
};

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function scoreColor(n: number | null | undefined): string {
  if (n == null) return "var(--text-faint)";
  if (n >= 0.95) return "var(--accent)";
  if (n >= 0.85) return "var(--text-primary)";
  if (n >= 0.7) return "#d29922";
  return "#f85149";
}

export default function HubReadinessBadge({
  headline,
  roundLabel,
  totalCells,
  passingCells,
  scores,
  breakdown,
  lastRunAt,
}: HubReadinessProps) {
  const [open, setOpen] = useState(false);
  if (!headline) return null;

  const overall = totalCells > 0 ? passingCells / totalCells : 0;
  const overallColor = scoreColor(overall);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-dim)",
        }}
      >
        <span
          className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold tabular-nums"
          style={{ background: overallColor, color: "#000" }}
          title="MWBench cross-AI readiness"
        >
          {pct(overall)}
        </span>
        <span className="flex-1 min-w-0">
          <span
            className="text-caption uppercase tracking-wider mr-2"
            style={{ color: "var(--text-faint)" }}
          >
            AI readiness
          </span>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {headline}
          </span>
        </span>
        <span className="text-caption" style={{ color: "var(--text-faint)" }}>
          {open ? "Hide" : "Details"}
        </span>
      </button>

      {open && (
        <div
          className="mt-2 p-4 rounded-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-dim)",
          }}
        >
          <div className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
            {roundLabel ? `${roundLabel} · ` : ""}
            {passingCells} of {totalCells} cells passing
            {lastRunAt ? ` · last run ${new Date(lastRunAt).toISOString().slice(0, 10)}` : ""}
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-dim)" }}>
                <th className="text-left py-1.5 pr-3 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  URL shape
                </th>
                {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                  <th key={m} className="text-right py-1.5 px-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                    {MODE_LABEL[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(SCOPE_LABEL) as Scope[]).map((scope) => {
                const row = scores[scope] || {};
                return (
                  <tr key={scope} style={{ borderBottom: "1px solid var(--border-dim)" }}>
                    <td className="py-2 pr-3" style={{ color: "var(--text-primary)" }}>
                      {SCOPE_LABEL[scope]}
                    </td>
                    {(Object.keys(MODE_LABEL) as Mode[]).map((m) => {
                      const v = row[m];
                      return (
                        <td
                          key={m}
                          className="text-right py-2 px-2 tabular-nums font-medium"
                          style={{ color: scoreColor(v) }}
                        >
                          {pct(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Per-runner detail when expanded — most useful for owners
              spot-checking which AI vendor under-performs. */}
          <div className="mt-4">
            <div
              className="text-caption uppercase tracking-wider mb-2"
              style={{ color: "var(--text-faint)" }}
            >
              Per-runner
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(SCOPE_LABEL) as Scope[]).map((scope) => {
                const browseAgg = breakdown[scope]?.browse;
                if (!browseAgg || !browseAgg.perRunner) return null;
                return (
                  <div
                    key={scope}
                    className="p-3 rounded"
                    style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}
                  >
                    <div
                      className="text-xs font-semibold mb-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {SCOPE_LABEL[scope]} · Browse
                    </div>
                    <div className="space-y-1">
                      {Object.entries(browseAgg.perRunner)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([runner, acc]) => (
                          <div
                            key={runner}
                            className="flex items-center justify-between text-xs"
                          >
                            <span style={{ color: "var(--text-secondary)" }}>
                              {runner}
                            </span>
                            <span
                              className="tabular-nums font-medium"
                              style={{ color: scoreColor(acc) }}
                            >
                              {pct(acc)}
                            </span>
                          </div>
                        ))}
                      {browseAgg.tool_use_rate != null && (
                        <div
                          className="flex items-center justify-between text-xs pt-1 mt-1"
                          style={{ borderTop: "1px solid var(--border-dim)" }}
                        >
                          <span style={{ color: "var(--text-faint)" }}>
                            tool-use
                          </span>
                          <span
                            className="tabular-nums"
                            style={{ color: scoreColor(browseAgg.tool_use_rate) }}
                          >
                            {pct(browseAgg.tool_use_rate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="mt-3 text-caption"
            style={{ color: "var(--text-faint)" }}
          >
            Measured by{" "}
            <a
              href="https://mdfy.app/gzuNdh_P"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--text-secondary)" }}
            >
              MWBench
            </a>{" "}
            — cross-AI eval across Claude / OpenAI / Gemini, judged by
            literal corpus quote per claim.
          </div>
        </div>
      )}
    </div>
  );
}
