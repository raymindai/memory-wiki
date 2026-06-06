import type { Metadata } from "next";
import CliDocsPure from "./CliDocsPure";

export const metadata: Metadata = {
  title: "CLI Reference — memory.wiki",
  description:
    "memory.wiki CLI reference. Publish Markdown from the command line. Pipe stdin, capture tmux panes, manage documents with simple terminal commands.",
  alternates: {
    canonical: "https://memory.wiki/docs/cli",
    languages: { ko: "https://memory.wiki/ko/docs/cli" },
  },
  openGraph: {
    title: "CLI Reference — memory.wiki",
    description: "Publish Markdown from the command line. Pipe stdin, capture tmux, manage documents.",
    url: "https://memory.wiki/docs/cli",
    images: [{ url: "/api/og?title=CLI", width: 1200, height: 630 }],
  },
};

export default function CliDocsPage() {
  return <CliDocsPure locale="en" />;
}
