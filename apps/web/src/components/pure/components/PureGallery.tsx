"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import "../styles/components/pure-gallery.css";

/**
 * PureGallery — replacement for HeroCarousel. Horizontal scroll-snap
 * track with dot navigation, drag-to-scroll, and click-to-open
 * lightbox. Designed flat for v8 aesthetic.
 */
export function PureGallery({
  slides,
  autoAdvance = 6000,
}: {
  slides: { src: string; alt: string; title: string; desc?: string; href?: string; linkText?: string }[];
  autoAdvance?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const goTo = useCallback((i: number) => {
    if (!ref.current) return;
    const items = ref.current.querySelectorAll<HTMLElement>(".pure-gallery-item");
    const idx = ((i % items.length) + items.length) % items.length;
    if (!items[idx]) return;
    const target = items[idx];
    ref.current.scrollTo({
      left: target.offsetLeft - ref.current.offsetWidth / 2 + target.offsetWidth / 2,
      behavior: "smooth",
    });
  }, []);

  // Track which slide is centered via scroll
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const items = el.querySelectorAll<HTMLElement>(".pure-gallery-item");
        const center = el.scrollLeft + el.offsetWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        items.forEach((it, i) => {
          const d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - center);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        setActive(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Auto-advance — pauses on hover or while lightbox is open
  useEffect(() => {
    if (!autoAdvance || paused || lightbox !== null) return;
    const t = setTimeout(() => goTo(active + 1), autoAdvance);
    return () => clearTimeout(t);
  }, [active, paused, autoAdvance, goTo, lightbox]);

  // Mouse drag to scroll the track.
  //
  // Critical: setPointerCapture is deferred until a real drag begins
  // (> 4px movement). Otherwise a simple click would be captured by
  // the track and the article's onClick — including the lightbox
  // trigger — would never fire.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = 0;
    let startScroll = 0;
    let isDown = false;
    let moved = false;
    let activePointerId: number | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;            // native touch swipe handles itself
      if ((e.target as HTMLElement).closest("a, button")) return; // don't hijack link clicks
      isDown = true;
      moved = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startScroll = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        el.classList.add("is-dragging");
        try { el.setPointerCapture(e.pointerId); } catch {}
      }
      if (moved) el.scrollLeft = startScroll - dx;
    };
    const onUp = () => {
      if (!isDown) return;
      isDown = false;
      if (moved) {
        el.classList.remove("is-dragging");
        if (activePointerId !== null) {
          try { el.releasePointerCapture(activePointerId); } catch {}
        }
        // snap to nearest slide
        const items = el.querySelectorAll<HTMLElement>(".pure-gallery-item");
        const center = el.scrollLeft + el.offsetWidth / 2;
        let best = 0, bestDist = Infinity;
        items.forEach((it, i) => {
          const d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - center);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        goTo(best);
        // suppress the synthetic click that follows the drag release
        const blockClick = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener("click", blockClick, { capture: true, once: true });
      }
      activePointerId = null;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [goTo]);

  // ESC closes lightbox, arrows navigate within it
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft")  setLightbox(((lightbox - 1) + slides.length) % slides.length);
      if (e.key === "ArrowRight") setLightbox((lightbox + 1) % slides.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, slides.length]);

  return (
    <>
      <div
        className="pure-gallery"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <button
          type="button"
          className="pure-gallery-nav pure-gallery-prev"
          onClick={() => goTo(active - 1)}
          aria-label="Previous slide"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button
          type="button"
          className="pure-gallery-nav pure-gallery-next"
          onClick={() => goTo(active + 1)}
          aria-label="Next slide"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="pure-gallery-track" ref={ref}>
          {slides.map((s, i) => (
            <article
              key={s.src}
              className={`pure-gallery-item${i === active ? " is-active" : ""}`}
              onClick={() => setLightbox(i)}
            >
              <div className="pure-gallery-img">
                <img src={s.src} alt={s.alt} loading="lazy" draggable={false} />
              </div>
              <div className="pure-gallery-meta">
                <div className="pure-gallery-meta-row">
                  <div className="pure-gallery-title">{s.title}</div>
                  {s.href && (
                    <Link href={s.href} className="pure-gallery-link" onClick={(e) => e.stopPropagation()}>
                      {s.linkText || "Open"}
                    </Link>
                  )}
                </div>
                {s.desc && <div className="pure-gallery-desc">{s.desc}</div>}
              </div>
            </article>
          ))}
        </div>
        <div className="pure-gallery-controls">
          <span className="pure-gallery-count mono">
            {String(active + 1).padStart(2, "0")}<span className="pure-gallery-count-sep">/</span>{String(slides.length).padStart(2, "0")}
          </span>
          <div className="pure-gallery-dots" role="tablist">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`pure-gallery-dot${i === active ? " is-active" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-selected={i === active}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox overlay */}
      {lightbox !== null && (
        <div className="pure-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal>
          <button
            type="button"
            className="pure-lightbox-close"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
          <button
            type="button"
            className="pure-lightbox-nav pure-lightbox-prev"
            onClick={(e) => { e.stopPropagation(); setLightbox(((lightbox - 1) + slides.length) % slides.length); }}
            aria-label="Previous"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button
            type="button"
            className="pure-lightbox-nav pure-lightbox-next"
            onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % slides.length); }}
            aria-label="Next"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <figure className="pure-lightbox-stage" onClick={(e) => e.stopPropagation()}>
            <img src={slides[lightbox].src} alt={slides[lightbox].alt} />
            <figcaption className="pure-lightbox-caption">
              <span className="pure-lightbox-title">{slides[lightbox].title}</span>
              {slides[lightbox].desc && <span className="pure-lightbox-desc">{slides[lightbox].desc}</span>}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
