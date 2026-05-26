import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "agent-memory",
  kicker: "Agent persistent memory",
  title: "Long-running agents that remember what they did yesterday.",
  sub: "For people building or operating autonomous AI agents. Every run starts fresh by default — Memory.Wiki turns the hub URL into the agent's cross-run memory, readable and writable through the MCP server.",
  accent: "#a78bfa",
  pain: [
    "Your agent (Claude Code, Cursor agent, Aider, a custom one) runs for an hour, makes 12 decisions, finishes the task. Next run, it starts from zero.",
    "You bolt on memory the vendor way — Cursor's rules file, OpenAI's Memories, agent-specific JSON state. Each one lives in a different format, doesn't share across tools, and you can't read it like documentation.",
    "When the agent makes a wrong call, you can't audit the trail. The memory is opaque or fragmented across N stores.",
    "You want the agent to learn from previous runs without bolting on a vector DB + custom retrieval layer.",
  ],
  action: [
    {
      step: "Give the agent an Memory.Wiki hub",
      detail: "Create a hub (memory.wiki/hub/<slug>). The hub URL is the agent's memory address. Bundle URLs inside it scope memory by project or task type.",
    },
    {
      step: "Wire the MCP server",
      detail: "Drop `memory-wiki-mcp` into the agent's MCP config (Claude Code's .mcp.json, Cursor's settings, etc.). The agent now has 26 tools — read, write, search, append, version — pointed at its hub.",
    },
    {
      step: "Pre-run: pull the hub URL as context",
      detail: "First step of every agent run is `Memory.Wiki pull <hub_url>` or `Memory.Wiki search <task topic>`. The hub fetches as plain markdown — no vector setup, no vendor SDK.",
    },
    {
      step: "Post-run: write decisions back",
      detail: "When the agent finishes, it calls `Memory.Wiki capture` (or `mw_create` MCP tool) with a structured summary: decision, rationale, files touched, follow-ups. Next run reads these alongside everything older.",
    },
  ],
  result: [
    "Agent memory is a URL you can audit, share, or hand to another agent — not a vendor blob.",
    "Cross-tool: the same hub URL works for Claude Code agents AND Cursor's agent AND a custom Aider loop. They all see the same memory.",
    "Versioned by default: every write creates a snapshot. When the agent makes a regression, you diff the bundle.",
    "Concept index pulls overlapping themes across runs — \"this is the third time the agent picked Postgres\" surfaces in the related panel.",
  ],
  example: {
    title: "Example: a coding agent across 30 runs on the same repo",
    body: "Hub memory.wiki/hub/acme-agent — bundle per major refactor (auth, billing, search). Each run starts by fetching the bundle URL, ends by appending a decision doc. After 30 runs the hub has 47 decisions, a concept index linking \"rate-limit\" across 9 of them, and a fresh AI session can pick up exactly where the last left off — without anyone re-priming.",
  },
  related: [
    { slug: "cross-tool-handoff", label: "Cross-tool handoff" },
    { slug: "project-decisions", label: "Project decisions" },
    { slug: "docs-as-kb", label: "Docs as a KB" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} />; }
