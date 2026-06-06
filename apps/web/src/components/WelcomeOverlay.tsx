"use client";
import { useState, useEffect, useCallback } from "react";

// v11. Each slide has a designed SVG illustration — NOT a fake
// product screenshot. The previous version (v8) fabricated mock
// chrome popups and mock sidebars that pretended to be the real UI;
// founder caught it. These are honest visual compositions built from
// brand elements (real morph blob asset, real typography, real URL
// shape) that depict the concept without lying about the product.
const STORAGE_KEY = "mw-welcome-seen-v11";

type Slide = {
  step: string | null;
  badge?: string;
  title: string;
  desc?: string;
  visual: React.ReactNode;
};

// ─── Honest visual compositions ─────────────────────────────────
// All compositions use design-token colors so light/dark theme
// inherits automatically. No images of fake product chrome.

function VisualMorphBlob() {
  // The actual brand asset, animated SVG. /brand/mwblob_morph.svg
  // is the source-of-truth animated mark used across the marketing
  // site too — same file, no fabrication.
  return (
    <picture>
      <source srcSet="/brand/mwblob_morph_dark.svg" media="(prefers-color-scheme: dark)" />
      <img src="/brand/mwblob_morph.svg" alt="" aria-hidden width={120} height={120} style={{ display: "block" }} />
    </picture>
  );
}

function VisualCapture() {
  // "Anything → URL" composition. Left: a stack of source shapes
  // (rectangles representing web page / chat / file). Right: the
  // memory.wiki URL chip. An accent arrow between. Honest about
  // what it depicts: the capture concept, not a fake UI.
  return (
    <svg width="280" height="120" viewBox="0 0 280 120" fill="none" aria-hidden>
      <g opacity="0.85">
        {/* Source stack (3 shifted rectangles representing diverse inputs) */}
        <rect x="14" y="14" width="68" height="84" rx="6" fill="var(--border-dim)" />
        <rect x="22" y="22" width="68" height="84" rx="6" fill="var(--border)" />
        <rect x="30" y="30" width="68" height="84" rx="6" fill="var(--surface)" stroke="var(--text-faint)" strokeWidth="1" />
        {/* tiny content lines inside the top card */}
        <rect x="38" y="40" width="50" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.5" />
        <rect x="38" y="50" width="38" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.5" />
        <rect x="38" y="60" width="44" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.5" />
      </g>
      {/* Arrow */}
      <path d="M118 60 L150 60" stroke="var(--accent, #fb923c)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M144 54 L150 60 L144 66" stroke="var(--accent, #fb923c)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* URL chip */}
      <g>
        <rect x="158" y="44" width="112" height="32" rx="16" fill="var(--text-primary)" />
        <text x="214" y="64" textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11" fontWeight="600" fill="var(--background)">
          memory.wiki/abc
        </text>
      </g>
    </svg>
  );
}

function VisualHub() {
  // Hub-as-URL composition. A ring of small doc tiles orbiting a
  // central URL chip. The ring suggests "everything rolls up to one
  // URL". 8 tiles, evenly distributed.
  const cx = 140, cy = 60, r = 42;
  const tiles = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * r - 6, y: cy + Math.sin(a) * r - 4 };
  });
  return (
    <svg width="280" height="120" viewBox="0 0 280 120" fill="none" aria-hidden>
      {/* Faint orbit guide */}
      <circle cx={cx} cy={cy} r={r} stroke="var(--border)" strokeWidth="0.75" strokeDasharray="2 3" fill="none" />
      {/* Doc tiles */}
      {tiles.map((t, i) => (
        <rect key={i} x={t.x} y={t.y} width="12" height="8" rx="1.5" fill={i === 0 ? "var(--accent, #fb923c)" : "var(--text-faint)"} opacity={i === 0 ? 1 : 0.6} />
      ))}
      {/* Central URL chip */}
      <g>
        <rect x="86" y="48" width="108" height="26" rx="13" fill="var(--text-primary)" />
        <text x="140" y="65" textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11" fontWeight="600" fill="var(--background)">
          memory.wiki/@you
        </text>
      </g>
    </svg>
  );
}

function VisualCrossAI() {
  // URL chip at top, 5 AI labels in a horizontal row at the bottom
  // connected by simple lines. Names are real provider names, not
  // logo lockups (we don't have rights cleared to use their marks
  // inside our product chrome at runtime).
  const ais = ["Claude", "ChatGPT", "Cursor", "Codex", "Gemini"];
  const W = 280;
  const xs = ais.map((_, i) => 30 + i * 55);
  return (
    <svg width={W} height="120" viewBox={`0 0 ${W} 120`} fill="none" aria-hidden>
      {/* URL chip */}
      <g>
        <rect x="80" y="14" width="120" height="28" rx="14" fill="var(--text-primary)" />
        <text x="140" y="33" textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11" fontWeight="600" fill="var(--background)">
          memory.wiki/@you
        </text>
      </g>
      {/* Lines fanning out */}
      {xs.map((x, i) => (
        <path key={i} d={`M140 42 Q${(140 + x) / 2} 60 ${x} 80`} stroke="var(--border)" strokeWidth="1" fill="none" />
      ))}
      {/* AI labels */}
      {ais.map((name, i) => (
        <g key={name}>
          <rect x={xs[i] - 22} y="78" width="44" height="20" rx="10" fill="var(--surface)" stroke="var(--border-dim)" strokeWidth="1" />
          <text x={xs[i]} y="92" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="600" fill="var(--text-primary)">
            {name}
          </text>
        </g>
      ))}
    </svg>
  );
}

