import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "meetings-and-interviews",
  kicker: "Meeting + interview log",
  title: "Transcripts your AI can quote back.",
  sub: "For founders running customer development, PMs synthesizing user research, anyone who lives in 1:1s. Capture once, query forever.",
  accent: "#fbbf24",
  pain: [
    "30 customer interviews in your Notion. The AI summarized each one — but the cross-interview patterns are stuck in your head.",
    "Meeting transcripts pile up. \"What did Sarah say about pricing in Q2?\" → 20 minutes of scrolling.",
    "Action items live in one place, decisions in another, raw transcripts in a third — none of them deploy to Claude when you ask for a synthesis.",
    "Six months later, you can't trace why you pivoted. The conversation that turned the team is buried.",
  ],
  action: [
    {
      step: "Capture the transcript",
      detail: "Paste it from Otter / Fireflies / Granola, or import from a Notion page that holds it. memory.wiki normalizes the speakers and saves a permanent URL.",
    },
    {
      step: "Tag with intent",
      detail: "Mark each doc as note / decision / question. Doc intent is auto-classified after the next concept refresh; you can override with the chip in the editor's MD bar.",
    },
    {
      step: "Bundle by project",
      detail: "Group all customer interviews for one project into a Bundle. Run Discoveries — the AI surfaces tensions (\"Customer A wants more X; Customer B wants less X\") and gaps automatically.",
    },
    {
      step: "Recall across interviews",
      detail: "Open the Hub Assistant and ask \"What did customers say about pricing?\" Hub recall hits every interview that mentions pricing and quotes the speaker + line directly.",
    },
  ],
  result: [
    "\"Why did we pivot?\" → the AI cites the three interviews that pushed the decision.",
    "Action items get an intent=decision tag; sidebar filter shows every decision the team made this quarter.",
    "Synthesis docs compiled from the bundle remember their source — Recompile after you add a new interview, get an updated synthesis.",
    "Send the hub URL to a new hire and they're up to speed on the customer landscape in an afternoon.",
  ],
  example: {
    title: "Example: 14 customer interviews → one pricing memo",
    body: "Bundle Intent: \"Decide our pricing tier for the new persona.\" After Discoveries: 3 tensions surfaced (\"Power users want usage-based; teams want flat-rate; first-time users want free\"). Compile to Memo → 1-page synthesis citing each customer by quote.",
  },
  related: [
    { slug: "project-decisions", label: "Project decisions" },
    { slug: "docs-as-kb", label: "Docs as a KB" },
    { slug: "cross-tool-handoff", label: "Cross-tool handoff" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} />; }
