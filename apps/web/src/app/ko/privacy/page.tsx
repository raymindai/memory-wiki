import type { Metadata } from "next";
import PrivacyPure from "../../privacy/PrivacyPure";

export const metadata: Metadata = {
  title: "개인정보 처리방침 — memory.wiki",
  description: "memory.wiki 개인정보 처리방침. 데이터 수집, 저장, 삭제, 쿠키 정책.",
  alternates: {
    canonical: "https://memory.wiki/ko/privacy",
    languages: { en: "https://memory.wiki/privacy" },
  },
};

export default function KoPrivacyPage() {
  return <PrivacyPure locale="ko" />;
}
