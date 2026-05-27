"use client";
import { useState, useEffect, useCallback } from "react";

// Bumped to v7 so anyone who saw the old "mdfy.app" welcome card
// gets the new "Memory.Wiki" version of the tour after rebrand.
const STORAGE_KEY = "mw-welcome-seen-v7";

// v6 welcome flow. Five slides, each with one role and one CTA:
//   intro — hook on the v6 thesis (knowledge hub for the AI era)
//   01 capture — paste anything (incl. AI share URLs), get a URL
//   02 hub — captures roll up into a single deployable URL
//   03 deploy — paste hub URL into any AI as context
//   04 surfaces — works from every AI tool
//
// One CTA per slide (the Next button). No inline links — those competed
// with Next and broke the "one screen, one action" rule. The dashboard
// surfaces (Install /memory.wiki, Memory.Wiki Foundations bundle, etc.) are the
// click targets once the user dismisses the overlay.

type Surface = { name: string; desc: string; color: string };

type Slide = {
  step: string | null;
  badge?: string;
  title: string;
  desc: string | null;
  icon: React.ReactNode | null;
  surfaces?: Surface[];
};

const slides: Slide[] = [
  {
    step: null,
    // Explicit line break: keeps the badge on two clean lines instead
    // of orphaning the last word when it wraps on narrow viewports.
    badge: "Your knowledge graph\nas a URL for any AI",
    title: "Your AI memory,\ndeployable to any AI.",
    desc: "ChatGPT, Claude, and Cursor forget you between sessions. Memory.Wiki turns what you write into a URL any AI can read — you decide the shape, Memory.Wiki keeps the index.",
    icon: null,
  },
  {
    step: "01",
    title: "Capture anything.",
    desc: "Paste a ChatGPT or Claude share link. Drop a PDF, DOCX, or code file. Pull a GitHub repo of `.md` files. Each becomes clean markdown at a permanent URL — no signup, no formatting cleanup.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Captures become a hub.",
    desc: "Everything you save lives at one URL: memory.wiki/hub/you. Bundles group related docs, a concept index links them, and Related-in-your-hub surfaces the connections you didn't draw yourself.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><circle cx="4" cy="6" r="2" /><circle cx="20" cy="6" r="2" /><circle cx="4" cy="18" r="2" /><circle cx="20" cy="18" r="2" /><path d="M6 7l4 3M18 7l-4 3M6 17l4-3M18 17l-4-3" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Paste the URL.\nAny AI reads it.",
    desc: "Drop your hub URL into Claude, ChatGPT, Cursor, or Codex. They fetch the markdown directly — and /llms.txt + ?compact keep the token cost low.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Use it from where you already work.",
    desc: null,
    icon: null,
    surfaces: [
      { name: "Claude Code", desc: "/memory.wiki capture, bundle, hub", color: "#fb923c" },
      { name: "Cursor", desc: ".mdc rule + project context", color: "#fbbf24" },
      { name: "Codex CLI", desc: "AGENTS.md block, idempotent", color: "#4ade80" },
      { name: "Aider", desc: "CONVENTIONS.md", color: "#60a5fa" },
      { name: "Chrome", desc: "Capture from any web AI", color: "#c4b5fd" },
      { name: "VS Code, Mac, CLI, MCP", desc: "Native everywhere else", color: "#f472b6" },
    ],
  },
];

export default function WelcomeOverlay() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setTimeout(() => setVisible(true), 600);
    }
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, "1");
    }, 300);
  }, []);

  const next = useCallback(() => {
    if (current < slides.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      dismiss();
    }
  }, [current, dismiss]);

  if (!visible) return null;

  const slide = slides[current];
  const isFirst = current === 0;
  const isLast = current === slides.length - 1;

  return (
    <div
      className={`welcome-overlay ${exiting ? "exiting" : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.3s",
      }}
      onClick={() => {}}
    >
      <div
        style={{
          // Flat surface — matches the system-wide flat-design
          // direction. The dim backdrop above already provides the
          // separation; the card itself stays a single tone with
          // a 1px border and no shadow.
          background: "var(--surface)",
          border: "1px solid var(--border-dim)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          margin: "0 24px",
          overflow: "hidden",
          animation: "welcome-in 0.4s ease-out",
        }}
      >
        {/* Content */}
        <div style={{ padding: slide.icon ? "44px 40px 28px" : "32px 40px 24px", textAlign: "center" }}>
          {/* Icon */}
          {slide.icon && (
            <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>{slide.icon}</div>
          )}

          {/* Step badge */}
          {slide.step && (
            <span
              style={{
                display: "inline-block",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-primary)",
                background: "var(--border)",
                padding: "3px 10px",
                borderRadius: 8,
                fontFamily: "var(--font-geist-mono), monospace",
                letterSpacing: 1,
                marginBottom: 16,
              }}
            >
              STEP {slide.step}
            </span>
          )}

          {/* Hero badge (intro slide) — pre-line so the explicit \n in the
              badge text wraps "for the AI era" onto its own line cleanly. */}
          {!slide.step && slide.badge && (
            <span
              style={{
                display: "inline-block",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-primary)",
                textTransform: "uppercase",
                letterSpacing: 1.4,
                marginBottom: 12,
                fontFamily: "var(--font-geist-mono), monospace",
                whiteSpace: "pre-line",
                lineHeight: 1.5,
              }}
            >
              {slide.badge}
            </span>
          )}

          {/* Logo on first slide */}
          {isFirst && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
                <span style={{ color: "var(--text-primary)" }}>Memory</span>
                <span style={{ color: "var(--text-primary)" }}>.Wiki</span>
              </span>
            </div>
          )}

          {/* Title */}
          <h2
            style={{
              fontSize: isFirst ? 28 : 22,
              fontWeight: 800,
              color: "var(--text-primary)",
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              margin: "0 0 12px",
              whiteSpace: "pre-line",
            }}
          >
            {slide.title}
          </h2>

          {/* Description */}
          {slide.desc && (
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 380,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {slide.desc}
            </p>
          )}

          {/* Surfaces grid (slide 04) */}
          {slide.surfaces && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6, maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
              {slide.surfaces.map((s) => (
                <div
                  key={s.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 12px",
                    borderRadius: 8,
                    background: "var(--background)",
                    textAlign: "left",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", minWidth: 130 }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{s.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Inline CTAs intentionally removed — one CTA per slide rule.
              Next / Get started is the only primary action; users explore
              specific surfaces from the dashboard after dismissal. */}
        </div>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "0 0 24px" }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: current === i ? 20 : 6,
                height: 6,
                borderRadius: 3,
                border: "none",
                background: current === i ? "var(--text-primary)" : "var(--border)",
                cursor: "pointer",
                padding: 0,
                transition: "width 0.2s, background 0.2s",
              }}
            />
          ))}
        </div>

        {/* Actions — primary CTA is the accent-fill button. Flat, no
            glow / no lift — the fill alone carries the contrast. */}
        <div style={{ padding: "16px 40px 32px" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {!isFirst && (
              <button
                onClick={() => setCurrent((c) => c - 1)}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-faint)",
                  background: "transparent",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 14px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              style={{
                flex: 1,
                background: "var(--text-primary)",
                color: "var(--background)",
                border: "none",
                padding: "13px 28px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "-0.01em",
              }}
            >
              {isLast ? "Get started" : "Next"}
            </button>
          </div>
          {!isLast && (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                onClick={dismiss}
                style={{
                  fontSize: 12,
                  color: "var(--text-faint)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                Skip tour
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
