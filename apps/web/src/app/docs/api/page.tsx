import type { Metadata } from "next";
import {
  CodeBlock,
  InlineCode,
  SectionHeading,
  SubLabel,
  DocsNav,
  DocsFooter,
  DocsSidebar,
  mono,
} from "@/components/docs";

export const metadata: Metadata = {
  title: "REST API Reference — memory.wiki",
  description:
    "Complete REST API reference for memory.wiki. Create, read, update, and delete Markdown documents via HTTP. Includes code examples in curl, JavaScript, and Python.",
  alternates: {
    canonical: "https://memory.wiki/docs/api",
    languages: { ko: "https://memory.wiki/ko/docs/api" },
  },
  openGraph: {
    title: "REST API Reference — memory.wiki",
    description: "Full REST API reference. Endpoints, parameters, examples.",
    url: "https://memory.wiki/docs/api",
    images: [{ url: "/api/og?title=REST%20API", width: 1200, height: 630 }],
  },
};

/* ─── Page-specific Components ─── */

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, { fg: string; bg: string }> = {
    POST: { fg: "#3b82f6", bg: "#3b82f615" },
    GET: { fg: "#22c55e", bg: "#22c55e15" },
    PATCH: { fg: "#f59e0b", bg: "#f59e0b15" },
    DELETE: { fg: "#ef4444", bg: "#ef444415" },
    HEAD: { fg: "#a78bfa", bg: "#a78bfa15" },
  };
  const c = colors[method] || {
    fg: "var(--text-secondary)",
    bg: "var(--surface)",
  };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: mono,
        color: c.fg,
        background: c.bg,
        padding: "3px 10px",
        borderRadius: 6,
        letterSpacing: 0.5,
      }}
    >
      {method}
    </span>
  );
}

function ParamRow({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="param-row"
      style={{
        display: "grid",
        gridTemplateColumns: "160px 80px 1fr",
        gap: 12,
        alignItems: "baseline",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-dim)",
      }}
    >
      <code
        style={{
          fontSize: 13,
          fontFamily: mono,
          color: "var(--text-primary)",
          fontWeight: 600,
        }}
      >
        {name}
        {required && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#ef4444",
              marginLeft: 6,
              verticalAlign: "super",
            }}
          >
            REQUIRED
          </span>
        )}
      </code>
      <span
        style={{
          fontSize: 12,
          fontFamily: mono,
          color: "var(--text-faint)",
        }}
      >
        {type}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.6,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function EndpointBlock({
  id,
  method,
  path,
  description,
  children,
}: {
  id: string;
  method: string;
  path: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-dim)",
        borderRadius: 14,
        padding: "28px 24px",
        marginBottom: 20,
        scrollMarginTop: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <MethodBadge method={method} />
        <code
          style={{
            fontSize: 15,
            fontFamily: mono,
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          {path}
        </code>
      </div>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 24px",
          lineHeight: 1.7,
          maxWidth: 640,
        }}
      >
        {description}
      </p>
      {children}
    </div>
  );
}

/* ─── Sidebar Items ─── */
const sidebarItems = [
  { id: "overview", label: "Overview" },
  { id: "post-docs", label: "POST /api/docs" },
  { id: "get-docs-id", label: "GET /api/docs/{id}" },
  { id: "patch-docs-id", label: "PATCH /api/docs/{id}" },
  { id: "head-docs-id", label: "HEAD /api/docs/{id}" },
  { id: "get-related", label: "GET /api/docs/{id}/related" },
  { id: "get-user-documents", label: "GET /api/user/documents" },
  { id: "post-upload", label: "POST /api/upload" },
  { id: "post-import-github", label: "POST /api/import/github" },
  { id: "post-import-obsidian", label: "POST /api/import/obsidian" },
  { id: "post-import-notion", label: "POST /api/import/notion" },
  { id: "post-hub-recall", label: "POST /api/hub/{slug}/recall" },
  { id: "raw-and-llms", label: "Raw + /llms.txt" },
  { id: "bundle-url-anatomy", label: "Bundle URL anatomy" },
  { id: "authentication", label: "Authentication" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "errors", label: "Errors" },
];

