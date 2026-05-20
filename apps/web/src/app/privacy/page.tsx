import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Memory.Wiki",
  description: "Privacy Policy for Memory.Wiki and the Memory.Wiki Chrome Extension.",
  openGraph: {
    title: "Privacy Policy — Memory.Wiki",
    url: "https://memory.wiki/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center px-4 py-16"
      style={{ background: "var(--bg)", color: "var(--text-primary)" }}
    >
      <article className="w-full max-w-2xl space-y-8 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <div>
          <Link href="/" className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            &larr; Memory.Wiki
          </Link>
          <h1 className="text-2xl font-bold mt-4" style={{ color: "var(--text-primary)" }}>
            Privacy Policy
          </h1>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Last updated: April 15, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Overview</h2>
          <p>
            Memory.Wiki is a document publishing service operated by Raymind AI.
            We respect your privacy and are committed to protecting your data.
            This policy covers the Memory.Wiki website, the Memory.Wiki Chrome Extension, and the Memory.Wiki VS Code Extension.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>What We Collect</h2>

          <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>Memory.Wiki Website</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Documents you publish:</strong> Stored on our servers to provide shareable URLs. You can delete your documents at any time.</li>
            <li><strong>Account information:</strong> If you create an account — email address and display name.</li>
            <li><strong>Analytics:</strong> We use Vercel Analytics to collect anonymous usage data (page views, performance). No personal information is tracked.</li>
            <li><strong>Images:</strong> Uploaded images are stored on our servers to serve them in your documents.</li>
          </ul>

          <h3 className="font-medium mt-4" style={{ color: "var(--text-primary)" }}>Chrome Extension</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Page content:</strong> The extension reads content from AI chat pages (ChatGPT, Claude, Gemini) only when you click &ldquo;Capture.&rdquo; Content is sent directly to Memory.Wiki — we do not store it elsewhere.</li>
            <li><strong>No background collection:</strong> The extension does not monitor, track, or collect any browsing data. It only activates when you explicitly use it.</li>
            <li><strong>Authentication:</strong> If you are logged into Memory.Wiki, the extension reads your auth cookie to enable features like image upload and permanent URLs.</li>
          </ul>

          <h3 className="font-medium mt-4" style={{ color: "var(--text-primary)" }}>VS Code Extension</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>File content:</strong> The extension reads Markdown files you explicitly open or publish. Content is sent to Memory.Wiki only when you use the Publish or Sync features.</li>
            <li><strong>No telemetry:</strong> We do not collect usage telemetry from the VS Code extension.</li>
          </ul>

          <h3 className="font-medium mt-4" style={{ color: "var(--text-primary)" }}>Memory.Wiki for Mac</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Local files:</strong> The desktop app reads files you open via Finder or Cmd+O. Files are edited through Memory.Wiki and auto-saved locally.</li>
            <li><strong>No phone-home:</strong> The app does not send data to any server unless you explicitly publish or sync a document.</li>
          </ul>

          <h3 className="font-medium mt-4" style={{ color: "var(--text-primary)" }}>MCP Server (mdfy-mcp)</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Document operations:</strong> The MCP server creates, reads, and manages documents on Memory.Wiki via its API. Documents are stored on Memory.Wiki servers.</li>
            <li><strong>Local tokens:</strong> Edit tokens are stored locally at <code style={{ fontSize: "0.85em" }}>~/.memory.wiki/tokens.json</code> with owner-only permissions (0600).</li>
            <li><strong>Email:</strong> Your email (MDFY_EMAIL) is sent to the API for document ownership. It is not shared with third parties.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>What We Don&apos;t Do</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>We do not sell your data to third parties.</li>
            <li>We do not use your content to train AI models.</li>
            <li>We do not track you across websites.</li>
            <li>We do not show advertisements.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Data Storage & Security</h2>
          <p>
            Documents and user data are stored on Supabase (PostgreSQL) with encryption at rest.
            Images are stored on Supabase Storage. The service is hosted on Vercel.
            All connections use HTTPS/TLS encryption.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Data Deletion</h2>
          <p>
            You can delete any document you created at any time. If you have an account, you can request
            full account deletion by emailing{" "}
            <a href="mailto:hi@raymind.ai" style={{ color: "var(--accent)" }}>hi@raymind.ai</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Cookies</h2>
          <p>
            We use essential cookies for authentication (login session) and theme preference.
            We do not use tracking or advertising cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Changes</h2>
          <p>
            We may update this policy from time to time. Changes will be posted on this page
            with an updated date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Contact</h2>
          <p>
            Questions about this policy? Email{" "}
            <a href="mailto:hi@raymind.ai" style={{ color: "var(--accent)" }}>hi@raymind.ai</a>.
          </p>
        </section>

        <div className="pt-8 text-xs" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-dim)" }}>
          <Link href="/" style={{ color: "var(--accent)" }}>Memory.Wiki</Link>
          {" "}&middot;{" "}
          <Link href="/about" style={{ color: "var(--text-muted)" }}>About</Link>
        </div>
      </article>
    </main>
  );
}
