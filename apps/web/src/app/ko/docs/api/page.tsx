import type { Metadata } from "next";
import ApiDocsPure from "@/app/docs/api/ApiDocsPure";

export const metadata: Metadata = {
  title: "REST API 레퍼런스 — Memory.Wiki",
  description:
    "Memory.Wiki REST API 레퍼런스. HTTP를 통해 Markdown 문서를 생성, 조회, 수정, 삭제할 수 있습니다. curl, JavaScript, Python 예시 포함.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs/api",
    languages: { en: "https://memory.wiki/docs/api" },
  },
  openGraph: {
    title: "REST API 레퍼런스 — Memory.Wiki",
    description: "REST API 레퍼런스. 엔드포인트, 매개변수, 예시.",
    url: "https://memory.wiki/ko/docs/api",
    images: [{ url: "/api/og?title=REST%20API", width: 1200, height: 630 }],
  },
};

export default function ApiDocsPageKo() {
  return <ApiDocsPure locale="ko" />;
}
