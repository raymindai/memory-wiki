"use client";

import { VariantNav } from "../VariantNav";
import "./clay.css";

export function ClayVariant() {
  return (
    <div className="v8-clay">
      <VariantNav />

      <header className="topnav">
        <div className="topnav-inner">
          <a href="#" className="brand">
            <span className="brand-blob" />
            <span className="brand-word">Memory.Wiki</span>
          </a>
          <nav className="topnav-links">
            <a href="#" className="topnav-link">Product</a>
            <a href="#" className="topnav-link">Solutions</a>
            <a href="#" className="topnav-link">Pricing</a>
            <a href="#" className="topnav-link">Customers</a>
          </nav>
          <div className="topnav-right">
            <a href="#" className="topnav-link">Sign in</a>
            <button className="btn-primary">Try free</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-band">
        <div className="hero-grid">
          <div>
            <h1 className="display-xl">
              Stop re-explaining yourself to every AI.
            </h1>
            <p className="hero-sub">
              Capture from anywhere. AI organizes in the background.
              Paste one URL into Claude, ChatGPT, Cursor — all of them know
              you instantly.
            </p>
            <div className="cta-row">
              <button className="btn-primary">Try free</button>
              <button className="btn-secondary">Book a demo</button>
            </div>
          </div>
          <div className="hero-illo">
            <div className="claymation-shape shape-1" />
            <div className="claymation-shape shape-2" />
            <div className="claymation-shape shape-3" />
            <div className="mascot">✦</div>
          </div>
        </div>
      </section>

      {/* Pastel feature cards */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-lg">Three primitives.</h2>
          <p className="section-lede">
            Each card a different color. The product voltage IS the brand color.
          </p>
        </div>
        <div className="feature-grid">
          <div className="feature-card feature-pink">
            <div className="feature-tag">Capture</div>
            <h3 className="card-title">From anywhere.</h3>
            <p className="card-body">
              Chrome, Cursor, mobile, MCP, CLI — any surface drops into your
              Memory.Wiki at the same URL.
            </p>
          </div>
          <div className="feature-card feature-teal">
            <div className="feature-tag">Organize</div>
            <h3 className="card-title">AI does the work.</h3>
            <p className="card-body">
              Background AI tags, clusters, summarizes. Original markdown stays
              sacred. Lock anything you&apos;ve corrected.
            </p>
          </div>
          <div className="feature-card feature-lavender">
            <div className="feature-tag">Use</div>
            <h3 className="card-title">Paste anywhere.</h3>
            <p className="card-body">
              Claude, ChatGPT, Cursor, Codex — each receives an optimized
              digest, token-budgeted.
            </p>
          </div>
          <div className="feature-card feature-peach">
            <div className="feature-tag">Share</div>
            <h3 className="card-title">Public or private.</h3>
            <p className="card-body">
              Bundles can be public, unlisted, restricted, or invite-only.
              Live edit + presence built in.
            </p>
          </div>
          <div className="feature-card feature-ochre">
            <div className="feature-tag">Mobile</div>
            <h3 className="card-title">iOS &amp; Android native.</h3>
            <p className="card-body">
              Share sheet from any app. Camera capture. Spotlight search. Widget.
            </p>
          </div>
          <div className="feature-card feature-cream">
            <div className="feature-tag">Cross-AI</div>
            <h3 className="card-title">Built for the post-vendor era.</h3>
            <p className="card-body">
              Vendor memories lock you in. Memory.Wiki ports across every AI.
              One URL, no walls.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section">
        <div className="section-head" style={{ textAlign: "center" }}>
          <h2 className="display-lg">Pricing.</h2>
          <p className="section-lede">Free during beta. Pro unlocks unlimited AI organize.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-tier">Free</div>
            <div className="pricing-price">$0</div>
            <p className="card-body">3 docs/mo · public only · 1 bundle</p>
            <button className="btn-secondary btn-full">Start free</button>
          </div>
          <div className="pricing-card pricing-featured">
            <div className="pricing-tier">Pro</div>
            <div className="pricing-price">$15 <span className="period">/ mo</span></div>
            <p className="card-body">Unlimited · private · AI auto-organize · native mobile</p>
            <button className="btn-on-color btn-full">Try Pro</button>
          </div>
          <div className="pricing-card">
            <div className="pricing-tier">Team</div>
            <div className="pricing-price">Soon</div>
            <p className="card-body">Shared workspaces · roles · SSO</p>
            <button className="btn-secondary btn-full">Join waitlist</button>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="section">
        <div className="cta-band">
          <h2 className="display-md">Turn your AI context into a URL today.</h2>
          <p className="section-lede" style={{ marginBottom: 28 }}>
            Free during beta. No credit card.
          </p>
          <button className="btn-primary">Start your Memory.Wiki</button>
          <div className="cta-illo">
            <div className="claymation-shape shape-cta-1" />
            <div className="claymation-shape shape-cta-2" />
          </div>
        </div>
      </section>

      {/* Cream footer (Clay's signature — NOT dark) */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="brand">
              <span className="brand-blob" />
              <span className="brand-word">Memory.Wiki</span>
            </div>
            <div className="caption">v8 Variant I · Clay-inspired</div>
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
              <a href="#" className="footer-link">Chrome</a>
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
        {/* Horizon mountain */}
        <div className="horizon">
          <div className="mountain mountain-1" />
          <div className="mountain mountain-2" />
          <div className="mountain mountain-3" />
        </div>
      </footer>
    </div>
  );
}
