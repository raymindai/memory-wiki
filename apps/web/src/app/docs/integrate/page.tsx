import type { Metadata } from "next";
import IntegrateDocsPure from "./IntegrateDocsPure";

export const metadata: Metadata = {
  title: "Integrate with AI dev tools — memory.wiki",
  description:
    "Plug your memory.wiki hub or bundle into Claude Code, Cursor, Codex, Gemini CLI, Windsurf, and Aider with a single URL. One line in AGENTS.md / CLAUDE.md / .cursor/rules and every AI tool reads your personal knowledge graph.",
  alternates: { canonical: "https://memory.wiki/docs/integrate" },
  openGraph: {
    title: "Integrate memory.wiki with AI dev tools",
    description: "One line in AGENTS.md / CLAUDE.md / .cursor/rules — every AI tool reads your hub or bundle as clean markdown.",
    url: "https://memory.wiki/docs/integrate",
    images: [{ url: "/api/og?title=Integrate%20with%20AI%20dev%20tools", width: 1200, height: 630 }],
  },
};

export default function IntegrateDocsPage() {
  return <IntegrateDocsPure locale="en" />;
}
