import type { Metadata } from "next";
import InstallPure from "../../install/InstallPure";

export const metadata: Metadata = {
  title: "설치 — Memory.Wiki",
  description: "Claude Code, Cursor, Codex, Aider에 한 줄로 Memory.Wiki 설치. 캡처, 번들, 허브 명령 즉시 사용.",
  alternates: {
    canonical: "https://memory.wiki/ko/install",
    languages: { en: "https://memory.wiki/install" },
  },
};

export default function KoInstallPage() {
  return <InstallPure locale="ko" />;
}
