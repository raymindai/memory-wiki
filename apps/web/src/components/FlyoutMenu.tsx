"use client";

/**
 * FlyoutMenu — submenu primitive used inside the auth/account menu.
 * Portals into <body> so it can extend past parent overflow-hidden
 * containers (auth menu would otherwise clip it invisible).
 *
 * Behavior:
 *   - Hover opens the panel; mouse-leave closes after a short grace
 *     period so the cursor can travel across the gap to the panel.
 *   - Clicking the trigger locks the panel open until an outside
 *     click dismisses it (escape hatch for stylus / keyboard users).
 *
 * Earlier Tailwind `group-hover` version dropped the submenu the
 * moment the cursor left the row's exact bounds — common cause of
 * "hover doesn't work" on nested menus.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function FlyoutMenu({
  label,
  icon,
  width,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  width: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // When the user OPENS the flyout by clicking the row (rather than
  // hovering), we lock it open and dismiss only on outside click.
  const [clickLocked, setClickLocked] = useState(false);
  // Position of the flyout panel in viewport coordinates. Computed
  // from the trigger row's getBoundingClientRect so the panel — which
  // we portal into document.body to escape the parent auth menu's
  // overflow-hidden — can sit just to the right of the row. Without
  // the portal, the panel was clipped invisible the moment it tried
  // to extend past the auth menu's bounds; that's why earlier clicks
  // didn't appear to do anything.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computePos = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    // Right of the row, 8px gap. Bottom-aligned to the row so the
    // panel grows upward (the rows sit near the bottom of the auth
    // menu so this prevents the panel running off-screen).
    setPos({ top: r.bottom, left: r.right + 8 });
  };

  useEffect(() => {
    if (!open) return;
    computePos();
    const onScroll = () => computePos();
    const onResize = () => computePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!clickLocked || !open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideWrapper = wrapperRef.current?.contains(t);
      const insidePanel = panelRef.current?.contains(t);
      if (!insideWrapper && !insidePanel) {
        setOpen(false);
        setClickLocked(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [clickLocked, open]);

  const cancelClose = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  };
  const scheduleClose = () => {
    if (clickLocked) return;
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={buttonRef}
        onClick={() => {
          setOpen((o) => !o);
          setClickLocked(true);
        }}
        className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center justify-between"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1.5L5.5 4L3 6.5"/></svg>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          // data-flyout-portal lets the parent menu's outside-click
          // handler (showAuthMenu's useEffect) recognize clicks inside
          // this portaled panel as "still inside the menu surface" and
          // skip closing. Without it the mousedown closed the auth
          // menu, unmounting the FlyoutMenu wrapper before the
          // click event could land on the option button.
          data-flyout-portal
          className="rounded-lg shadow-xl py-1 max-h-[calc(100vh-40px)] overflow-y-auto"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: "translateY(-100%)",
            width,
            zIndex: 10000,
            background: "var(--menu-bg)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
