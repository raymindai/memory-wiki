"use client";

import { useState } from "react";
import {
  Bell, Settings, FileText, Package, Clock, Globe, Lock,
  Search, Plus, RefreshCw, PanelLeftClose,
  Sparkles, LayoutGrid, Frame, List, Share2, MessageSquare,
  Eye, Code2, Copy, Zap, Shield, Check, Folder, ArrowRight, Sparkle,
} from "lucide-react";
import { VariantNav } from "../VariantNav";
import "./frontier.css";

const TOOLS = [
  { key: "claude",      label: "Claude",      color: "",       paste: "Drop this URL into a Claude chat",      desc: "Works in Claude.ai web and the desktop apps. Claude fetches the concept map and follows inline links to specific docs.", action: "Open in Claude" },
  { key: "chatgpt",     label: "ChatGPT",     color: "green",  paste: "Paste into a ChatGPT message",           desc: "Drop the URL into ChatGPT browse-enabled chat. The bot pulls clean markdown and reasons over the bundle structure.",   action: "Open in ChatGPT" },
  { key: "gemini",      label: "Gemini",      color: "blue",   paste: "Paste into Gemini or AI Studio",         desc: "Works in Gemini consumer and Studio. URL is served as compact markdown, no rendering wait.",                          action: "Open in Gemini" },
  { key: "claude-code", label: "Claude Code", color: "",       paste: "Reference from Claude Code CLI",         desc: "Use /read or /fetch with the URL. Claude Code receives the markdown payload directly without browsing.",              action: "Copy CLI command" },
  { key: "cursor",      label: "Cursor",      color: "violet", paste: "Paste into Cursor chat",                 desc: "Cursor reads the URL like a docs page. Inline links work, so any doc the bundle references is reachable.",            action: "Open in Cursor" },
  { key: "generic",     label: "Generic",     color: "yellow", paste: "Any AI that can browse",                 desc: "For Perplexity, Le Chat, Grok, or any model with browse. URL is plain markdown, no auth, no rate limits.",            action: "Copy URL" },
  { key: "mcp",         label: "MCP",         color: "violet", paste: "Connect via MCP server",                 desc: "Run the memory-wiki-mcp server. Agents read your hub as a structured tool with named queries.",                       action: "Install MCP" },
  { key: "skill",       label: "Skill",       color: "yellow", paste: "Add as an Anthropic Skill",              desc: "Configure as a custom Claude Skill. The hub becomes a callable knowledge surface inside any Claude conversation.",     action: "Add to Claude" },
  { key: "cli",         label: "CLI",         color: "green",  paste: "Fetch from the memory-wiki CLI",         desc: "memory-wiki fetch raymind pulls the hub locally. Pipe into any script or paste into terminal-based agents.",          action: "Copy CLI command" },
] as const;

/* Lucide icon wrappers for sidebar row icons (consistent size + colour token) */
const I_ROW = { size: 13, strokeWidth: 1.75 } as const;
const GlobeRowIcon = () => <Globe className="lib-row-icon globe" {...I_ROW} />;
const BundleRowIcon = () => <Package className="lib-row-icon" {...I_ROW} />;
const LockRowIcon = () => <Lock className="lib-row-icon" {...I_ROW} />;

