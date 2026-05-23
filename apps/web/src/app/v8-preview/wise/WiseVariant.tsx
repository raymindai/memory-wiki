"use client";

import { VariantNav } from "../VariantNav";
import "./wise.css";

export function WiseVariant() {
  return (
    <div className="v8-wise">
      <VariantNav />

      {/* Top nav */}
      <header className="topnav">
        <div className="topnav-inner">
          <a href="#" className="brand">Memory.Wiki</a>
          <nav className="topnav-links">
            <a href="#" className="topnav-link">Capture</a>
            <a href="#" className="topnav-link">Organize</a>
            <a href="#" className="topnav-link">Use</a>
            <a href="#" className="topnav-link">Pricing</a>
          </nav>
          <div className="topnav-right">
            <a href="#" className="topnav-link">Log in</a>
            <button className="btn-primary">Get started</button>
          </div>
        </div>
      </header>

      {/* Hero band — sage canvas + giant Manrope display */}
      <section className="hero-band">
        <div className="hero-grid">
          <div>
            <h1 className="display-mega">
              Stop
              <br />
              re-explaining.
            </h1>
            <p className="hero-sub">
              Capture from anywhere. AI organizes. Every AI you use can read
              your context from one URL.
            </p>
            <div className="cta-row">
              <button className="btn-primary">Start your Memory.Wiki</button>
              <button className="btn-tertiary">See an example</button>
            </div>
          </div>

          {/* Signature converter-style card — adapted to "context card" */}
          <div className="converter-card">
            <div className="converter-row">
              <div className="converter-label">You write</div>
              <div className="converter-value">
                <span className="converter-amount">12</span>
                <span className="converter-unit">notes / week</span>
              </div>
            </div>
            <div className="converter-divider">
              <div className="converter-arrow">→</div>
            </div>
            <div className="converter-row converter-row-out">
              <div className="converter-label">AI gets</div>
              <div className="converter-value">
                <span className="converter-amount">1</span>
                <span className="converter-unit">URL</span>
              </div>
              <div className="converter-detail">
                Auto-organized · 3 clusters · 8 KB digest
              </div>
            </div>
            <button className="btn-primary btn-full">Save my context</button>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="section content-band">
        <div className="stats">
          <div className="stat">
            <div className="stat-num">247</div>
            <div className="stat-label">captures organized</div>
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

      {/* Pastel feature cards */}
      <section className="section content-band">
        <div className="section-head">
          <h2 className="display-md">Three primitives.</h2>
          <p className="section-lede">Each does one thing well.</p>
        </div>
        <div className="feature-grid">
          <div className="feature-card feature-green">
            <div className="feature-badge">Capture</div>
            <h3 className="card-title">From anywhere.</h3>
            <p className="card-body">
              Chrome, Cursor, mobile share sheet, MCP, CLI — every surface drops
              into the same URL.
            </p>
          </div>
          <div className="feature-card feature-sage">
            <div className="feature-badge">Organize</div>
            <h3 className="card-title">AI does the work.</h3>
            <p className="card-body">
              Background AI tags, clusters, summarizes. Your original markdown
              stays sacred. Lock anything you&apos;ve corrected.
            </p>
          </div>
          <div className="feature-card feature-cream">
            <div className="feature-badge">Use</div>
            <h3 className="card-title">Paste anywhere.</h3>
            <p className="card-body">
              ChatGPT, Claude, Cursor, Codex — each receives an optimized
              digest, token-budgeted for its context window.
            </p>
          </div>
        </div>
      </section>

      {/* Dark hero band — polarity flip */}
      <section className="hero-band-dark">
        <div className="hero-grid">
          <div>
            <h2 className="display-mega green-on-dark">
              One URL.
              <br />
              Every AI.
            </h2>
            <p className="hero-sub-dark">
              Memory.Wiki is the context layer giants can&apos;t build.
              Cross-AI is structural — and that&apos;s the wedge.
            </p>
            <div className="cta-row">
              <button className="btn-primary">Try it free</button>
              <button className="btn-tertiary-on-dark">Read manifesto</button>
            </div>
          </div>
          <div className="dark-mockup">
            <div className="mockup-row">
              <span className="mockup-key">memory.wiki/@raymind</span>
              <span className="mockup-status">
                <span className="mockup-dot" /> connected
              </span>
            </div>
            <div className="mockup-divider" />
            <div className="mockup-row">
              <span className="mockup-key">→ Claude</span>
              <span className="mockup-tag tag-positive">reading 8 KB</span>
            </div>
            <div className="mockup-row">
              <span className="mockup-key">→ ChatGPT</span>
              <span className="mockup-tag tag-positive">reading 12 KB</span>
            </div>
            <div className="mockup-row">
              <span className="mockup-key">→ Cursor</span>
              <span className="mockup-tag tag-positive">reading 4 KB</span>
            </div>
            <div className="mockup-row">
              <span className="mockup-key">→ Codex</span>
              <span className="mockup-tag tag-positive">reading 6 KB</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section content-band">
        <div className="section-head" style={{ textAlign: "center" }}>
          <h2 className="display-md">Pricing.</h2>
          <p className="section-lede">Free during beta. Pro unlocks everything.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-tier">Free</div>
            <div className="pricing-price">$0</div>
            <p className="card-body" style={{ marginBottom: 24 }}>
              3 docs/month · public · 1 bundle
            </p>
            <button className="btn-tertiary btn-full">Start free</button>
          </div>
          <div className="pricing-card pricing-card-featured">
            <div className="pricing-tier">Pro</div>
            <div className="pricing-price">
              $15 <span className="pricing-period">/ mo</span>
            </div>
            <p className="card-body" style={{ marginBottom: 24 }}>
              Unlimited everything · private · AI auto-organize · native mobile
            </p>
            <button className="btn-primary btn-full">Try Pro</button>
          </div>
          <div className="pricing-card">
            <div className="pricing-tier">Team</div>
            <div className="pricing-price">Soon</div>
            <p className="card-body" style={{ marginBottom: 24 }}>
              Shared bundles · roles · SSO · audit
            </p>
            <button className="btn-tertiary btn-full">Join waitlist</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="brand brand-dark">Memory.Wiki</div>
            <div className="caption">v8 Variant G · Wise-inspired</div>
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
              <a href="#" className="footer-link">Android</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <a href="#" className="footer-link">About</a>
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
