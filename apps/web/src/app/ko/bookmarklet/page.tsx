import type { Metadata } from "next";
import BookmarkletPure from "../../bookmarklet/BookmarkletPure";

export const metadata: Metadata = {
  title: "북마클릿 — Memory.Wiki",
  description: "한 번 클릭으로 AI 대화를 허브에 저장. 확장, 설치, 계정 모두 불필요.",
  alternates: {
    canonical: "https://memory.wiki/ko/bookmarklet",
    languages: { en: "https://memory.wiki/bookmarklet" },
  },
};

export default function KoBookmarkletPage() {
  return <BookmarkletPure locale="ko" />;
}
