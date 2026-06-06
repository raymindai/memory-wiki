import type { Metadata } from "next";
import HowPure from "../../how/HowPure";

export const metadata: Metadata = {
  title: "동작 원리 — memory.wiki",
  description:
    "문서가 생기고, 번들이 묶이고, 허브가 자동 발행되고, 수정이 전파되고, 어떤 AI라도 그 URL을 읽습니다. 전체 라이프사이클 워크스루.",
  alternates: {
    canonical: "https://memory.wiki/ko/how",
    languages: { en: "https://memory.wiki/how" },
  },
  openGraph: {
    title: "동작 원리 — memory.wiki",
    description: "캡처, 번들, 허브, 업데이트, AI fetch. 전체 흐름 한 페이지.",
    url: "https://memory.wiki/ko/how",
    images: [{ url: "/api/og?title=How%20it%20works", width: 1200, height: 630 }],
  },
};

export default function KoHowPage() {
  return <HowPure locale="ko" />;
}
