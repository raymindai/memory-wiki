"use client";

import dynamic from "next/dynamic";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";

const MdEditor = dynamic(() => import("@/components/MdEditor"), {
  ssr: false,
  loading: () => (
    <div
      className="flex flex-col items-center justify-center h-screen"
      style={{ background: "var(--background)", gap: 14 }}
    >
      <div style={{ animation: "mwBootEnter 520ms ease-out both" }}>
        <MemoryWikiLogo size={64} variant="icon-only" />
      </div>
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}
      >
        Loading
      </span>
      <style>{`
        @keyframes mwBootEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  ),
});

export default function GalaxyPageClient() {
  return <MdEditor />;
}
