"use client";
import { useRef, useState, useEffect, useCallback } from "react";

interface Slide {
  src: string;
  alt: string;
  title: string;
  desc: string;
  href?: string;
  linkText?: string;
}

export default function HeroCarousel({ slides }: { slides: Slide[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  const scrollTo = useCallback(
    (idx: number) => {
      if (!ref.current) return;
      const items = ref.current.querySelectorAll<HTMLElement>(".hero-c-item");
      if (!items[idx]) return;
      const container = ref.current;
      const item = items[idx];
      const scrollLeft =
        item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    },
    []
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Scroll tracking
    const onScroll = () => {
      const items = el.querySelectorAll<HTMLElement>(".hero-c-item");
      const center = el.scrollLeft + el.offsetWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      items.forEach((item, i) => {
        const itemCenter = item.offsetLeft + item.offsetWidth / 2;
        const dist = Math.abs(center - itemCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      setActive(closest);
    };

    // Mouse drag
    const onMouseDown = (e: MouseEvent) => {
      dragState.current = { isDragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
      el.style.cursor = "grabbing";
      el.style.scrollSnapType = "none";
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - dragState.current.startX) * 1.5;
      el.scrollLeft = dragState.current.scrollLeft - walk;
    };
    const onMouseUp = () => {
      if (!dragState.current.isDragging) return;
      dragState.current.isDragging = false;
      el.style.cursor = "";
      el.style.scrollSnapType = "x proximity";
      // Snap to nearest slide after drag
      const items = el.querySelectorAll<HTMLElement>(".hero-c-item");
      const center = el.scrollLeft + el.offsetWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      items.forEach((item, i) => {
        const itemCenter = item.offsetLeft + item.offsetWidth / 2;
        const dist = Math.abs(center - itemCenter);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      const target = items[closest];
      if (target) {
        el.scrollTo({ left: target.offsetLeft - el.offsetWidth / 2 + target.offsetWidth / 2, behavior: "smooth" });
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    setTimeout(() => scrollTo(0), 100);

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [scrollTo]);

  return (
    <div style={{ position: "relative" }}>
      {/* Carousel track */}
      <div ref={ref} className="hero-c-track">
        {slides.map((slide, i) => (
          <div
            key={i}
            className="hero-c-item"
            style={{
              opacity: active === i ? 1 : 0.4,
              filter: active === i ? "none" : "brightness(0.6)",
              transition: "opacity 0.4s, filter 0.4s",
            }}
          >
            <img src={slide.src} alt={slide.alt} draggable={false} style={{ pointerEvents: "none" }} />
            <div className="hero-c-caption">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p>{slide.title}</p>
                  <p>{slide.desc}</p>
                </div>
                {slide.href && slide.linkText && (
                  <a
                    href={slide.href}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      marginLeft: 16,
                    }}
                  >
                    {slide.linkText} &rarr;
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Arrows */}
      <button
        className="hero-c-arrow hero-c-arrow-left"
        onClick={() => scrollTo(Math.max(0, active - 1))}
        aria-label="Previous"
        style={{ opacity: active === 0 ? 0.2 : 1 }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        className="hero-c-arrow hero-c-arrow-right"
        onClick={() => scrollTo(Math.min(slides.length - 1, active + 1))}
        aria-label="Next"
        style={{ opacity: active === slides.length - 1 ? 0.2 : 1 }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>

      {/* Dots */}
      <div className="hero-c-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`hero-c-dot ${active === i ? "active" : ""}`}
            onClick={() => scrollTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
