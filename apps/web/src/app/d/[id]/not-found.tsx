import Link from "next/link";
import ViewerHeader from "@/components/ViewerHeader";

// Doc viewer 404. Mirrors the bundle / hub not-found family so the
// three permanent-URL surfaces fail identically: ViewerHeader chrome,
// canvas bg, Cal Sans display heading, ink-filled pill primary,
// quiet text-link secondary.

export default function DocNotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--canvas)", color: "var(--text-primary)" }}>
      <ViewerHeader title="Document not found" />

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div
            className="font-mono mb-3"
            style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            404, document
          </div>
          <h1
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: 0,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Document not found
          </h1>
          <p
            className="mt-3 leading-relaxed"
            style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}
          >
            This document doesn&apos;t exist, was moved, or its owner made it private.
          </p>
          <p
            className="mt-2 mb-6 leading-relaxed"
            style={{ color: "var(--text-faint)", fontSize: 12, lineHeight: 1.55 }}
          >
            memory.wiki documents are permanent. If you saved one earlier and it&apos;s gone, the owner likely deleted or restricted it.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{
                background: "var(--text-primary)",
                color: "var(--background)",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Start something new
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center transition-colors hover:underline"
              style={{ color: "var(--text-muted)", fontSize: 12, textDecoration: "none" }}
            >
              What is memory.wiki?
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
