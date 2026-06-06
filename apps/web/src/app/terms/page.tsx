import type { Metadata } from "next";
import TermsPure from "./TermsPure";

export const metadata: Metadata = {
  title: "Terms of Service — memory.wiki",
  description: "Terms of Service for memory.wiki, the memory.wiki Chrome Extension, VS Code Extension, and memory.wiki for Mac.",
  alternates: { canonical: "https://memory.wiki/terms" },
  openGraph: {
    title: "Terms of Service — memory.wiki",
    url: "https://memory.wiki/terms",
  },
};

export default function TermsPage() {
  return <TermsPure />;
}
