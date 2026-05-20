import type { Metadata } from "next";
import InstallButton from "./InstallButton";

export const metadata: Metadata = {
  title: "memory.wiki bookmarklet — capture any AI conversation",
  description:
    "Drag this to your bookmarks bar. One click on chatgpt.com, claude.ai, or gemini.google.com saves the current conversation to your memory.wiki hub.",
};

/**
 * The bookmarklet stub the user drags to their bookmarks bar. Loading the
 * full extractor from /bookmarklet.js means we can ship updates without
 * asking users to re-install. Cache-bust on each visit so the install they
 * grab today never goes stale.
 */
const BOOKMARKLET_HREF = `javascript:void((function(){var s=document.createElement('script');s.src='https://memory.wiki/bookmarklet.js?v='+Date.now();document.body.appendChild(s);})());`;

export default function BookmarkletPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ background: "var(--background)", color: "var(--text-primary)" }}
    >
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
          The memory.wiki bookmarklet
        </h1>
        <p
          className="text-base mb-10"
          style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
        >
          One click on any AI chat page saves the conversation to your hub. No
          extension, no install, no account required.
        </p>

        <section className="mb-12">
          <h2 className="text-sm uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
            Step 1
          </h2>
          <p className="mb-4">
            Make sure your browser&apos;s bookmarks bar is visible. On most browsers,
            press <kbd className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>⌘⇧B</kbd> (Mac) or <kbd className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>Ctrl+Shift+B</kbd> (Windows/Linux).
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-sm uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
            Step 2
          </h2>
          <p className="mb-4">
            Drag this orange button up to your bookmarks bar.
          </p>
          <div
            className="flex items-center justify-center py-10 rounded-xl"
            style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
          >
            <InstallButton href={BOOKMARKLET_HREF} />
          </div>
          <p
            className="text-xs mt-3 text-center"
            style={{ color: "var(--text-faint)" }}
          >
            Your browser may show a confirmation dialog the first time. That&apos;s
            normal — bookmarklets are just bookmarks with a snippet of code.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-sm uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
            Step 3
          </h2>
          <p className="mb-4">Use it on any AI conversation page.</p>
          <ul className="space-y-2" style={{ color: "var(--text-secondary)" }}>
            <li>• <strong>ChatGPT</strong> — works on chatgpt.com (any chat, including ones you haven&apos;t shared yet).</li>
            <li>• <strong>Claude</strong> — works on claude.ai. Cloudflare can&apos;t see this; the bookmarklet runs in your browser.</li>
            <li>• <strong>Gemini</strong> — works on gemini.google.com.</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-sm uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
            What happens when you click it
          </h2>
          <ol className="space-y-2 list-decimal list-inside" style={{ color: "var(--text-secondary)" }}>
            <li>The bookmarklet detects which AI you&apos;re on.</li>
            <li>It walks the visible conversation in the page DOM and converts it to clean markdown.</li>
            <li>It saves the markdown to memory.wiki and opens the new doc URL in a new tab.</li>
            <li>Anonymous by default — sign in later to claim every doc you&apos;ve captured into your hub.</li>
          </ol>
        </section>

        <section
          className="mt-16 pt-8 text-sm"
          style={{
            borderTop: "1px solid var(--border)",
            color: "var(--text-faint)",
            lineHeight: 1.6,
          }}
        >
          <p className="mb-2">
            <strong>Privacy.</strong> The bookmarklet only sends the captured conversation, the page URL, and which AI it came from. Nothing else.
          </p>
          <p>
            <strong>Open source.</strong> The script lives at{" "}
            <a
              href="/bookmarklet.js"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              memory.wiki/bookmarklet.js
            </a>{" "}
            — read it, fork it, run it from somewhere else if you prefer.
          </p>
        </section>
      </div>
    </main>
  );
}
