import type { Metadata } from "next";
import IntegrateDocsPure from "../../../docs/integrate/IntegrateDocsPure";

export const metadata: Metadata = {
  title: "AI 개발 도구와 연결 — Memory.Wiki",
  description:
    "Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Aider 에 한 줄 추가해서 Memory.Wiki hub / bundle 을 모든 세션의 컨텍스트로 자동 로드. AGENTS.md / CLAUDE.md / .cursor/rules 한 곳에 URL 만 박으면 끝.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs/integrate",
    languages: { en: "https://memory.wiki/docs/integrate" },
  },
  openGraph: {
    title: "AI 개발 도구와 Memory.Wiki 연결",
    description: "AGENTS.md / CLAUDE.md / .cursor/rules 에 한 줄 추가하면 모든 AI 도구가 당신의 hub / bundle 을 깨끗한 마크다운으로 읽습니다.",
    url: "https://memory.wiki/ko/docs/integrate",
    images: [{ url: "/api/og?title=AI%20개발%20도구와%20연결", width: 1200, height: 630 }],
  },
};

export default function IntegrateDocsPageKo() {
  return <IntegrateDocsPure locale="ko" />;
}
