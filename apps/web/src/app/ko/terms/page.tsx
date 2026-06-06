import type { Metadata } from "next";
import TermsPure from "../../terms/TermsPure";

export const metadata: Metadata = {
  title: "이용약관 — memory.wiki",
  description: "memory.wiki 이용약관. 서비스 이용 조건, 사용자 콘텐츠, 책임 한계.",
  alternates: {
    canonical: "https://memory.wiki/ko/terms",
    languages: { en: "https://memory.wiki/terms" },
  },
};

export default function KoTermsPage() {
  return <TermsPure locale="ko" />;
}
