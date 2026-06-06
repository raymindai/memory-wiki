import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "research-notes",
  kicker: "Research notes",
  title: "Papers + PDFs into one cited URL.",
  sub: "For people who read more than they remember — researchers, founders, doctoral students. memory.wiki turns a pile of PDFs into a hub any AI can quote back to you.",
  accent: "#fb923c",
  pain: [
    "You read 30 papers a quarter. By month two you can't remember which one had the argument you need.",
    "Your AI assistant can summarize one paper at a time but can't synthesize across the whole stack.",
    "Citations go stale the moment you close the tab — title alone doesn't help future-you.",
    "Notion / Obsidian work, but they don't deploy to Claude or Cursor when you switch tools.",
  ],
  action: [
    {
      step: "Drop each PDF in",
      detail: "memory.wiki extracts the text, runs the optional AI \"clean up\" pass, and saves it at a permanent URL. Source pages stay intact — you can re-quote with section anchors.",
    },
    {
      step: "Let the concept index build",
      detail: "Background Haiku extraction notes the concepts each paper raises. Cross-paper concepts (≥2 papers) get the orange dot. The Related-in-your-hub widget surfaces overlaps you didn't notice.",
    },
    {
      step: "Bundle by question",
      detail: "Group the 5-8 papers that bear on one open question into a Bundle. Set the bundle Intent (\"Why does X happen when Y is held constant?\"). The bundle's discoveries panel surfaces tensions across papers.",
    },
    {
      step: "Deploy the hub URL",
      detail: "Paste memory.wiki/hub/<you> into Claude, ChatGPT, or Cursor. It fetches the index + per-concept passages and answers from your actual citations, not training-data hallucinations.",
    },
  ],
  result: [
    "\"What did Smith 2023 say about X?\" → the AI quotes the passage with the citation.",
    "Tensions across papers surface automatically — Compile a Brief and the synthesis names which paper disagrees with which.",
    "When you switch from Cursor to Claude, the context is the URL. Zero re-priming.",
    "Six months later, future-you can read the hub log and remember why you were investigating each thread.",
  ],
  example: {
    title: "Example: hub of 12 papers on RAG retrieval",
    body: "Bundle named \"Why hybrid retrieval beats vector-only.\" Concept index links query-rewriting + reranker + sparse-dense fusion across 7 of the 12. Hub recall returns the exact passages on rerank latency tradeoffs.",
  },
  related: [
    { slug: "book-course-notes", label: "Book + course notes" },
    { slug: "project-decisions", label: "Project decisions" },
    { slug: "docs-as-kb", label: "Docs as a KB" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} />; }
