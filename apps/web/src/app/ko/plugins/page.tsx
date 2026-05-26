import type { Metadata } from "next";
import PluginsPure from "../../plugins/PluginsPure";

export const metadata: Metadata = {
  title: "플러그인 및 확장 프로그램 — Memory.Wiki",
  description:
    "CLI, Mac 데스크톱 앱, Chrome 확장 프로그램, VS Code 확장 프로그램, macOS QuickLook으로 Memory.Wiki를 어디서든 사용하세요. AI 채팅 캡처와 터미널 게시 지원.",
  alternates: {
    canonical: "https://memory.wiki/ko/plugins",
    languages: { en: "https://memory.wiki/plugins" },
  },
  openGraph: {
    title: "플러그인 및 확장 프로그램 — Memory.Wiki",
    description:
      "AI 채팅 캡처 Chrome 확장. VS Code, CLI, Mac 앱, macOS QuickLook으로 Markdown 관리.",
    url: "https://memory.wiki/ko/plugins",
    images: [{ url: "/api/og?title=Plugins", width: 1200, height: 630 }],
  },
};

export default function KoPluginsPage() {
  return <PluginsPure locale="ko" />;
}
