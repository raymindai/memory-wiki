import Link from "next/link";
import MdfyLogo from "@/components/MdfyLogo";

/**
 * Global 404 — used when no more specific not-found.tsx (e.g.
 * /d/[id]/not-found, /b/[id]/not-found, /hub/[slug]/not-found)
 * matches the route. Same shell as those route-scoped pages so
 * the brand feel stays consistent across every miss.
 */
export default function GlobalNotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <header className="px-6 py-3 flex items-center" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <Link href="/" className="shrink-0"><MdfyLogo size={18} /></Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-display font-bold mb-4" style={{ color: "var(--accent)" }}>
            Page not found
          </div>
          <p className="text-body leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            That URL doesn&apos;t exist on memory.wiki. Maybe it was renamed, or the link is wrong.
          </p>
          <p className="text-caption leading-relaxed mb-8" style={{ color: "var(--text-faint)" }}>
            memory.wiki URLs look like <code>memory.wiki/&lt;id&gt;</code>, <code>memory.wiki/b/&lt;id&gt;</code>, or <code>memory.wiki/hub/&lt;slug&gt;</code>.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-body font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              Go home →
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
