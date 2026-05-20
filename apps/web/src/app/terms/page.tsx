import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — memory.wiki",
  description: "Terms of Service for memory.wiki, the memory.wiki Chrome Extension, VS Code Extension, and memory.wiki for Mac.",
  openGraph: {
    title: "Terms of Service — memory.wiki",
    url: "https://memory.wiki/terms",
  },
};

export default function TermsPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center px-4 py-16"
      style={{ background: "var(--bg)", color: "var(--text-primary)" }}
    >
      <article className="w-full max-w-2xl space-y-8 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <div>
          <Link href="/" className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            &larr; memory.wiki
          </Link>
          <h1 className="text-2xl font-bold mt-4" style={{ color: "var(--text-primary)" }}>
            Terms of Service
          </h1>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Last updated: April 15, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>1. Acceptance</h2>
          <p>
            By using memory.wiki, the memory.wiki Chrome Extension, VS Code Extension, memory.wiki for Mac, or the memory.wiki MCP server
            (collectively, &ldquo;the Service&rdquo;), you agree to these terms. The Service is operated by Raymind AI.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>2. The Service</h2>
          <p>
            memory.wiki is a Markdown document publishing platform. You can create, edit, and share documents
            via shareable URLs. The Service includes a web editor, browser extension, VS Code extension,
            desktop app, and MCP server for AI tool integration.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>3. Your Content</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Ownership:</strong> You retain full ownership of all content you create or upload. We do not claim any intellectual property rights over your content.</li>
            <li><strong>License to us:</strong> By publishing a document, you grant us a limited license to store, display, and serve your content as necessary to provide the Service (e.g., rendering your document at its shareable URL).</li>
            <li><strong>Public documents:</strong> Documents you share via public URLs are accessible to anyone with the link. You are responsible for the content you publish.</li>
            <li><strong>Deletion:</strong> You can delete your documents at any time. Deleted content is removed from our servers.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>4. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Publish illegal, harmful, or abusive content</li>
            <li>Distribute malware or phishing content</li>
            <li>Impersonate others or misrepresent your identity</li>
            <li>Abuse the API or attempt to disrupt the Service</li>
            <li>Scrape or bulk-download content from other users</li>
          </ul>
          <p>
            We reserve the right to remove content or suspend accounts that violate these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>5. Accounts</h2>
          <p>
            Some features require an account (Google or GitHub sign-in). You are responsible for
            maintaining the security of your account. We are not liable for unauthorized access
            to your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>6. Pricing</h2>
          <p>
            The Service is currently free for all features. We may introduce paid tiers in the future.
            If we do, existing free features will remain available, and we will provide advance notice
            of any changes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>7. Availability</h2>
          <p>
            We strive to keep the Service available at all times but do not guarantee 100% uptime.
            The Service is provided &ldquo;as is&rdquo; without warranties of any kind.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Raymind AI shall not be liable for any indirect,
            incidental, or consequential damages arising from your use of the Service. Our total
            liability shall not exceed the amount you paid us in the 12 months preceding the claim (if any).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>9. Changes</h2>
          <p>
            We may update these terms from time to time. Continued use of the Service after changes
            constitutes acceptance. Material changes will be communicated via the website.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>10. Contact</h2>
          <p>
            Questions about these terms? Email{" "}
            <a href="mailto:hi@raymind.ai" style={{ color: "var(--accent)" }}>hi@raymind.ai</a>.
          </p>
        </section>

        <div className="pt-8 text-xs" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-dim)" }}>
          <Link href="/" style={{ color: "var(--accent)" }}>memory.wiki</Link>
          {" "}&middot;{" "}
          <Link href="/about" style={{ color: "var(--text-muted)" }}>About</Link>
          {" "}&middot;{" "}
          <Link href="/privacy" style={{ color: "var(--text-muted)" }}>Privacy</Link>
        </div>
      </article>
    </main>
  );
}
