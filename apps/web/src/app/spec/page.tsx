import type { Metadata } from "next";
import SpecPure from "./SpecPure";

export const metadata: Metadata = {
  title: "memory.wiki — Open Spec",
  description:
    "The URL contract, retrieval API, llms.txt, bundle digest, and concept index — the open spec that any AI tool can implement against. Memory.Wiki is an AI-era wiki: the AI does the linking, you write.",
  alternates: {
    canonical: "https://memory.wiki/spec",
    languages: { ko: "https://memory.wiki/ko/spec" },
  },
  openGraph: {
    title: "memory.wiki — Open Spec",
    description: "URL contract + retrieval API + llms.txt for the AI-era wiki. Open, MIT-licensed engine.",
    url: "https://memory.wiki/spec",
    images: [{ url: "/api/og?title=Memory.Wiki%20Spec", width: 1200, height: 630 }],
  },
};

export default function SpecPage() {
  return <SpecPure locale="en" />;
}
