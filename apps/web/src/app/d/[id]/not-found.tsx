import Link from "next/link";
import MdfyLogo from "@/components/MdfyLogo";

export default function DocNotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <header className="px-6 py-3 flex items-center" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <Link href="/" className="shrink-0"><MdfyLogo size={18} /></Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-display font-bold mb-4" style={{ color: "var(--accent)" }}>
            Document not found
          </div>
          <p className="text-body leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            This document doesn&apos;t exist, was moved, or its owner made it private.
          </p>
          <p className="text-caption leading-relaxed mb-8" style={{ color: "var(--text-faint)" }}>
            memory.wiki documents are permanent — if you saved one earlier and it&apos;s gone, the owner likely deleted or restricted it.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-body font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              Start something new →
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-body font-semibold transition-colors"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              What is memory.wiki?
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
