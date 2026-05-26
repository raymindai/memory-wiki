import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "cross-tool-handoff",
  kicker: "Cross-tool handoff",
  title: "Cursor ↔ Claude on shared context.",
  sub: "For builders who switch AI tools mid-flow. The hub URL is portable context — paste the same URL into either tool and the AI picks up where you left off.",
  accent: "#f472b6",
  pain: [
    "You started a feature in Cursor with 30 minutes of context-priming. You hit a thinking dead-end, want a second opinion from Claude.",
    "You paste the conversation into Claude. Half the context is gone — Claude doesn't have your codebase, your design decisions, your customer feedback.",
    "You re-prime Claude for 20 minutes. Get unstuck. Want to go back to Cursor. Repeat the priming there.",
    "Most of your AI time is spent re-explaining what you already explained an hour ago.",
  ],
  action: [
    {
      step: "Build the project hub once",
      detail: "Capture the spec, recent decisions, customer feedback, design constraints into Memory.Wiki docs. Group them into a Bundle named after the project. That bundle has a permanent URL.",
    },
    {
      step: "Paste the bundle URL when priming",
      detail: "Cursor: drop the URL into .cursorrules or the project README. Claude: paste it in the system prompt or first message. Both AIs fetch the same markdown.",
    },
    {
      step: "Switch freely",
      detail: "Hit a wall in Cursor, ask Claude — they're both reading the same hub. The context is the URL, not whichever chat thread you happened to be in.",
    },
    {
      step: "Keep the hub current",
      detail: "When a new decision lands, save it to Memory.Wiki (Hub Chat's Save-as-doc, or the editor). Next time you paste the URL, both AIs see the updated state. No re-priming.",
    },
  ],
  result: [
    "Setup cost moves from \"every conversation\" to \"once per project.\"",
    "Switching between AIs is a paste, not a translation.",
    "When a teammate joins, they paste the same URL. They onboard at AI speed.",
    "Your context survives tool churn — Cursor → Claude → ChatGPT → next year's tool — without you having to migrate anything.",
  ],
  example: {
    title: "Example: shipping a feature with Cursor + Claude in tandem",
    body: "Bundle memory.wiki/b/feat-handoff — spec, ADRs, 3 customer quotes, recent test failures. Pasted into both Cursor (.cursorrules) and Claude (system prompt). Switch tools 4× over an afternoon. Zero re-priming.",
  },
  related: [
    { slug: "docs-as-kb", label: "Docs as a KB" },
    { slug: "project-decisions", label: "Project decisions" },
    { slug: "meetings-and-interviews", label: "Meeting + interview log" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} />; }
