"use client";

// App-router root error boundary. Next.js renders this on any
// uncaught throw from a Server / Client component below. Pure-design
// surface: canvas bg, Cal Sans display title, micro-red eyebrow,
// ink-filled pill action. No raw hex, no system-ui — all tokens so
// dark and light modes stay readable.

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--canvas)", color: "var(--text-primary)" }}
    >
      <div className="max-w-md text-center">
        <div
          className="font-mono mb-3"
          style={{
            color: "var(--micro-red)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Error
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
          Something went wrong
        </h1>
        <p
          className="mt-3 mb-6 leading-relaxed"
          style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}
        >
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
          style={{
            background: "var(--text-primary)",
            color: "var(--background)",
            fontSize: 13,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
