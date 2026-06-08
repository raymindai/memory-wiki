// /delete-account — account deletion instructions for the Google Play
// Data Safety form. Play requires a URL that prominently features the
// steps to delete an account + specifies what data is deleted vs kept.
// Don't break this page's URL — it's referenced from the Play Console
// Data Safety listing and from /privacy.

import Link from "next/link";

export const metadata = {
  title: "Delete your memory.wiki account",
  description: "How to request deletion of your memory.wiki account and all associated data.",
};

export default function DeleteAccountPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ background: "var(--canvas)", color: "var(--text-primary)", maxWidth: 720, margin: "0 auto" }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
        Delete your memory.wiki account
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 32 }}>
        memory.wiki — operated by Raymind. Last updated 2026-06-08.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          Self-serve deletion (recommended)
        </h2>
        <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>
          <li>Open memory.wiki in any browser and sign in at <Link href="/" style={{ color: "var(--accent)" }}>memory.wiki</Link>.</li>
          <li>Go to <Link href="/settings" style={{ color: "var(--accent)" }}>Settings</Link> (gear icon in the sidebar).</li>
          <li>Scroll to <strong>Account</strong> and choose <strong>Delete account</strong>.</li>
          <li>Confirm the action in the dialog. Deletion runs immediately.</li>
        </ol>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          Email request (alternative)
        </h2>
        <p style={{ lineHeight: 1.7 }}>
          If you cannot sign in, email{" "}
          <a href="mailto:hi@raymind.ai?subject=memory.wiki%20account%20deletion%20request" style={{ color: "var(--accent)" }}>
            hi@raymind.ai
          </a>{" "}
          from the address attached to your memory.wiki account with the subject{" "}
          <em>memory.wiki account deletion request</em>. We verify ownership and complete
          the deletion within 7 business days, and confirm by email.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          What is deleted
        </h2>
        <ul style={{ lineHeight: 1.7, paddingLeft: 20 }}>
          <li>Your account record (email, display name, user ID, sign-in provider link).</li>
          <li>Every document you authored, including those you marked public.</li>
          <li>Every bundle and hub you created.</li>
          <li>Uploaded files (photos, audio transcripts, attachments) tied to your captures.</li>
          <li>Your AI usage history and embedding vectors.</li>
          <li>Sync metadata for any companion app (Mac, iOS, Android, Chrome, VS Code, CLI).</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          What is kept, and for how long
        </h2>
        <ul style={{ lineHeight: 1.7, paddingLeft: 20 }}>
          <li>
            <strong>Anonymised logs</strong> — request logs (timestamps, status codes,
            anonymised IP) are retained for up to 30 days for security and abuse
            investigation, then permanently deleted.
          </li>
          <li>
            <strong>Aggregate AI usage counts</strong> — number of calls per provider, with
            no user identifier, kept up to 90 days for capacity planning.
          </li>
          <li>
            <strong>Documents shared with you by other users</strong> — these are owned by
            them, not you, and are not deleted when you delete your account.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          Partial deletion (some data, keep the account)
        </h2>
        <p style={{ lineHeight: 1.7 }}>
          You can delete individual documents, bundles, or hubs at any time without
          deleting the account itself. Open the item, click the more menu, choose{" "}
          <strong>Delete</strong>. Deletion is immediate and removes the content from
          every linked companion app on its next sync.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          Contact
        </h2>
        <p style={{ lineHeight: 1.7 }}>
          Privacy questions:{" "}
          <a href="mailto:hi@raymind.ai" style={{ color: "var(--accent)" }}>hi@raymind.ai</a>
          . Privacy policy:{" "}
          <Link href="/privacy" style={{ color: "var(--accent)" }}>memory.wiki/privacy</Link>.
        </p>
      </section>
    </main>
  );
}
