"use client";

import { VariantNav } from "../VariantNav";
import "./clay-stack.css";

export function ClayStackVariant() {
  return (
    <div className="v8-clay-stack">
      <VariantNav />

      <header className="topnav">
        <div className="topnav-inner">
          <a href="#" className="brand">
            <span className="brand-blob" />
            <span className="brand-word">Memory.Wiki</span>
          </a>
          <nav className="topnav-links">
            <a href="#" className="topnav-link">Product</a>
            <a href="#" className="topnav-link">Pricing</a>
            <a href="#" className="topnav-link">Docs</a>
          </nav>
          <div className="topnav-right">
            <span className="status mono">
              <span className="status-dot" /> live · v8 beta
            </span>
            <a href="#" className="topnav-link">Sign in</a>
            <button className="btn-primary">Try free</button>
          </div>
        </div>
      </header>

      {/* Hero — type-driven, full-bleed teal */}
      <section className="hero-band">
        <span className="eyebrow mono">memory.wiki / v8 / 2026.10</span>
        <h1 className="display-mega">
          One URL.
          <br />
          <span className="display-accent">Every AI.</span>
        </h1>
        <p className="hero-sub">
          Stop re-explaining yourself. Capture from anywhere — Claude, ChatGPT,
          Cursor all read the same context from one Memory.Wiki URL.
        </p>
        <div className="cta-row">
          <button className="btn-primary">Try free</button>
          <button className="btn-outline mono">memory.wiki/@raymind →</button>
        </div>

        {/* Surface strip — list of supported AIs */}
        <div className="surface-strip">
          <span className="mono surface-label">reads from</span>
          <span className="surface-pill">Claude</span>
          <span className="surface-pill">ChatGPT</span>
          <span className="surface-pill">Cursor</span>
          <span className="surface-pill">Codex</span>
          <span className="surface-pill">Perplexity</span>
          <span className="surface-pill mono">+ any MCP-aware AI</span>
        </div>
      </section>

      {/* Feature cards — saturated, 2 columns, tight */}
      <section className="section">
        <div className="section-head">
          <span className="eyebrow mono">3 primitives + 3 powers</span>
          <h2 className="display-lg">Built around capture · organize · use.</h2>
        </div>
        <div className="feature-grid">
          <div className="feature-card feature-pink">
            <span className="feature-tag mono">/capture</span>
            <h3 className="card-title">From anywhere you work.</h3>
            <p className="card-body">
              Chrome, Cursor, mobile share, MCP, CLI — every surface drops
              into the same URL. Zero reformatting.
            </p>
            <div className="card-stats">
              <div className="stat">
                <div className="stat-num">9</div>
                <div className="mono stat-label">surfaces</div>
              </div>
              <div className="stat">
                <div className="stat-num">0</div>
                <div className="mono stat-label">friction</div>
              </div>
            </div>
          </div>
          <div className="feature-card feature-teal">
            <span className="feature-tag mono">/organize</span>
            <h3 className="card-title">AI does the heavy lifting.</h3>
            <p className="card-body">
              Background AI tags, clusters, summarizes — your original markdown
              stays sacred. Lock anything you&apos;ve corrected.
            </p>
            <div className="card-stats">
              <div className="stat">
                <div className="stat-num">5-10</div>
                <div className="mono stat-label">tags / doc</div>
              </div>
              <div className="stat">
                <div className="stat-num">nightly</div>
                <div className="mono stat-label">refresh</div>
              </div>
            </div>
          </div>
          <div className="feature-card feature-lavender">
            <span className="feature-tag mono">/use</span>
            <h3 className="card-title">Paste in any AI.</h3>
            <p className="card-body">
              Each receives an optimized digest, token-budgeted for its context
              window. Same URL, different consumers.
            </p>
            <div className="card-stats">
              <div className="stat">
                <div className="stat-num">4-16</div>
                <div className="mono stat-label">KB digest</div>
              </div>
              <div className="stat">
                <div className="stat-num">5+</div>
                <div className="mono stat-label">AI compat</div>
              </div>
            </div>
          </div>
          <div className="feature-card feature-ochre">
            <span className="feature-tag mono">/share</span>
            <h3 className="card-title">Yours, team&apos;s, or public.</h3>
            <p className="card-body">
              Public, unlisted, restricted, or invite-only. Live edit with
              presence — built on Yjs CRDT.
            </p>
            <div className="card-stats">
              <div className="stat">
                <div className="stat-num">max 5</div>
                <div className="mono stat-label">collab</div>
              </div>
              <div className="stat">
                <div className="stat-num">CRDT</div>
                <div className="mono stat-label">realtime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dark band — anatomy of a URL */}
      <section className="section">
        <div className="anatomy-card">
          <span className="eyebrow mono on-dark">anatomy</span>
          <h2 className="display-md on-dark">
            One URL. Multiple shapes per consumer.
          </h2>
          <div className="anatomy-grid">
            <div className="anatomy-row">
              <span className="mono anatomy-key">browser</span>
              <span className="anatomy-arrow">→</span>
              <span className="anatomy-result">HTML timeline · full markdown · interactive</span>
            </div>
            <div className="anatomy-row">
              <span className="mono anatomy-key">ChatGPT-User</span>
              <span className="anatomy-arrow">→</span>
              <span className="anatomy-result mono">text/html · SSR body · 12 KB</span>
            </div>
            <div className="anatomy-row">
              <span className="mono anatomy-key">Claude-Web</span>
              <span className="anatomy-arrow">→</span>
              <span className="anatomy-result mono">text/markdown · digest · 8 KB</span>
            </div>
            <div className="anatomy-row">
              <span className="mono anatomy-key">.md suffix</span>
              <span className="anatomy-arrow">→</span>
              <span className="anatomy-result mono">text/markdown · full payload</span>
            </div>
            <div className="anatomy-row">
              <span className="mono anatomy-key">/api/docs/&lt;id&gt;</span>
              <span className="anatomy-arrow">→</span>
              <span className="anatomy-result mono">application/json · all fields</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section">
        <div className="section-head" style={{ textAlign: "center" }}>
          <span className="eyebrow mono">/pricing</span>
          <h2 className="display-md">Free during beta.</h2>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="mono pricing-tier">free</div>
            <div className="pricing-price">$0</div>
            <p className="card-body">3 docs/mo · public only · 1 bundle</p>
            <button className="btn-outline btn-full">Start free</button>
          </div>
          <div className="pricing-card pricing-featured">
            <div className="mono pricing-tier">pro</div>
            <div className="pricing-price">$15 <span className="mono period">/mo</span></div>
            <p className="card-body">Unlimited · private · AI auto-organize · native mobile</p>
            <button className="btn-on-color btn-full">Try Pro</button>
          </div>
          <div className="pricing-card">
            <div className="mono pricing-tier">team</div>
            <div className="pricing-price">soon</div>
            <p className="card-body">Shared workspaces · roles · SSO · v9</p>
            <button className="btn-outline btn-full">Join waitlist</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="brand">
              <span className="brand-blob" />
              <span className="brand-word">Memory.Wiki</span>
            </div>
            <span className="mono caption">v8 / variant I.3 / clay-stack</span>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-title mono">/product</div>
              <a href="#" className="footer-link">Capture</a>
              <a href="#" className="footer-link">Organize</a>
              <a href="#" className="footer-link">Use</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title mono">/surfaces</div>
              <a href="#" className="footer-link">Web</a>
              <a href="#" className="footer-link">iOS</a>
              <a href="#" className="footer-link">Android</a>
              <a href="#" className="footer-link">Chrome</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title mono">/company</div>
              <a href="#" className="footer-link">About</a>
              <a href="#" className="footer-link">Manifesto</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title mono">/legal</div>
              <a href="#" className="footer-link">Privacy</a>
              <a href="#" className="footer-link">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
