import CasePage, { caseMetadata, type CaseData } from "@/components/CasePage";

const data: CaseData = {
  slug: "docs-as-kb",
  kicker: "Docs as a KB",
  title: "Your team's docs, AI-readable.",
  sub: "For small engineering / product teams. Turn your scattered docs into a hub URL Claude, Cursor, and ChatGPT can fetch the same way — no custom RAG pipeline.",
  accent: "#c4b5fd",
  pain: [
    "Your team docs live in 4 places: Notion, GitHub READMEs, Confluence, half-finished Google Docs. None of them are AI-readable.",
    "When a new dev asks the AI \"how does our auth work?\", it makes something up. Even with paid Copilot Workspace, it doesn't know your codebase's specifics.",
    "Building a custom RAG over your docs takes a week. Maintaining it forever.",
    "Onboarding doc → \"see this page → and this page → and this old wiki → which is wrong now → ask Sarah.\"",
  ],
  action: [
    {
      step: "Import the docs that matter",
      detail: "GitHub repos of .md files (one URL, Memory.Wiki walks every .md). Notion pages (paste the URL + integration token). Obsidian vaults (drop a .zip). URL pages (any public docs page). Drag-and-drop files from your machine.",
    },
    {
      step: "Make the hub public",
      detail: "Settings → toggle Hub public. Memory.Wiki auto-publishes index.md / SCHEMA.md / log.md / llms.txt at the hub root — every AI agent's protocol of choice.",
    },
    {
      step: "Share the one URL",
      detail: "memory.wiki/hub/<your-team>. Put it in CLAUDE.md, .cursorrules, .codex-agents — wherever your team's AI loads context from. Each AI fetches and ingests the same way.",
    },
    {
      step: "Let the lint surface drift",
      detail: "Needs Review highlights orphan docs (not linked from any other doc) and likely duplicates. Resolve in one click. The KB stays coherent without a docs-czar.",
    },
  ],
  result: [
    "\"How does our auth work?\" — every AI on your team answers from your real docs, with citations to the source URL.",
    "New hires read the hub URL on day one and are productive on day two.",
    "Updates to a doc propagate immediately. The AI fetches fresh markdown every call — no rebuild.",
    "No custom RAG to maintain. Token cost is visible (token-economy badge on the hub header) and tunable (?compact, ?digest).",
  ],
  example: {
    title: "Example: 28-doc engineering KB on memory.wiki/hub/acme",
    body: "Imported from GitHub (12 READMEs) + Notion (9 architecture docs) + URL ingest (7 vendor docs). Public hub, hub recall + reranker on. CLAUDE.md points at the hub URL. New devs paste the same URL into Cursor.",
  },
  related: [
    { slug: "cross-tool-handoff", label: "Cross-tool handoff" },
    { slug: "project-decisions", label: "Project decisions" },
    { slug: "meetings-and-interviews", label: "Meeting + interview log" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePage data={data} />; }
