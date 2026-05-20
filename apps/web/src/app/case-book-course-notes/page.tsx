import CasePage, { caseMetadata, type CaseData } from "@/components/CasePage";

const data: CaseData = {
  slug: "book-course-notes",
  kicker: "Book + course notes",
  title: "Chapter takeaways that compound.",
  sub: "For readers and lifelong learners. Per-chapter notes become a hub the concept index quietly weaves into a personal curriculum.",
  accent: "#4ade80",
  pain: [
    "You finish a book, write 5 takeaways, close the file. Six months later you can't recall whether it was Munger or Buffett who said the thing about inversion.",
    "Online courses scatter notes across Notion / Apple Notes / a half-finished Obsidian vault. None of them deploy to your AI.",
    "Each chapter feels isolated when you write it. The connections to other books / courses don't surface until you're already trying to remember them.",
    "Re-reading is expensive. Without compounding notes, every revisit starts from page 1.",
  ],
  action: [
    {
      step: "One doc per chapter (or per lecture)",
      detail: "Drop in your raw takeaways. memory.wiki doesn't care if it's bullet form or prose. The title is the chapter — that's the H1, that's the address.",
    },
    {
      step: "Let recurring concepts surface themselves",
      detail: "Concept index auto-runs. After 3-5 chapters, the cross-chapter concepts (inversion, second-order thinking, etc.) get the orange dot in the sidebar Concepts list.",
    },
    {
      step: "Bundle by theme — not by book",
      detail: "\"Mental models for risk\" might pull 3 chapters from one book + 2 from another + a course module. The Bundle is the curriculum you wish someone had assembled.",
    },
    {
      step: "Ask the hub what you've learned",
      detail: "\"What have I read about inversion?\" Hub recall returns every chapter that touched the concept with the exact passages. Better than your own memory.",
    },
  ],
  result: [
    "Concept clusters emerge as you read more — the wiki compounds without manual cross-linking.",
    "Compiling a Brief from a theme-bundle gives you the synthesis you'd otherwise have to write yourself.",
    "Year-end \"what did I learn this year?\" answers itself.",
    "When you write something new, paste the hub URL into Claude — it argues with your past self using your own notes.",
  ],
  example: {
    title: "Example: 40 chapters from 6 books → mental-models hub",
    body: "Concept index links \"inversion\" across Charlie Munger / Annie Duke / Shane Parrish. Bundle \"Decisions under uncertainty\" pulls 8 chapters. Compile to Brief → a 600-word synthesis you didn't have to write.",
  },
  related: [
    { slug: "research-notes", label: "Research notes" },
    { slug: "project-decisions", label: "Project decisions" },
    { slug: "cross-tool-handoff", label: "Cross-tool handoff" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePage data={data} />; }
