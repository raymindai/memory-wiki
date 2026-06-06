import type { Metadata } from "next";
import SpecPure from "../../spec/SpecPure";

export const metadata: Metadata = {
  title: "memory.wiki — Open Spec",
  description:
    "URL 계약, retrieval API, llms.txt, bundle digest, concept index의 공개 스펙. 어떤 AI 도구든 구현 가능. memory.wiki는 AI 시대 wiki — 링킹은 AI가 하고 사용자는 글을 씁니다.",
  alternates: {
    canonical: "https://memory.wiki/ko/spec",
    languages: { en: "https://memory.wiki/spec" },
  },
  openGraph: {
    title: "memory.wiki — Open Spec",
    description: "AI 시대 wiki를 위한 URL 계약 + retrieval API + llms.txt. 오픈, MIT 라이선스 엔진.",
    url: "https://memory.wiki/ko/spec",
    images: [{ url: "/api/og?title=memory.wiki%20Spec", width: 1200, height: 630 }],
  },
};

export default function SpecPageKo() {
  return <SpecPure locale="ko" />;
}
