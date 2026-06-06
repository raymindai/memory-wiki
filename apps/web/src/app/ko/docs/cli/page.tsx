import type { Metadata } from "next";
import CliDocsPure from "@/app/docs/cli/CliDocsPure";

export const metadata: Metadata = {
  title: "CLI 레퍼런스 — memory.wiki",
  description:
    "memory.wiki CLI 레퍼런스. 커맨드 라인에서 Markdown을 게시합니다. stdin 파이프, tmux 캡처, 문서 관리를 간단한 터미널 명령어로 수행하세요.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs/cli",
    languages: { en: "https://memory.wiki/docs/cli" },
  },
  openGraph: {
    title: "CLI 레퍼런스 — memory.wiki",
    description: "커맨드 라인에서 Markdown을 게시합니다. stdin 파이프, tmux 캡처, 문서 관리.",
    url: "https://memory.wiki/ko/docs/cli",
    images: [{ url: "/api/og?title=CLI", width: 1200, height: 630 }],
  },
};

export default function CliDocsPageKo() {
  return <CliDocsPure locale="ko" />;
}
