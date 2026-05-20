import type { Metadata } from "next";
import Link from "next/link";
import ClaudeMdSnippet from "./ClaudeMdSnippet";

export const metadata: Metadata = {
  title: "Install /memory.wiki in Claude Code | Memory.Wiki",
  description:
    "One-line install for the /memory.wiki slash command in Claude Code. Capture, bundle, and deploy your conversations through your personal Memory.Wiki hub.",
};

const INSTALL_CMD_CLAUDE =
  "curl -fsSL https://staging.memory.wiki/skills/memory.wiki/install.sh | sh";
const INSTALL_CMD_CURSOR =
  "curl -fsSL https://staging.memory.wiki/skills/memory.wiki/install.sh | sh -s -- --target=cursor";
const INSTALL_CMD_CODEX =
  "curl -fsSL https://staging.memory.wiki/skills/memory.wiki/install.sh | sh -s -- --target=codex";
const INSTALL_CMD_AIDER =
  "curl -fsSL https://staging.memory.wiki/skills/memory.wiki/install.sh | sh -s -- --target=aider";

export default function InstallPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ background: "var(--background)", color: "var(--text-primary)" }}
    >
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
          Install Memory.Wiki in your AI coding tool
        </h1>
        <p
          className="text-base mb-10"
          style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
        >
          One line to install. Captures the current conversation, builds bundles from your hub, and hands you a URL any other AI can read. Same actions, two installers below for Claude Code and Cursor.
        </p>

        <section className="mb-10">
          <h2
            className="text-sm uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            Claude Code
          </h2>
          <pre
            className="p-4 rounded-lg overflow-x-auto text-sm"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            <code>{INSTALL_CMD_CLAUDE}</code>
          </pre>
          <p
            className="text-xs mt-2"
            style={{ color: "var(--text-faint)" }}
          >
            Drops SKILL.md into <code>~/.claude/skills/memory.wiki/</code>. Restart Claude Code (or run <code>/reload-skills</code>) to pick it up. Then call <code>/memory.wiki capture &lt;title&gt;</code> in any chat.
          </p>
        </section>

        <section className="mb-10">
          <h2
            className="text-sm uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            Cursor
          </h2>
          <pre
            className="p-4 rounded-lg overflow-x-auto text-sm"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            <code>{INSTALL_CMD_CURSOR}</code>
          </pre>
          <p
            className="text-xs mt-2"
            style={{ color: "var(--text-faint)" }}
          >
            Drops <code>memorywiki.mdc</code> into <code>~/.cursor/rules/</code>. Cursor picks it up on next launch (or after toggling rules in Settings). Then say things like &quot;save this to Memory.Wiki as &lt;title&gt;&quot; in any chat.
          </p>
        </section>

        <section className="mb-10">
          <h2
            className="text-sm uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            Codex CLI
          </h2>
          <pre
            className="p-4 rounded-lg overflow-x-auto text-sm"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            <code>{INSTALL_CMD_CODEX}</code>
          </pre>
          <p
            className="text-xs mt-2"
            style={{ color: "var(--text-faint)" }}
          >
            Appends an <code>Memory.Wiki actions</code> block to <code>~/.codex/AGENTS.md</code>. Idempotent: rerunning replaces just the Memory.Wiki block, leaves the rest of your AGENTS.md alone. Restart Codex CLI to pick it up.
          </p>
        </section>

        <section className="mb-10">
          <h2
            className="text-sm uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            Aider
          </h2>
          <pre
            className="p-4 rounded-lg overflow-x-auto text-sm"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            <code>{INSTALL_CMD_AIDER}</code>
          </pre>
          <p
            className="text-xs mt-2"
            style={{ color: "var(--text-faint)" }}
          >
            Drops <code>conventions.md</code> into <code>~/.aider/</code>. Add <code>read: ~/.aider/conventions.md</code> to your <code>.aider.conf.yml</code> and aider will load it as conventions in every session.
          </p>
        </section>

        <section className="mb-10">
          <h2
            className="text-sm uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            Wire your hub into CLAUDE.md (optional)
          </h2>
          <p
            className="text-base mb-4"
            style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
          >
            Claude Code reads <code>CLAUDE.md</code> at the start of every session — global at <code>~/.claude/CLAUDE.md</code>, or per-project at the repo root. Adding your hub URL there lets every Claude Code conversation load your personal context automatically, without you pasting anything.
          </p>
          <ClaudeMdSnippet />
        </section>

        <section className="mb-10">
          <h2
            className="text-sm uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            What you can do after installing
          </h2>
          <ul className="space-y-3" style={{ color: "var(--text-secondary)" }}>
            <li>
              <strong>/memory.wiki capture &lt;title&gt;</strong>
              <br />
              Save the conversation segment as a public Memory.Wiki URL. Pasted into any AI, it loads as context.
            </li>
            <li>
              <strong>/memory.wiki bundle &lt;topic&gt;</strong>
              <br />
              Generate a curated bundle from your existing hub docs around a topic.
            </li>
            <li>
              <strong>/memory.wiki hub</strong>
              <br />
              Print your hub URL. Paste it into Claude, ChatGPT, Gemini, or Cursor and they read your full personal knowledge as context.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2
            className="text-sm uppercase tracking-wider mb-3"
            style={{ color: "var(--text-faint)" }}
          >
            Why this matters
          </h2>
          <p
            style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}
          >
            Karpathy hand-maintains a personal LLM wiki because no consumer surface does this yet. Graphify proved that <code>/&lt;tool&gt;</code> shipped as a skill scales across Claude Code, Cursor, Codex, and Aider. The /memory.wiki skill is the same shape: one install, then every coding-AI session can capture into your hub and pull from it as context. Same URL works for every AI.
          </p>
          <p className="mt-4 text-sm">
            <Link
              href="/docs"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              Read the deep dive: How Memory.Wiki works &rarr;
            </Link>
          </p>
          <p className="mt-2 text-sm">
            <Link
              href="/docs/integrate"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              How Memory.Wiki memory works (chunked, hybrid, public) &rarr;
            </Link>
          </p>
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
            <strong>Privacy.</strong> The skill only sends the conversation
            segment you ask it to capture, plus your auth token if you&apos;ve
            signed in. Nothing else.
          </p>
          <p>
            <strong>Open source.</strong> Read the script:{" "}
            <a
              href="/skills/memory.wiki/install.sh"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              /skills/memory.wiki/install.sh
            </a>
            . Read the skill:{" "}
            <a
              href="/skills/memory.wiki/SKILL.md"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              /skills/memory.wiki/SKILL.md
            </a>
            .
          </p>
          <p className="mt-4">
            Cursor, Codex, and Aider versions of /memory.wiki follow in W9 and W10.
          </p>
        </section>
      </div>
    </main>
  );
}