function Sparkline({ pattern, accentAt }: { pattern: number[]; accentAt?: number }) {
  const max = Math.max(...pattern);
  return (
    <div className="spark" aria-hidden>
      {pattern.map((v, i) => (
        <span
          key={i}
          className={`spark-bar${i === accentAt ? " accent" : ""}`}
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            animationDelay: `${i * 40}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function FrontierVariant() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [tool, setTool] = useState<typeof TOOLS[number]["key"]>("claude");
  const [size, setSize] = useState<"compact" | "full">("compact");
  const active = TOOLS.find((t) => t.key === tool) ?? TOOLS[0];

  return (
    <div className="v8-frontier" data-frontier-theme={theme}>
      <VariantNav />
      {/* ambient background layers */}
      <div className="aurora aurora-1" aria-hidden />
      <div className="aurora aurora-2" aria-hidden />
      <div className="grain" aria-hidden />

      {/* ─── TOP NAV ─── */}
      <header className="topnav">
        <div className="topnav-inner">
          <a className="brand" href="/v8-preview/frontier">
            <span className="brand-mark">
              <span className="brand-mark-inner">M</span>
            </span>
            <span className="brand-word">
              Memory<span className="brand-dot">.</span>Wiki
            </span>
            <span className="brand-pill mono">v8</span>
          </a>
          <nav className="topnav-links">
            <a href="#product" className="topnav-link">Product</a>
            <a href="#how" className="topnav-link">How it works</a>
            <a href="#screens" className="topnav-link">Surfaces</a>
            <a href="#pricing" className="topnav-link">Pricing</a>
            <a href="#" className="topnav-link">Manifesto</a>
          </nav>
          <div className="topnav-right">
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <span className="theme-toggle-dot" />
              {theme === "dark" ? "dark" : "light"}
            </button>
            <button className="btn-ghost">Sign in</button>
            <button className="btn-primary">
              Start free
              <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero-inner">
          <div className="kicker">
            <span className="pulse-dot" style={{ width: 8, height: 8, minWidth: 8, minHeight: 8, maxWidth: 8, maxHeight: 8, display: "inline-block", borderRadius: "50%", padding: 0, margin: 0, lineHeight: 0, verticalAlign: "middle" }} />
            <span className="mono">Now in v8 preview / Cross-AI memory layer</span>
          </div>
          <h1 className="display-hero">
            Stop re-explaining
            <br />
            your context to AI.
          </h1>
          <p className="lede">
            Memory.Wiki captures every thought, document, and conversation,
            organizes them with AI, and ships the result as one URL any model
            can read. Cross-AI by design, permanent by default.
          </p>
          <div className="hero-actions">
            <button className="btn-primary btn-lg">
              Start capturing free
              <span className="arrow">→</span>
            </button>
            <button className="btn-ghost btn-lg">
              <span className="mono">⌘</span> Watch 90s demo
            </button>
          </div>

          <div className="hero-trust">
            <span className="trust-label mono">Reads natively from</span>
            <div className="trust-row">
              <span className="trust-chip"><span className="status-dot green" />ChatGPT</span>
              <span className="trust-chip"><span className="status-dot" />Claude</span>
              <span className="trust-chip"><span className="status-dot blue" />Gemini</span>
              <span className="trust-chip"><span className="status-dot violet" />Cursor</span>
              <span className="trust-chip"><span className="status-dot yellow" />Copilot</span>
            </div>
          </div>
        </div>

        {/* floating preview card */}
        <div className="hero-card-float">
          <div className="hero-card glass">
            <div className="hero-card-head">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
              <span className="hero-card-url mono">memory.wiki/nvF3Li2x</span>
              <span className="hero-card-status mono">
                <span className="pulse-dot sm" style={{ width: 6, height: 6, minWidth: 6, minHeight: 6, maxWidth: 6, maxHeight: 6, display: "inline-block", borderRadius: "50%", padding: 0, margin: 0, lineHeight: 0, verticalAlign: "middle" }} /> live
              </span>
            </div>
            <div className="hero-card-body">
              <div className="hero-card-meta mono">
                /raymind / v8 thinking
              </div>
              <h3 className="hero-card-title">
                Cross-AI is the structural wedge.
              </h3>
              <p className="hero-card-p">
                Vendor walled-garden memory cannot beat a portable URL that any
                model paste-reads. The graph ships with the URL.
              </p>
              <div className="hero-card-tags">
                <span className="tag">strategy</span>
                <span className="tag">v8</span>
                <span className="tag tag-ai">ai / cluster</span>
              </div>
            </div>
            <div className="hero-card-foot">
              <span className="mono hero-card-stat"><b>247</b> reads</span>
              <span className="mono hero-card-stat"><b>12</b> AI fetches</span>
              <span className="mono hero-card-stat"><b>3</b> bundles</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI TOOL PICKER (the wow moment) ─── */}
      <section className="picker" id="product">
        <div className="picker-card glass">
          <div className="picker-head">
            <div>
              <div className="picker-eyebrow">
                <span className="picker-num">01</span>
                <span>Share</span>
              </div>
              <h2 className="picker-title">Pick your AI tool.</h2>
              <p className="picker-sub">
                One URL, nine paste points. Drop it where you already work and
                the AI receives clean markdown plus the concept map.
              </p>
            </div>
            <div className="ops-status">
              <span className="status-dot" />
              All systems operational
            </div>
          </div>

          <div className="picker-tools">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                className={`tool-chip${tool === t.key ? " active" : ""}`}
                onClick={() => setTool(t.key)}
              >
                <span className={`status-dot${t.color ? " " + t.color : ""}`} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="picker-paste">
            <div className="paste-head">
              <div className="paste-title">{active.paste}</div>
              <span className="paste-recommended">
                <span className="status-dot" /> recommended
              </span>
            </div>
            <p className="paste-desc">{active.desc}</p>

            <div className="seg">
              <button
                className={`seg-btn${size === "compact" ? " active" : ""}`}
                onClick={() => setSize("compact")}
              >
                Compact
                <span className="seg-size">≈1.2k</span>
                concept map
              </button>
              <button
                className={`seg-btn${size === "full" ? " active" : ""}`}
                onClick={() => setSize("full")}
              >
                Full
                <span className="seg-size">≈83.2k</span>
                everything inlined
              </button>
            </div>

            <div className="url-bar">
              <span className="url-bar-globe">●</span>
              <span className="url-bar-text">
                <span className="scheme">https://</span>memory.wiki/@raymind
              </span>
              <div className="url-bar-actions">
                <button className="btn-secondary sm">Copy URL</button>
                <button className="btn-primary sm">
                  {active.action}
                  <span className="arrow">→</span>
                </button>
              </div>
            </div>

            <div className="paste-trust">
              <span className="paste-trust-item">
                <Zap size={13} strokeWidth={1.75} /> Avg fetch &lt; 200ms
              </span>
              <span className="paste-trust-item cached">
                <Shield size={13} strokeWidth={1.75} /> Public &amp; CDN-cached
              </span>
              <span className="paste-trust-item verified">
                <Check size={13} strokeWidth={1.75} /> Verified by 12 AI tools
              </span>
              <a href="#" className="paste-trust-link">Full guide →</a>
            </div>

            {/* Markdown payload preview — what the AI actually receives */}
            <div className="payload">
              <div className="payload-head">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
                <span className="payload-label">
                  AI sees / {size === "compact" ? "compact.md" : "full.md"}
                </span>
                <span className="payload-toks">
                  {size === "compact" ? "≈1,238 tokens" : "≈83,194 tokens"}
                </span>
              </div>
              <div className="payload-body">
                <div><span className="md-h"># raymind / Memory.Wiki hub</span></div>
                <div><span className="md-meta">memory.wiki/@raymind / 247 docs / 17 bundles / updated 2h ago</span></div>
                <div>&nbsp;</div>
                <div><span className="md-h">## What this hub is</span></div>
                <div>Everything about Raymind AI and its founder Hyunsang Cho.</div>
                <div>Product specs, vision docs, CV, and the wiki that ties it together.</div>
                <div>&nbsp;</div>
                <div><span className="md-h">## Concept map (compact)</span></div>
                <div><span className="md-bullet">-</span>Memory.Wiki vision <span className="md-link">[v8 thinking]</span></div>
                <div><span className="md-bullet">-</span>Cross-AI strategy <span className="md-link">[strategy / wedge]</span></div>
                <div><span className="md-bullet">-</span>Capture surfaces <span className="md-link">[9 surfaces shipping]</span></div>
                <div><span className="md-bullet">-</span>Auto-organize layer <span className="md-link">[clusters / bundles]</span></div>
                <div><span className="md-bullet">-</span>Hub URL spec <span className="md-link">[/@username]</span><span className="cursor" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LOGO BAND ─── */}
      <section className="logo-band">
        <div className="logo-band-inner">
          <span className="logo-band-label mono">Featured / Built in public</span>
          <div className="logo-band-viewport">
            <div className="logo-band-track">
              {[0, 1].map((set) => (
                <div key={set} style={{ display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
                  <span className="logo-band-item">Hacker News</span>
                  <span className="logo-band-sep" />
                  <span className="logo-band-item">Product Hunt</span>
                  <span className="logo-band-sep" />
                  <span className="logo-band-item">Show HN top 5</span>
                  <span className="logo-band-sep" />
                  <span className="logo-band-item">Karpathy LLM Wiki ref</span>
                  <span className="logo-band-sep" />
                  <span className="logo-band-item">Vercel for Startups</span>
                  <span className="logo-band-sep" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── PILLARS ─── */}
      <section className="section" id="how">
        <div className="section-head">
          <div className="eyebrow-row">
            <span className="eyebrow-num mono">01</span>
            <span className="eyebrow">The model</span>
          </div>
          <h2 className="display-md">
            Three steps. One URL.
          </h2>
          <p className="section-lede">
            Capture is reflex. Organization is automatic. Use is a paste.
            Everything else is plumbing.
          </p>
        </div>

        <div className="pillar-grid">
          <article className="pillar glass">
            <div className="pillar-head">
              <span className="pillar-num mono">01</span>
              <span className="pillar-tag mono">capture</span>
            </div>
            <h3 className="pillar-title">
              Capture everything.
            </h3>
            <p className="pillar-body">
              Highlight in any browser, screenshot on iOS, paste from desktop,
              forward an email. Every surface lands in the same vault in
              under one second.
            </p>
            <ul className="pillar-list">
              <li>Chrome / Safari / Firefox</li>
              <li>iOS share sheet / Android intent</li>
              <li>VS Code / Cursor / Raycast</li>
              <li>Email-to-Memory forwarding</li>
            </ul>
          </article>

          <article className="pillar glass">
            <div className="pillar-head">
              <span className="pillar-num mono">02</span>
              <span className="pillar-tag mono">organize</span>
            </div>
            <h3 className="pillar-title">
              Organize automatically.
            </h3>
            <p className="pillar-body">
              AI clusters by topic, suggests bundles, links to past thinking,
              and surfaces what you already concluded. You stay the editor,
              not the librarian.
            </p>
            <ul className="pillar-list">
              <li>Auto-clusters with named themes</li>
              <li>Bundle suggestions you accept or reshape</li>
              <li>Concept index across your hub</li>
              <li>Always-on link-back to past decisions</li>
            </ul>
          </article>

          <article className="pillar glass">
            <div className="pillar-head">
              <span className="pillar-num mono">03</span>
              <span className="pillar-tag mono">use</span>
            </div>
            <h3 className="pillar-title">
              Use anywhere.
            </h3>
            <p className="pillar-body">
              Every URL serves clean markdown to any model. Paste once into
              ChatGPT, Claude, Gemini, or Cursor and your full context shows
              up without uploads or plugins.
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

      {/* ─── BIG NUMBERS ─── */}
      <section className="big-numbers">
        <div className="big-numbers-inner">
          <div className="bnum">
            <div className="bnum-num">3<span className="bnum-unit">s</span></div>
            <div className="bnum-label mono">from highlight to URL</div>
          </div>
          <div className="bnum">
            <div className="bnum-num">9</div>
            <div className="bnum-label mono">capture surfaces shipping</div>
          </div>
          <div className="bnum">
            <div className="bnum-num">5</div>
            <div className="bnum-label mono">AIs read natively</div>
          </div>
          <div className="bnum">
            <div className="bnum-num">∞</div>
            <div className="bnum-label mono">URL lifetime, no expiry ever</div>
          </div>
        </div>
      </section>

      {/* ─── REAL SCREENS ─── */}
      <section className="section" id="screens">
        <div className="section-head">
          <div className="eyebrow-row">
            <span className="eyebrow-num mono">02</span>
            <span className="eyebrow">The surfaces</span>
          </div>
          <h2 className="display-md">
            A real workspace, not a feature.
          </h2>
          <p className="section-lede">
            Below are the actual surfaces you open every day. App shell with AI
            companion, public doc, and your hub at /@username.
          </p>
        </div>

        {/* App shell */}
        <div className="screen glass">
          <div className="screen-chrome">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
            <span className="screen-url mono">memory.wiki/@raymind</span>
            <span className="screen-tag mono">app shell</span>
          </div>

          {/* App top bar — brand, path chip, nav, tabs, actions */}
          <div className="app-topbar">
            <div className="app-topbar-brand">
              <span className="brand-mark sm">
                <span className="brand-mark-inner">M</span>
              </span>
              <span className="brand-word sm">
                Memory<span className="brand-dot">.</span>Wiki
              </span>
            </div>
            <span className="app-path-chip mono">
              <Folder size={12} strokeWidth={1.75} />
              /hub/ raymindai
            </span>
            <div className="app-tabs">
              <button className="app-tab"><Sparkles size={13} strokeWidth={1.75} />Start</button>
              <button className="app-tab active"><LayoutGrid size={13} strokeWidth={1.75} />Hub</button>
              <button className="app-tab"><Package size={13} strokeWidth={1.75} />Bundle</button>
              <button className="app-tab"><Frame size={13} strokeWidth={1.75} />Canvas</button>
              <button className="app-tab"><List size={13} strokeWidth={1.75} />List</button>
            </div>
            <div className="app-topbar-right">
              <button className="app-bell" aria-label="Notifications">
                <Bell size={14} strokeWidth={1.75} />
                <span className="app-bell-badge">4</span>
              </button>
              <button className="app-share-btn">
                <Share2 size={13} strokeWidth={1.75} /> Share
              </button>
              <button className="app-chat-btn">
                <MessageSquare size={13} strokeWidth={1.75} /> Chat
              </button>
            </div>
          </div>

          <div className="app-shell">
            <aside className="app-side">
              <div className="lib-head">
                <span className="lib-head-label mono">LIBRARY</span>
                <div className="lib-head-icons">
                  <button aria-label="Collapse"><PanelLeftClose size={12} strokeWidth={1.75} /></button>
                  <button aria-label="Refresh"><RefreshCw size={12} strokeWidth={1.75} /></button>
                  <button aria-label="Add"><Plus size={12} strokeWidth={1.75} /></button>
                </div>
              </div>

              <div className="lib-search">
                <Search size={13} strokeWidth={1.75} />
                <span className="lib-search-text">Search...</span>
                <span className="kbd">⌘K</span>
              </div>

              <div className="lib-cat">
                <div className="lib-cat-head">
                  <span className="lib-cat-arrow" style={{ color: "var(--accent)" }}>▾</span>
                  <span className="lib-cat-name">Recent</span>
                  <span className="lib-cat-count">3</span>
                </div>
                <div className="lib-rows">
                  <button className="lib-row active"><GlobeRowIcon /> Memory.Wiki v8 — UI &amp; Brand Direction</button>
                  <button className="lib-row"><GlobeRowIcon /> Memory.Wiki v8 Plan</button>
                  <button className="lib-row"><GlobeRowIcon /> memory.wiki 사업계획 v7-revised</button>
                </div>
              </div>

              <div className="lib-cat">
                <div className="lib-cat-head">
                  <span className="lib-cat-arrow" style={{ color: "var(--accent)" }}>▾</span>
                  <span className="lib-cat-name">MD Bundles</span>
                  <span className="lib-cat-end mono">18</span>
                </div>
                <div className="lib-rows">
                  <button className="lib-row"><BundleRowIcon /> Memory Wiki v7 <span className="lib-row-count">5</span></button>
                  <button className="lib-row"><BundleRowIcon /> Hyunsang Cho CV <span className="lib-row-count">1</span></button>
                  <button className="lib-row"><BundleRowIcon /> mdfy Foundations <span className="lib-row-count">9</span></button>
                  <button className="lib-row"><BundleRowIcon /> AI Memory <span className="lib-row-count">3</span></button>
                </div>
              </div>

              <div className="lib-cat">
                <div className="lib-cat-head">
                  <span className="lib-cat-arrow" style={{ color: "var(--accent)" }}>▾</span>
                  <span className="lib-cat-name">MDs</span>
                  <span className="lib-cat-end mono">127</span>
                </div>
                <div className="lib-rows">
                  <button className="lib-row"><GlobeRowIcon /> Memory.Wiki v8 Plan</button>
                  <button className="lib-row"><GlobeRowIcon /> v8 Idea</button>
                  <button className="lib-row"><LockRowIcon /> v7 rebrand — Remaining tasks</button>
                </div>
              </div>

              <div className="app-user-card">
                <div className="avatar">H</div>
                <div className="app-user-card-text">
                  <div className="app-user-name">Hyunsang Cho</div>
                  <div className="app-user-meta">hi@raymind.ai</div>
                </div>
                <button className="app-user-gear" aria-label="Settings">
                  <Settings size={13} strokeWidth={1.75} />
                </button>
              </div>
            </aside>

            <main className="app-main">
              <div className="app-crumbs">
                <span className="hub-public">
                  <span className="status-dot green" /> PUBLIC
                </span>
                <span className="mono">memory.wiki/hub/raymind</span>
                <div className="app-crumb-actions">
                  <button className="btn-pill">Open Galaxy view</button>
                  <button className="btn-pill">Preview as visitor</button>
                </div>
              </div>

              {/* Hub identity card */}
              <div className="real-hub-id glass">
                <div className="real-hub-avatar">H</div>
                <h1 className="real-hub-name">Hyunsang Cho</h1>
                <p className="real-hub-bio">
                  Everything about Raymind AI and its founder Hyunsang Cho.
                </p>
                <div className="real-hub-meta mono">
                  <span className="real-hub-meta-item">
                    <FileText size={13} strokeWidth={1.75} /> 127 docs
                  </span>
                  <span className="real-hub-meta-item">
                    <Package size={13} strokeWidth={1.75} /> 18 bundles
                  </span>
                  <span className="real-hub-meta-item">
                    <Clock size={13} strokeWidth={1.75} /> Updated 14h ago
                  </span>
                  <button className="real-hub-galaxy">
                    <Sparkle size={12} strokeWidth={1.75} />
                    Galaxy
                  </button>
                </div>
              </div>

              {/* 01 SHARE — 2-col V2 layout */}
              <section className="v2-sec">
                <div className="v2-sec-left">
                  <div className="v2-eyebrow mono">
                    <span className="v2-eyebrow-num">01</span>
                    <span>SHARE</span>
                  </div>
                  <h2 className="v2-sec-title">Pick your AI tool</h2>
                  <p className="v2-sec-desc">
                    Each one shows exactly what to paste and where. Drop the URL
                    into a chat — the AI fetches the hub like a smart sitemap.
                  </p>
                </div>
                <div className="v2-sec-right">
                  <div className="v2-tools">
                    {TOOLS.map((t) => (
                      <button
                        key={t.key}
                        className={`v2-tool${tool === t.key ? " active" : ""}`}
                        onClick={() => setTool(t.key)}
                      >
                        <span className={`status-dot${t.color ? " " + t.color : ""}`} />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="v2-paste">
                    <div className="v2-paste-head">
                      <span className="v2-paste-title">{active.paste}</span>
                      <span className="v2-paste-rec mono">recommended</span>
                    </div>

                    <div className="v2-size-row">
                      <button
                        className={`v2-size${size === "compact" ? " active" : ""}`}
                        onClick={() => setSize("compact")}
                      >
                        Compact <span className="mono">≈ 1.2k tok</span>
                      </button>
                      <button
                        className={`v2-size${size === "full" ? " active" : ""}`}
                        onClick={() => setSize("full")}
                      >
                        Full <span className="mono">≈ 99.9k tok</span>
                      </button>
                      <span className="v2-size-meta mono">
                        {size === "compact" ? "concept map, cheap to paste" : "everything inlined"}
                      </span>
                    </div>

                    <div className="v2-url">
                      <span className="v2-url-globe"><Globe size={13} strokeWidth={1.75} /></span>
                      <span className="mono v2-url-text">
                        <span className="v2-url-scheme">https://</span>
                        memory.wiki/hub/raymind
                      </span>
                      <button className="v2-url-copy">
                        <Copy size={13} strokeWidth={1.75} /> Copy URL
                      </button>
                      <button className="v2-url-open">
                        Open in {active.label}
                        <ArrowRight size={14} strokeWidth={2} />
                      </button>
                    </div>

                    <div className="v2-trust">
                      <span className="v2-trust-item">
                        <Zap size={12} strokeWidth={1.75} /> Avg fetch &lt; 200ms
                      </span>
                      <span className="v2-trust-item">
                        <Shield size={12} strokeWidth={1.75} /> Public &amp; CDN-cached
                      </span>
                      <span className="v2-trust-item">
                        <Check size={12} strokeWidth={1.75} /> Verified by 12 AI tools
                      </span>
                      <a href="#" className="v2-trust-link">Full guide →</a>
                    </div>

                    <p className="v2-paste-desc">
                      Works the same in Claude.ai (web) and the Mac / Windows desktop
                      app. Claude fetches the compact view — a concept map of your hub —
                      and follows the inline links to specific docs as needed.
                    </p>
                  </div>
                </div>
              </section>

              {/* 02 VERIFY — 2-col V2 layout */}
              <section className="v2-sec">
                <div className="v2-sec-left">
                  <div className="v2-eyebrow mono">
                    <span className="v2-eyebrow-num">02</span>
                    <span>VERIFY</span>
                  </div>
                  <h2 className="v2-sec-title">Preview what AIs see</h2>
                  <p className="v2-sec-desc">
                    Sanity-check the payload before sharing the link.
                  </p>
                </div>
                <div className="v2-sec-right">
                  <div className="v2-preview-grid">
                    <a className="v2-preview-card" href="#">
                      <span className="v2-preview-icon">
                        <Eye size={16} strokeWidth={1.75} />
                      </span>
                      <div className="v2-preview-text">
                        <div className="v2-preview-title">Visitor view</div>
                        <div className="v2-preview-meta">How a browser renders this hub</div>
                      </div>
                      <ArrowRight size={14} strokeWidth={1.75} className="v2-preview-arrow" />
                    </a>
                    <a className="v2-preview-card" href="#">
                      <span className="v2-preview-icon">
                        <Code2 size={16} strokeWidth={1.75} />
                      </span>
                      <div className="v2-preview-text">
                        <div className="v2-preview-title">Raw .md payload</div>
                        <div className="v2-preview-meta">The markdown an AI receives</div>
                      </div>
                      <span className="v2-preview-toks mono">1.2k tok</span>
                    </a>
                  </div>
                </div>
              </section>

            </main>

            <aside className="app-ai">
              <div className="app-ai-head">
                <span className="badge-ai">
                  <span className="pulse-dot sm" style={{ width: 6, height: 6, minWidth: 6, minHeight: 6, maxWidth: 6, maxHeight: 6, display: "inline-block", borderRadius: "50%", padding: 0, margin: 0, lineHeight: 0, verticalAlign: "middle" }} />
                  Memory.Wiki AI
                </span>
                <button className="btn-pill">Close</button>
              </div>
              <div className="ai-msg ai-msg-user">
                What did I decide about cross-AI yesterday?
              </div>
              <div className="ai-msg ai-msg-bot">
                You decided cross-AI is the <em>structural wedge</em> giants
                cannot build. It carries the brand narrative for v8 launch.
                <div className="ai-cite mono">source / memory.wiki/nvF3Li2x</div>
              </div>
              <div className="ai-input">
                <input placeholder="Ask Memory.Wiki" />
                <button className="ai-send" aria-label="Send">→</button>
              </div>
            </aside>
          </div>
        </div>

        {/* Public doc */}
        <div className="screen glass">
          <div className="screen-chrome">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
            <span className="screen-url mono">memory.wiki/nvF3Li2x</span>
            <span className="screen-tag mono">public doc</span>
          </div>
          <article className="pdoc">
            <div className="pdoc-strip">
              <span className="pdoc-strip-item">
                <span className="status-dot green" />
                <span className="mono">PUBLIC DOC</span>
              </span>
              <span className="pdoc-strip-item">
                <span className="mono">CROSS-AI READY</span>
              </span>
              <span className="pdoc-strip-item">
                <Clock size={11} strokeWidth={1.75} />
                <span className="mono">captured 2h ago / chrome-extension</span>
              </span>
              <div className="pdoc-strip-actions">
                <button className="pdoc-action">
                  <Copy size={12} strokeWidth={1.75} /> Copy for Claude
                </button>
                <button className="pdoc-action">
                  <Copy size={12} strokeWidth={1.75} /> Copy for ChatGPT
                </button>
              </div>
            </div>

            <div className="pdoc-byline">
              <div className="avatar lg">R</div>
              <div className="pdoc-byline-text">
                <div className="pdoc-byline-name">raymind</div>
                <div className="pdoc-byline-role mono">Solo founder / Memory.Wiki</div>
              </div>
              <button className="pdoc-follow">
                <Plus size={12} strokeWidth={2} /> Follow
              </button>
            </div>

            <h1 className="pdoc-title">v8 thinking, capture vs memory</h1>

            <div className="pdoc-tags">
              <span className="tag">v8</span>
              <span className="tag">thinking</span>
              <span className="tag tag-ai">ai / framework</span>
            </div>

            <div className="pdoc-body">
              <p className="pdoc-lede">
                Memory.Wiki이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함.
                그래서 capture everything이 자연스러운 입구.
              </p>
              <blockquote className="pdoc-quote">
                AI organize 하는 layer 가 그 다음, 어떤 AI 한테든 paste 가능한
                URL 이 마지막 단계.
              </blockquote>
              <p>
                Cross-AI 가 본질적 wedge. Vendor 의 walled-garden memory 와
                대치되는 portable URL 이 핵심 가치.
              </p>
            </div>

            <div className="pdoc-readby">
              <span className="pdoc-readby-label mono">READ NATIVELY BY</span>
              <span className="pdoc-readby-chip">
                <span className="status-dot" /> Claude
              </span>
              <span className="pdoc-readby-chip">
                <span className="status-dot green" /> ChatGPT
              </span>
              <span className="pdoc-readby-chip">
                <span className="status-dot blue" /> Gemini
              </span>
              <span className="pdoc-readby-chip">
                <span className="status-dot violet" /> Cursor
              </span>
              <span className="pdoc-readby-chip">
                <span className="status-dot yellow" /> Copilot
              </span>
            </div>

            <footer className="pdoc-foot">
              <div className="pdoc-foot-stats">
                <span className="pdoc-foot-stat mono">
                  <b>247</b> reads
                </span>
                <span className="pdoc-foot-stat mono">
                  <b>12</b> AI fetches
                </span>
                <span className="pdoc-foot-stat mono">
                  <b>3</b> bundles
                </span>
              </div>
              <button className="btn-primary pdoc-cta">
                Publish your own
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            </footer>
          </article>
        </div>

        {/* Hub profile */}
        <div className="screen glass">
          <div className="screen-chrome">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
            <span className="screen-url mono">memory.wiki/@raymind</span>
            <span className="screen-tag mono">hub / @raymind</span>
          </div>
          <div className="vhub">
            <div className="vhub-strip">
              <span className="vhub-strip-item">
                <span className="status-dot green" />
                <span className="mono">PUBLIC HUB</span>
              </span>
              <span className="vhub-strip-item">
                <span className="mono">memory.wiki/@raymind</span>
              </span>
              <button className="vhub-strip-action">
                <Copy size={11} strokeWidth={1.75} /> Copy hub URL
              </button>
            </div>

            <div className="vhub-card">
              <div className="vhub-card-head">
                <div className="avatar xl">R</div>
                <div className="vhub-card-text">
                  <h1 className="vhub-name">raymind</h1>
                  <p className="vhub-bio">
                    Solo founder of Memory.Wiki. Building a cross-AI context
                    layer. Ships fast, prefers TypeScript, lives in markdown.
                  </p>
                </div>
                <div className="vhub-card-actions">
                  <button className="btn-primary">
                    Paste my Memory.Wiki
                    <ArrowRight size={14} strokeWidth={2} />
                  </button>
                  <button className="btn-secondary">
                    <Plus size={12} strokeWidth={2} /> Follow
                  </button>
                </div>
              </div>
              <div className="vhub-card-stats">
                <div className="vhub-stat">
                  <span className="vhub-stat-num">247</span>
                  <span className="vhub-stat-label mono">documents</span>
                </div>
                <div className="vhub-stat">
                  <span className="vhub-stat-num">18</span>
                  <span className="vhub-stat-label mono">AI clusters</span>
                </div>
                <div className="vhub-stat">
                  <span className="vhub-stat-num">9</span>
                  <span className="vhub-stat-label mono">surfaces</span>
                </div>
                <div className="vhub-stat">
                  <span className="vhub-stat-num">5</span>
                  <span className="vhub-stat-label mono">AIs reading</span>
                </div>
                <div className="vhub-stat-meta mono">
                  <span>since 2026</span>
                  <span className="vhub-stat-sep">/</span>
                  <span>updated 14h ago</span>
                </div>
              </div>
            </div>

            <div className="vhub-section">
              <div className="vhub-section-head">
                <div>
                  <div className="vhub-section-eyebrow mono">FEATURED</div>
                  <h3 className="vhub-section-title">What this hub is about</h3>
                </div>
                <a className="vhub-section-link mono" href="#">view all bundles <ArrowRight size={11} strokeWidth={1.75} /></a>
              </div>
              <div className="vhub-feat-grid">
                <a className="vhub-feat-card vhub-feat-strategy" href="#">
                  <div className="vhub-feat-cat mono">STRATEGY</div>
                  <div className="vhub-feat-title">Cross-AI as a structural wedge</div>
                  <div className="vhub-feat-meta mono">
                    <Package size={11} strokeWidth={1.75} /> 12 docs
                  </div>
                </a>
                <a className="vhub-feat-card vhub-feat-product" href="#">
                  <div className="vhub-feat-cat mono">PRODUCT</div>
                  <div className="vhub-feat-title">v8 launch — capture vs memory</div>
                  <div className="vhub-feat-meta mono">
                    <Package size={11} strokeWidth={1.75} /> 9 docs
                  </div>
                </a>
                <a className="vhub-feat-card vhub-feat-writing" href="#">
                  <div className="vhub-feat-cat mono">WRITING</div>
                  <div className="vhub-feat-title">Founder log / build in public</div>
                  <div className="vhub-feat-meta mono">
                    <Package size={11} strokeWidth={1.75} /> 18 docs
                  </div>
                </a>
              </div>
            </div>

            <div className="vhub-section">
              <div className="vhub-section-head">
                <div>
                  <div className="vhub-section-eyebrow mono">RECENT</div>
                  <h3 className="vhub-section-title">Latest documents</h3>
                </div>
                <a className="vhub-section-link mono" href="#">view all <ArrowRight size={11} strokeWidth={1.75} /></a>
              </div>
              <div className="vhub-doc-list">
                <a className="vhub-doc-row" href="#">
                  <span className="vhub-doc-dot"><span className="status-dot" /></span>
                  <span className="vhub-doc-title">v8 thinking, capture vs memory</span>
                  <span className="vhub-doc-meta mono">memory.wiki/nvF3Li2x</span>
                  <span className="vhub-doc-time mono">2h ago</span>
                </a>
                <a className="vhub-doc-row" href="#">
                  <span className="vhub-doc-dot"><span className="status-dot" /></span>
                  <span className="vhub-doc-title">v7-revised business plan</span>
                  <span className="vhub-doc-meta mono">memory.wiki/SKaY7VJP</span>
                  <span className="vhub-doc-time mono">1d ago</span>
                </a>
                <a className="vhub-doc-row" href="#">
                  <span className="vhub-doc-dot"><span className="status-dot blue" /></span>
                  <span className="vhub-doc-title">Cross-AI strategy notes</span>
                  <span className="vhub-doc-meta mono">memory.wiki/k2L9PqXm</span>
                  <span className="vhub-doc-time mono">3d ago</span>
                </a>
                <a className="vhub-doc-row" href="#">
                  <span className="vhub-doc-dot"><span className="status-dot green" /></span>
                  <span className="vhub-doc-title">Founder log, May week 3</span>
                  <span className="vhub-doc-meta mono">memory.wiki/Lp9X3Bv2</span>
                  <span className="vhub-doc-time mono">5d ago</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="section" id="pricing">
        <div className="section-head center">
          <div className="eyebrow-row center">
            <span className="eyebrow-num mono">03</span>
            <span className="eyebrow">Pricing</span>
          </div>
          <h2 className="display-md">
            Free during beta. Pro later.
          </h2>
          <p className="section-lede">
            URLs are permanent on both tiers. We never delete your memory.
          </p>
        </div>
        <div className="pricing-grid">
          <article className="price-card glass">
            <div className="price-head">
              <div className="price-name mono">Free</div>
              <div className="price-amount">$0</div>
              <div className="price-sub mono">forever for capture</div>
            </div>
            <ul className="price-list">
              <li>Unlimited documents</li>
              <li>Permanent URLs</li>
              <li>All 9 capture surfaces</li>
              <li>Manual organize</li>
              <li>Public hub at /@username</li>
            </ul>
            <button className="btn-secondary btn-full">Start free</button>
          </article>
          <article className="price-card price-card-feature">
            <div className="price-tag mono">v8 launch</div>
            <div className="price-head">
              <div className="price-name mono">Pro</div>
              <div className="price-amount">TBD</div>
              <div className="price-sub mono">priced after launch</div>
            </div>
            <ul className="price-list">
              <li>Auto-organize, continuous AI clustering</li>
              <li>Bundle auto-suggestion</li>
              <li>Private capture surfaces</li>
              <li>Team workspaces, v9+</li>
              <li>Priority support</li>
            </ul>
            <button className="btn-primary btn-full">
              Join the waitlist
              <span className="arrow">→</span>
            </button>
          </article>
        </div>
      </section>

      {/* ─── BOTTOM CTA ─── */}
      <section className="cta-band">
        <div className="cta-band-inner glass">
          <div className="cta-band-copy">
            <h2 className="display-md">
              The fastest way from thought to
               URL.
            </h2>
            <p className="cta-band-lede">
              Three seconds. Any AI. Yours forever.
            </p>
          </div>
          <div className="cta-band-actions">
            <button className="btn-primary btn-lg">
              Start capturing free
              <span className="arrow">→</span>
            </button>
            <button className="btn-ghost btn-lg">
              Manifesto
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <a className="brand" href="/">
              <span className="brand-mark">
                <span className="brand-mark-inner">M</span>
              </span>
              <span className="brand-word">
                Memory<span className="brand-dot">.</span>Wiki
              </span>
            </a>
            <p className="footer-tag">
              The fastest way from thought to shared document.
            </p>
            <div className="footer-meta mono">
              <span className="pulse-dot sm" style={{ width: 6, height: 6, minWidth: 6, minHeight: 6, maxWidth: 6, maxHeight: 6, display: "inline-block", borderRadius: "50%", padding: 0, margin: 0, lineHeight: 0, verticalAlign: "middle" }} />
              v8 preview / staging.memory.wiki
            </div>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-head mono">Product</div>
              <a href="#">Capture</a>
              <a href="#">Organize</a>
              <a href="#">Use</a>
              <a href="#">Pricing</a>
              <a href="#">Changelog</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-head mono">Surfaces</div>
              <a href="#">Web</a>
              <a href="#">Chrome / Safari</a>
              <a href="#">iOS / Android</a>
              <a href="#">VS Code</a>
              <a href="#">Desktop / DMG</a>
              <a href="#">MCP server</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-head mono">Company</div>
              <a href="#">Manifesto</a>
              <a href="#">Roadmap</a>
              <a href="#">Build log</a>
              <a href="#">Twitter / X</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </div>
        <div className="footer-rule" />
        <div className="footer-bottom">
          <span className="mono">© 2026 Memory.Wiki</span>
          <span className="ops-status">
            <span className="status-dot" />
            All systems operational
          </span>
          <span className="mono">Built in public / 1 founder + Claude</span>
        </div>
      </footer>
    </div>
  );
}
