import type { Metadata } from "next";
import ManifestoContent from "@/components/ManifestoContent";

export const metadata: Metadata = {
  title: "Manifesto — 당신의 AI 메모리, 어떤 AI에도 deploy",
  description:
    "당신이 방향을 잡고, Memory.Wiki가 URL로 구조화하고, 어떤 AI든 읽어갑니다. AI 시대의 메모리 포맷으로서의 마크다운, 배포 가능한 형태로서의 허브, primitive로서의 URL — Memory.Wiki의 7가지 belief.",
  alternates: {
    canonical: "https://memory.wiki/ko/manifesto",
    languages: { en: "https://memory.wiki/manifesto" },
  },
  openGraph: {
    title: "Manifesto — Memory.Wiki",
    description: "당신이 방향을 잡고, Memory.Wiki가 URL로 구조화하고, 어떤 AI든 읽어갑니다. Memory.Wiki의 7가지 belief.",
    url: "https://memory.wiki/ko/manifesto",
    images: [{ url: "/api/og?title=Manifesto", width: 1200, height: 630 }],
  },
};

export default function KoManifestoPage() {
  return <ManifestoContent locale="ko" />;
}
