"use client";

import "../styles/components/pure-timeline.css";

/**
 * PureTimeline — numbered step list.
 */
export function PureTimeline({
  steps,
}: {
  steps: { marker: string; text: string }[];
}) {
  return (
    <ol className="pure-timeline">
      {steps.map((s, i) => (
        <li key={s.marker} className="pure-timeline-step">
          <span className="pure-timeline-num mono">{String(i + 1).padStart(2, "0")}</span>
          <div className="pure-timeline-body">
            <div className="pure-timeline-marker mono">{s.marker}</div>
            <div className="pure-timeline-text">{s.text}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
