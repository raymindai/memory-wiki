"use client";
import { useState, useEffect, useCallback } from "react";

// Bumped to v8 — slides rewritten with mini product mockups instead
// of abstract line icons, copy tightened, surfaces grid dropped.
// Anyone who saw v7 gets the new version once.
const STORAGE_KEY = "mw-welcome-seen-v8";

type Slide = {
  step: string | null;
  badge?: string;
  title: string;
  desc?: string;
  visual: React.ReactNode;
};

// ─── Mini product mockups ────────────────────────────────────────
// Built with raw JSX so the welcome doesn't pull in screenshot
// assets. Each one hints at the real UI shape (Chrome popup, hub
// URL chip, cross-AI delivery) rather than describing it abstractly.

function MockMorphBlob() {
  return (
    <div style={{ position: "relative", width: 120, height: 120 }}>
      <div
        style={{
          position: "absolute", inset: 0,
          background: "var(--accent, #fb923c)",
          borderRadius: "62% 38% 53% 47% / 51% 49% 51% 49%",
          opacity: 0.18,
          filter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "absolute", inset: 18,
          background: "var(--text-primary)",
          borderRadius: "62% 38% 53% 47% / 51% 49% 51% 49%",
          animation: "welcome-blob 8s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function MockCapture() {
  return (
    <div style={{ position: "relative", width: 240, height: 140 }}>
      {/* Mock browser tab strip */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 20, background: "var(--border-dim)", borderTopLeftRadius: 10, borderTopRightRadius: 10, display: "flex", alignItems: "center", paddingLeft: 8, gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-faint)", opacity: 0.5 }} />
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-faint)", opacity: 0.5 }} />
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-faint)", opacity: 0.5 }} />
      </div>
      {/* Mock page body */}
      <div style={{ position: "absolute", top: 20, left: 0, right: 0, bottom: 0, background: "var(--background)", borderBottomLeftRadius: 10, borderBottomRightRadius: 10, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ height: 6, width: "80%", background: "var(--border)", borderRadius: 3 }} />
        <div style={{ height: 6, width: "65%", background: "var(--border)", borderRadius: 3 }} />
        <div style={{ height: 6, width: "70%", background: "var(--border)", borderRadius: 3 }} />
      </div>
      {/* Popup floating top-right */}
      <div style={{ position: "absolute", top: 28, right: 6, width: 110, padding: "8px 10px", background: "var(--text-primary)", color: "var(--background)", borderRadius: 8, fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }}>
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--accent, #fb923c)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>+</span>
        Add to memory.wiki
      </div>
      {/* URL chip emerging at the bottom */}
      <div style={{ position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)", padding: "4px 10px", background: "var(--surface)", border: "1px solid var(--accent, #fb923c)", borderRadius: 999, fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", color: "var(--text-primary)" }}>
        memory.wiki/abc123
      </div>
    </div>
  );
}

function MockHub() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: 260 }}>
      {/* Big hub URL chip */}
      <div style={{ padding: "10px 16px", background: "var(--text-primary)", color: "var(--background)", borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: "var(--font-geist-mono), monospace", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent, #fb923c)" }} />
        memory.wiki/@you
      </div>
      {/* Mini doc tiles flowing into it */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, width: "100%" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 28,
              borderRadius: 4,
              background: i % 3 === 0 ? "var(--border)" : "var(--surface)",
              border: "1px solid var(--border-dim)",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: 0.4 }}>
        docs · bundles · hub
      </div>
    </div>
  );
}

