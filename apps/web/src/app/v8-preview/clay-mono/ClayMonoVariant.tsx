"use client";

import { useState, useEffect } from "react";
import { VariantNav } from "../VariantNav";
import "./clay-mono.css";

export function ClayMonoVariant() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(["v8", "thinking", "framework"]);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-claymono-theme", theme);
  }, [theme]);

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const triggerToast = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2400);
  };

  return (
    <div className="v8-clay-mono" data-claymono-theme={theme}>
      <VariantNav />

      <header className="topnav">
        <div className="topnav-inner">
          <a href="#" className="brand">
            <span className="brand-square brand-square-blob">
              <img src={theme === "dark" ? "/brand/mwblob_morph.svg" : "/brand/mwblob_morph_dark.svg"} alt="" aria-hidden />
            </span>
            <span className="brand-word">memory.wiki</span>
          </a>
          <nav className="topnav-links">
            <a href="#" className="topnav-link">Product</a>
            <a href="#" className="topnav-link">Pricing</a>
            <a href="#" className="topnav-link">Docs</a>
          </nav>
          <div className="topnav-right">
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label="Toggle theme"
            >
              {theme === "light" ? "Dark" : "Light"}
            </button>
            <a href="#" className="topnav-link">Sign in</a>
            <button className="btn-primary">Try free</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-band">
        <span className="eyebrow">memory.wiki / v8 / 2026.10</span>
        <h1 className="display-xl">
          Stop re-explaining yourself
          <br />
          to every AI.
        </h1>
        <p className="hero-sub">
          Capture from anywhere. AI organizes in the background. Paste one URL
          into Claude, ChatGPT, or Cursor and all of them know you instantly.
        </p>
        <div className="cta-row">
          <button className="btn-primary">Try free</button>
          <button className="btn-secondary">memory.wiki/@raymind</button>
        </div>
        <div className="hero-meta">
          <span className="meta-key">running on</span>
          <span className="meta-pill">9 surfaces</span>
          <span className="meta-key">last sync</span>
          <span className="meta-pill">2m ago</span>
          <span className="meta-key">connected to</span>
          <span className="meta-pill">5 AIs</span>
        </div>
      </section>

      {/* Feature cards */}
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">3 primitives</span>
          <h2 className="display-lg">One URL. Every AI reads it.</h2>
        </div>
        <div className="feature-grid">
          <div className="feature-card feature-pink">
            <span className="feature-tag">/capture</span>
            <h3 className="card-title">From anywhere you work.</h3>
            <p className="card-body">
              Chrome, Cursor, mobile share, MCP, CLI. Any surface drops into
              the same URL.
            </p>
            <div className="card-meta"><span className="mono">6 surfaces / 0 friction</span></div>
          </div>
          <div className="feature-card feature-teal">
            <span className="feature-tag">/organize</span>
            <h3 className="card-title">AI does the work.</h3>
            <p className="card-body">
              Background AI tags, clusters, summarizes. Your original markdown
              stays sacred.
            </p>
            <div className="card-meta"><span className="mono">runs nightly / lockable per doc</span></div>
          </div>
          <div className="feature-card feature-lavender">
            <span className="feature-tag">/use</span>
            <h3 className="card-title">Paste anywhere.</h3>
            <p className="card-body">
              Claude, ChatGPT, Cursor, Codex. Each receives an optimized
              digest.
            </p>
            <div className="card-meta"><span className="mono">4 to 16 KB / negotiated per UA</span></div>
          </div>
          <div className="feature-card feature-peach">
            <span className="feature-tag">/share</span>
            <h3 className="card-title">Yours, your team, or public.</h3>
            <p className="card-body">
              Bundle visibility, live edit, presence. Public profile if you
              want it.
            </p>
            <div className="card-meta"><span className="mono">Yjs / realtime / attribution</span></div>
          </div>
          <div className="feature-card feature-ochre">
            <span className="feature-tag">/mobile</span>
            <h3 className="card-title">iOS and Android native.</h3>
            <p className="card-body">
              Share sheet from any app. Camera capture. Spotlight. Widget.
            </p>
            <div className="card-meta"><span className="mono">Swift / Kotlin / v8 launch</span></div>
          </div>
          <div className="feature-card feature-cream">
            <span className="feature-tag">/cross-ai</span>
            <h3 className="card-title">Built for the post-vendor era.</h3>
            <p className="card-body">
              Vendor memories lock you in. memory.wiki ports across every AI.
            </p>
            <div className="card-meta"><span className="mono">MCP / API / OpenAPI 3.1</span></div>
          </div>
        </div>
      </section>

      {/* Product components */}
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">/components / live</span>
          <h2 className="display-md">Actual product surfaces.</h2>
          <p className="section-lede">
            These are the components you meet inside memory.wiki. Sidebar, doc
            card, AI cluster, capture flow, command palette, code block. Switch
            the theme above to see them in light or dark.
          </p>
        </div>

        <div className="component-grid">
          {/* Sidebar */}
          <div className="component-card">
            <div className="component-label">
              <span className="mono">component / sidebar</span>
            </div>
            <div className="surface-sidebar">
              <div className="sidebar-section">
                <div className="sidebar-section-title">
                  <span className="mono">My docs</span>
                  <span className="sidebar-count">12</span>
                </div>
                <div className="sidebar-row active">
                  <span className="dot dot-user" />
                  <span className="sidebar-row-title">v8 thinking, capture vs memory</span>
                  <span className="mono sidebar-time">2h</span>
                </div>
                <div className="sidebar-row">
                  <span className="dot dot-user" />
                  <span className="sidebar-row-title">v7-revised business plan</span>
                  <span className="mono sidebar-time">1d</span>
                </div>
                <div className="sidebar-row">
                  <span className="dot dot-user" />
                  <span className="sidebar-row-title">memory.wiki/@raymind profile</span>
                  <span className="mono sidebar-time">3d</span>
                </div>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-section-title sidebar-section-ai">
                  <span className="mono">AI bundles</span>
                  <span className="sidebar-count">3</span>
                </div>
                <div className="sidebar-row">
                  <span className="dot dot-ai" />
                  <span className="sidebar-row-title">v8 launch (8 docs)</span>
                </div>
                <div className="sidebar-row">
                  <span className="dot dot-ai" />
                  <span className="sidebar-row-title">design system (6 docs)</span>
                </div>
                <div className="sidebar-row">
                  <span className="dot dot-ai" />
                  <span className="sidebar-row-title">cross-AI strategy (4 docs)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Doc card */}
          <div className="component-card">
            <div className="component-label">
              <span className="mono">component / doc-card</span>
            </div>
            <div className="doc-card">
              <div className="doc-card-head">
                <div className="avatar">R</div>
                <div className="doc-card-meta">
                  <div className="doc-card-author">raymind</div>
                  <div className="mono doc-card-time">2h ago / captured from chrome-ext</div>
                </div>
                <button className="doc-card-icon" aria-label="more">more</button>
              </div>
              <h3 className="doc-card-title">v8 thinking, capture vs memory</h3>
              <p className="doc-card-body">
                memory.wiki 이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함. 그래서 capture
                everything 이 자연스러운 입구.
              </p>
              <div className="doc-card-foot">
                <div className="doc-tags">
                  <span className="tag">v8</span>
                  <span className="tag">thinking</span>
                  <span className="tag tag-ai">auto: framework</span>
                </div>
                <span className="mono doc-card-url">memory.wiki/nvF3Li2x</span>
              </div>
            </div>
          </div>

          {/* AI cluster */}
          <div className="component-card">
            <div className="component-label">
              <span className="mono">component / ai-cluster-header</span>
            </div>
            <div className="cluster-card">
              <div className="cluster-head">
                <span className="badge-ai-pill">Auto organized by AI</span>
                <span className="mono cluster-time">updated 2h ago by Claude</span>
              </div>
              <h3 className="cluster-title">v8 launch</h3>
              <p className="cluster-desc">
                8 docs about memory.wiki v8 (design direction, framework,
                surfaces). Strongest signal: design connects to framework at 0.84
                similarity.
              </p>
              <div className="cluster-stats">
                <div className="stat">
                  <span className="stat-num">8</span>
                  <span className="mono stat-label">docs</span>
                </div>
                <div className="stat">
                  <span className="stat-num">23</span>
                  <span className="mono stat-label">tags</span>
                </div>
                <div className="stat">
                  <span className="stat-num">0.84</span>
                  <span className="mono stat-label">cohesion</span>
                </div>
                <button className="btn-pill cluster-cta">Make this mine</button>
              </div>
            </div>
          </div>

          {/* Tag input */}
          <div className="component-card">
            <div className="component-label">
              <span className="mono">component / tag-input</span>
            </div>
            <div className="tag-editor">
              <span className="mono tag-editor-label">Tags</span>
              <div className="tag-list">
                {tags.map((t) => (
                  <span key={t} className="tag tag-editable">
                    {t}
                    <button
                      className="tag-remove"
                      onClick={() => removeTag(t)}
                      aria-label={`remove ${t}`}
                    >
                      x
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  className="tag-input"
                  placeholder="add tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                />
              </div>
              <div className="tag-suggest">
                <span className="mono">AI suggests</span>
                <button
                  className="tag tag-suggest-chip"
                  onClick={() => setTags([...tags, "ai-memory"])}
                >
                  ai-memory
                </button>
                <button
                  className="tag tag-suggest-chip"
                  onClick={() => setTags([...tags, "cross-ai"])}
                >
                  cross-ai
                </button>
              </div>
            </div>
          </div>

          {/* Capture flow */}
          <div className="component-card">
            <div className="component-label">
              <span className="mono">component / capture-flow</span>
            </div>
            <div className="capture-shell">
              <textarea
                className="capture-textarea"
                placeholder="Paste any text, URL, AI chat, or screenshot. memory.wiki organizes it."
                rows={3}
                readOnly
                defaultValue="memory.wiki is the cross-AI context layer. Capture, organize, use, with attribution and a single URL that every AI can read."
              />
              <div className="capture-row">
                <div className="capture-pills">
                  <button className="btn-pill">Attach</button>
                  <button className="btn-pill">From URL</button>
                  <button className="btn-pill">Smart capture</button>
                </div>
                <button className="btn-primary" onClick={triggerToast}>
                  Save to memory.wiki
                </button>
              </div>
            </div>
          </div>

          {/* Command palette */}
          <div className="component-card">
            <div className="component-label">
              <span className="mono">component / command-palette</span>
            </div>
            <div className="palette">
              <div className="palette-input">
                <span className="mono palette-prompt">/</span>
                <input
                  type="text"
                  className="palette-text"
                  placeholder="Search captures, bundles, tags"
                  defaultValue="v8"
                />
                <span className="mono palette-kbd">cmd K</span>
              </div>
              <div className="palette-results">
                <div className="palette-section">
                  <span className="mono palette-section-title">Docs</span>
                  <div className="palette-row palette-row-active">
                    <span className="dot dot-user" />
                    <span className="palette-row-title">v8 thinking, capture vs memory</span>
                    <span className="mono palette-row-meta">memory.wiki/nvF3Li2x</span>
                  </div>
                  <div className="palette-row">
                    <span className="dot dot-user" />
                    <span className="palette-row-title">v7-revised business plan</span>
                    <span className="mono palette-row-meta">memory.wiki/SKaY7VJP</span>
                  </div>
                </div>
                <div className="palette-section">
                  <span className="mono palette-section-title">AI bundles</span>
                  <div className="palette-row">
                    <span className="dot dot-ai" />
                    <span className="palette-row-title">v8 launch (8 docs)</span>
                    <span className="mono palette-row-meta">/b/abc123</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Code block */}
          <div className="component-card component-card-wide">
            <div className="component-label">
              <span className="mono">component / code-block</span>
            </div>
            <div className="codeblock">
              <div className="codeblock-head">
                <span className="mono codeblock-lang">typescript</span>
                <button className="codeblock-copy mono">copy</button>
              </div>
              <pre className="codeblock-body">
                <code>
                  <span className="mono"><span className="kw">async</span> <span className="kw">function</span> <span className="fn">fetchMemory</span>(<span className="param">url</span>: <span className="type">string</span>) {"{"}
{"  "}<span className="kw">const</span> res = <span className="kw">await</span> <span className="fn">fetch</span>(url, {"{"}
{"    "}headers: {"{"} Accept: <span className="str">&apos;text/markdown&apos;</span> {"}"},
{"  "}{"}"});
{"  "}<span className="kw">return</span> res.<span className="fn">text</span>();
{"}"}</span>
                </code>
              </pre>
            </div>
          </div>

          {/* Pricing toggle */}
          <div className="component-card">
            <div className="component-label">
              <span className="mono">component / pricing-toggle</span>
            </div>
            <div className="toggle-shell">
              <div className="toggle-wrap">
                <button className="toggle-option toggle-active">Monthly</button>
                <button className="toggle-option">
                  Annual <span className="mono toggle-save">save 15%</span>
                </button>
              </div>
              <div className="price-display">
                <span className="pricing-price">$15</span>
                <span className="mono pricing-period">/ month</span>
              </div>
            </div>
          </div>

          {/* Empty state */}
          <div className="component-card">
            <div className="component-label">
              <span className="mono">component / empty-state</span>
            </div>
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" />
                  <path d="M16 11v10M11 16h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h4 className="empty-title">No captures yet</h4>
              <p className="empty-body">
                Capture your first thought from any surface. Chrome, Cursor,
                mobile share, or paste here.
              </p>
              <button className="btn-primary">Start capturing</button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── REAL APP SCREENS ─── */}
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">/screens / live</span>
          <h2 className="display-md">Real product screens.</h2>
          <p className="section-lede">
            Same design system, applied to the surfaces a memory.wiki user
            actually meets. App shell, public doc, hub profile, AI panel.
          </p>
        </div>

        {/* App shell */}
        <div className="screen-card">
          <div className="screen-chrome">
            <span className="screen-dot" style={{ background: "var(--pink)" }} />
            <span className="screen-dot" style={{ background: "var(--peach)" }} />
            <span className="screen-dot" style={{ background: "var(--purple)" }} />
            <span className="mono screen-title">memory.wiki / @raymind</span>
          </div>
          <div className="app-shell">
            <aside className="app-side">
              <div className="app-brand">
                <span className="brand-square brand-square-blob">
                  <img src={theme === "dark" ? "/brand/mwblob_morph.svg" : "/brand/mwblob_morph_dark.svg"} alt="" aria-hidden />
                </span>
                <span className="brand-word">memory.wiki</span>
              </div>
              <button className="app-cta">
                <span className="mono app-cta-key">N</span> New document
              </button>
              <div className="app-search mono">Search</div>
              <div className="app-side-section">
                <div className="app-side-head mono">My docs</div>
                <div className="app-side-row app-side-active">
                  <span className="dot dot-user" />
                  <span>v8 thinking</span>
                </div>
                <div className="app-side-row">
                  <span className="dot dot-user" />
                  <span>v7-revised business plan</span>
                </div>
                <div className="app-side-row">
                  <span className="dot dot-user" />
                  <span>About raymind</span>
                </div>
              </div>
              <div className="app-side-section">
                <div className="app-side-head mono">AI bundles</div>
                <div className="app-side-row">
                  <span className="dot dot-ai" />
                  <span>v8 launch</span>
                </div>
                <div className="app-side-row">
                  <span className="dot dot-ai" />
                  <span>Design system notes</span>
                </div>
              </div>
            </aside>
            <main className="app-main">
              <div className="app-breadcrumb">
                <span className="mono">/raymind</span>
                <span className="app-crumb-sep">/</span>
                <span className="mono">v8 thinking</span>
                <div className="app-breadcrumb-actions">
                  <button className="btn-pill">Share</button>
                  <button className="btn-pill">Copy URL</button>
                </div>
              </div>
              <div className="app-doc">
                <h1 className="app-doc-title">v8 thinking, capture vs memory</h1>
                <div className="app-doc-meta">
                  <span className="mono">memory.wiki/nvF3Li2x</span>
                  <span className="mono app-doc-sep">2h ago</span>
                  <span className="mono app-doc-sep">read by 5 AIs</span>
                </div>
                <p className="app-doc-body">
                  memory.wiki 이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함.
                  그래서 capture everything 이 자연스러운 입구. AI 가 organize 하는
                  layer 가 그 다음, 어떤 AI 한테든 paste 가능한 URL 이 마지막 단계.
                </p>
                <p className="app-doc-body">
                  Cross-AI 가 본질적 wedge. Vendor 의 walled garden memory 와
                  대치되는 portable URL 이 핵심 가치.
                </p>
                <div className="app-tag-row">
                  <span className="tag">v8</span>
                  <span className="tag">thinking</span>
                  <span className="tag">framework</span>
                  <span className="tag tag-ai">ai: cross-ai-strategy</span>
                </div>
              </div>
            </main>
            <aside className="app-ai">
              <div className="app-ai-head">
                <span className="badge-ai-pill">memory.wiki AI</span>
                <button className="btn-pill mono">close</button>
              </div>
              <div className="ai-msg ai-msg-user">
                <p>What did I decide about cross-AI yesterday?</p>
              </div>
              <div className="ai-msg ai-msg-bot">
                <p>
                  You decided cross-AI is the structural wedge giants cannot
                  build. It carries the brand narrative for v8 launch.
                </p>
                <div className="ai-msg-cite mono">
                  source: memory.wiki/nvF3Li2x
                </div>
              </div>
              <div className="ai-input mono">
                Ask memory.wiki
              </div>
            </aside>
          </div>
        </div>

        {/* Public doc page */}
        <div className="screen-card">
          <div className="screen-chrome">
            <span className="screen-dot" style={{ background: "var(--pink)" }} />
            <span className="screen-dot" style={{ background: "var(--peach)" }} />
            <span className="screen-dot" style={{ background: "var(--purple)" }} />
            <span className="mono screen-title">memory.wiki / nvF3Li2x</span>
          </div>
          <article className="public-doc">
            <header className="public-doc-head">
              <div className="public-doc-meta-row">
                <div className="avatar avatar-lg">R</div>
                <div>
                  <div className="public-doc-author">raymind</div>
                  <div className="mono public-doc-time">
                    captured 2h ago from chrome-ext
                  </div>
                </div>
                <div className="public-doc-actions">
                  <button className="btn-pill">Copy for ChatGPT</button>
                  <button className="btn-pill">Copy for Claude</button>
                  <button className="btn-secondary">Open in editor</button>
                </div>
              </div>
              <h1 className="public-doc-title">
                v8 thinking, capture vs memory
              </h1>
              <div className="public-doc-tags">
                <span className="tag">v8</span>
                <span className="tag">thinking</span>
                <span className="tag tag-ai">ai: framework</span>
              </div>
            </header>
            <div className="public-doc-body">
              <p>
                memory.wiki 이 메모리 레이어가 되려면 나에 대해서 잘 알아야 함.
                그래서 capture everything 이 자연스러운 입구.
              </p>
              <p>
                AI 가 organize 하는 layer 가 그 다음, 어떤 AI 한테든 paste 가능한
                URL 이 마지막 단계. Cross-AI 가 본질적 wedge.
              </p>
            </div>
            <footer className="public-doc-foot">
              <div className="mono public-doc-foot-stat">
                <span>247</span>
                <span className="public-doc-foot-label">reads</span>
              </div>
              <div className="mono public-doc-foot-stat">
                <span>12</span>
                <span className="public-doc-foot-label">AI fetches</span>
              </div>
              <div className="mono public-doc-foot-stat">
                <span>3</span>
                <span className="public-doc-foot-label">bundles</span>
              </div>
              <button className="btn-primary public-doc-cta">
                Publish your own
              </button>
            </footer>
          </article>
        </div>

        {/* Hub profile */}
        <div className="screen-card">
          <div className="screen-chrome">
            <span className="screen-dot" style={{ background: "var(--pink)" }} />
            <span className="screen-dot" style={{ background: "var(--peach)" }} />
            <span className="screen-dot" style={{ background: "var(--purple)" }} />
            <span className="mono screen-title">memory.wiki / @raymind</span>
          </div>
          <div className="hub">
            <div className="hub-head">
              <div className="avatar avatar-xl">R</div>
              <div>
                <h1 className="hub-name">raymind</h1>
                <p className="hub-bio">
                  Solo founder of memory.wiki. Building a cross-AI context layer.
                  Korean. Ships fast. Prefers TypeScript and minimal dependencies.
                </p>
                <div className="hub-meta">
                  <span className="mono">memory.wiki/@raymind</span>
                  <span className="mono hub-meta-sep">since 2026</span>
                  <span className="mono hub-meta-sep">247 captures</span>
                </div>
              </div>
              <div className="hub-actions">
                <button className="btn-primary">Paste my memory.wiki</button>
              </div>
            </div>
            <div className="hub-stats">
              <div className="hub-stat">
                <div className="hub-stat-num">247</div>
                <div className="mono hub-stat-label">documents</div>
              </div>
              <div className="hub-stat">
                <div className="hub-stat-num">18</div>
                <div className="mono hub-stat-label">AI clusters</div>
              </div>
              <div className="hub-stat">
                <div className="hub-stat-num">9</div>
                <div className="mono hub-stat-label">surfaces synced</div>
              </div>
              <div className="hub-stat">
                <div className="hub-stat-num">5</div>
                <div className="mono hub-stat-label">AIs reading</div>
              </div>
            </div>
            <div className="hub-section">
              <div className="hub-section-head">
                <h3 className="mono">Recent docs</h3>
                <a href="#" className="mono hub-section-link">view all</a>
              </div>
              <div className="hub-grid">
                <div className="hub-tile">
                  <div className="hub-tile-tag">
                    <span className="dot dot-user" />
                    <span className="mono">2h ago</span>
                  </div>
                  <div className="hub-tile-title">v8 thinking, capture vs memory</div>
                  <div className="mono hub-tile-meta">memory.wiki/nvF3Li2x</div>
                </div>
                <div className="hub-tile">
                  <div className="hub-tile-tag">
                    <span className="dot dot-user" />
                    <span className="mono">1d ago</span>
                  </div>
                  <div className="hub-tile-title">v7-revised business plan</div>
                  <div className="mono hub-tile-meta">memory.wiki/SKaY7VJP</div>
                </div>
                <div className="hub-tile">
                  <div className="hub-tile-tag">
                    <span className="dot dot-ai" />
                    <span className="mono">AI digest</span>
                  </div>
                  <div className="hub-tile-title">Weekly synthesis, 3 themes emerged</div>
                  <div className="mono hub-tile-meta">memory.wiki/digest-w20</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">/pricing</span>
          <h2 className="display-md">Free during beta.</h2>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-tier">Free</div>
            <div className="pricing-price">$0</div>
            <p className="card-body">3 docs per month, public only, 1 bundle</p>
            <button className="btn-secondary btn-full">Start free</button>
            <div className="card-meta"><span className="mono">no credit card</span></div>
          </div>
          <div className="pricing-card pricing-featured">
            <div className="pricing-tier">Pro</div>
            <div className="pricing-price">$15 <span className="period">/ mo</span></div>
            <p className="card-body">Unlimited, private, AI auto-organize, native mobile</p>
            <button className="btn-on-color btn-full">Try Pro</button>
            <div className="card-meta"><span className="mono mono-on-dark">beta / 50% off lifetime</span></div>
          </div>
          <div className="pricing-card">
            <div className="pricing-tier">Team</div>
            <div className="pricing-price">Soon</div>
            <p className="card-body">Shared workspaces, roles, SSO</p>
            <button className="btn-secondary btn-full">Join waitlist</button>
            <div className="card-meta"><span className="mono">v9</span></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="brand">
              <span className="brand-square brand-square-blob">
                <img src={theme === "dark" ? "/brand/mwblob_morph.svg" : "/brand/mwblob_morph_dark.svg"} alt="" aria-hidden />
              </span>
              <span className="brand-word">memory.wiki</span>
            </div>
            <span className="mono caption">v8 / variant I.2 / clay-mono / {theme}</span>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-title">/product</div>
              <a href="#" className="footer-link">Capture</a>
              <a href="#" className="footer-link">Organize</a>
              <a href="#" className="footer-link">Use</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">/surfaces</div>
              <a href="#" className="footer-link">Web</a>
              <a href="#" className="footer-link">iOS</a>
              <a href="#" className="footer-link">Chrome</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">/company</div>
              <a href="#" className="footer-link">About</a>
              <a href="#" className="footer-link">Manifesto</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">/legal</div>
              <a href="#" className="footer-link">Privacy</a>
              <a href="#" className="footer-link">Terms</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast */}
      {toastVisible && (
        <div className="toast">
          <span className="toast-icon">OK</span>
          <div className="toast-body">
            <div className="toast-title">Saved to memory.wiki</div>
            <span className="mono toast-url">memory.wiki/aBc123De</span>
          </div>
          <button className="toast-copy mono">copy</button>
        </div>
      )}
    </div>
  );
}
