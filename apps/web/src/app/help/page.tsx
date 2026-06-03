"use client";

// /help — top-level help hub. Routes the user to the surface-specific
// help page that matches what they're using. Surface count grows
// (chrome / web / desktop / vscode / cli / mcp / ios / android), so a
// single mega-page would be overwhelming AND inaccurate (e.g. the
// 'hover-image save' affordance only exists in the chrome ext).
//
// Pure design tokens, dark-first.

import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";

type Surface = {
  slug: string;
  title: string;
  blurb: string;
  href: string;          // internal /help/{slug} OR external doc
  status: "live" | "stub";
};

const SURFACES: Surface[] = [
  { slug: "chrome",  title: "Chrome extension", blurb: "Page / selection / per-message / social / image / intent capture.", href: "/help/chrome",  status: "live" },
  { slug: "web",     title: "Web editor",       blurb: "Editing, sharing, AI panel, image library, bundles, hubs.",      href: "/help/web",     status: "stub" },
  { slug: "desktop", title: "Desktop (macOS)",  blurb: "Native app + QuickLook for .md files in Finder.",                href: "/help/desktop", status: "stub" },
  { slug: "vscode",  title: "VS Code extension",blurb: "Sidebar workspace, WYSIWYG editor, in-place sync.",              href: "/help/vscode",  status: "stub" },
  { slug: "cli",     title: "CLI",              blurb: "memory-wiki-cli — pipe / stdin / scripted captures.",            href: "/help/cli",     status: "stub" },
  { slug: "mcp",     title: "MCP server",       blurb: "memory-wiki-mcp — Claude / Cursor / Codex tool integration.",    href: "/help/mcp",     status: "stub" },
  { slug: "ios",     title: "iOS app",          blurb: "Capture, edit, share from iPhone / iPad.",                       href: "/help/ios",     status: "stub" },
  { slug: "android", title: "Android app",      blurb: "Capture, edit, share from Android.",                             href: "/help/android", status: "stub" },
];

export default function HelpHubPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--canvas)", color: "var(--text-primary)" }}
    >
      <header
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ background: "var(--canvas)", borderBottom: "1px solid var(--border-dim)" }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          style={{ textDecoration: "none", color: "var(--text-primary)" }}
        >
          <MemoryWikiLogo size={20} withBlob />
          <span style={{ fontSize: 14, fontWeight: 500 }}>memory.wiki</span>
        </Link>
        <a
          href="mailto:hi@raymind.ai"
          className="font-mono"
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          Stuck? hi@raymind.ai
        </a>
      </header>

      <main className="flex-1 px-6 py-10 max-w-3xl w-full mx-auto">
        <div className="mb-10">
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: 0,
              lineHeight: 1.15,
            }}
          >
            Help
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              lineHeight: 1.55,
              marginTop: 8,
            }}
          >
            memory.wiki runs on many surfaces. Pick the one you&apos;re using — each
            surface has its own gestures, shortcuts, and workflow.
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SURFACES.map((s) => (
            <li key={s.slug}>
              {s.status === "live" ? (
                <Link
                  href={s.href}
                  className="block group transition-colors"
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    border: "1px solid var(--border-dim)",
                    background: "var(--surface)",
                    textDecoration: "none",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-dim)";
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                      fontWeight: 500,
                      letterSpacing: 0,
                      marginBottom: 4,
                    }}
                  >
                    {s.title}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.45 }}>
                    {s.blurb}
                  </div>
                </Link>
              ) : (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    border: "1px dashed var(--border-dim)",
                    background: "transparent",
                    color: "var(--text-faint)",
                    cursor: "default",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                      fontWeight: 500,
                      letterSpacing: 0,
                      marginBottom: 4,
                      color: "var(--text-muted)",
                    }}
                  >
                    {s.title}
                    <span
                      className="font-mono"
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-faint)",
                      }}
                    >
                      coming soon
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.45 }}>{s.blurb}</div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
