"use client";

// /help — single-page reference for everything the Chrome extension
// + memory.wiki capture surfaces can do. Linked from the popup footer
// + the chrome ext options page.
//
// Pure design tokens, dark-first. Sections by surface so the user
// can scroll to the one that matches what they're trying to capture.

import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";

const SECTIONS: Array<{
  id: string;
  title: string;
  intro: string;
  rows: Array<{ trigger: string; result: string; note?: string }>;
}> = [
  {
    id: "page",
    title: "Capture a whole page",
    intro:
      "Any article / blog post / docs page → one click → a memory.wiki URL holding the cleaned markdown.",
    rows: [
      { trigger: "Click the memory.wiki Clipper icon → Capture", result: "Full page → markdown doc → opens new tab" },
      { trigger: "⌘⇧E (mac) / ⌃⇧E (win)", result: "Same as above, no popup needed" },
      { trigger: "Select text → Capture the selection", result: "Just the selection becomes the doc" },
      { trigger: "⌘⇧X / ⌃⇧X", result: "Capture only the highlighted text" },
    ],
  },
  {
    id: "ai",
    title: "Capture AI conversations",
    intro:
      "Per-message save buttons appear on hover when you're inside an AI chat. Captures the user prompt + assistant response together.",
    rows: [
      { trigger: "Hover any message on chatgpt.com, claude.ai, gemini.google.com", result: "A small memory.wiki pill appears top-right of the message" },
      { trigger: "Click the pill", result: "Q+A pair saved as a doc, URL copied to clipboard for the next AI" },
      { trigger: "Use the extension popup → Capture", result: "Saves the whole conversation, not just one turn" },
    ],
  },
  {
    id: "social",
    title: "Capture social posts",
    intro:
      "Per-post save buttons on X and Threads. Pulls body text, author, timestamp, attached images, and a link back to the original.",
    rows: [
      { trigger: "Hover any post on x.com / twitter.com / threads.net", result: "Save pill appears top-right (next to the platform's … menu)" },
      { trigger: "Click", result: "Post → markdown doc with author + timestamp + images" },
      { trigger: "Toast → Open doc", result: "Jumps straight to the new URL" },
    ],
  },
  {
    id: "images",
    title: "Save individual images",
    intro:
      "Any image on the web → your image library. Doesn't create a new doc — adds the asset to a reusable library you can insert into any future doc.",
    rows: [
      { trigger: "Hover any image larger than ~100px", result: "Save pill appears top-right of the image" },
      { trigger: "Click", result: "Image uploaded to your library (memory.wiki/library)" },
      { trigger: "In any doc → top nav → Image library icon", result: "Browse, insert, copy URL, delete" },
    ],
  },
  {
    id: "intent",
    title: "Capture with AI intent",
    intro:
      "Tell the AI what to do with the capture in plain English — it rewrites the content before saving.",
    rows: [
      { trigger: "Open popup → type in the lower textarea", result: "e.g. 'Summarize in 5 bullets', 'Extract code blocks only', 'Translate to Korean'" },
      { trigger: "Click capture", result: "AI transforms the page → saves the result as the doc" },
      { trigger: "Tap a chip below the textarea", result: "Reuse one of your favorite / common prompts" },
      { trigger: "Recipe / movie / paper / product page", result: "Auto-extracted with a built-in template — no intent needed" },
    ],
  },
  {
    id: "library",
    title: "Where your captures go",
    intro:
      "Every capture lives at memory.wiki/{id} — your private URL by default, shareable when you want it to be.",
    rows: [
      { trigger: "memory.wiki", result: "Editor with all your docs, bundles, hubs, and the image library" },
      { trigger: "memory.wiki/library", result: "Image library standalone — browse, copy MD, delete" },
      { trigger: "The popup → Recent list", result: "Your last 10 captures from this browser; click to open" },
      { trigger: "Sign in everywhere", result: "Same captures show up on web, VS Code, desktop, iOS, Android, MCP, CLI" },
    ],
  },
  {
    id: "shortcuts",
    title: "Shortcuts",
    intro: "All keyboard shortcuts work without opening the popup.",
    rows: [
      { trigger: "⌘⇧E (mac) / ⌃⇧E (win)", result: "Capture the current page" },
      { trigger: "⌘⇧X (mac) / ⌃⇧X (win)", result: "Capture the current selection" },
      { trigger: "Configure", result: "chrome://extensions/shortcuts" },
    ],
  },
];

export default function HelpPage() {
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
          href="https://chromewebstore.google.com/detail/memory-wiki-clipper/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono"
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          Get the extension →
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
            Help & instructions
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              lineHeight: 1.55,
              marginTop: 8,
            }}
          >
            Every way to get content into memory.wiki — from the Chrome extension, from
            the editor, from AI chats. One reference, scroll to the surface you're on.
          </p>
        </div>

        {/* TOC */}
        <nav className="mb-12" aria-label="Sections">
          <ul className="grid grid-cols-2 gap-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block transition-colors"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-dim)",
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--text-primary)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-dim)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="mb-14 scroll-mt-20">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: 0,
                marginBottom: 6,
              }}
            >
              {s.title}
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 13,
                lineHeight: 1.55,
                marginBottom: 16,
              }}
            >
              {s.intro}
            </p>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border-dim)" }}
            >
              {s.rows.map((row, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row gap-1 sm:gap-6 px-4 py-3"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--border-dim)" : "none",
                    background: i % 2 === 0 ? "transparent" : "var(--surface)",
                  }}
                >
                  <div
                    className="font-mono shrink-0"
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-primary)",
                      letterSpacing: 0,
                      minWidth: 240,
                      lineHeight: 1.5,
                    }}
                  >
                    {row.trigger}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.55,
                      flex: 1,
                    }}
                  >
                    {row.result}
                    {row.note && (
                      <div
                        style={{
                          color: "var(--text-faint)",
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        {row.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="mb-14">
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: 0,
              marginBottom: 6,
            }}
          >
            Something not working?
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Email{" "}
            <a
              href="mailto:hi@raymind.ai"
              style={{ color: "var(--text-primary)", textDecoration: "underline" }}
            >
              hi@raymind.ai
            </a>{" "}
            with the page URL and what you expected. Bug reports get triaged within 24h.
          </p>
        </section>
      </main>
    </div>
  );
}
