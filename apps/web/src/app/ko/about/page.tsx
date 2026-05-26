import type { Metadata } from "next";
import AboutPure from "../../about/AboutPure";

export const metadata: Metadata = {
  title: "소개 — Memory.Wiki",
  description:
    "URL 하나, 모든 AI. 한 번 캡처하면 모든 AI가 당신의 URL을 읽습니다. Cross-AI 검증 완료.",
  alternates: {
    canonical: "https://memory.wiki/ko/about",
    languages: { en: "https://memory.wiki/about" },
  },
  openGraph: {
    title: "소개 — Memory.Wiki",
    description: "URL 하나, 모든 AI. 한 번 캡처하면 모든 AI가 당신의 URL을 읽습니다.",
    url: "https://memory.wiki/ko/about",
    images: [{ url: "/api/og?title=About", width: 1200, height: 630 }],
  },
};

export default function KoAboutPage() {
  return <AboutPure locale="ko" />;
}