/* ─── Page ─── */
export default function ApiDocsPage() {
  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100vh",
      }}
    >
      <DocsNav />

      <div className="docs-layout">
        <DocsSidebar
          items={sidebarItems}
          currentPath="/docs/api"
        />

        {/* MAIN CONTENT */}
        <main style={{ paddingTop: 40, paddingBottom: 80, minWidth: 0 }}>
          {/* Overview */}
          <div id="overview" style={{ scrollMarginTop: 80 }}>
            <p
              style={{
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 12,
                fontFamily: mono,
              }}
            >
              REST API
            </p>
            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
                margin: "0 0 16px",
              }}
            >
              API Reference
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 8,
                maxWidth: 640,
              }}
            >
              All endpoints accept and return JSON. Base URL:{" "}
              <InlineCode>{"https://memory.wiki"}</InlineCode>
            </p>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-faint)",
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              Rate limit: 10 requests/min per IP. Max document size: 500KB.
            </p>
          </div>

          {/* ─── POST /api/docs ─── */}
          <EndpointBlock
            id="post-docs"
            method="POST"
            path="/api/docs"
            description="Create a new document. Returns document ID, edit token, and creation timestamp."
          >
            <SubLabel>Parameters</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="markdown" type="string" required>
                The Markdown content of the document.
              </ParamRow>
              <ParamRow name="title" type="string">
                Document title. If not provided, extracted from the first heading.
              </ParamRow>
              <ParamRow name="isDraft" type="boolean">
                Draft status. Default: <InlineCode>{"false"}</InlineCode>. Draft documents are only visible to the owner.
              </ParamRow>
              <ParamRow name="source" type="string">
                Source identifier: <InlineCode>{"api"}</InlineCode>, <InlineCode>{"web"}</InlineCode>, <InlineCode>{"vscode"}</InlineCode>, <InlineCode>{"mcp"}</InlineCode>, <InlineCode>{"cli"}</InlineCode>, or <InlineCode>{"github:<owner>/<repo>"}</InlineCode> for GitHub imports.
              </ParamRow>
              <ParamRow name="editMode" type="string">
                Who can edit: <InlineCode>{"owner"}</InlineCode> (default for signed-in users), <InlineCode>{"token"}</InlineCode> (anyone with editToken), <InlineCode>{"view"}</InlineCode> (read-only for everyone but the owner).
              </ParamRow>
              <ParamRow name="folderId" type="string">
                Place the document in a specific folder.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/docs \\
  -H "Content-Type: application/json" \\
  -d '{
    "markdown": "# Hello World\\nThis is my document.",
    "title": "My Document",
    "isDraft": false
  }'`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/docs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    markdown: "# Hello World\\nThis is my document.",
    title: "My Document",
    isDraft: false,
  }),
});
const data = await res.json();`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.post("https://memory.wiki/api/docs", json={
    "markdown": "# Hello World\\nThis is my document.",
    "title": "My Document",
    "isDraft": False,
})
data = res.json()`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "id": "abc123",
  "editToken": "tok_aBcDeFgHiJkLmNoP",
  "created_at": "2026-04-15T00:00:00Z"
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── GET /api/docs/{id} ─── */}
          <EndpointBlock
            id="get-docs-id"
            method="GET"
            path="/api/docs/{id}"
            description="Read a document by ID. Draft documents and email-restricted shares require owner or invitee authentication."
          >
            <SubLabel>Headers (optional)</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="x-user-id" type="string">
                User UUID for ownership verification.
              </ParamRow>
              <ParamRow name="x-user-email" type="string">
                User email for identification (matches against the doc&apos;s allowed_emails / allowed_editors).
              </ParamRow>
              <ParamRow name="Authorization" type="string">
                Bearer token for OAuth-authenticated requests.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl https://memory.wiki/api/docs/abc123`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/docs/abc123");
