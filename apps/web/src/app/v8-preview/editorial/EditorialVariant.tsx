"use client";

import { useState } from "react";
import { VariantNav } from "../VariantNav";
import "./editorial.css";

export function EditorialVariant() {
  const [streamedText, setStreamedText] = useState("");
  const fullText =
    "Your weekly digest: 12 captures this week, clustered into 3 themes. " +
    "Memory.Wiki noticed a strong connection between your TypeScript notes " +
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
    <div className="v8-editorial">
      <VariantNav />

      {/* Top nav */}
      <header className="topnav">
        <div className="topnav-inner">
          <div className="topnav-brand">
            <Spike size={18} />
            <span className="topnav-wordmark">Memory.Wiki</span>
          </div>
          <nav className="topnav-links">
            <a href="#" className="topnav-link">Product</a>
            <a href="#" className="topnav-link">Use cases</a>
            <a href="#" className="topnav-link">Pricing</a>
            <a href="#" className="topnav-link">Docs</a>
          </nav>
          <div className="topnav-right">
            <a href="#" className="text-link">Sign in</a>
            <button className="btn-primary">Try Memory.Wiki</button>
          </div>
        </div>
      </header>

      {/* Hero band */}
      <section className="hero-band">
        <div className="hero-grid">
          <div>
            <span className="badge-pill">v8 · Editorial direction</span>
            <h1 className="display-xl">
              Stop re&#8209;explaining
              <br />
              your context
              <br />
              <em>to every AI.</em>
            </h1>
            <p className="hero-sub">
              One URL every AI fetches. Yours, your team&apos;s, or your
              community&apos;s.
            </p>
            <div className="cta-row">
              <button className="btn-primary">Start your Memory.Wiki</button>
              <button className="btn-secondary">See an example →</button>
            </div>
          </div>

          {/* Hero illustration card — dark product mockup */}
          <div className="hero-illustration-card">
            <div className="code-window">
              <div className="code-window-bar">
                <div className="code-window-dots">
                  <span className="dot d-r" />
                  <span className="dot d-y" />
                  <span className="dot d-g" />
                </div>
                <div className="code-window-title">claude · paste context</div>
              </div>
              <div className="code-window-body">
                <div className="code-line">
                  <span className="code-prompt">&gt;</span>{" "}
                  <span className="code-user">
                    Read memory.wiki/@raymind — help me ship v8
                  </span>
                </div>
                <div className="code-line code-line-ai">
                  <span className="code-sparkle">✦</span> Claude · fetched 12 KB
                </div>
                <div className="code-line code-output">
                  Raymind is solo-founder shipping Memory.Wiki v8. Capture →
                  Organize → Use framework. Cross-AI is the wedge. Today: working
                  on visual direction. Let me help —
                </div>
                <div className="code-line">
                  <span className="cursor" />
                </div>
              </div>
              <div className="code-window-status">
                <span className="status-dot status-on" />
                connected · 247 captures · last sync 2m ago
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards — cream */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-lg">Three primitives. One URL.</h2>
          <p className="section-lede">
            Every Memory.Wiki page is composed of three layers: capture, organize,
            and use. AI lives in the middle.
          </p>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <Spike size={22} className="feature-icon" />
            <h3 className="title-md">Capture anywhere</h3>
            <p className="body-md">
              Chrome, Cursor, mobile share sheet, MCP, CLI — every surface drops
              into the same URL. No reformatting.
            </p>
          </div>
          <div className="feature-card">
            <Spike size={22} className="feature-icon" />
            <h3 className="title-md">AI organizes</h3>
            <p className="body-md">
              Background AI tags, clusters, and summarizes. Original markdown
              stays sacred. You can lock anything you&apos;ve edited.
            </p>
          </div>
          <div className="feature-card">
            <Spike size={22} className="feature-icon" />
            <h3 className="title-md">Use everywhere</h3>
            <p className="body-md">
              Paste the URL into Claude, ChatGPT, Cursor, or Codex. Each receives
              the same context, optimized for its token budget.
            </p>
          </div>
        </div>
      </section>

      {/* Dual-layer cards */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-md">Original sacred. AI assistive.</h2>
          <p className="section-lede">
            What you write stays yours. What AI adds is clearly attributed.
            Both live in the same timeline.
          </p>
        </div>
        <div className="card-row">
          <div className="dual-card user-card">
            <div className="dual-meta">
              <div className="avatar">R</div>
              <span className="dual-author">raymind</span>
              <span className="dual-time">2h ago</span>
            </div>
            <h3 className="title-md">v8 thinking — capture vs memory</h3>
            <p className="body-md">
              Memory.Wiki 이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함.
              그래서 capture everything 이 자연스러운 입구.
            </p>
            <div className="tags">
              <span className="tag">v8</span>
              <span className="tag">thinking</span>
            </div>
          </div>

          <div className="dual-card ai-card">
            <div className="dual-meta">
              <span className="badge-ai">
                <Spike size={11} /> Claude · weekly digest
              </span>
              <span className="dual-time">Sunday</span>
            </div>
            <h3 className="title-md">Three themes emerged this week</h3>
            <p className="body-md">
              You captured 12 docs this week across TypeScript patterns, v8
              design direction, and cross-AI memory. The strongest connection
              is Thursday&apos;s design notes to Monday&apos;s v8 plan.
            </p>
            <div className="tags">
              <span className="tag tag-ai">digest</span>
              <span className="tag tag-ai">synthesis</span>
            </div>
          </div>

          <div className="dual-card user-card">
            <div className="dual-meta">
              <div className="avatar">R</div>
              <span className="dual-author">raymind</span>
              <span className="dual-footnote">edited · originally AI</span>
            </div>
            <h3 className="title-md">My current focus</h3>
            <p className="body-md">
              Shipping Memory.Wiki v8 over 20 weeks. Capture → Organize → Use.
              Cross-AI delivery is the wedge giants cannot build.
            </p>
            <div className="tags">
              <span className="tag">focus</span>
              <span className="tag">v8</span>
            </div>
          </div>
        </div>
      </section>

      {/* Streaming demo in dark code window */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-md">AI works in the open.</h2>
          <p className="section-lede">
            Streaming is visible. Attribution is explicit. Nothing happens silently.
          </p>
        </div>
        <div className="code-window code-window-wide">
          <div className="code-window-bar">
            <div className="code-window-dots">
              <span className="dot d-r" />
              <span className="dot d-y" />
              <span className="dot d-g" />
            </div>
            <div className="code-window-title">memory.wiki · digest</div>
            <button className="btn-on-dark" onClick={startStream}>
              Run
            </button>
          </div>
          <div className="code-window-body">
            <div className="code-line code-line-ai">
              <span className="code-sparkle">✦</span> Claude · synthesizing
            </div>
            <div className="code-output streaming-text">
              {streamedText || (
                <span className="streaming-prompt">
                  Press &quot;Run&quot; to generate digest →
                </span>
              )}
              {streamedText && streamedText.length < fullText.length && (
                <span className="cursor" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing tier cards */}
      <section className="section">
        <div className="section-head">
          <h2 className="display-md">Pricing.</h2>
          <p className="section-lede">
            Free during beta. Pro for unlimited AI organize and private docs.
          </p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="title-lg">Free</div>
            <div className="display-sm">$0</div>
            <p className="body-sm muted">
              3 docs per month · public only · 1 bundle
            </p>
            <ul className="pricing-list">
              <li>Capture from any surface</li>
              <li>Manual organize</li>
              <li>Paste-anywhere URL</li>
              <li>Community support</li>
            </ul>
            <button className="btn-secondary full">Start free</button>
          </div>
          <div className="pricing-card pricing-card-featured">
            <div className="title-lg">Pro</div>
            <div className="display-sm">
              $15 <span className="price-period">/ month</span>
            </div>
            <p className="body-sm">
              Unlimited everything · private docs · auto-organize
            </p>
            <ul className="pricing-list">
              <li>Unlimited docs &amp; bundles</li>
              <li>AI auto-organize &amp; weekly digest</li>
              <li>Private docs &amp; bundles</li>
              <li>Native mobile (iOS + Android)</li>
              <li>Custom GPT integration</li>
              <li>Priority email support</li>
            </ul>
            <button className="btn-primary full">Try Pro</button>
          </div>
          <div className="pricing-card">
            <div className="title-lg">Team</div>
            <div className="display-sm">Soon</div>
            <p className="body-sm muted">
              Shared bundles · role-based access · per-seat billing
            </p>
            <ul className="pricing-list">
              <li>Everything in Pro</li>
              <li>Shared team memory</li>
              <li>Admin / Editor / Viewer roles</li>
              <li>SSO + audit log</li>
              <li>Dedicated support</li>
            </ul>
            <button className="btn-secondary full">Join waitlist</button>
          </div>
        </div>
      </section>

      {/* Coral callout */}
      <section className="section">
        <div className="callout-coral">
          <h2 className="display-md callout-headline">
            Try Memory.Wiki with Claude today.
          </h2>
          <p className="callout-sub">
            Paste your memory.wiki URL into any AI conversation. It just works.
          </p>
          <button className="btn-on-coral">Start your Memory.Wiki</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Spike size={20} light />
            <span className="footer-wordmark">Memory.Wiki</span>
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
              <a href="#" className="footer-link">iOS / Android</a>
              <a href="#" className="footer-link">Chrome</a>
              <a href="#" className="footer-link">VS Code</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <a href="#" className="footer-link">About</a>
              <a href="#" className="footer-link">Manifesto</a>
              <a href="#" className="footer-link">Changelog</a>
              <a href="#" className="footer-link">Contact</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Legal</div>
              <a href="#" className="footer-link">Privacy</a>
              <a href="#" className="footer-link">Terms</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="caption">v8 Variant E · Editorial · Cormorant + Inter · cream/coral/navy</span>
            <span className="caption">© 2026 Raymind</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Spike-mark substitute ───
// 4-spoke radial asterisk. We use the same shape as the Anthropic mark
// because the editorial variant is testing the "feel of that brand" and
// the spike is what carries the editorial weight.
function Spike({
  size = 16,
  light = false,
  className = "",
}: {
  size?: number;
  light?: boolean;
  className?: string;
}) {
  const color = light ? "#faf9f5" : "#141413";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <path
        d="M50 4 L56 44 L96 50 L56 56 L50 96 L44 56 L4 50 L44 44 Z"
        fill={color}
      />
    </svg>
  );
}
