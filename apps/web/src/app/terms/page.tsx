import type { Metadata } from "next";
import TermsPure from "./TermsPure";

export const metadata: Metadata = {
  title: "Terms of Service — Memory.Wiki",
  description: "Terms of Service for Memory.Wiki, the Memory.Wiki Chrome Extension, VS Code Extension, and Memory.Wiki for Mac.",
  alternates: { canonical: "https://memory.wiki/terms" },
  openGraph: {
    title: "Terms of Service — Memory.Wiki",
    url: "https://memory.wiki/terms",
  },
};

export default function TermsPage() {
  return <TermsPure />;
}
