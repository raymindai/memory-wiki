import type { Metadata } from "next";
import BenchmarkPure from "../../benchmark/BenchmarkPure";

export const metadata: Metadata = {
  title: "벤치마크 — memory.wiki",
  description:
    "오픈 크로스 AI 평가. Paste 모드 100%, browse 모드 98%, adversarial 거부 100%. Harness, judge 프롬프트, 라운드별 결과 전부 공개.",
  alternates: {
    canonical: "https://memory.wiki/ko/benchmark",
    languages: { en: "https://memory.wiki/benchmark" },
  },
  openGraph: {
    title: "벤치마크 — memory.wiki",
    description: "URL contract가 모든 AI에 대해 성립함을 증명하는 오픈 평가.",
    url: "https://memory.wiki/ko/benchmark",
    images: [{ url: "/api/og?title=Benchmark", width: 1200, height: 630 }],
  },
};

export default function KoBenchmarkPage() {
  return <BenchmarkPure locale="ko" />;
}
