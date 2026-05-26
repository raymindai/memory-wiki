"use client";

import dynamic from "next/dynamic";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import WelcomeOverlay from "@/components/WelcomeOverlay";

const MdEditor = dynamic(() => import("@/components/MdEditor"), {
  ssr: false,
  loading: () => (
    // Boot loader — visually identical to MdEditor's inner doc
    // loader (same logo size, same bar dimensions, same caption,
    // same fade-in animation). When MdEditor finishes downloading
    // and the inner loader takes over while the first doc fetches,
    // the transition reads as ONE continuous boot screen. The old
    // version sized this logo at 34 with a tagline below — the
    // jump from "big logo + tagline" to "smaller logo + Loading"
    // is what the founder saw as "logo appears twice".
    //
    // The brand tagline moved to the WelcomeOverlay so it surfaces
    // at the right moment (first-run experience), not as a flash
    // during boot.
    <div
      className="flex flex-col items-center justify-center h-screen"
      style={{ background: "var(--background)", gap: 14 }}
    >
      {/* Symbol-only loader. Removed the wordmark + progress bar —
          the animated blob carries the brand on its own and the bar
          was added latency to a state that's already brief. */}
      <div style={{ animation: "mwBootEnter 520ms ease-out both" }}>
        <MemoryWikiLogo size={64} variant="icon-only" />
      </div>
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}
      >
        Loading
      </span>

      <style>{`
        @keyframes mwBootEnter {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  ),
});

export default function Home() {
  // First-visit redirect — a brand-new visitor (no localStorage flag)
  // gets routed to /about so the marketing surface answers "what is
  // this?" before they see the editor. Once they've opened the editor
  // even once, the flag flips and subsequent visits go straight to
  // the editor. Lives in a small useEffect so the noscript fallback
  // (and SEO crawlers reading the noscript) still see the landing
  // markup. The flag is written by MdEditor on mount so simply
  // landing on /about doesn't count as "used the editor".
  if (typeof window !== "undefined") {
    try {
      const opened = localStorage.getItem("mw-editor-opened") === "1";
      const here = window.location.pathname;
      if (!opened && here === "/") {
        window.location.replace("/about");
        // Don't bother rendering — replace() unloads this page.
        return null;
      }
    } catch { /* private mode etc. — fall through to editor */ }
  }
  return (
    <>
      <noscript>
        <div style={{ padding: "60px 24px", maxWidth: 800, margin: "0 auto", fontFamily: "system-ui, sans-serif", color: "#fafafa", background: "#09090b" }}>
          <h1>Memory.Wiki — Your AI memory, deployable to any AI</h1>
          <p>Create, edit, and share beautiful documents instantly. WYSIWYG Markdown editor with AI conversation capture, cross-platform sync, and a developer-friendly API. No login required — paste or type, get a permanent URL in seconds.</p>
          <h2>Features</h2>
          <ul>
            <li>WYSIWYG Markdown editor powered by a Rust/WASM engine</li>
            <li>AI conversation capture from ChatGPT, Claude, and Gemini</li>
            <li>Code syntax highlighting, KaTeX math, and Mermaid diagrams</li>
            <li>Permanent shareable URLs with OG previews and QR codes</li>
            <li>Cross-platform: VS Code extension, Chrome extension, CLI, MCP server, Mac desktop app</li>
            <li>Dark and light themes with beautiful typography</li>
            <li>Private until you publish; share with specific people by email</li>
            <li>Export to PDF, copy as rich text for Google Docs and email</li>
          </ul>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- noscript context, Link component won't work */}
          <p><a href="/about">About Memory.Wiki</a> | <a href="/plugins">Plugins and Extensions</a> | <a href="/docs">Developer Documentation</a> | <a href="/manifesto">Manifesto</a></p>
        </div>
      </noscript>
      <WelcomeOverlay />
      <MdEditor />
    </>
  );
}
