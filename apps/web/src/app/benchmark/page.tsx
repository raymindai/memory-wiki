import type { Metadata } from "next";
import BenchmarkPure from "./BenchmarkPure";

export const metadata: Metadata = {
  title: "Cross-AI benchmark — memory.wiki",
  description:
    "Open evaluation proving a single memory.wiki URL delivers your knowledge to every AI, including content the AIs have never seen during training. Methodology, judge, and round-by-round results — all public.",
  alternates: { canonical: "https://memory.wiki/benchmark" },
  openGraph: {
    title: "Cross-AI benchmark — memory.wiki",
    description: "Open eval. Familiar + unseen hub. Paste, compact, browse, adversarial.",
    url: "https://memory.wiki/benchmark",
    images: [{ url: "/api/og?title=Benchmark", width: 1200, height: 630 }],
  },
};

export default function BenchmarkPage() {
  return <BenchmarkPure />;
}
