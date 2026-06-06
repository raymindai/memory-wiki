import type { Metadata } from "next";
import CasesIndexPure from "./CasesIndexPure";

export const metadata: Metadata = {
  title: "Use cases — memory.wiki",
  description:
    "Seven shapes the hub URL takes: agent memory, project decisions, research notes, cross-tool handoff, meetings and interviews, docs as a KB, book and course notes.",
  alternates: { canonical: "https://memory.wiki/cases" },
  openGraph: {
    title: "Use cases — memory.wiki",
    description: "Seven shapes the hub URL takes — pick the one closest to your week.",
    url: "https://memory.wiki/cases",
    images: [{ url: "/api/og?title=Use%20cases", width: 1200, height: 630 }],
  },
};

export default function CasesIndexPage() {
  return <CasesIndexPure />;
}
