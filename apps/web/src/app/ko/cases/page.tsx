import type { Metadata } from "next";
import CasesIndexPure from "../../cases/CasesIndexPure";

export const metadata: Metadata = {
  title: "사용 사례 — Memory.Wiki",
  description: "에이전트 메모리, 도구 간 핸드오프, 의사결정 기록, 팀 KB, 연구 노트, 회의 로그, 강의 노트 — 같은 URL이 띠는 일곱 가지 모양.",
  alternates: {
    canonical: "https://memory.wiki/ko/cases",
    languages: { en: "https://memory.wiki/cases" },
  },
};

export default function KoCasesPage() {
  return <CasesIndexPure locale="ko" />;
}
