"use client";

import { useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light";

/**
 * Marketing-side dark/light toggle for DocsNav and other public-site
 * surfaces. Mirrors the editor's theme pattern: persists to
 * `mw-theme` in localStorage and sets `data-theme` on the
 * documentElement so the same CSS variables flip.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = (typeof window !== "undefined"
      ? (localStorage.getItem("mw-theme") as Theme | null)
      : null);
    const initial: Theme = saved || (document.documentElement.getAttribute("data-theme") as Theme | null) || "dark";
    setTheme(initial);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("mw-theme", next);
    } catch { /* private mode — ignore */ }
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.background = next === "light" ? "#faf9f7" : "#09090b";
  }, [theme]);

  // Pre-mount placeholder keeps the nav layout from shifting when the
  // client picks up the persisted theme. Renders an empty button of the
  // same dimensions.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "transparent",
          border: "1px solid var(--border-dim)",
        }}
      />
    );
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        background: "transparent",
        border: "1px solid var(--border-dim)",
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "color var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border-dim)"; }}
    >
      {isLight ? (
        // Moon — clicking it switches to dark
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun — clicking it switches to light
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
