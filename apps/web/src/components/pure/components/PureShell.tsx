"use client";

import { useState, useCallback, type ReactNode } from "react";
import "../styles/components/pure-shell.css";
import type { PureTheme } from "../types";

/**
 * PureShell — the v8-frontier wrapper. Owns theme state and exposes
 * it to children that need the matching blob asset / theme-conditional
 * rendering.
 */
export function PureShell({
  children,
  initialTheme = "dark",
  locale = "en",
}: {
  children: (theme: PureTheme, toggleTheme: () => void) => ReactNode;
  initialTheme?: PureTheme;
  /** Drives Pretendard for CJK locales + word-break tuning. */
  locale?: "en" | "ko";
}) {
  const [theme, setTheme] = useState<PureTheme>(initialTheme);
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return (
    <div
      className="v8-frontier pure-root"
      data-frontier-theme={theme}
      data-frontier-approach="pure"
      data-locale={locale}
      lang={locale}
    >
      {/* Lightweight backdrop — uses the DARK morph in both themes:
          on dark bg it sits as a darker shape, on light bg it shows
          as a clearly visible dark blob. Opacity tuned per theme. */}
      <div className="pure-shell-backdrop" aria-hidden>
        <img
          className="pure-shell-backdrop-morph"
          src="/brand/mwblob_morph_dark.svg"
          alt=""
        />
      </div>
      <div className="pure-shell-content">
        {children(theme, toggle)}
      </div>
    </div>
  );
}
