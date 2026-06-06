import Link from "next/link";
import ViewerHeader from "@/components/ViewerHeader";

// Bundle viewer 404. Uses ViewerHeader so the chrome matches the
// real bundle viewer the user expected to land on — keeps the
// "this URL just doesn't have content" reading instead of a
// generic site error. Canvas bg + Cal Sans display title; the
// primary action is an ink-filled pill, the secondary is a quiet
// text link below.

export default function BundleNotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--canvas)", color: "var(--text-primary)" }}>
      <ViewerHeader title="Bundle not found" />

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div
            className="font-mono mb-3"
            style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            404, bundle
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
            Bundle not found
          </h1>
          <p
            className="mt-3 leading-relaxed"
            style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}
          >
            This bundle doesn&apos;t exist, was deleted, or its owner restricted access.
          </p>
          <p
            className="mt-2 mb-6 leading-relaxed"
            style={{ color: "var(--text-faint)", fontSize: 12, lineHeight: 1.55 }}
          >
            Bundles are collections of documents, they share one URL but contain many docs. Make your own from any pair of docs in memory.wiki.
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
              Start a bundle
            </Link>
            <Link
              href="/shared"
              className="inline-flex items-center transition-colors hover:underline"
              style={{ color: "var(--text-muted)", fontSize: 12, textDecoration: "none" }}
            >
              Browse shared bundles
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
