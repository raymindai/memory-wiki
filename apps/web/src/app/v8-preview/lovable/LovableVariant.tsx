"use client";

import { useState } from "react";
import { VariantNav } from "../VariantNav";
import "./lovable.css";

export function LovableVariant() {
  const [streamedText, setStreamedText] = useState("");
  const fullText =
    "Your weekly digest: 12 captures this week, clustered into 3 themes. " +
    "memory.wiki noticed a strong connection between your TypeScript notes " +
    "and the new design system you started capturing on Thursday.";

  const startStream = () => {
    setStreamedText("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setStreamedText(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, 18);
  };

  return (
    <div className="v8-lovable">
      <VariantNav />

      {/* Top nav */}
      <header className="topnav">
        <div className="topnav-inner">
          <a href="#" className="topnav-brand">
            <span className="brand-mark">✦</span>
            <span className="brand-word">memory.wiki</span>
          </a>
          <nav className="topnav-links">
            <a href="#" className="topnav-link">Product</a>
            <a href="#" className="topnav-link">Pricing</a>
            <a href="#" className="topnav-link">Docs</a>
          </nav>
          <div className="topnav-right">
            <a href="#" className="topnav-link">Log in</a>
            <button className="btn-dark">Start building</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        {/* Ambient warm gradient wash */}
        <div className="ambient" aria-hidden />
        <div className="hero-inner">
          <h1 className="display-hero">
            Stop re-explaining your
            <br />
            context to every AI.
          </h1>
          <p className="hero-sub">
            One URL every AI fetches. Yours, your team&apos;s, or your community&apos;s.
            Capture from anywhere, paste anywhere.
          </p>
          <div className="cta-row">
            <button className="btn-dark">Start your memory.wiki</button>
            <button className="btn-outline">See an example</button>
          </div>

          {/* Prompt input (signature Lovable component) */}
          <div className="prompt-input">
            <textarea
              className="prompt-textarea"
              placeholder="Paste anything — article, AI chat, idea — and memory.wiki organizes it."
              rows={3}
              readOnly
              defaultValue=""
            />
            <div className="prompt-actions">
              <div className="prompt-pills">
                <button className="pill">📎 Attach</button>
                <button className="pill">✦ Smart capture</button>
                <button className="pill">🌐 From URL</button>
              </div>
              <button className="btn-dark-pill">Save →</button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="section">
        <div className="stats">
          <div className="stat">
            <div className="stat-num">247</div>
            <div className="stat-label">captures this month</div>
          </div>
          <div className="stat">
            <div className="stat-num">18</div>
            <div className="stat-label">auto-clustered</div>
          </div>
          <div className="stat">
            <div className="stat-num">5</div>
            <div className="stat-label">AIs reading</div>
          </div>
          <div className="stat">
            <div className="stat-num">2.4k</div>
            <div className="stat-label">tokens saved per session</div>
          </div>
        </div>
      </section>

      {/* Feature gallery */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-section">Three primitives. One URL.</h2>
          <p className="section-lede">
            Every memory.wiki page is composed of three layers: capture,
            organize, and use. AI lives in the middle.
          </p>
        </div>
        <div className="gallery">
          <div className="gallery-card">
            <div className="gallery-image">
              <span className="gallery-emoji">📥</span>
            </div>
            <div className="gallery-meta">
              <div className="gallery-title">Capture</div>
              <div className="gallery-sub">
                Chrome, Cursor, mobile, MCP — any surface drops into the same URL.
              </div>
            </div>
          </div>
          <div className="gallery-card">
            <div className="gallery-image">
              <span className="gallery-emoji">✦</span>
            </div>
            <div className="gallery-meta">
              <div className="gallery-title">Organize</div>
              <div className="gallery-sub">
                Background AI tags, clusters, summarizes. Original markdown stays sacred.
              </div>
            </div>
          </div>
          <div className="gallery-card">
            <div className="gallery-image">
              <span className="gallery-emoji">🔗</span>
            </div>
            <div className="gallery-meta">
              <div className="gallery-title">Use</div>
              <div className="gallery-sub">
                Paste the URL into any AI. Each receives optimized context.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual-layer cards */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-section">Original sacred. AI assistive.</h2>
          <p className="section-lede">
            What you write stays yours. What AI adds is clearly attributed.
          </p>
        </div>
        <div className="card-row">
          <div className="dual-card">
            <div className="dual-meta">
              <div className="avatar">R</div>
              <span className="dual-author">raymind</span>
              <span className="dual-time">2h ago</span>
            </div>
            <h3 className="card-title">v8 thinking — capture vs memory</h3>
            <p className="card-body">
              memory.wiki 이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함.
              그래서 capture everything 이 자연스러운 입구.
            </p>
            <div className="tags">
              <span className="tag">v8</span>
              <span className="tag">thinking</span>
            </div>
          </div>

          <div className="dual-card dual-card-ai">
            <div className="dual-meta">
              <span className="ai-pill">✦ Claude · digest</span>
              <span className="dual-time">Sunday</span>
            </div>
            <h3 className="card-title">Three themes emerged this week</h3>
            <p className="card-body">
              You captured 12 docs this week across TypeScript patterns, v8
              design direction, and cross-AI memory. Strongest signal between
              Thursday and Monday.
            </p>
            <div className="tags">
              <span className="tag">digest</span>
              <span className="tag">synthesis</span>
            </div>
          </div>

          <div className="dual-card">
            <div className="dual-meta">
              <div className="avatar">R</div>
              <span className="dual-author">raymind</span>
              <span className="dual-footnote">edited · originally AI</span>
            </div>
            <h3 className="card-title">My current focus</h3>
            <p className="card-body">
              Shipping memory.wiki v8 over 20 weeks. Capture → Organize → Use.
              Cross-AI delivery is the wedge giants cannot build.
            </p>
            <div className="tags">
              <span className="tag">focus</span>
              <span className="tag">v8</span>
            </div>
          </div>
        </div>
      </section>

      {/* Streaming */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-section">AI streams in plain sight.</h2>
          <p className="section-lede">
            Generation is visible. Attribution explicit. Nothing happens silently.
          </p>
        </div>
        <div className="dual-card dual-card-ai" style={{ maxWidth: 720 }}>
          <div className="dual-meta">
            <span className="ai-pill">✦ memory.wiki AI</span>
            <button className="btn-outline-small" onClick={startStream}>
              Generate again
            </button>
          </div>
          <p className="card-body" style={{ minHeight: 88 }}>
            {streamedText || (
              <span className="streaming-prompt">
                Click &ldquo;Generate again&rdquo; →
              </span>
            )}
            {streamedText && streamedText.length < fullText.length && (
              <span className="cursor" />
            )}
          </p>
        </div>
      </section>

      {/* Buttons */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-section">Buttons.</h2>
        </div>
        <div className="button-row">
          <button className="btn-dark">Primary dark</button>
          <button className="btn-outline">Outline</button>
          <button className="btn-cream">Cream surface</button>
          <button className="btn-dark-pill">Pill action</button>
          <button className="btn-icon" aria-label="play">
            ▶
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <a href="#" className="topnav-brand">
              <span className="brand-mark">✦</span>
              <span className="brand-word">memory.wiki</span>
            </a>
            <div className="footer-meta">
              <span className="footer-link">v8 · Variant F</span>
              <span className="footer-link">Lovable-inspired</span>
            </div>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-title">Product</div>
              <a href="#" className="footer-link">Capture</a>
              <a href="#" className="footer-link">Organize</a>
              <a href="#" className="footer-link">Use</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Surfaces</div>
              <a href="#" className="footer-link">Web</a>
              <a href="#" className="footer-link">iOS</a>
              <a href="#" className="footer-link">Chrome</a>
              <a href="#" className="footer-link">VS Code</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <a href="#" className="footer-link">About</a>
              <a href="#" className="footer-link">Manifesto</a>
              <a href="#" className="footer-link">Contact</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Legal</div>
              <a href="#" className="footer-link">Privacy</a>
              <a href="#" className="footer-link">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
