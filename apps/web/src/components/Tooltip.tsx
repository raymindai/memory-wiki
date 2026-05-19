"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Custom tooltip — instant (no OS delay), styled to match the app theme.
 * Renders into document.body via portal so it escapes overflow:hidden parents.
 * Clamps to viewport so it never gets cut off at any edge.
 */
export default function Tooltip({
  children,
  text,
  position = "bottom",
}: {
  children: ReactNode;
  text: ReactNode;
  position?: "bottom" | "right" | "top" | "left";
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const [edgeAlign, setEdgeAlign] = useState<"left" | "right" | null>(null);
  const handleMouseEnter = () => {
    if (!triggerRef.current || typeof window === "undefined") return;
    // Touch devices fire synthetic mouseEnter on tap but never the
    // matching mouseLeave (the finger lifts off, there's no cursor
    // to track) — the tooltip would then stick visible until the
    // user tapped elsewhere. Mobile-Safari was showing "Close my
    // hub" indefinitely on the header Hub button for exactly this
    // reason. Suppress the tooltip entirely on no-hover devices;
    // the underlying button's title attribute (where present) is
    // the right accessible fallback there.
    if (window.matchMedia && window.matchMedia("(hover: none)").matches) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    // Decide edge alignment up-front based on trigger position so very-left or
    // very-right triggers don't get a centered tooltip that gets clipped.
    if (position === "bottom" || position === "top") {
      if (rect.left < 100) setEdgeAlign("left");
      else if (vw - rect.right < 100) setEdgeAlign("right");
      else setEdgeAlign(null);
    } else {
      setEdgeAlign(null);
    }
    if (position === "bottom") setCoords({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    else if (position === "right") setCoords({ top: rect.top + rect.height / 2, left: rect.right + 6 });
    else if (position === "top") setCoords({ top: rect.top - 6, left: rect.left + rect.width / 2 });
    else if (position === "left") setCoords({ top: rect.top + rect.height / 2, left: rect.left - 6 });
    setShow(true);
  };

  const baseTransform =
    position === "bottom" ? "translateX(-50%)"
    : position === "top" ? "translate(-50%, -100%)"
    : position === "left" ? "translate(-100%, -50%)"
    : "translateY(-50%)";
  // Override centered horizontal transform for edge cases
  const transform = edgeAlign === "left"
    ? (position === "top" ? "translate(0, -100%)" : "translateX(0)")
    : edgeAlign === "right"
      ? (position === "top" ? "translate(-100%, -100%)" : "translateX(-100%)")
      : baseTransform;
  // For edge-aligned tooltips, shift the anchor coords too: align to trigger
  // left or right edge instead of center.
  const adjustedCoords = (() => {
    if (!triggerRef.current || edgeAlign === null) return coords;
    const rect = triggerRef.current.getBoundingClientRect();
    if (edgeAlign === "left") return { top: coords.top, left: rect.left };
    if (edgeAlign === "right") return { top: coords.top, left: rect.right };
    return coords;
  })();

  // Safety net: tooltips that show via mouseEnter rely on a matching
  // mouseLeave to disappear, but several real cases skip mouseLeave —
  // touch taps emulate enter without an exit, fast pointer flicks off
  // the trigger edge, and tooltips on elements that get unmounted /
  // re-rendered while shown. Without these, the tooltip can stick
  // until the user manually moves over it. Dismiss whenever the user
  // interacts somewhere else, scrolls, switches tabs, or hits Escape.
  useEffect(() => {
    if (!show) return;
    const close = () => setShow(false);
    const onPointerDown = (e: Event) => {
      const t = e.target as Node | null;
      if (t && triggerRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("touchstart", onPointerDown, true);
    document.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("touchstart", onPointerDown, true);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      // alignSelf:stretch makes the wrapper fill its flex parent's cross-axis
      // (height) when used inside a horizontal toolbar. Without it, the
      // wrapper is content-height and any `h-full` button inside only fills
      // that smaller box — so hover backgrounds appear chopped at top/bottom.
      // For non-flex parents, alignSelf is silently ignored.
      // alignItems:center keeps fixed-height children (most icons/buttons)
      // vertically centered inside the stretched wrapper instead of pinning
      // them to the top — which is what happened in section headers where the
      // h-5 expand/collapse-all button visibly hugged the top of the h-7 row.
      style={{ display: "inline-flex", alignSelf: "stretch", alignItems: "center" }}
    >
      {children}
      {show && typeof document !== "undefined" && createPortal(
        <div
          ref={(el) => {
            tooltipRef.current = el;
            // Re-clamp into viewport once measured. Prefer keeping the requested
            // direction but shift left/top so the tooltip never gets clipped.
            if (!el) return;
            requestAnimationFrame(() => {
              const r = el.getBoundingClientRect();
              const margin = 6;
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              let dx = 0, dy = 0;
              if (r.left < margin) dx = margin - r.left;
              else if (r.right > vw - margin) dx = vw - margin - r.right;
              if (r.top < margin) dy = margin - r.top;
              else if (r.bottom > vh - margin) dy = vh - margin - r.bottom;
              if (dx || dy) {
                el.style.transform = `${transform} translate(${dx}px, ${dy}px)`;
              }
            });
          }}
          style={{
            position: "fixed",
            top: adjustedCoords.top,
            left: adjustedCoords.left,
            transform,
            zIndex: 99999,
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-body)",
            lineHeight: 1.4,
            fontWeight: 500,
            color: "var(--text-primary)",
            background: "var(--menu-bg)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
            pointerEvents: "none" as const,
            // Wrap once we hit maxWidth instead of bleeding past the
            // background. wordBreak guards against URL-like strings that
            // have no soft-wrap opportunities.
            whiteSpace: "normal" as const,
            wordBreak: "break-word" as const,
            // Floor tooltip width so a near-edge trigger can't collapse it
            // into a 1-character vertical column (saw "B / u / n / d / l /
            // e ..." rendering for a tooltip near the right edge of the
            // viewport). The width still shrinks to fit short text via
            // `width: max-content` semantics from the parent.
            minWidth: 120,
            // Narrower than viewport so even a long sentence still leaves
            // breathing room from the screen edge.
            maxWidth: "min(360px, calc(100vw - 24px))",
            width: "max-content",
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </div>
  );
}
