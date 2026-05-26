import Link from "next/link";
import ViewerHeader from "@/components/ViewerHeader";

// Hub viewer 404. Third member of the not-found family (doc /
// bundle / hub) — same chrome and rhythm so the three permanent
// URLs all fail in one consistent voice.

export default function HubNotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--canvas)", color: "var(--text-primary)" }}>
      <ViewerHeader title="Hub not found" />

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div
            className="font-mono mb-3"
            style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            404, hub
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
            Hub not found
          </h1>
          <p
            className="mt-3 leading-relaxed"
            style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}
          >
            This hub doesn&apos;t exist, or its owner hasn&apos;t made it public yet.
          </p>
          <p
            className="mt-2 mb-6 leading-relaxed"
            style={{ color: "var(--text-faint)", fontSize: 12, lineHeight: 1.55 }}
          >
            Hubs are opt-in. The owner can publish theirs from{" "}
            <Link href="/settings" className="underline" style={{ color: "var(--text-muted)" }}>
              Settings
            </Link>
            .
          </p>
          <div className="flex justify-center">
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
              Start your own hub
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
