"use client";

/**
 * PureTOC — table of contents that lives in the right margin of a
 * 720px reading column (manifesto/how/benchmark/spec style).
 *
 * Two behaviours stitched together:
 *   1. Initial position aligns with the page's eyebrow/readtime so
 *      the TOC and the content visually start at the same Y.
 *   2. Once the eyebrow scrolls past the comfortable read line, the
 *      TOC snaps to a sticky-style fixed top.
 *
 * Active section is tracked with IntersectionObserver against the
 * heading IDs passed in via `items`. Clicking an item scrolls
 * smoothly to that anchor.
 *
 * Hidden under 1180px viewport (no room beside a 720 column).
 */

import { useEffect, useRef, useState } from "react";

interface PureTOCItem {
  id: string;
  label: string;
}

interface PureTOCProps {
  items: PureTOCItem[];
  /** Eyebrow label above the list. Defaults to "On this page". */
  heading?: string;
  /** CSS selector for the element the TOC should align its top with
   *  at scroll=0. Defaults to ".pure-manifesto-readtime" — the
   *  shared eyebrow used by manifesto/how/benchmark/install. */
  alignTo?: string;
}

const STICKY_TOP = 120;

export function PureTOC({ items, heading = "On this page", alignTo = ".pure-manifesto-readtime" }: PureTOCProps) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [topPx, setTopPx] = useState<number>(STICKY_TOP);
  const rafRef = useRef<number | null>(null);

  // Track active section with IntersectionObserver.
  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) return;
    const elements: HTMLElement[] = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const firstVisible = items.find((it) => visible.has(it.id));
        if (firstVisible) setActiveId(firstVisible.id);
      },
      { rootMargin: "-80px 0px -40% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  // Dynamic top: align with eyebrow when visible, snap to STICKY_TOP
  // when the eyebrow has scrolled past. rAF-throttled for cheap scroll.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateTop = () => {
      const anchor = document.querySelector(alignTo) as HTMLElement | null;
      if (!anchor) {
        setTopPx(STICKY_TOP);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      // Use the eyebrow's viewport Y while it's still on-screen and
      // above the comfortable read line; otherwise snap to STICKY_TOP.
      const next = Math.max(STICKY_TOP, Math.round(rect.top));
      setTopPx(next);
    };
    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateTop();
      });
    };
    updateTop();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [alignTo]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }

  if (items.length === 0) return null;

  return (
    <aside className="pure-toc" aria-label={heading} style={{ top: `${topPx}px` }}>
      <div className="pure-toc-heading mono">{heading}</div>
      <ol className="pure-toc-list">
        {items.map((it, i) => (
          <li key={it.id} className={`pure-toc-item ${activeId === it.id ? "is-active" : ""}`}>
            <a
              href={`#${it.id}`}
              onClick={(e) => handleClick(e, it.id)}
              className="pure-toc-link"
            >
              <span className="pure-toc-num mono">{String(i + 1).padStart(2, "0")}</span>
              <span className="pure-toc-label">{it.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
