import type { Metadata } from "next";
import DocsHomePure from "../../docs/DocsHomePure";

export const metadata: Metadata = {
  title: "문서 — memory.wiki",
  description:
    "memory.wiki 개발자 문서. REST API, CLI, JavaScript SDK, MCP 서버로 마크다운 문서를 프로그래밍 방식으로 생성, 관리, 공유하세요.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs",
    languages: { en: "https://memory.wiki/docs" },
  },
  openGraph: {
    title: "문서 — memory.wiki",
    description: "개발자 문서. REST API, CLI, SDK, MCP Server.",
    url: "https://memory.wiki/ko/docs",
    images: [{ url: "/api/og?title=Documentation", width: 1200, height: 630 }],
  },
};

export default function DocsPageKo() {
  return <DocsHomePure locale="ko" />;
}
