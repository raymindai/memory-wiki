"use client";

import { VariantNav } from "../VariantNav";
import "./miro.css";

export function MiroVariant() {
  return (
    <div className="v8-miro">
      <VariantNav />

      {/* Promo banner */}
      <div className="promo-banner">
        v8 launch coming soon <span className="promo-pill">GET EARLY ACCESS</span>
      </div>

      {/* Top nav */}
      <header className="topnav">
        <div className="topnav-inner">
          <a href="#" className="brand-mark">
            <span className="brand-square">M</span>
            <span className="brand-word">Memory.Wiki</span>
          </a>
          <nav className="topnav-links">
            <a href="#" className="topnav-link">Product</a>
            <a href="#" className="topnav-link">Use cases</a>
            <a href="#" className="topnav-link">Pricing</a>
            <a href="#" className="topnav-link">Resources</a>
          </nav>
          <div className="topnav-right">
            <a href="#" className="topnav-link">Login</a>
            <button className="btn-primary">Get started free</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-band">
        <h1 className="display-hero">
          See how teams remember context with Memory.Wiki.
        </h1>
        <p className="hero-sub">
          Capture from anywhere. AI organizes. Every AI you use can read your
          context from one URL.
        </p>
        <div className="cta-row">
          <button className="btn-primary">Get started free</button>
          <button className="btn-secondary">Book a demo</button>
        </div>

        {/* Whiteboard-style mockup */}
        <div className="whiteboard-mockup">
          <div className="sticky" style={{ background: "#FFE600", top: 40, left: 40, transform: "rotate(-3deg)" }}>
            <div className="sticky-text">v8 launch plan</div>
            <div className="sticky-meta">@raymind · today</div>
          </div>
          <div className="sticky" style={{ background: "#FFC1D8", top: 80, left: 260, transform: "rotate(2deg)" }}>
            <div className="sticky-text">capture → organize → use</div>
            <div className="sticky-meta">✦ AI digest · Sunday</div>
          </div>
          <div className="sticky" style={{ background: "#A8E6CF", top: 200, left: 120, transform: "rotate(-1deg)" }}>
            <div className="sticky-text">cross-AI is the wedge</div>
            <div className="sticky-meta">@raymind · 2h</div>
          </div>
          <div className="sticky" style={{ background: "#C5E1FF", top: 160, left: 380, transform: "rotate(4deg)" }}>
            <div className="sticky-text">brand foundation week 1</div>
            <div className="sticky-meta">@raymind · 3h</div>
          </div>
          <div className="sticky" style={{ background: "#FFD4A8", top: 280, left: 300, transform: "rotate(-2deg)" }}>
            <div className="sticky-text">Tier A collab features</div>
            <div className="sticky-meta">✦ AI cluster</div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section">
        <div className="stats">
          <div className="stat">
            <div className="stat-num">100K+</div>
            <div className="stat-label">captures organized</div>
          </div>
          <div className="stat">
            <div className="stat-num">5</div>
            <div className="stat-label">AIs reading by default</div>
          </div>
          <div className="stat">
            <div className="stat-num">2.4k</div>
            <div className="stat-label">tokens saved per session</div>
          </div>
          <div className="stat">
            <div className="stat-num">9</div>
            <div className="stat-label">surfaces synced</div>
          </div>
        </div>
      </section>

      {/* Pastel feature cards */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-2">Three primitives. One URL.</h2>
        </div>
        <div className="feature-grid">
          <div className="feature-card feature-yellow">
            <div className="feature-tag">Capture</div>
            <h3 className="card-title">From anywhere you work.</h3>
            <p className="card-body">
              Chrome, Cursor, mobile share sheet, MCP, CLI — every surface drops
              into the same URL.
            </p>
          </div>
          <div className="feature-card feature-rose">
            <div className="feature-tag">Organize</div>
            <h3 className="card-title">AI does the heavy lifting.</h3>
            <p className="card-body">
              Background AI tags, clusters, summarizes. Your original markdown
              stays sacred.
            </p>
          </div>
          <div className="feature-card feature-teal">
            <div className="feature-tag">Use</div>
            <h3 className="card-title">Paste in any AI.</h3>
            <p className="card-body">
              ChatGPT, Claude, Cursor, Codex — each gets an optimized digest,
              token-budgeted.
            </p>
          </div>
          <div className="feature-card feature-coral">
            <div className="feature-tag">Share</div>
            <h3 className="card-title">With teammates or the world.</h3>
            <p className="card-body">
              Bundle visibility · live edit · presence. Public profile if you
              want it.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section">
        <div className="section-head" style={{ textAlign: "center" }}>
          <h2 className="display-2">Pricing.</h2>
          <p className="section-lede">Free during beta. Pro unlocks unlimited AI organize.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-tier">Free</div>
            <div className="pricing-price">$0</div>
            <p className="card-body">3 docs/month · public · 1 bundle</p>
            <button className="btn-secondary btn-full">Start free</button>
          </div>
          <div className="pricing-card pricing-featured">
            <div className="featured-badge">FEATURED</div>
            <div className="pricing-tier">Pro</div>
            <div className="pricing-price">$15<span className="period">/mo</span></div>
            <p className="card-body">Unlimited · private · AI organize · native mobile</p>
            <button className="btn-primary btn-full">Try Pro</button>
          </div>
          <div className="pricing-card pricing-enterprise">
            <div className="pricing-tier">Team</div>
            <div className="pricing-price">Soon</div>
            <p className="card-body">Shared bundles · roles · SSO</p>
            <button className="btn-on-dark btn-full">Join waitlist</button>
          </div>
        </div>
      </section>

      {/* CTA banner dark */}
      <section className="section">
        <div className="cta-banner-dark">
          <h2 className="display-2 on-dark">Try Memory.Wiki today.</h2>
          <p className="hero-sub on-dark">No credit card. Beta is free.</p>
          <button className="btn-on-dark">Get started free</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="brand-square brand-square-dark">M</span>
            <span className="brand-word brand-word-dark">Memory.Wiki</span>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-title">Product</div>
              <a href="#" className="footer-link">Capture</a>
              <a href="#" className="footer-link">Organize</a>
              <a href="#" className="footer-link">Use</a>
              <a href="#" className="footer-link">Pricing</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Surfaces</div>
              <a href="#" className="footer-link">Web</a>
              <a href="#" className="footer-link">iOS</a>
              <a href="#" className="footer-link">Android</a>
              <a href="#" className="footer-link">Chrome</a>
              <a href="#" className="footer-link">VS Code</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Resources</div>
              <a href="#" className="footer-link">Docs</a>
              <a href="#" className="footer-link">MCP server</a>
              <a href="#" className="footer-link">Changelog</a>
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
          <div className="footer-bottom">
            <span className="caption">v8 Variant H · Miro-inspired</span>
            <span className="caption">© 2026 Raymind</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
