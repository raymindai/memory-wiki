import type { Metadata } from "next";
import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";

export const metadata: Metadata = {
  title: "memory.wiki — Your AI memory, owned by you",
  description:
    "Two doors into memory.wiki: a personal AI memory every LLM user can own, and an LLM-maintained personal wiki for power users. Same hub, two ways in.",
  robots: { index: false, follow: false },
};

const memoryDoorPoints = [
  "Capture anything from ChatGPT, Claude, Gemini, or Cursor in one click.",
  "Get a permanent URL. Paste it back into any AI and it loads as context.",
  "Sign in later to claim everything you captured anonymously.",
];

const wikiDoorPoints = [
  "An LLM keeps your hub coherent — synthesizes new captures into existing notes.",
  "Bundles, semantic graph, and a hub-wide lint pass surface tensions and gaps.",
  "Your hub URL is a markdown index. Any AI you trust can read it as your context.",
];

const sharedActions = [
  { label: "/memory.wiki capture", body: "Save the conversation segment as a public memory.wiki URL." },
  { label: "/memory.wiki bundle", body: "Group related docs into a curated bundle." },
  { label: "/memory.wiki hub", body: "Print your hub URL. Paste anywhere, any AI reads it." },
];

export default function V6LandingDraft() {
  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--text-primary)" }}
    >
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border-dim)" }}
      >
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <MemoryWikiLogo size={20} />
        </Link>
        <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>
          v6-landing draft — noindex
        </span>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <p
          className="text-sm uppercase tracking-wider mb-4"
          style={{ color: "var(--accent)" }}
        >
          Personal knowledge hub for the AI era
        </p>
        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
          style={{ color: "var(--text-primary)" }}
        >
          Two doors. One hub.
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
        >
          Pick the door that fits today. The hub underneath is the same — captures, bundles, and a public URL that any AI can read as your context.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12 grid sm:grid-cols-2 gap-5">
        <article
          className="p-7 rounded-xl flex flex-col"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-xs uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            Door 1 — For every LLM user
          </p>
          <h2
            className="text-2xl font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Your AI memory, owned by you.
          </h2>
          <p
            className="mb-5"
            style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
          >
            ChatGPT, Claude, and Gemini all forget you between sessions. memory.wiki is a one-click capture for the answers worth keeping — yours, on a URL you control.
          </p>
          <ul className="space-y-2 mb-6 flex-1" style={{ color: "var(--text-secondary)" }}>
            {memoryDoorPoints.map(point => (
              <li key={point} className="flex gap-2">
                <span style={{ color: "var(--accent)" }}>•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="inline-block text-sm font-semibold px-4 py-2 rounded-lg text-center"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            Start capturing — no login
          </Link>
        </article>

        <article
          className="p-7 rounded-xl flex flex-col"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-xs uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            Door 2 — For power users
          </p>
          <h2
            className="text-2xl font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            An LLM-maintained personal wiki.
          </h2>
          <p
            className="mb-5"
            style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
          >
            Karpathy hand-curates a personal LLM wiki because nothing does it for him. memory.wiki does it for you — auto-synthesis, semantic bundles, and a hub-wide lint pass that flags what to reconcile.
          </p>
          <ul className="space-y-2 mb-6 flex-1" style={{ color: "var(--text-secondary)" }}>
            {wikiDoorPoints.map(point => (
              <li key={point} className="flex gap-2">
                <span style={{ color: "var(--accent)" }}>•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/install"
            className="inline-block text-sm font-semibold px-4 py-2 rounded-lg text-center"
            style={{
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            Install /memory.wiki in your AI tool
          </Link>
        </article>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <p
          className="text-xs uppercase tracking-wider mb-4"
          style={{ color: "var(--text-faint)" }}
        >
          Same actions, both doors
        </p>
        <ul
          className="grid sm:grid-cols-3 gap-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {sharedActions.map(action => (
            <li
              key={action.label}
              className="p-4 rounded-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
            >
              <code
                className="text-sm font-mono"
                style={{ color: "var(--accent)" }}
              >
                {action.label}
              </code>
              <p className="mt-2 text-sm" style={{ lineHeight: 1.5 }}>
                {action.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <p
          className="text-xs uppercase tracking-wider mb-4"
          style={{ color: "var(--text-faint)" }}
        >
          Why this matters
        </p>
        <p
          style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}
        >
          AI vendors are racing to be your memory layer — and your memory will live inside their walls. memory.wiki is the opposite bet: a public URL is the universal context format, and the hub that owns it should be yours, not a vendor&apos;s.
        </p>
      </section>

      <footer
        className="max-w-4xl mx-auto px-6 py-10 text-sm flex items-center justify-between"
        style={{ borderTop: "1px solid var(--border-dim)", color: "var(--text-faint)" }}
      >
        <span>
          Hosted on <Link href="/" style={{ color: "var(--accent)" }}>memory.wiki</Link>
        </span>
        <span>v6-landing draft — not the live page yet</span>
      </footer>
    </main>
  );
}
