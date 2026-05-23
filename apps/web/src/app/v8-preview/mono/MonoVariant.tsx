"use client";

import { useState } from "react";
import { VariantNav } from "../VariantNav";
import "./mono.css";

export function MonoVariant() {
  const [streamedText, setStreamedText] = useState("");
  const fullText =
    "$ memory.wiki digest --week current\n" +
    "12 captures · 3 clusters detected · 47 tags · 8 new relations\n" +
    "→ strongest signal: typescript ↔ design-system (0.84)\n" +
    "→ pasted into 4 AI sessions this week\n" +
    "→ saved 23 minutes of re-explanation";

  const startStream = () => {
    setStreamedText("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setStreamedText(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, 14);
  };

  return (
    <div className="v8-mono">
      <VariantNav />

      <section className="hero">
        <div className="badge">[ v8 / variant-c / dark-edge ]</div>
        <h1 className="display">
          Stop re-explaining
          <span className="display-line">your context</span>
          <span className="display-line">to every AI.</span>
        </h1>
        <p className="hero-sub">
          One URL every AI fetches. Yours, your team&apos;s, or your community&apos;s.
        </p>
        <div className="cta-row">
          <button className="btn-primary">
            <span className="prompt">$</span> Start your memory
          </button>
          <button className="btn-ghost">→ See an example</button>
        </div>
      </section>

      {/* Palette */}
      <section className="section">
        <h2 className="section-title">// palette</h2>
        <div className="palette-grid">
          <Swatch label="bg" hex="#050505" />
          <Swatch label="surface" hex="#0e0e0e" />
          <Swatch label="elevated" hex="#161616" />
          <Swatch label="text" hex="#f5f5f5" />
          <Swatch label="muted" hex="#888888" />
          <Swatch label="accent" hex="#fb923c" />
          <Swatch label="ai" hex="#84cc16" />
          <Swatch label="border" hex="#262626" />
        </div>
      </section>

      {/* Cards */}
      <section className="section">
        <h2 className="section-title">// dual-layer cards</h2>
        <p className="section-lede">
          tight grid · mono everywhere · lime AI signal · brutalist edge
        </p>
        <div className="card-row">
          <div className="card card-user">
            <div className="card-meta">
              <span className="meta-key">[user]</span>
              <span className="meta-val">@raymind</span>
              <span className="meta-time">2h</span>
            </div>
            <h3 className="card-title">v8 thinking — capture vs memory</h3>
            <p className="card-body">
              Memory.Wiki 이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함.
              그래서 capture everything 이 자연스러운 입구.
            </p>
            <div className="card-tags">
              <span className="tag">v8</span>
              <span className="tag">thinking</span>
            </div>
          </div>

          <div className="card card-ai">
            <div className="card-meta">
              <span className="badge-ai">[ai] generated_by=claude-sonnet-4.6</span>
              <span className="meta-time">sunday</span>
            </div>
            <h3 className="card-title">weekly_synthesis — 3 themes emerged</h3>
            <p className="card-body">
              12 docs this week / 3 clusters / strongest = typescript ↔
              design-system (similarity 0.84). suggested action: bundle them.
            </p>
            <div className="card-tags">
              <span className="tag tag-ai">digest</span>
              <span className="tag tag-ai">synthesis</span>
            </div>
          </div>

          <div className="card card-user">
            <div className="card-meta">
              <span className="meta-key">[user/edited]</span>
              <span className="meta-val">@raymind</span>
              <span className="meta-edit">// was ai</span>
            </div>
            <h3 className="card-title">current_focus.md</h3>
            <p className="card-body">
              shipping memory.wiki v8 over 20 weeks. capture → organize → use.
              cross-ai delivery is the wedge giants cannot build.
            </p>
            <div className="card-tags">
              <span className="tag">focus</span>
              <span className="tag">v8</span>
            </div>
          </div>
        </div>
      </section>

      {/* Streaming */}
      <section className="section">
        <h2 className="section-title">// ai streaming</h2>
        <div className="terminal">
          <div className="terminal-bar">
            <span className="terminal-dot d-r" />
            <span className="terminal-dot d-y" />
            <span className="terminal-dot d-g" />
            <span className="terminal-title">memory-wiki ~ digest</span>
            <button className="stream-btn" onClick={startStream}>
              run
            </button>
          </div>
          <pre className="terminal-body">
            {streamedText || (
              <span className="streaming-prompt">$ click &quot;run&quot; →</span>
            )}
            {streamedText && streamedText.length < fullText.length && (
              <span className="cursor" />
            )}
          </pre>
        </div>
      </section>

      {/* Buttons */}
      <section className="section">
        <h2 className="section-title">// buttons</h2>
        <div className="button-row">
          <button className="btn-primary">primary</button>
          <button className="btn-secondary">secondary</button>
          <button className="btn-ghost">ghost</button>
          <button className="btn-ai">[ai] action</button>
        </div>
      </section>

      {/* Logo */}
      <section className="section">
        <h2 className="section-title">// logo</h2>
        <div className="logo-row">
          <LayeredM size={48} />
          <LayeredM size={96} />
          <LayeredM size={160} />
        </div>
        <div className="logo-row">
          <div className="logo-card">
            <Wordmark />
            <span className="caption">wordmark on dark</span>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>// v8 variant C / dark-edge / jetbrains-mono + space-grotesk</p>
        <p className="caption">references: vercel, replit, raycast, terminal aesthetics</p>
      </footer>
    </div>
  );
}

function Swatch({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="swatch">
      <div className="swatch-tile" style={{ background: hex }} />
      <div className="swatch-meta">
        <span className="swatch-label">{label}</span>
        <span className="swatch-hex">{hex}</span>
      </div>
    </div>
  );
}

function LayeredM({ size = 64 }: { size?: number }) {
  const stroke = Math.max(2, Math.round(size * 0.16));
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <rect width="100" height="100" rx="6" fill="#0e0e0e" />
      <path
        d="M22 76 V 32 L 50 60 L 78 32 V 76"
        fill="none"
        stroke="#f5f5f5"
        strokeWidth={stroke}
        strokeLinejoin="miter"
        strokeLinecap="square"
        transform="translate(4 4)"
        opacity="0.5"
      />
      <path
        d="M22 76 V 32 L 50 60 L 78 32 V 76"
        fill="none"
        stroke="#fb923c"
        strokeWidth={stroke}
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
    </svg>
  );
}

function Wordmark() {
  return (
    <span
      style={{
        fontFamily: "var(--font-jetbrains-mono), monospace",
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: "-0.04em",
      }}
    >
      <span style={{ color: "#fb923c" }}>memory</span>
      <span style={{ color: "#888" }}>.</span>
      <span style={{ color: "#f5f5f5" }}>wiki</span>
    </span>
  );
}
