import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "project-decisions",
  kicker: "Project decisions",
  title: "Why you chose X, in one place.",
  sub: "ADR-style decision records for solo founders and small teams. Future-you (or any AI) can ask \"why X over Y?\" and get the rationale, not a guess.",
  accent: "#60a5fa",
  pain: [
    "You picked Postgres over DynamoDB six months ago. Today you wonder whether to switch. You can't reconstruct the trade-offs you weighed back then.",
    "Slack threads decay. \"The decision\" lives in a 40-message thread that's already been archived twice.",
    "When you ask Claude to weigh a new option, it has no idea what you already rejected and why.",
    "Onboarding a teammate means re-explaining every past decision from memory.",
  ],
  action: [
    {
      step: "Write the decision as a short doc",
      detail: "Context (what we knew), Options (what we considered), Decision (what we picked), Consequences (what we expect). 200-400 words. memory.wiki auto-tags the intent as \"decision\" after the next concept refresh.",
    },
    {
      step: "Cite the inputs",
      detail: "Link the customer interview, the spike branch, the cost-model spreadsheet, the AI conversation that helped you think. Each link survives because memory.wiki URLs are permanent.",
    },
    {
      step: "Bundle by area",
      detail: "Group all infra decisions, all pricing decisions, all hiring decisions into bundles. The hub log shows when each was made and who edited it.",
    },
    {
      step: "Recall when you revisit",
      detail: "\"Why did we pick Postgres?\" → the Hub Assistant cites your own doc + its inputs. The AI now argues using your actual reasoning, not generic advice.",
    },
  ],
  result: [
    "Every decision has a permanent URL. Paste it into any AI when you need to revisit.",
    "Concept index links decisions to the same source material — patterns in your own thinking become visible.",
    "Teammates onboard themselves by reading the decisions log instead of asking you.",
    "When you reverse a decision, the old doc stays — version history shows what changed and why.",
  ],
  example: {
    title: "Example: ADR-007 — \"Postgres over DynamoDB\"",
    body: "Context: 3 customer interviews flagged complex joins. Options: PG / Dynamo / Mongo with cost-model spreadsheet linked. Decision: PG. Consequences: \"we'll feel pain at 100M rows; revisit then.\" Six months later, hub recall finds this in 1 second.",
  },
  related: [
    { slug: "meetings-and-interviews", label: "Meeting + interview log" },
    { slug: "docs-as-kb", label: "Docs as a KB" },
    { slug: "research-notes", label: "Research notes" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} />; }
