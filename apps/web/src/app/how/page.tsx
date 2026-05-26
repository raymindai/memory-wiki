import type { Metadata } from "next";
import HowPure from "./HowPure";

export const metadata: Metadata = {
  title: "How Memory.Wiki works — Memory.Wiki",
  description:
    "How a document is born, how a bundle assembles itself, how a hub auto-publishes, how updates propagate, and how any AI reads the URL. With the open cross-AI benchmark woven in.",
  alternates: { canonical: "https://memory.wiki/how" },
  openGraph: {
    title: "How Memory.Wiki works",
    description: "Document → Bundle → Hub: the full lifecycle, in plain language.",
    url: "https://memory.wiki/how",
    images: [{ url: "/api/og?title=How%20it%20works", width: 1200, height: 630 }],
  },
};

export default function HowPage() {
  return <HowPure />;
}