const doc = await res.json();`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.get("https://memory.wiki/api/docs/abc123")
doc = res.json()`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "id": "abc123",
  "title": "My Document",
  "markdown": "# Hello World\\nThis is my document.",
  "created_at": "2026-04-15T00:00:00Z",
  "updated_at": "2026-04-15T01:00:00Z",
  "view_count": 42,
  "is_draft": false,
  "editMode": "owner",
  "isOwner": true,
  "editToken": "tok_..."
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── PATCH /api/docs/{id} ─── */}
          <EndpointBlock
            id="patch-docs-id"
            method="PATCH"
            path="/api/docs/{id}"
            description="Update a document. Requires edit token or owner authentication. Supports multiple actions: update content, soft-delete, rotate-token, change-edit-mode."
          >
            <SubLabel>Parameters</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="editToken" type="string" required>
                The edit token returned at creation (required for token mode).
              </ParamRow>
              <ParamRow name="markdown" type="string">
                New Markdown content.
              </ParamRow>
              <ParamRow name="title" type="string">
                New document title.
              </ParamRow>
              <ParamRow name="isDraft" type="boolean">
                Toggle between draft and published state.
              </ParamRow>
              <ParamRow name="action" type="string">
                Special action: <InlineCode>{"soft-delete"}</InlineCode>, <InlineCode>{"rotate-token"}</InlineCode>.
              </ParamRow>
              <ParamRow name="changeSummary" type="string">
                Version note describing the change.
              </ParamRow>
              <ParamRow name="editMode" type="string">
                Change edit mode: <InlineCode>{"owner"}</InlineCode>, <InlineCode>{"token"}</InlineCode>, or <InlineCode>{"view"}</InlineCode>.
              </ParamRow>
            </div>

            <SubLabel>Request - curl (update content)</SubLabel>
            <CodeBlock lang="bash">{`curl -X PATCH https://memory.wiki/api/docs/abc123 \\
  -H "Content-Type: application/json" \\
  -d '{
    "editToken": "tok_aBcDeFgH",
    "markdown": "# Updated Content",
    "changeSummary": "Fixed typos"
  }'`}</CodeBlock>

            <SubLabel>Request - curl (soft delete)</SubLabel>
            <CodeBlock lang="bash">{`curl -X PATCH https://memory.wiki/api/docs/abc123 \\
  -H "Content-Type: application/json" \\
  -d '{
    "editToken": "tok_aBcDeFgH",
    "action": "soft-delete"
  }'`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/docs/abc123", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    editToken: "tok_aBcDeFgH",
    markdown: "# Updated Content",
  }),
});`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.patch("https://memory.wiki/api/docs/abc123", json={
    "editToken": "tok_aBcDeFgH",
    "markdown": "# Updated Content",
})`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "success": true,
  "id": "abc123",
  "updated_at": "2026-04-15T02:00:00Z"
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── HEAD /api/docs/{id} ─── */}
          <EndpointBlock
            id="head-docs-id"
            method="HEAD"
            path="/api/docs/{id}"
            description="Check when a document was last updated. Returns x-updated-at response header. Useful for sync polling without downloading full content."
          >
            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -I https://memory.wiki/api/docs/abc123

# Response headers:
# x-updated-at: 2026-04-15T01:00:00Z
# x-content-length: 1234`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/docs/abc123", {
  method: "HEAD",
});
const updatedAt = res.headers.get("x-updated-at");`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.head("https://memory.wiki/api/docs/abc123")
updated_at = res.headers["x-updated-at"]`}</CodeBlock>
          </EndpointBlock>

          {/* ─── GET /api/user/documents ─── */}
          <EndpointBlock
            id="get-user-documents"
            method="GET"
            path="/api/user/documents"
            description="List all documents owned by a user. Requires user identification via header."
          >
            <SubLabel>Headers</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="x-user-id" type="string" required>
                User UUID. Alternatively use <InlineCode>{"x-user-email"}</InlineCode> or <InlineCode>{"Authorization: Bearer"}</InlineCode>.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl https://memory.wiki/api/user/documents \\
  -H "x-user-id: user-uuid-here"`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/user/documents", {
  headers: { "x-user-id": "user-uuid-here" },
});
const { documents } = await res.json();`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.get("https://memory.wiki/api/user/documents",
    headers={"x-user-id": "user-uuid-here"})
