export const dynamic = "force-static";

const CONTENT = `# Memory.Wiki API Reference
Base URL: https://memory.wiki
Rate Limit: 10 requests/min per IP
Max Document Size: 500KB

## Authentication

Memory.Wiki uses progressive authentication:
- No auth required for basic publish and read
- Edit tokens for updates/deletes (returned at creation)
- User identity via x-user-id or Authorization: Bearer JWT headers
- MCP and CLI use JWT from \`Memory.Wiki login\` (stored in ~/.memory.wiki/config.json)

## Endpoints

### POST /api/docs
Create a new document.

Parameters:
- markdown (string, required): Markdown content
- title (string, optional): Document title
- isDraft (boolean, default false): Draft status
- source (string, optional): Source identifier ("api", "web", "vscode", "mcp", "cli", "github:<owner>/<repo>")
- editMode (string, optional): "owner" (default for signed-in), "token" (anyone with editToken), "view" (read-only)
- folderId (string, optional): Folder to place document in
- userId (string, optional): User UUID for ownership

Request:
\`\`\`
curl -X POST https://memory.wiki/api/docs \\
  -H "Content-Type: application/json" \\
  -d '{"markdown": "# Hello World", "isDraft": false}'
\`\`\`

Response 200:
\`\`\`json
{
  "id": "abc123",
  "editToken": "tok_aBcDeFgHiJkLmNoP",
  "created_at": "2026-04-15T00:00:00Z"
}
\`\`\`

### GET /api/docs/{id}
Read a document by ID.

Headers (optional):
- x-user-id: User UUID for ownership verification
- x-user-email: User email (matches against allowed_emails / allowed_editors)
- x-anonymous-id: Anonymous user ID
- Authorization: Bearer <token>

Request:
\`\`\`
curl https://memory.wiki/api/docs/abc123
\`\`\`

Response 200:
\`\`\`json
{
  "id": "abc123",
  "title": "My Document",
  "markdown": "# Hello World",
  "created_at": "2026-04-15T00:00:00Z",
  "updated_at": "2026-04-15T01:00:00Z",
  "view_count": 42,
  "is_draft": false,
  "editMode": "owner",
  "isOwner": true,
  "editToken": "tok_..."
}
\`\`\`

### PATCH /api/docs/{id}
Update a document. Requires edit token or owner authentication.

Parameters:
- editToken (string, required for token mode): Edit token from creation
- markdown (string, optional): New Markdown content
- title (string, optional): New title
- isDraft (boolean, optional): Toggle draft/published
- action (string, optional): "soft-delete" or "rotate-token"
- changeSummary (string, optional): Version note
- editMode (string, optional): Change edit mode

Request (update content):
\`\`\`
curl -X PATCH https://memory.wiki/api/docs/abc123 \\
  -H "Content-Type: application/json" \\
  -d '{"editToken": "tok_...", "markdown": "# Updated", "changeSummary": "Fixed typos"}'
\`\`\`

Request (soft delete):
\`\`\`
curl -X PATCH https://memory.wiki/api/docs/abc123 \\
  -H "Content-Type: application/json" \\
  -d '{"editToken": "tok_...", "action": "soft-delete"}'
\`\`\`

Response 200:
\`\`\`json
{
  "success": true,
  "id": "abc123",
  "updated_at": "2026-04-15T02:00:00Z"
}
\`\`\`

### HEAD /api/docs/{id}
Check when a document was last updated. Returns x-updated-at header.

Request:
\`\`\`
curl -I https://memory.wiki/api/docs/abc123
\`\`\`

Response Headers:
- x-updated-at: 2026-04-15T01:00:00Z
- x-content-length: 1234

### GET /api/user/documents
List all documents owned by a user.

Headers (one required):
- x-user-id: User UUID
- x-user-email: User email
- Authorization: Bearer <token>

Request:
\`\`\`
curl https://memory.wiki/api/user/documents \\
  -H "x-user-id: user-uuid"
\`\`\`

Response 200:
\`\`\`json
{
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
}
\`\`\`

### POST /api/upload
Upload an image. Returns a public URL.

Request:
\`\`\`
curl -X POST https://memory.wiki/api/upload \\
  -F "file=@screenshot.png"
\`\`\`

Response 200:
\`\`\`json
{
  "url": "https://storage.memory.wiki/uploads/screenshot.png"
}
\`\`\`

### GET /api/docs/{id}/related
Find docs in the caller's hub that share concepts with this one. Owner-only.

Query: limit (number, default 5, max 20)

Response 200:
\`\`\`json
{
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
}
\`\`\`

### POST /api/import/github
Import every .md from a GitHub repo, folder, or file. Caps: 80 files / 200KB each.
Creates one doc per file plus a bundle that groups them.

Parameters:
- url (string, required): github.com URL — repo home, /tree/branch/path, /blob/branch/path, or raw.githubusercontent.com link

Response 200:
\`\`\`json
{
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
}
\`\`\`

### POST /api/import/notion
Import a single Notion page using the caller's internal integration token. v1 — no OAuth, the user pastes the token per-call.

Parameters:
- token (string, required): Notion internal integration token (\`secret_…\` or \`ntn_…\`). The integration must have access to the page.
- pageUrl (string) OR pageId (string): the page to import. Hyphenated UUID, bare 32-char id, or any notion.so URL containing one.

Response 200:
\`\`\`json
{
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
}
\`\`\`

### POST /api/import/obsidian
Import every .md file from an Obsidian vault uploaded as a .zip (multipart/form-data, file field).
Caps: 10MB zipped, 80 files, 200KB per file. Skips dot-prefixed folders (.obsidian, .git, …) and macOS resource forks.

Multipart field:
- file (required): .zip containing your vault

Response 200:
\`\`\`json
{
  "imported": 12,
  "skipped": 0,
  "deduplicated": 2,
  "failed": 0,
  "docs": [
    { "id": "abc123", "title": "Daily Note", "path": "notes/Daily Note.md" }
  ]
}
\`\`\`

### POST /api/hub/{slug}/recall
Hybrid retrieval (vector + keyword) over the public docs in a hub.
Pass rerank: true to reorder candidates with a Haiku-based cross-encoder.

Parameters:
- query (string, required): natural-language question or search phrase
- k (number, default 8): number of results to return
- rerank (boolean, default false): when true, fetch k * 4 candidates first then rerank

Response 200:
\`\`\`json
{
  "matches": [
    { "doc_id": "abc123", "title": "Bundles overview", "passage": "...", "score": 0.84 }
  ],
  "meta": { "reranked": true }
}
\`\`\`

## Raw + /llms.txt (token-economy URLs for AI agents)

Every public Memory.Wiki URL also exposes a clean-markdown variant. Append ?compact or ?digest to cut tokens.

- GET /raw/{id} — plain markdown for a single document, with \`## Concepts (this doc)\` + \`## Concept relations (this doc)\` appended (extracted per-doc by the doc_ontology job). Pass ?compact to drop the appendix.
- GET /raw/b/{bundleId} — concatenated markdown for a bundle
- GET /raw/hub/{slug} — whole-hub markdown; ?digest=1 returns a concept-clustered summary
- GET /raw/hub/{slug}/c/{concept} — per-concept passages across all docs in the hub
- GET /hub/{slug}/llms.txt — manifest the agent fetches first to understand what's available
- GET /hub/{slug}/llms-full.txt — dense whole-hub bundle (default 80k tokens, override with ?cap=)

## Error Codes

- 400: Bad Request - Missing required fields or invalid parameters
- 401: Unauthorized - Invalid or missing edit token / credentials
- 403: Forbidden - Insufficient permissions for this resource
- 404: Not Found - Document does not exist or deleted
- 409: Conflict - Anti-template guard refused the write (would overwrite real content with boilerplate)
- 429: Too Many Requests - Rate limit exceeded (Retry-After header included)
- 500: Internal Server Error

Error response format:
\`\`\`json
{
  "error": "Document not found",
  "status": 404
}
\`\`\`

## CLI

Install: npm install -g memory-wiki-cli

Commands:
- mw publish <file>: Publish a file or stdin
- Memory.Wiki update <id> <file>: Update existing document
- Memory.Wiki pull <id>: Download document content
- Memory.Wiki delete <id>: Soft-delete a document
- Memory.Wiki list: List your documents
- Memory.Wiki open <id>: Open in browser
- Memory.Wiki capture: Capture tmux pane and publish
- Memory.Wiki login: Authenticate
- Memory.Wiki logout: Clear credentials
- Memory.Wiki whoami: Show current user

Pipe examples:
- echo "# Hello" | mw publish
- pbpaste | mw publish
- cat file.md | mw publish
- tmux capture-pane -p | mw publish

## HTTP API

There is no SDK package — Memory.Wiki exposes plain HTTP. Use any client.
See "REST API" above for the full endpoint surface, request shapes, and
authentication. \`fetch()\` from anywhere works.

\`\`\`typescript
// Publish
const res = await fetch("https://memory.wiki/api/docs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ markdown: "# Hello", title: "Doc" }),
});
const { id, editToken, url } = await res.json();

// Update (edit-token auth)
await fetch(\`https://memory.wiki/api/docs/\${id}\`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", "x-edit-token": editToken },
  body: JSON.stringify({ markdown: "# Updated" }),
});

// Read
const doc = await fetch(\`https://memory.wiki/api/docs/\${id}\`).then((r) => r.json());
\`\`\`

## MCP Server

Two ways to connect:

### Option A: Hosted HTTP MCP (Claude Web, Cursor, etc.)

URL: https://memory.wiki/api/mcp

In Claude.ai: Settings → Integrations → Add custom MCP server → paste the URL.
In Cursor: Settings → MCP → Add server with { "url": "https://memory.wiki/api/mcp" }.

### Option B: Local stdio MCP (Claude Desktop, Claude Code)

Prerequisites: npm install -g memory-wiki-cli && Memory.Wiki login

Config (.mcp.json or claude_desktop_config.json):
\`\`\`json
{
  "mcpServers": {
    "Memory.Wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}
\`\`\`

### Tools (hosted HTTP MCP exposes 25)

Core CRUD:
- mw_create(markdown, title?, draft?): Create document, returns url/id
- mw_read(id): Read document content
- mw_update(id, markdown, title?): Update document
- mw_delete(id): Delete document
- mw_list(): List user's documents (auth)
- mw_search(query): Full-text search (auth)

Append/Prepend:
- mw_append(id, content, separator?): Append content
- mw_prepend(id, content): Prepend content

Sections:
- mw_outline(id): Get heading-based outline / TOC
- mw_extract_section(id, heading): Extract content of a section
- mw_replace_section(id, heading, newContent): Replace a section

Duplicate/Import:
- mw_duplicate(id, title?): Duplicate as new document
- mw_import_url(url, title?): Fetch URL → markdown → save

Sharing:
- mw_publish(id, published): Toggle public/private
- mw_set_allowed_emails(id, emails): Restrict to email allowlist
- mw_get_share_url(id): Get URL + access metadata

Versions:
- mw_versions(id): List version history
- mw_restore_version(id, versionId): Restore previous version
- mw_diff(id, fromVersionId, toVersionId): Line-level diff

Stats/Folders:
- mw_stats(id): View count, dates, status
- mw_recent(): Recently visited (auth)
- mw_folder_list(): List folders (auth)
- mw_folder_create(name, parentId?): Create folder (auth)
- mw_move_to_folder(documentId, folderId): Move doc to folder

The local stdio package (memory-wiki-mcp v1.3.x) currently exposes the 6 core tools.
For the full 25, use the hosted HTTP endpoint.

## npm Packages

- memory-wiki-mcp: MCP server for AI tools (hosted + stdio)
- memory-wiki-cli: command-line publisher
`;

export function GET() {
  return new Response(CONTENT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
