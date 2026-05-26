import type { Metadata } from "next";
import DocsHomePure from "./DocsHomePure";

export const metadata: Metadata = {
  title: "Documentation — Memory.Wiki",
  description:
    "Complete developer documentation for Memory.Wiki. REST API, CLI, JavaScript SDK, MCP server, and npm packages for Markdown publishing.",
  alternates: {
    canonical: "https://memory.wiki/docs",
    languages: { ko: "https://memory.wiki/ko/docs" },
  },
  openGraph: {
    title: "Documentation — Memory.Wiki",
    description: "Complete developer documentation. REST API, CLI, SDK, MCP server.",
    url: "https://memory.wiki/docs",
    images: [{ url: "/api/og?title=Documentation", width: 1200, height: 630 }],
  },
};

export default function DocsPage() {
  return <DocsHomePure locale="en" />;
}