documents = res.json()["documents"]`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "documents": [
    {
      "id": "abc123",
      "title": "My Document",
      "created_at": "2026-04-15T00:00:00Z",
      "updated_at": "2026-04-15T01:00:00Z",
      "is_draft": false,
      "view_count": 42
    }
  ]
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── POST /api/upload ─── */}
          <EndpointBlock
            id="post-upload"
            method="POST"
            path="/api/upload"
            description="Upload an image file. Returns a public URL. Accepts multipart form-data with a file field."
          >
            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/upload \\
  -F "file=@screenshot.png"`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const form = new FormData();
form.append("file", fileBlob, "screenshot.png");

const res = await fetch("https://memory.wiki/api/upload", {
  method: "POST",
  body: form,
});
const { url } = await res.json();`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

with open("screenshot.png", "rb") as f:
    res = requests.post("https://memory.wiki/api/upload",
        files={"file": f})
url = res.json()["url"]`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "url": "https://storage.memory.wiki/uploads/screenshot.png"
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── GET /api/docs/{id}/related ─── */}
          <EndpointBlock
            id="get-related"
            method="GET"
            path="/api/docs/{id}/related"
            description="Return up to N other docs from the caller's hub that share concepts with this doc. Owner-only — overlap leaks titles otherwise."
          >
            <SubLabel>Query parameters</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="limit" type="number">
                Max results to return. Default 5, capped at 20.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl https://memory.wiki/api/docs/abc123/related?limit=5 \\
  -H "Authorization: Bearer $JWT"`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "id": "abc123",
  "related": [
    {
      "id": "def456",
      "title": "Related doc",
      "sharedConcepts": ["AI memory", "knowledge hub"],
      "overlap": 2,
      "isDraft": false,
      "isRestricted": false,
      "sharedWithCount": 0,
      "updated_at": "2026-04-15T01:00:00Z"
    }
  ]
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── POST /api/import/github ─── */}
          <EndpointBlock
            id="post-import-github"
            method="POST"
            path="/api/import/github"
            description="Import every .md file from a GitHub repo, folder, or single file. Caps: 80 files, 200KB per file. Creates one doc per file plus a bundle that groups them."
          >
            <SubLabel>Parameters</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="url" type="string" required>
                GitHub URL — repo home, /tree/branch/path, /blob/branch/path, or raw.githubusercontent.com link.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/import/github \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT" \\
  -d '{ "url": "https://github.com/owner/repo/tree/main/docs" }'`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "imported": 12,
  "skipped": 0,
  "deduplicated": 2,
  "failed": 0,
  "docs": [
    {
      "id": "abc123",
      "title": "README",
      "path": "README.md",
      "sourceUrl": "https://github.com/owner/repo/blob/main/README.md"
    }
  ]
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── POST /api/import/obsidian ─── */}
          <EndpointBlock
            id="post-import-obsidian"
            method="POST"
            path="/api/import/obsidian"
            description="Import every .md file from an Obsidian vault uploaded as a .zip (multipart/form-data, file field). Caps: 10MB zipped, 80 files, 200KB per file. Skips dot-prefixed folders (.obsidian, .git, …) and macOS resource forks."
          >
            <SubLabel>Multipart fields</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="file" type="file" required>
                A .zip containing your vault. The file name (minus extension) is recorded as the vault label.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/import/obsidian \\
  -H "Authorization: Bearer $JWT" \\
  -F "file=@MyVault.zip"`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "imported": 12,
  "skipped": 0,
  "deduplicated": 2,
  "failed": 0,
  "docs": [
    {
      "id": "abc123",
      "title": "Daily Note",
      "path": "notes/Daily Note.md"
    }
  ]
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── POST /api/import/notion ─── */}
          <EndpointBlock
            id="post-import-notion"
            method="POST"
            path="/api/import/notion"
            description="Import a single Notion page using the caller's internal integration token. v1 — no OAuth; the user pastes the token per call. Same dedup contract as docs/PDF/GitHub/Obsidian so re-calling is idempotent."
          >
            <SubLabel>Parameters</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="token" type="string" required>
                Notion internal integration token (<InlineCode>{"secret_…"}</InlineCode> or <InlineCode>{"ntn_…"}</InlineCode>). The integration must have access to the page.
              </ParamRow>
              <ParamRow name="pageUrl" type="string">
                Notion page URL — anything from <InlineCode>{"notion.so/…"}</InlineCode> with a UUID in it.
              </ParamRow>
              <ParamRow name="pageId" type="string">
                Alternative to pageUrl. Hyphenated UUID or bare 32-char id.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/import/notion \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT" \\
  -d '{
    "token": "secret_xxx",
    "pageUrl": "https://www.notion.so/My-Page-abcdef0123456789abcdef0123456789"
  }'`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "imported": 1,
  "deduplicated": 0,
  "failed": 0,
  "docs": [
    {
      "id": "abc123",
      "title": "My Page",
      "notionPageId": "abcdef01-2345-6789-abcd-ef0123456789",
      "pageUrl": "https://www.notion.so/My-Page-abcdef0123456789abcdef0123456789"
    }
  ]
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── POST /api/hub/{slug}/recall ─── */}
          <EndpointBlock
            id="post-hub-recall"
            method="POST"
            path="/api/hub/{slug}/recall"
            description="Hybrid retrieval over the public docs in a hub. Combines vector + keyword search; pass rerank: true to reorder candidates with a Haiku-based cross-encoder for higher precision."
          >
            <SubLabel>Parameters</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="query" type="string" required>
                The natural-language question or search phrase.
              </ParamRow>
              <ParamRow name="k" type="number">
                Number of results to return. Default 8.
              </ParamRow>
              <ParamRow name="rerank" type="boolean">
                When true, fetch <InlineCode>{"k * 4"}</InlineCode> candidates first then rerank with Anthropic Haiku. Slower but more precise.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/hub/your-slug/recall \\
  -H "Content-Type: application/json" \\
  -d '{ "query": "how do bundles work?", "k": 6, "rerank": true }'`}</CodeBlock>

            <SubLabel>Response 200</SubLabel>
            <CodeBlock lang="json">{`{
  "matches": [
    {
      "doc_id": "abc123",
      "title": "Bundles overview",
      "passage": "A bundle groups related docs into…",
      "score": 0.84
    }
  ],
  "meta": { "reranked": true }
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── Raw + /llms.txt ─── */}
          <SectionHeading id="raw-and-llms">Raw + /llms.txt</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            Every public memory.wiki URL also exposes a clean-markdown variant for AI agents.
            Append <InlineCode>{"?compact"}</InlineCode> or <InlineCode>{"?digest"}</InlineCode> to cut tokens — the answer is the same; the bill is smaller.
          </p>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 24,
            }}
          >
            <ParamRow name="/raw/{id}" type="GET">
              Plain markdown for a single document.
            </ParamRow>
            <ParamRow name="/raw/b/{bundleId}" type="GET">
              Bundle digest: frontmatter + the canvas analysis (themes, insights, concept sub-graph) + a numbered link list of member docs.
              Add <InlineCode>{"?full=1"}</InlineCode> to inline every doc body, <InlineCode>{"?graph=0"}</InlineCode> to drop the analysis.
              See <a href="#bundle-url-anatomy" style={{ color: "var(--accent)" }}>Bundle URL anatomy</a> below.
            </ParamRow>
            <ParamRow name="/raw/hub/{slug}" type="GET">
              Whole-hub markdown. <InlineCode>{"?digest=1"}</InlineCode> returns a concept-clustered summary.
            </ParamRow>
            <ParamRow name="/raw/hub/{slug}/c/{concept}" type="GET">
              Per-concept passage page across all docs in the hub.
            </ParamRow>
            <ParamRow name="/hub/{slug}/llms.txt" type="GET">
              Manifest the agent can fetch first to understand what&apos;s available.
            </ParamRow>
            <ParamRow name="/hub/{slug}/llms-full.txt" type="GET">
              Dense whole-hub bundle (default 80k tokens, override with <InlineCode>{"?cap="}</InlineCode>).
            </ParamRow>
          </div>

          {/* ─── Bundle URL anatomy ─── */}
          <SectionHeading id="bundle-url-anatomy">Bundle URL anatomy</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            Pasting a bundle URL (<InlineCode>memory.wiki/b/&#123;id&#125;</InlineCode>) into Claude, ChatGPT, or Cursor returns more than a doc list.
            The default response is a digest that also carries the canvas&apos;s cross-document analysis — themes,
            insights, gaps, takeaways, notable connections, and a concept sub-graph — so the consuming AI inherits the prior AI&apos;s work
            instead of redoing it.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            Vector embeddings stay server-side (they&apos;re numeric and unusable to an LLM). What ships over the wire is the textual
            output the analysis already produced.
          </p>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 24,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            Response shape
          </h3>
          <CodeBlock lang="markdown">{`---
mdfy_bundle: 1
id: <bundleId>
title: "..."
url: https://memory.wiki/b/<id>
document_count: N
updated: <ISO>
analysis_generated_at: <ISO>   # present when the canvas has run
analysis_stale: true           # only when a member doc was edited after that run
source: "memory.wiki"
---

# <Bundle title>
> <description>
**Intent:** <intent>

> ⚠ _Analysis may be stale — re-run the canvas to refresh._   (stale only)

## Summary
<canvas summary>

## Themes
- ...

## Cross-document insights
- ...

## Key takeaways
- ...

## Open questions / gaps
- ...

## Notable connections
- **doc A title** ↔ **doc B title** — <relationship>

## Concepts (this bundle)
- **concept label** (from **doc title**)

## Concept relations
- **conceptA** ↔ **conceptB** — <edge label>

1. [Doc 1 title](https://memory.wiki/<docId>) — annotation
2. [Doc 2 title](https://memory.wiki/<docId>) — annotation`}</CodeBlock>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 24,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            Query parameters
          </h3>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "16px 24px",
              marginBottom: 24,
            }}
          >
            <ParamRow name="full" type="boolean">
              <InlineCode>{"?full=1"}</InlineCode> inlines every member doc&apos;s full markdown body after the doc-list section.
              Default (omitted) returns the link list only — the AI follows links on demand.
            </ParamRow>
            <ParamRow name="graph" type="boolean">
              <InlineCode>{"?graph=0"}</InlineCode> (also <InlineCode>false</InlineCode> / <InlineCode>off</InlineCode>) drops the canvas-analysis sections and returns the legacy doc-list-only digest. Useful when the analysis is heavy or the caller only needs the inventory.
            </ParamRow>
            <ParamRow name="compact" type="boolean">
              <InlineCode>{"?compact"}</InlineCode> strips redundant whitespace and trims long quoted blocks across the whole payload.
              Combines with <InlineCode>full</InlineCode> and <InlineCode>graph</InlineCode>.
            </ParamRow>
          </div>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 24,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            Two ontology layers
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 12,
              maxWidth: 640,
            }}
          >
            memory.wiki ships two distinct ontology layers, and each lives on its own URL:
          </p>
          <ul
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.8,
              marginBottom: 16,
              paddingLeft: 20,
              maxWidth: 640,
            }}
          >
            <li>
              <strong style={{ color: "var(--text-primary)" }}>concept_index</strong> — hub-wide. Concept labels + the docs each appears in.
              Already embedded in <InlineCode>/raw/hub/&#123;slug&#125;</InlineCode>.
            </li>
            <li>
              <strong style={{ color: "var(--text-primary)" }}>ai_graph</strong> — bundle-scoped. Themes, insights, gaps, connections, and a
              concept sub-graph produced by the canvas. Embedded in <InlineCode>/raw/b/&#123;id&#125;</InlineCode> as of this release.
            </li>
          </ul>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 24,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            Staleness model
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 24,
              maxWidth: 640,
            }}
          >
            The canvas analysis is a snapshot. If any member doc&apos;s <InlineCode>updated_at</InlineCode> is later than
            <InlineCode>graph_generated_at</InlineCode>, the response sets <InlineCode>analysis_stale: true</InlineCode> in frontmatter and prepends a
            warning blockquote so the consuming AI can weight the analysis appropriately.
          </p>

          {/* ─── Authentication ─── */}
          <SectionHeading id="authentication">Authentication</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 24,
              maxWidth: 640,
            }}
          >
            memory.wiki uses progressive authentication. Basic operations require no auth.
            Advanced features use edit tokens or user identity.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {[
              {
                title: "No auth required",
                desc: "POST /api/docs and GET /api/docs/{id} work without authentication. The returned editToken is your proof of ownership.",
              },
              {
                title: "Edit tokens",
                desc: "Every document gets an editToken at creation. Include it in PATCH requests to update or delete. MCP server and CLI manage tokens automatically.",
              },
              {
                title: "User identity",
                desc: "For user-scoped actions (list, ownership), provide x-user-id header, x-user-email header, or Authorization: Bearer JWT token.",
              },
              {
                title: "MCP / CLI auth",
                desc: "Both MCP server and CLI use JWT from memory.wiki login. Run: npm install -g mdfy-cli && memory.wiki login",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-dim)",
                  borderRadius: 14,
                  padding: "24px",
                }}
              >
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginTop: 0,
                    marginBottom: 10,
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* ─── Rate Limits ─── */}
          <SectionHeading id="rate-limits">Rate Limits</SectionHeading>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "24px",
              marginBottom: 24,
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              All endpoints are rate-limited to <strong>10 requests per minute per IP</strong>.
              Exceeding the limit returns <InlineCode>{"429 Too Many Requests"}</InlineCode>.
              The response includes <InlineCode>{"Retry-After"}</InlineCode> header indicating seconds to wait.
              Maximum document size is <strong>500KB</strong>.
            </p>
          </div>

          {/* ─── Errors ─── */}
          <SectionHeading id="errors">Errors</SectionHeading>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "24px",
              marginBottom: 24,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <ParamRow name="400" type="error">Bad Request. Missing required fields or invalid parameters.</ParamRow>
              <ParamRow name="401" type="error">Unauthorized. Invalid or missing edit token / credentials.</ParamRow>
              <ParamRow name="403" type="error">Forbidden. Insufficient permissions for this resource.</ParamRow>
              <ParamRow name="404" type="error">Not Found. Document does not exist or has been deleted.</ParamRow>
              <ParamRow name="409" type="error">Conflict. Anti-template guard refused the write (would overwrite real content with boilerplate).</ParamRow>
              <ParamRow name="429" type="error">Too Many Requests. Rate limit exceeded.</ParamRow>
              <ParamRow name="500" type="error">Internal Server Error. Please retry or contact support.</ParamRow>
            </div>
            <SubLabel>Error Response Format</SubLabel>
            <CodeBlock lang="json">{`{
  "error": "Document not found",
  "status": 404
}`}</CodeBlock>
          </div>
        </main>
      </div>

      <DocsFooter breadcrumb="REST API" />
    </div>
  );
}