function MockCrossAI() {
  const ais = [
    { label: "Claude", color: "#cc785c" },
    { label: "ChatGPT", color: "#10a37f" },
    { label: "Cursor", color: "#000000" },
    { label: "Codex", color: "#5436da" },
    { label: "Gemini", color: "#4285f4" },
  ];
  return (
    <div style={{ width: 280 }}>
      {/* URL chip top */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <div style={{ padding: "6px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, fontSize: 11, fontFamily: "var(--font-geist-mono), monospace", color: "var(--text-primary)" }}>
          memory.wiki/@you
        </div>
      </div>
      {/* Arrows down */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <svg width="180" height="18" viewBox="0 0 180 18" fill="none" stroke="var(--border)" strokeWidth="1">
          <path d="M90 0 L90 6 L20 14 M90 6 L60 14 M90 6 L90 14 M90 6 L120 14 M90 6 L160 14" strokeLinecap="round" />
        </svg>
      </div>
      {/* AI chips */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        {ais.map((a) => (
          <div
            key={a.label}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--text-primary)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.color }} />
            {a.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockStart() {
  return (
    <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Sample sidebar row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--accent, #fb923c)", borderRadius: 10 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>📖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>Welcome guide</div>
          <div style={{ fontSize: 9, color: "var(--text-faint)" }}>A short tour written as a real doc</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 10 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>＋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>New document</div>
          <div style={{ fontSize: 9, color: "var(--text-faint)" }}>Blank page, start writing</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 10 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🔌</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>Install MCP</div>
          <div style={{ fontSize: 9, color: "var(--text-faint)" }}>Connect Claude / Cursor</div>
        </div>
      </div>
    </div>
  );
}

const slides: Slide[] = [
  {
    step: null,
    badge: "memory.wiki",
    title: "Your knowledge as a URL\nany AI can read.",
    desc: "ChatGPT, Claude, Cursor, Gemini forget you between sessions. memory.wiki holds the memory, the URL delivers it. One source of truth, every AI.",
    visual: <MockMorphBlob />,
  },
  {
    step: "01",
    title: "Capture from anywhere.",
    desc: "Chrome extension Add button on every web page, AI chat, X / Threads / Reddit post. Paste a Claude or ChatGPT share link. Drop a PDF, DOCX, code repo. Each becomes clean markdown at a permanent URL.",
    visual: <MockCapture />,
  },
  {
    step: "02",
    title: "Everything rolls up to one URL.",
    desc: "Your captures live at memory.wiki/@you. Docs group into Bundles (a thinking surface with concept graph + tensions). Bundles roll up into your Hub — one URL, fetchable as markdown.",
    visual: <MockHub />,
  },
  {
    step: "03",
    title: "Paste the URL.\nAny AI reads it.",
    desc: "Drop your hub URL into Claude, ChatGPT, Cursor, Codex, Gemini. They fetch the markdown directly. Cross-AI by construction — no plugin, no integration, no auth wall.",
    visual: <MockCrossAI />,
  },
  {
    step: "04",
    title: "Start with the welcome guide.",
    desc: "The Start tab has a one-click Welcome guide that opens as a real doc — edit it, learn by doing. Sign in anytime to keep your captures synced across web, mac, vscode, and mobile.",
    visual: <MockStart />,
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
      // Last slide CTA = "Open the welcome guide". Dispatch a custom
      // event the editor listens for so the welcome doc actually
      // opens after dismissal; otherwise the user lands on the empty
      // Start surface and has to find the doc themselves.
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
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.3s",
      }}
    >
      {/* Blob morph keyframes — used by MockMorphBlob on slide 1 */}
      <style>{`
        @keyframes welcome-blob {
          0%, 100% { border-radius: 62% 38% 53% 47% / 51% 49% 51% 49%; transform: rotate(0deg); }
          50%      { border-radius: 38% 62% 47% 53% / 49% 51% 49% 51%; transform: rotate(180deg); }
        }
        @keyframes welcome-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-dim)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 520,
          margin: "0 24px",
          overflow: "hidden",
          animation: "welcome-in 0.4s ease-out",
        }}
      >
        {/* Visual panel — fixed height so the modal doesn't reflow
            between slides as visuals change. Centered on a slightly
            tinted backdrop so the mockup reads as its own surface. */}
        <div
          style={{
            height: 200,
            background: "var(--background)",
            borderBottom: "1px solid var(--border-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {slide.visual}
        </div>

        {/* Content */}
        <div style={{ padding: "26px 40px 22px", textAlign: "center" }}>
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
                marginBottom: 14,
              }}
            >
              STEP {slide.step}
            </span>
          )}
          {!slide.step && slide.badge && (
            <span
              style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-primary)",
                textTransform: "lowercase",
                letterSpacing: 0,
                marginBottom: 12,
                fontFamily: "var(--font-geist-mono), monospace",
                opacity: 0.7,
              }}
            >
              {slide.badge}
            </span>
          )}
          <h2
            style={{
              fontSize: isFirst ? 24 : 20,
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
          {slide.desc && (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.55,
                margin: 0,
                maxWidth: 400,
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
        <div style={{ padding: "10px 40px 28px" }}>
          <div style={{ display: "flex", gap: 10 }}>
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
                padding: "12px 24px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "-0.01em",
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