function VisualWelcomeDoc() {
  // Open-doc composition pointing toward "read me first". Two page
  // spread with content lines + an accent bookmark tag.
  return (
    <svg width="220" height="120" viewBox="0 0 220 120" fill="none" aria-hidden>
      {/* Page shadow */}
      <path d="M14 18 L110 18 L110 108 L14 108 Z" fill="var(--border-dim)" opacity="0.6" />
      <path d="M110 18 L206 18 L206 108 L110 108 Z" fill="var(--border-dim)" opacity="0.6" />
      {/* Left page */}
      <rect x="18" y="14" width="92" height="92" rx="3" fill="var(--surface)" stroke="var(--text-faint)" strokeWidth="0.75" />
      {/* Right page */}
      <rect x="110" y="14" width="92" height="92" rx="3" fill="var(--surface)" stroke="var(--text-faint)" strokeWidth="0.75" />
      {/* Spine */}
      <line x1="110" y1="14" x2="110" y2="106" stroke="var(--text-faint)" strokeWidth="0.75" opacity="0.4" />
      {/* Left content lines */}
      <rect x="26" y="26" width="58" height="6" rx="1.5" fill="var(--text-primary)" />
      <rect x="26" y="40" width="76" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      <rect x="26" y="48" width="68" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      <rect x="26" y="56" width="72" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      <rect x="26" y="72" width="50" height="4" rx="1.5" fill="var(--text-primary)" opacity="0.7" />
      <rect x="26" y="82" width="62" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      <rect x="26" y="90" width="40" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      {/* Right content lines */}
      <rect x="118" y="26" width="50" height="4" rx="1.5" fill="var(--text-primary)" opacity="0.7" />
      <rect x="118" y="40" width="76" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      <rect x="118" y="48" width="68" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      <rect x="118" y="56" width="60" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      <rect x="118" y="72" width="46" height="4" rx="1.5" fill="var(--text-primary)" opacity="0.7" />
      <rect x="118" y="82" width="76" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      <rect x="118" y="90" width="56" height="3" rx="1.5" fill="var(--text-faint)" opacity="0.55" />
      {/* Bookmark tag */}
      <path d="M180 8 L180 32 L188 26 L196 32 L196 8 Z" fill="var(--accent, #fb923c)" />
    </svg>
  );
}

const slides: Slide[] = [
  {
    step: null,
    badge: "memory.wiki",
    title: "Your knowledge as a URL\nany AI can read.",
    desc: "ChatGPT, Claude, Cursor, Gemini forget you between sessions. memory.wiki holds the memory, the URL delivers it. One source of truth, every AI.",
    visual: <VisualMorphBlob />,
  },
  {
    step: "01",
    title: "Capture from anywhere.",
    desc: "Chrome extension Add button on every web page, AI chat, X / Threads / Reddit post. Paste a Claude or ChatGPT share link. Drop a PDF, DOCX, code repo. Each becomes clean markdown at a permanent URL.",
    visual: <VisualCapture />,
  },
  {
    step: "02",
    title: "Everything rolls up to one URL.",
    desc: "Your captures live at memory.wiki/@you. Docs group into Bundles (a thinking surface with concept graph + tensions). Bundles roll up into your Hub — one URL, fetchable as markdown.",
    visual: <VisualHub />,
  },
  {
    step: "03",
    title: "Paste the URL.\nAny AI reads it.",
    desc: "Drop your hub URL into Claude, ChatGPT, Cursor, Codex, Gemini. They fetch the markdown directly. Cross-AI by construction — no plugin, no integration, no auth wall.",
    visual: <VisualCrossAI />,
  },
  {
    step: "04",
    title: "Start with the welcome guide.",
    desc: "The Start tab has a one-click Welcome guide that opens as a real doc — edit it, learn by doing. Sign in anytime to keep your captures synced across web, mac, vscode, and mobile.",
    visual: <VisualWelcomeDoc />,
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
        // Mobile: page-pad + scroll so the modal never gets clipped
        // on short viewports.
        padding: "max(env(safe-area-inset-top), 16px) 16px max(env(safe-area-inset-bottom), 16px)",
        overflowY: "auto",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.3s",
      }}
    >
      <style>{`
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
          maxWidth: 480,
          overflow: "hidden",
          animation: "welcome-in 0.4s ease-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Visual panel — scales down on mobile, but the SVG art
            uses viewBox so it always fits cleanly. */}
        <div
          style={{
            background: "var(--background)",
            borderBottom: "1px solid var(--border-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "28px 16px",
            minHeight: 152,
          }}
        >
          {slide.visual}
        </div>

        {/* Content */}
        <div style={{ padding: "24px 28px 20px", textAlign: "center" }}>
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
                marginBottom: 14,
                fontFamily: "var(--font-geist-mono), monospace",
                opacity: 0.7,
              }}
            >
              {slide.badge}
            </span>
          )}
          <h2
            style={{
              fontSize: isFirst ? 22 : 19,
              fontWeight: 800,
              color: "var(--text-primary)",
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              margin: "0 0 10px",
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
                maxWidth: 380,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {slide.desc}
            </p>
          )}
        </div>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "0 0 14px" }}>
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
        <div style={{ padding: "8px 28px 24px" }}>
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
