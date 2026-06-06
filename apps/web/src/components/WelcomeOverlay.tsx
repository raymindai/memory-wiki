"use client";
import { useState, useEffect, useCallback } from "react";

// v12. Stop trying to design custom illustrations — the user
// corrected me 5+ times in a row. Trust the brand system:
// real morph blob asset + big Cal Sans typography + generous
// whitespace. 3 slides instead of 5. No fake mockups, no fake
// product screenshots. The brand doc (memory.wiki/L2SHNVir §2.4)
// is explicit: monochrome ink base, color only as small dots.
const STORAGE_KEY = "mw-welcome-seen-v12";

type Slide = {
  eyebrow?: string;
  title: string;
  desc?: string;
};

const slides: Slide[] = [
  {
    eyebrow: "memory.wiki",
    title: "Your knowledge as a URL\nany AI can read.",
    desc: "ChatGPT, Claude, Cursor, Gemini all read the same URL. Capture from anywhere. Use everywhere.",
  },
  {
    eyebrow: "the loop",
    title: "Capture.\nOrganize.\nUse.",
    desc: "Chrome / Mac / VS Code / CLI / iOS / Android — pick the surface, drop in any content. memory.wiki structures it, your hub URL delivers it to every AI.",
  },
  {
    eyebrow: "ready",
    title: "Start with the\nwelcome guide.",
    desc: "Opens as a real doc in the editor. Read it, edit it, delete when you're done. Sign in anytime from the sidebar to sync everywhere.",
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
      setTimeout(() => {
        try { window.dispatchEvent(new CustomEvent("mw:open-welcome-doc")); } catch { /* ignore */ }
      }, 320);
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
        padding: "max(env(safe-area-inset-top), 16px) 16px max(env(safe-area-inset-bottom), 16px)",
        overflowY: "auto",
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(10px)",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.3s",
      }}
    >
      <style>{`
        @keyframes welcome-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-dim)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          overflow: "hidden",
          animation: "welcome-in 0.4s ease-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Real animated brand mark — only on first slide.
            Subsequent slides drop the visual entirely to give
            the typography all the air. */}
        {isFirst && (
          <div style={{ display: "flex", justifyContent: "center", padding: "44px 0 12px" }}>
            <picture>
              <source srcSet="/brand/mwblob_morph_dark.svg" media="(prefers-color-scheme: dark)" />
              <img src="/brand/mwblob_morph.svg" alt="" aria-hidden width={84} height={84} style={{ display: "block" }} />
            </picture>
          </div>
        )}

        {/* Eyebrow + title + body — all generous space + Cal Sans on
            the headline. Letter-spacing 0 (brand rule). */}
        <div style={{ padding: isFirst ? "8px 36px 24px" : "48px 36px 24px", textAlign: "center" }}>
          {slide.eyebrow && (
            <span
              style={{
                display: "inline-block",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-faint)",
                marginBottom: 18,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {slide.eyebrow}
            </span>
          )}
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 30,
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.18,
              letterSpacing: 0,
              margin: "0 0 16px",
              whiteSpace: "pre-line",
            }}
          >
            {slide.title}
          </h2>
          {slide.desc && (
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 360,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {slide.desc}
            </p>
          )}
        </div>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "0 0 18px" }}>
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
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div style={{ padding: "8px 36px 32px" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {!isFirst && (
              <button
                onClick={() => setCurrent((c) => c - 1)}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-faint)",
                  background: "transparent",
                  border: "none",
                  borderRadius: 10,
                  padding: "13px 16px",
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
                padding: "13px 24px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0,
              }}
            >
              {isLast ? "Open the welcome guide" : "Next"}
            </button>
          </div>
          {!isLast && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
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
