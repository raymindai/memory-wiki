import type { Metadata } from "next";
import McpDocsPure from "./McpDocsPure";

export const metadata: Metadata = {
  title: "MCP Server — memory.wiki",
  description:
    "MCP (Model Context Protocol) server for memory.wiki. Let Claude, Cursor, Windsurf, and other AI tools create and manage documents directly with 25 tools.",
  alternates: {
    canonical: "https://memory.wiki/docs/mcp",
    languages: { ko: "https://memory.wiki/ko/docs/mcp" },
  },
  openGraph: {
    title: "MCP Server — memory.wiki",
    description: "Let AI tools publish and manage documents on memory.wiki. 25 tools for Claude, Cursor, and Windsurf.",
    url: "https://memory.wiki/docs/mcp",
    images: [{ url: "/api/og?title=MCP%20Server", width: 1200, height: 630 }],
  },
};

export default function McpDocsPage() {
  return <McpDocsPure locale="en" />;
}
