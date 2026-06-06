"use client";

import { useState } from "react";
import { VariantNav } from "../VariantNav";
import "./modern.css";

export function ModernVariant() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  return (
    <div className="v8-modern" data-modern-theme={theme}>
      <VariantNav />
      {/* ─── TOP NAV ─── */}
      <header className="topnav">
        <div className="topnav-inner">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="brand" href="/v8-preview/modern">
            <span className="brand-mark">M</span>
            <span className="brand-word">Memory<span className="brand-dot">.</span>Wiki</span>
          </a>
          <nav className="topnav-links">
            <a className="topnav-link" href="#capture">Capture</a>
            <a className="topnav-link" href="#organize">Organize</a>
            <a className="topnav-link" href="#use">Use</a>
            <a className="topnav-link" href="#pricing">Pricing</a>
          </nav>
          <div className="topnav-right">
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? "Dark" : "Light"}
            </button>
            <button className="btn-ghost">Sign in</button>
            <button className="btn-primary">Start free</button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero-inner">
          <span className="kicker">
            <span className="kicker-dot" />
            Built for the AI era
          </span>
          <h1 className="display-xl">
            Stop re-explaining<br />
            your context to AI.
          </h1>
          <p className="lede">
            memory.wiki captures every thought, document, and conversation,
            organizes them with AI, and ships the result as a single URL any
            AI can read. Cross-AI by design.
          </p>
          <div className="hero-actions">
            <button className="btn-primary btn-lg">
              Start capturing free
              <span className="btn-arrow">→</span>
            </button>
            <button className="btn-secondary btn-lg">
              Watch the 90s demo
            </button>
          </div>
          <div className="hero-trust">
            <span className="trust-label">Reads natively from</span>
            <div className="trust-row">
              <span className="trust-chip">ChatGPT</span>
              <span className="trust-chip">Claude</span>
              <span className="trust-chip">Gemini</span>
              <span className="trust-chip">Cursor</span>
              <span className="trust-chip">Copilot</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PILLARS ─── */}
      <section className="section" id="capture">
        <div className="section-head">
          <span className="eyebrow">The model</span>
          <h2 className="display-md">Three steps. One URL.</h2>
          <p className="section-lede">
            Capture is reflex. Organization is automatic. Use is a paste.
          </p>
        </div>
        <div className="pillar-grid">
          <article className="pillar">
            <div className="pillar-num">01</div>
            <h3 className="pillar-title">Capture everything</h3>
            <p className="pillar-body">
              Highlight in any browser, screenshot on iOS, paste from desktop,
              forward an email. Every surface lands in the same vault in
              under one second.
            </p>
            <ul className="pillar-list">
              <li>Chrome / Safari / Firefox</li>
              <li>iOS share sheet / Android intent</li>
              <li>VS Code · Cursor · Raycast</li>
              <li>Email-to-Memory forwarding</li>
            </ul>
          </article>
          <article className="pillar">
            <div className="pillar-num">02</div>
            <h3 className="pillar-title">Organize automatically</h3>
            <p className="pillar-body">
              AI clusters by topic, suggests bundles, links to past thinking,
              and surfaces what you already concluded. You stay the editor,
              not the librarian.
            </p>
            <ul className="pillar-list">
              <li>Auto-clusters with named themes</li>
              <li>Bundle suggestions you can accept or reshape</li>
              <li>Concept index across your hub</li>
              <li>Always-on link-back to past decisions</li>
            </ul>
          </article>
          <article className="pillar">
            <div className="pillar-num">03</div>
            <h3 className="pillar-title">Use anywhere</h3>
            <p className="pillar-body">
              Every URL serves clean markdown to any model. Paste once into
              ChatGPT, Claude, Gemini, or Cursor and your full context shows
              up without uploads, plugins, or copy-paste loops.
            </p>
            <ul className="pillar-list">
              <li>Content negotiation per request</li>
              <li>Bundle URLs travel with the graph</li>
              <li>Hub URL exposes your public memory</li>
              <li>MCP server for direct agent access</li>
            </ul>
          </article>
        </div>
      </section>

      {/* ─── METRIC BAND ─── */}
      <section className="metric-band">
        <div className="metric-band-inner">
          <div className="metric">
            <div className="metric-num">3s</div>
            <div className="metric-label">from highlight to URL</div>
          </div>
          <div className="metric">
            <div className="metric-num">9</div>
            <div className="metric-label">capture surfaces shipping in v8</div>
          </div>
          <div className="metric">
            <div className="metric-num">5</div>
            <div className="metric-label">AIs read your URL natively</div>
          </div>
          <div className="metric">
            <div className="metric-num">∞</div>
            <div className="metric-label">URL lifetime, no expiry ever</div>
          </div>
        </div>
      </section>

      {/* ─── REAL APP SCREENS ─── */}
      <section className="section" id="organize">
        <div className="section-head">
          <span className="eyebrow">The product</span>
          <h2 className="display-md">A real workspace, not a feature.</h2>
          <p className="section-lede">
            memory.wiki is a daily app. Below is the actual surface a user
            opens to think.
          </p>
        </div>

        {/* App shell */}
        <div className="screen">
          <div className="screen-chrome">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
            <span className="screen-url mono">memory.wiki/@raymind</span>
          </div>
          <div className="app-shell">
            <aside className="app-side">
              <div className="app-brand">
                <span className="brand-mark sm">M</span>
                <span className="brand-word sm">
                  Memory<span className="brand-dot">.</span>Wiki
                </span>
              </div>
              <button className="app-cta">
                <span>New document</span>
                <span className="kbd">N</span>
              </button>
              <button className="app-search">
                <span>Search everything</span>
                <span className="kbd">⌘K</span>
              </button>
              <div className="app-side-section">
                <div className="app-side-head">My documents</div>
                <button className="app-side-row app-side-active">
                  <span className="row-dot user" />
                  v8 thinking, capture vs memory
                </button>
                <button className="app-side-row">
                  <span className="row-dot user" />
                  v7-revised business plan
                </button>
                <button className="app-side-row">
                  <span className="row-dot user" />
                  Founder log, May
                </button>
              </div>
              <div className="app-side-section">
                <div className="app-side-head">AI bundles</div>
                <button className="app-side-row">
                  <span className="row-dot ai" />
                  v8 launch
                </button>
                <button className="app-side-row">
                  <span className="row-dot ai" />
                  Cross-AI strategy
                </button>
                <button className="app-side-row">
                  <span className="row-dot ai" />
                  Pricing experiments
                </button>
              </div>
            </aside>

            <main className="app-main">
              <div className="app-crumbs">
                <span className="mono">/raymind</span>
                <span className="crumb-sep">/</span>
                <span className="mono">v8 thinking</span>
                <div className="app-crumb-actions">
                  <button className="btn-pill">Share</button>
                  <button className="btn-pill">Copy URL</button>
                </div>
              </div>
              <article className="app-doc">
                <h1 className="app-doc-title">v8 thinking, capture vs memory</h1>
                <div className="app-doc-meta">
                  <span className="mono">memory.wiki/nvF3Li2x</span>
                  <span className="meta-sep">/</span>
                  <span className="mono">2h ago</span>
                  <span className="meta-sep">/</span>
                  <span className="mono">read by 5 AIs</span>
                </div>
                <p className="app-doc-body">
                  memory.wiki이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함.
                  그래서 <em>capture everything</em>이 자연스러운 입구.
                  AI가 organize 하는 layer가 그 다음, 어떤 AI한테든 paste 가능한
                  URL이 마지막 단계.
                </p>
                <p className="app-doc-body">
                  Cross-AI가 본질적 wedge. Vendor의 walled garden memory와
                  대치되는 portable URL이 핵심 가치.
                </p>
                <div className="app-tag-row">
                  <span className="tag">v8</span>
                  <span className="tag">thinking</span>
                  <span className="tag">framework</span>
                  <span className="tag tag-ai">ai / cross-ai-strategy</span>
                </div>
              </article>
            </main>

            <aside className="app-ai">
              <div className="app-ai-head">
                <span className="badge-ai">memory.wiki AI</span>
                <button className="btn-pill">Close</button>
              </div>
              <div className="ai-msg ai-msg-user">
                What did I decide about cross-AI yesterday?
              </div>
              <div className="ai-msg ai-msg-bot">
                You decided cross-AI is the structural wedge giants cannot
                build. It carries the brand narrative for v8 launch.
                <div className="ai-cite mono">source / memory.wiki/nvF3Li2x</div>
              </div>
              <div className="ai-input">
                <input placeholder="Ask memory.wiki" />
                <button className="ai-send">→</button>
              </div>
            </aside>
          </div>
        </div>

        {/* Public doc */}
        <div className="screen">
          <div className="screen-chrome">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
            <span className="screen-url mono">memory.wiki/nvF3Li2x</span>
          </div>
          <article className="public-doc">
            <header className="pd-head">
              <div className="pd-author-row">
                <div className="avatar lg">R</div>
                <div className="pd-author">
                  <div className="pd-author-name">raymind</div>
                  <div className="pd-author-meta mono">
                    captured 2h ago from chrome-extension
                  </div>
                </div>
                <div className="pd-actions">
                  <button className="btn-secondary sm">Copy for ChatGPT</button>
                  <button className="btn-secondary sm">Copy for Claude</button>
                  <button className="btn-primary sm">Open in editor</button>
                </div>
              </div>
              <h1 className="pd-title">v8 thinking, capture vs memory</h1>
              <div className="pd-tags">
                <span className="tag">v8</span>
                <span className="tag">thinking</span>
                <span className="tag tag-ai">ai / framework</span>
              </div>
            </header>
            <div className="pd-body">
              <p>
                memory.wiki이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함.
                그래서 capture everything이 자연스러운 입구.
              </p>
              <p>
                AI가 organize 하는 layer가 그 다음, 어떤 AI한테든 paste 가능한
                URL이 마지막 단계. Cross-AI가 본질적 wedge.
              </p>
            </div>
            <footer className="pd-foot">
              <div className="pd-stat">
                <div className="pd-stat-num">247</div>
                <div className="pd-stat-label mono">reads</div>
              </div>
              <div className="pd-stat">
                <div className="pd-stat-num">12</div>
                <div className="pd-stat-label mono">AI fetches</div>
              </div>
              <div className="pd-stat">
                <div className="pd-stat-num">3</div>
                <div className="pd-stat-label mono">bundles</div>
              </div>
              <button className="btn-primary pd-cta">
                Publish your own →
              </button>
            </footer>
          </article>
        </div>

        {/* Hub profile */}
        <div className="screen">
          <div className="screen-chrome">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
            <span className="screen-url mono">memory.wiki/@raymind</span>
          </div>
          <div className="hub">
            <div className="hub-head">
              <div className="avatar xl">R</div>
              <div className="hub-head-text">
                <h1 className="hub-name">raymind</h1>
                <p className="hub-bio">
                  Solo founder of memory.wiki. Building a cross-AI context
                  layer. Ships fast, prefers TypeScript, lives in markdown.
                </p>
                <div className="hub-meta">
                  <span className="mono">memory.wiki/@raymind</span>
                  <span className="meta-sep">/</span>
                  <span className="mono">since 2026</span>
                  <span className="meta-sep">/</span>
                  <span className="mono">247 captures</span>
                </div>
              </div>
              <button className="btn-primary">Paste my memory.wiki</button>
            </div>
            <div className="hub-stats">
              <div className="hub-stat">
                <div className="hub-stat-num">247</div>
                <div className="hub-stat-label mono">documents</div>
              </div>
              <div className="hub-stat">
                <div className="hub-stat-num">18</div>
                <div className="hub-stat-label mono">AI clusters</div>
              </div>
              <div className="hub-stat">
                <div className="hub-stat-num">9</div>
                <div className="hub-stat-label mono">surfaces synced</div>
              </div>
              <div className="hub-stat">
                <div className="hub-stat-num">5</div>
                <div className="hub-stat-label mono">AIs reading</div>
              </div>
            </div>
            <div className="hub-section">
              <div className="hub-section-head">
                <h3 className="hub-section-title">Recent documents</h3>
                <a className="hub-section-link mono" href="#">view all →</a>
              </div>
              <div className="hub-grid">
                <a className="hub-tile" href="#">
                  <div className="hub-tile-tag">
                    <span className="row-dot user" />
                    <span className="mono">2h ago</span>
                  </div>
                  <div className="hub-tile-title">v8 thinking, capture vs memory</div>
                  <div className="hub-tile-meta mono">memory.wiki/nvF3Li2x</div>
                </a>
                <a className="hub-tile" href="#">
                  <div className="hub-tile-tag">
                    <span className="row-dot user" />
                    <span className="mono">1d ago</span>
                  </div>
                  <div className="hub-tile-title">v7-revised business plan</div>
                  <div className="hub-tile-meta mono">memory.wiki/SKaY7VJP</div>
                </a>
                <a className="hub-tile" href="#">
                  <div className="hub-tile-tag">
                    <span className="row-dot ai" />
                    <span className="mono">3d ago</span>
                  </div>
                  <div className="hub-tile-title">Cross-AI strategy notes</div>
                  <div className="hub-tile-meta mono">memory.wiki/k2L9PqXm</div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="section" id="pricing">
        <div className="section-head center">
          <span className="eyebrow">Pricing</span>
          <h2 className="display-md">Free during beta. Pro later.</h2>
          <p className="section-lede">
            URLs are permanent on both tiers. We never delete your memory.
          </p>
        </div>
        <div className="pricing-grid">
          <article className="price-card">
            <div className="price-head">
              <div className="price-name">Free</div>
              <div className="price-amount">$0</div>
              <div className="price-sub mono">forever for capture</div>
            </div>
            <ul className="price-list">
              <li>Unlimited documents</li>
              <li>Permanent URLs</li>
              <li>All 9 capture surfaces</li>
              <li>Manual organize</li>
              <li>Personal hub at memory.wiki/hub/&lt;you&gt;</li>
            </ul>
            <button className="btn-secondary btn-full">Start free</button>
          </article>
          <article className="price-card price-card-feature">
            <div className="price-tag">Coming with v8</div>
            <div className="price-head">
              <div className="price-name">Pro</div>
              <div className="price-amount">TBD</div>
              <div className="price-sub mono">priced after launch</div>
            </div>
            <ul className="price-list">
              <li>Auto-organize (continuous AI clustering)</li>
              <li>Bundle auto-suggestion</li>
              <li>Private capture surfaces</li>
              <li>Team workspaces (v9+)</li>
              <li>Priority support</li>
            </ul>
            <button className="btn-primary btn-full">Join the waitlist</button>
          </article>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="brand" href="/">
              <span className="brand-mark">M</span>
              <span className="brand-word">
                Memory<span className="brand-dot">.</span>Wiki
              </span>
            </a>
            <p className="footer-tag">The fastest way from thought to shared document.</p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-head mono">Product</div>
              <a href="#">Capture</a>
              <a href="#">Organize</a>
              <a href="#">Use</a>
              <a href="#">Pricing</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-head mono">Surfaces</div>
              <a href="#">Web</a>
              <a href="#">Chrome</a>
              <a href="#">iOS / Android</a>
              <a href="#">VS Code</a>
              <a href="#">Desktop</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-head mono">Company</div>
              <a href="#">Manifesto</a>
              <a href="#">Roadmap</a>
              <a href="#">Changelog</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </div>
        <div className="footer-rule" />
        <div className="footer-bottom">
          <span className="mono">© 2026 memory.wiki</span>
          <span className="mono">Built in public / v8 preview</span>
        </div>
      </footer>
    </div>
  );
}
