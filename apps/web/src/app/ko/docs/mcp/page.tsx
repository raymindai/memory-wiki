import type { Metadata } from "next";
import McpDocsPure from "@/app/docs/mcp/McpDocsPure";

export const metadata: Metadata = {
  title: "MCP Server 레퍼런스 — memory.wiki",
  description:
    "memory.wiki MCP (Model Context Protocol) 서버. Claude, Cursor, Windsurf 등 AI 도구에서 25개 도구로 문서를 직접 생성하고 관리할 수 있습니다.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs/mcp",
    languages: { en: "https://memory.wiki/docs/mcp" },
  },
  openGraph: {
    title: "MCP Server 레퍼런스 — memory.wiki",
    description: "AI 도구에서 memory.wiki 문서를 게시하고 관리합니다. 25개 도구 지원.",
    url: "https://memory.wiki/ko/docs/mcp",
    images: [{ url: "/api/og?title=MCP%20Server", width: 1200, height: 630 }],
  },
};

export default function McpDocsPageKo() {
  return <McpDocsPure locale="ko" />;
}
