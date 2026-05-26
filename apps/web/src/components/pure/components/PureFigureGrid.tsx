"use client";

import "../styles/components/pure-figure-grid.css";

/**
 * PureFigureGrid — image + caption grid (3 columns by default).
 */
export function PureFigureGrid({
  figures,
  columns = 3,
}: {
  figures: { src: string; alt: string; title: string; sub?: string }[];
  columns?: 2 | 3;
}) {
  return (
    <div className="pure-figure-grid" data-cols={columns}>
      {figures.map((f) => (
        <figure key={f.src} className="pure-figure">
          <div className="pure-figure-img">
            <img src={f.src} alt={f.alt} loading="lazy" />
          </div>
          <figcaption>
            <div className="pure-figure-title">{f.title}</div>
            {f.sub && <div className="pure-figure-sub mono">{f.sub}</div>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
