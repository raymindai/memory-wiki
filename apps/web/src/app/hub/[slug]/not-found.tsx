import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";

export default function HubNotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <header className="px-6 py-3 flex items-center" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <Link href="/" className="shrink-0"><MemoryWikiLogo size={18} /></Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-display font-bold mb-4" style={{ color: "var(--accent)" }}>
            Hub not found
          </div>
          <p className="text-body leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            This hub doesn&apos;t exist, or its owner hasn&apos;t made it public yet.
          </p>
          <p className="text-caption leading-relaxed mb-8" style={{ color: "var(--text-faint)" }}>
            Hubs are opt-in. The owner can publish theirs from{" "}
            <Link href="/settings" className="underline" style={{ color: "var(--accent)" }}>Settings</Link>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-body font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            Start your own hub →
          </Link>
        </div>
      </main>
    </div>
  );
}
