"use client";

// Hub Pulse — Layer 1 of the "growing knowledge hub" surface on the Start
// tab. A 365-day contribution heatmap + streak + totals strip, designed
// to give the user one daily reason to open memory.wiki: see what they built,
// keep the streak alive.
//
// Anti-patterns explicitly avoided (see memory note
// `start_growing_hub_concept_2026_05`):
//   - No badges / gamification trophies
//   - No shame copy when streak breaks ("you lost it!")
//   - No social comparison
//   - No generic line chart over time
// Just visceral receipts: cells that fill in, a number that ticks up.

import { useEffect, useState } from "react";

interface PulseDay {
  date: string;       // YYYY-MM-DD
  count: number;      // captures + edits + bundle creations on this day
}

interface PulseData {
  days: PulseDay[];
  currentStreak: number;
  longestStreak: number;
  totalDocs: number;
  totalViews: number;
  windowStart: string;
  windowEnd: string;
}

interface Props {
  authHeaders: Record<string, string>;
  /** Optional: hide the panel entirely until N captures exist. The
   *  caller can pass a quick pre-check; the panel still renders if the
   *  API ever returns docs >= the floor anyway. Defaults to 3. */
  minDocsToShow?: number;
}

function intensityClass(count: number): string {
  if (count === 0) return "pulse-cell-0";
  if (count === 1) return "pulse-cell-1";
  if (count <= 3) return "pulse-cell-2";
  if (count <= 6) return "pulse-cell-3";
  return "pulse-cell-4";
}

// Color the cell via inline style (so we can react to the live theme
// CSS variables without touching globals.css). Empty cells get a
// near-background neutral; populated cells climb the accent scale.
function intensityColor(count: number): string {
  if (count === 0) return "color-mix(in srgb, var(--text-primary) 4%, var(--surface) 96%)";
  if (count === 1) return "color-mix(in srgb, var(--text-primary) 25%, var(--surface) 75%)";
  if (count <= 3) return "color-mix(in srgb, var(--text-primary) 50%, var(--surface) 50%)";
  if (count <= 6) return "color-mix(in srgb, var(--text-primary) 75%, var(--surface) 25%)";
  return "var(--text-primary)";
}

export default function HubPulse({ authHeaders, minDocsToShow = 3 }: Props) {
  const [data, setData] = useState<PulseData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/hub/pulse", { headers: authHeaders });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;
  if (!data) return null;
  // Below the floor — let the parent show the onboarding-friendly Start
  // content instead. The "growing hub" framing wants real growth to
  // visualize, not a near-empty grid.
  if (data.totalDocs < minDocsToShow) return null;

  // Bucket days into 52 weeks × 7 cells (oldest first). Pad the leading
  // partial week with empty placeholders so the columns align to Sun→Sat.
  const firstDate = new Date(data.days[0].date + "T00:00:00Z");
  const firstDayOfWeek = firstDate.getUTCDay(); // 0 = Sun
  const cells: (PulseDay | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...data.days,
  ];
  const weeks: (PulseDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  // Latest week may be a partial — pad to 7 cells with nulls.
  while (weeks[weeks.length - 1].length < 7) {
    weeks[weeks.length - 1].push(null);
  }

  // Month labels along the top, only on weeks that start a new month.
  let prevMonth = -1;
  const monthLabels = weeks.map((week) => {
    const first = week.find((d) => d) as PulseDay | undefined;
    if (!first) return "";
    const m = parseInt(first.date.slice(5, 7), 10);
    if (m === prevMonth) return "";
    prevMonth = m;
    return [
      "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ][m];
  });

  const recentCount = data.days.slice(-7).reduce((s, d) => s + d.count, 0);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-dim)",
        borderRadius: 12,
        padding: "16px 18px 14px",
      }}
    >
      {/* Header strip: streak + numbers */}
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-y-2">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono uppercase"
            style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}
          >
            Hub pulse
          </span>
          <span className="text-caption" style={{ color: "var(--text-muted)" }}>
            {data.currentStreak > 0 ? (
              <>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  {data.currentStreak}
                </span>
                {" "}day streak
                {data.longestStreak > data.currentStreak && (
                  <span style={{ color: "var(--text-faint)" }}>
                    {" "}/ longest {data.longestStreak}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: "var(--text-faint)" }}>
                Capture today to start a streak
              </span>
            )}
          </span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="text-caption" style={{ color: "var(--text-faint)" }}>
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
              {recentCount}
            </span>
            {" "}captures (7d)
          </span>
          <span className="text-caption" style={{ color: "var(--text-faint)" }}>
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
              {data.totalDocs}
            </span>
            {" "}docs total
          </span>
          {data.totalViews > 0 && (
            <span className="text-caption" style={{ color: "var(--text-faint)" }}>
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                {data.totalViews.toLocaleString()}
              </span>
              {" "}views
            </span>
          )}
        </div>
      </div>

      {/* Heatmap: month labels + 7×52 grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
            gap: 2,
            fontSize: 9,
            color: "var(--text-faint)",
            fontFamily: "var(--font-mono)",
            marginLeft: 18, // align with cells (skip the day-row labels gutter)
          }}
        >
          {monthLabels.map((label, i) => (
            <span key={i} style={{ textAlign: "left", height: 12 }}>{label}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {/* Day-of-week labels (Mon / Wed / Fri shown sparsely) */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: "repeat(7, 1fr)",
              fontSize: 8,
              color: "var(--text-faint)",
              fontFamily: "var(--font-mono)",
              width: 16,
              gap: 2,
            }}
          >
            {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
              <span
                key={i}
                style={{ display: "flex", alignItems: "center", height: 10 }}
              >
                {d}
              </span>
            ))}
          </div>
          {/* The grid itself */}
          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridTemplateRows: "repeat(7, 1fr)",
              gridAutoColumns: "minmax(0, 1fr)",
              gap: 2,
              flex: 1,
            }}
          >
            {weeks.map((week, wIdx) =>
              week.map((day, dIdx) => {
                if (!day) {
                  return (
                    <div
                      key={`${wIdx}-${dIdx}`}
                      style={{ height: 10, borderRadius: 2, opacity: 0 }}
                    />
                  );
                }
                return (
                  <div
                    key={`${wIdx}-${dIdx}`}
                    title={`${day.date} (${day.count} ${day.count === 1 ? "capture" : "captures"})`}
                    className={intensityClass(day.count)}
                    style={{
                      height: 10,
                      borderRadius: 2,
                      background: intensityColor(day.count),
                      cursor: "default",
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Legend (subtle) */}
      <div
        className="flex items-center gap-1.5 mt-3"
        style={{ fontSize: 9, color: "var(--text-faint)", justifyContent: "flex-end" }}
      >
        <span>quiet</span>
        {[0, 1, 3, 6, 10].map((n) => (
          <span
            key={n}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: intensityColor(n),
            }}
          />
        ))}
        <span>active</span>
      </div>
    </div>
  );
}
