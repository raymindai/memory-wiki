import type { Metadata } from "next";
import AboutContent from "@/components/AboutContent";

export const metadata: Metadata = {
  title: "소개 — 당신의 AI 메모리, 어떤 AI에도 deploy",
  description:
    "URL 하나, 모든 AI. ChatGPT·Claude·GitHub·Obsidian·Notion에서 캡처한 모든 문서가 하나의 허브가 되고, Claude·Cursor·ChatGPT·Codex가 같은 방식으로 가져갑니다. 방향은 당신이, 구조는 Memory.Wiki가.",
  alternates: {
    canonical: "https://memory.wiki/ko/about",
    languages: { en: "https://memory.wiki/about" },
  },
  openGraph: {
    title: "소개 — Memory.Wiki",
    description:
      "당신의 AI 메모리, 어떤 AI에도 deploy. URL 하나, 모든 AI.",
    url: "https://memory.wiki/ko/about",
    images: [{ url: "/api/og?title=About", width: 1200, height: 630 }],
  },
};

export default function KoAboutPage() {
  return <AboutContent locale="ko" />;
}
