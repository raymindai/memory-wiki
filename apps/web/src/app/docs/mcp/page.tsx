import type { Metadata } from "next";
import {
  CodeBlock,
  InlineCode,
  Card,
  SectionHeading,
  SubLabel,
  DocsNav,
  DocsFooter,
  DocsSidebar,
  mono,
} from "@/components/docs";

export const metadata: Metadata = {
  title: "MCP Server — Memory.Wiki",
  description:
    "MCP (Model Context Protocol) server for Memory.Wiki. Let Claude, Cursor, Windsurf, and other AI tools create and manage documents directly with 25 tools.",
  alternates: {
    canonical: "https://memory.wiki/docs/mcp",
    languages: { ko: "https://memory.wiki/ko/docs/mcp" },
  },
  openGraph: {
    title: "MCP Server — Memory.Wiki",
    description: "Let AI tools publish and manage documents on Memory.Wiki. 25 tools for Claude, Cursor, and Windsurf.",
    url: "https://memory.wiki/docs/mcp",
    images: [{ url: "/api/og?title=MCP%20Server", width: 1200, height: 630 }],
  },
};

function ParamRow({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
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
      <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>
        {name}
        {required && <span style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", marginLeft: 6, verticalAlign: "super" }}>REQUIRED</span>}
      </code>
      <span style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)" }}>{type}</span>
      <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

const sidebarItems = [
  { id: "what-is-mcp", label: "What is MCP" },
  { id: "claude-web", label: "Claude Web (Hosted)" },
  { id: "installation", label: "Local Installation" },
  { id: "claude-code", label: "Claude Code Setup" },
  { id: "claude-desktop", label: "Claude Desktop Setup" },
  { id: "cursor", label: "Cursor / Windsurf" },
  { id: "tools", label: "All 25 Tools" },
  { id: "mw-create", label: "mw_create" },
  { id: "mw-read", label: "mw_read" },
  { id: "mw-update", label: "mw_update" },
  { id: "mw-list", label: "mw_list" },
  { id: "mw-publish", label: "mw_publish" },
  { id: "mw-delete", label: "mw_delete" },
  { id: "examples", label: "Usage Examples" },
];

const tools = [
  {
    id: "mw-create",
    name: "mw_create",
    desc: "Create a new document from Markdown content. Returns the document URL, ID, and edit token.",
    params: [
      { name: "markdown", type: "string", required: true, desc: "The Markdown content." },
      { name: "title", type: "string", required: false, desc: "Document title." },
      { name: "isDraft", type: "boolean", required: false, desc: "Create as draft. Default: false." },
    ],
    example: `// In Claude Code:
"Publish this analysis as a document on Memory.Wiki"

// Claude calls mw_create:
{
  "markdown": "# Performance Analysis\\n...",
  "title": "Performance Analysis",
  "isDraft": false
}

// Returns:
{
  "url": "https://memory.wiki/abc123",
  "id": "abc123",
  "editToken": "tok_..."
}`,
  },
  {
    id: "mw-read",
    name: "mw_read",
    desc: "Fetch a document's content and metadata by ID.",
    params: [
      { name: "id", type: "string", required: true, desc: "Document ID." },
    ],
    example: `// "Read the document at memory.wiki/abc123"

// Claude calls mw_read:
{ "id": "abc123" }

// Returns full markdown content and metadata`,
  },
  {
    id: "mw-update",
    name: "mw_update",
    desc: "Update an existing document's content or title.",
    params: [
      { name: "id", type: "string", required: true, desc: "Document ID." },
      { name: "markdown", type: "string", required: false, desc: "New Markdown content." },
      { name: "title", type: "string", required: false, desc: "New title." },
      { name: "changeSummary", type: "string", required: false, desc: "Description of changes." },
    ],
    example: `// "Update the document with the revised version"

// Claude calls mw_update:
{
  "id": "abc123",
  "markdown": "# Revised Analysis\\n...",
  "changeSummary": "Added benchmarks section"
}`,
  },
  {
    id: "mw-list",
    name: "mw_list",
    desc: "List all documents owned by the authenticated user.",
    params: [],
    example: `// "Show me my published documents"

// Claude calls mw_list (no parameters)
// Returns array of documents with id, title, status`,
  },
  {
    id: "mw-publish",
    name: "mw_publish",
    desc: "Toggle a document between draft (private) and published (shared) state.",
    params: [
      { name: "id", type: "string", required: true, desc: "Document ID." },
      { name: "isDraft", type: "boolean", required: true, desc: "Set to true for draft, false for published." },
    ],
    example: `// "Make document abc123 public"

// Claude calls mw_publish:
{ "id": "abc123", "isDraft": false }`,
  },
  {
    id: "mw-delete",
    name: "mw_delete",
    desc: "Soft-delete a document. Can be restored by owner.",
    params: [
      { name: "id", type: "string", required: true, desc: "Document ID." },
    ],
    example: `// "Delete the old draft"

// Claude calls mw_delete:
{ "id": "abc123" }`,
  },
];

export default function McpDocsPage() {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <DocsNav />

      <div className="docs-layout">
        <DocsSidebar
          items={sidebarItems}
          currentPath="/docs/mcp"
        />

        {/* MAIN */}
        <main style={{ paddingTop: 40, paddingBottom: 80, minWidth: 0 }}>
          <p style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, fontFamily: mono }}>MCP</p>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 16px" }}>
            MCP Server
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 32, maxWidth: 640 }}>
            Let Claude, Cursor, Windsurf, and other AI tools create and manage documents on Memory.Wiki directly.
          </p>

          {/* Memory Layer intro */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--accent-dim)", borderRadius: 14, padding: "28px 24px", marginBottom: 40 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>
              The MCP-native memory layer for AI agents.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.7 }}>
              Read Memory.Wiki URLs as context today. Write memory back via MCP in Phase 2.
            </p>
            <div className="about-grid-2" style={{ gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", margin: "0 0 8px" }}>
                  Today <span className="live-badge">Live</span>
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                  <li style={{ padding: "3px 0" }}>Read Memory.Wiki URLs as AI context</li>
                  <li style={{ padding: "3px 0" }}>Document CRUD via 25 MCP tools</li>
                  <li style={{ padding: "3px 0" }}>Auto-source detection</li>
                </ul>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", margin: "0 0 8px" }}>
                  Coming <span className="coming-soon-badge">Q2 2026</span>
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, color: "var(--text-faint)" }}>
                  <li style={{ padding: "3px 0" }}>Memory write access</li>
                  <li style={{ padding: "3px 0" }}>Bundle deploy</li>
                  <li style={{ padding: "3px 0" }}>Multi-agent memory sharing</li>
                  <li style={{ padding: "3px 0" }}>Real-time bundle sync</li>
                </ul>
              </div>
            </div>
          </div>

          {/* What is MCP */}
          <SectionHeading id="what-is-mcp">What is MCP</SectionHeading>
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, margin: 0 }}>
              The <strong style={{ color: "var(--text-primary)" }}>Model Context Protocol (MCP)</strong> is an open standard
              that lets AI assistants interact with external tools and services. The Memory.Wiki MCP server exposes
              25 tools across 7 categories — core CRUD, append/prepend, section editing, sharing controls,
              version history, folders, and stats. The hosted endpoint at <InlineCode>{"https://memory.wiki/api/mcp"}</InlineCode> works
              with any MCP-compatible client (Claude Web, Cursor, etc.).
            </p>
          </Card>

          {/* Claude Web — Hosted */}
          <SectionHeading id="claude-web">Claude Web (Hosted MCP)</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Use Memory.Wiki directly in <strong style={{ color: "var(--text-primary)" }}>claude.ai</strong> via our hosted MCP endpoint — no local install required.
          </p>
          <Card>
            <SubLabel>Endpoint URL</SubLabel>
            <CodeBlock>{`https://memory.wiki/api/mcp`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 16, marginBottom: 8, lineHeight: 1.7 }}>
              In Claude.ai → <strong style={{ color: "var(--text-muted)" }}>Settings → Integrations / Connectors</strong> → Add custom MCP server → paste the URL above.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0, lineHeight: 1.7 }}>
              Same hosted endpoint works for any MCP-compatible client that supports remote HTTP MCP (Cursor, ChatGPT, Gemini, etc.).
            </p>
          </Card>

          {/* Installation */}
          <SectionHeading id="installation">Local Installation</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            For local stdio-based clients (Claude Desktop, Claude Code, Cursor stdio mode), install the npm package:
          </p>
          <Card>
            <CodeBlock lang="bash">{`npm install -g memory-wiki-cli && Memory.Wiki login`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 12, marginBottom: 0, lineHeight: 1.7 }}>
              The MCP server uses JWT authentication from <InlineCode>{"Memory.Wiki login"}</InlineCode>. No environment variables needed.
            </p>
          </Card>

          {/* Claude Code */}
          <SectionHeading id="claude-code">Claude Code Setup</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Add to <InlineCode>{".mcp.json"}</InlineCode> in your project root:
          </p>
          <Card>
            <CodeBlock lang="json">{`{
  "mcpServers": {
    "Memory.Wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}`}</CodeBlock>
          </Card>

          {/* Claude Desktop */}
          <SectionHeading id="claude-desktop">Claude Desktop Setup</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Add to <InlineCode>{"claude_desktop_config.json"}</InlineCode>:
          </p>
          <Card>
            <SubLabel>macOS</SubLabel>
            <p style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)", margin: "0 0 12px" }}>
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </p>
            <SubLabel>Windows</SubLabel>
            <p style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)", margin: "0 0 12px" }}>
              %APPDATA%\Claude\claude_desktop_config.json
            </p>
            <CodeBlock lang="json">{`{
  "mcpServers": {
    "Memory.Wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}`}</CodeBlock>
          </Card>

          {/* Cursor / Windsurf */}
          <SectionHeading id="cursor">Cursor / Windsurf</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Cursor and Windsurf both support MCP. Use the hosted HTTP endpoint or the npm package.
          </p>
          <Card>
            <SubLabel>Cursor — Settings → MCP → Add new global MCP server</SubLabel>
            <CodeBlock lang="json">{`{
  "mcpServers": {
    "Memory.Wiki": {
      "url": "https://memory.wiki/api/mcp"
    }
  }
}`}</CodeBlock>
          </Card>

          {/* Tools */}
          <SectionHeading id="tools">All 25 Tools</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            The hosted MCP exposes 25 tools across 8 categories.
            Auth happens via the user&apos;s Memory.Wiki session (no API keys).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 8, marginBottom: 24 }}>
            {[
              { cat: "Core CRUD", tools: ["mw_create", "mw_read", "mw_update", "mw_delete", "mw_list", "mw_search"] },
              { cat: "Append/Prepend", tools: ["mw_append", "mw_prepend"] },
              { cat: "Sections", tools: ["mw_outline", "mw_extract_section", "mw_replace_section"] },
              { cat: "Duplicate/Import", tools: ["mw_duplicate", "mw_import_url"] },
              { cat: "Sharing", tools: ["mw_publish", "mw_set_allowed_emails", "mw_get_share_url"] },
              { cat: "Versions", tools: ["mw_versions", "mw_restore_version", "mw_diff"] },
              { cat: "Stats/Folders", tools: ["mw_stats", "mw_recent", "mw_folder_list", "mw_folder_create", "mw_move_to_folder"] },
              { cat: "Render", tools: ["mw_render_preview"] },
            ].map((g) => (
              <div key={g.cat} style={{ background: "var(--surface)", padding: "12px 14px", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{g.cat}</div>
                {g.tools.map((t) => (
                  <code key={t} style={{ display: "block", fontSize: 12, fontFamily: mono, color: "var(--accent)", padding: "2px 0" }}>{t}</code>
                ))}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.7, marginBottom: 24 }}>
            Detailed parameters for the 6 core tools below. The other 19 follow the same pattern — the AI will autocomplete arguments from the tool descriptions when called.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
              gap: 12,
              marginBottom: 32,
            }}
          >
            {tools.map((tool) => (
              <a
                key={tool.name}
                href={`#${tool.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    background: "var(--surface)",
                    borderRadius: 10,
                    padding: "16px 18px",
                    height: "100%",
                  }}
                >
                  <code style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, color: "var(--accent)" }}>{tool.name}</code>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" }}>{tool.desc}</p>
                </div>
              </a>
            ))}
          </div>

          {/* Individual Tools */}
          {tools.map((tool) => (
            <div key={tool.id} id={tool.id} style={{ scrollMarginTop: 80, marginBottom: 32 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                <code style={{ fontFamily: mono, color: "var(--accent)" }}>{tool.name}</code>
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>{tool.desc}</p>
              <Card>
                {tool.params.length > 0 && (
                  <>
                    <SubLabel>Parameters</SubLabel>
                    <div style={{ marginBottom: 16 }}>
                      {tool.params.map((p) => (
                        <ParamRow key={p.name} name={p.name} type={p.type} required={p.required}>
                          {p.desc}
                        </ParamRow>
                      ))}
                    </div>
                  </>
                )}
                <SubLabel>Example</SubLabel>
                <CodeBlock>{tool.example}</CodeBlock>
              </Card>
            </div>
          ))}

          {/* Usage Examples */}
          <SectionHeading id="examples">Usage Examples</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <SubLabel>Publish a document</SubLabel>
              <CodeBlock>{`You: "Write a blog post about WebAssembly and publish it on Memory.Wiki"

Claude: I'll write the blog post and publish it for you.

[Claude writes the content, then calls mw_create]

Done! Your blog post is live at https://memory.wiki/abc123`}</CodeBlock>
            </Card>

            <Card>
              <SubLabel>Update with revisions</SubLabel>
              <CodeBlock>{`You: "Update the document at memory.wiki/abc123 - add a section about benchmarks"

Claude: I'll read the current document and add the benchmarks section.

[Claude calls mw_read, then mw_update with new content]

Updated! The document now includes the benchmarks section.`}</CodeBlock>
            </Card>

            <Card>
              <SubLabel>Manage documents</SubLabel>
              <CodeBlock>{`You: "Show me my recent documents and delete the old drafts"

Claude: Let me list your documents.

[Claude calls mw_list]

You have 5 documents:
1. "API Guide" (published) - updated 2h ago
2. "Draft notes" (draft) - updated 3d ago
3. "Old meeting notes" (draft) - updated 2w ago

Should I delete the old drafts (#2 and #3)?

You: "Yes"

[Claude calls mw_delete for each]

Done! Deleted 2 documents.`}</CodeBlock>
            </Card>
          </div>
        </main>
      </div>

      <DocsFooter breadcrumb="MCP Server" />
    </div>
  );
}
