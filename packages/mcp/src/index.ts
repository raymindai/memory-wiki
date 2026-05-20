import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ─── Config ───

const BASE_URL = (process.env.MDFY_BASE_URL || "https://memory.wiki").replace(/\/$/, "");
const MDFY_DIR = join(homedir(), ".memory.wiki");
const CONFIG_FILE = join(MDFY_DIR, "config.json");
const TOKEN_FILE = join(MDFY_DIR, "tokens.json");

// ─── Auth (JWT from `Memory.Wiki login`) ───

interface MdfyConfig {
  token?: string;
  userId?: string;
  email?: string;
}

function loadConfig(): MdfyConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function getAuthHeaders(): Record<string, string> {
  const config = loadConfig();
  const headers: Record<string, string> = {};
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  if (config.userId) headers["x-user-id"] = config.userId;
  return headers;
}

function isLoggedIn(): boolean {
  const config = loadConfig();
  return !!(config.token);
}

function getUserId(): string | undefined {
  return loadConfig().userId;
}

// ─── Edit Token Store ───

function loadTokens(): Record<string, string> {
  try {
    if (existsSync(TOKEN_FILE)) {
      return JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function saveToken(docId: string, editToken: string): void {
  if (!existsSync(MDFY_DIR)) mkdirSync(MDFY_DIR, { recursive: true });
  const tokens = loadTokens();
  tokens[docId] = editToken;
  const tmpFile = TOKEN_FILE + `.tmp.${process.pid}`;
  writeFileSync(tmpFile, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  renameSync(tmpFile, TOKEN_FILE);
}

function getToken(docId: string): string | undefined {
  return loadTokens()[docId];
}

// ─── API Helper ───

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Authentication expired. Run 'Memory.Wiki login' in your terminal to re-authenticate."
      );
    }
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response from ${path}: ${text.slice(0, 200)}`);
  }
}

// Error wrapper for tool handlers
function errorResult(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function loginRequiredResult() {
  return {
    content: [{
      type: "text" as const,
      text: "Not logged in. Run `Memory.Wiki login` in your terminal first to authenticate with Memory.Wiki.",
    }],
    isError: true as const,
  };
}

// ─── Heading / section helpers (local — no API roundtrip needed) ───

interface Section { heading: string; level: number; start: number; end: number; }

function parseHeadings(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      sections.push({ heading: m[2].trim(), level: m[1].length, start: i, end: lines.length });
    }
  }
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      if (sections[j].level <= sections[i].level) {
        sections[i].end = sections[j].start;
        break;
      }
    }
  }
  return sections;
}

function findSection(markdown: string, heading: string): Section | null {
  const target = heading.trim().toLowerCase();
  return parseHeadings(markdown).find((s) => s.heading.toLowerCase() === target) || null;
}

// ─── Doc fetch helper (used by edit-then-save tools) ───

interface DocRecord {
  id: string;
  markdown: string;
  title: string | null;
  updated_at: string;
  is_draft: boolean;
  view_count?: number;
  created_at?: string;
  expires_at?: string | null;
  allowed_emails?: string[] | null;
  password_hash?: string | null;
}

async function fetchDoc(id: string): Promise<DocRecord> {
  return api<DocRecord>(`/api/docs/${encodeURIComponent(id)}`);
}

// ─── MCP Server ───

const server = new McpServer({
  name: "Memory.Wiki",
  version: "1.4.0",
});

// ──────────────────────────────────────────────────────────────────
// CRUD (existing core 6)
// ──────────────────────────────────────────────────────────────────

server.tool(
  "mdfy_create",
  "Create a new Markdown document on Memory.Wiki and get a shareable URL",
  {
    markdown: z.string().describe("Markdown content for the document"),
    title: z.string().optional().describe("Document title (extracted from H1 if omitted)"),
    draft: z.boolean().optional().describe("If true, document is private. If false, publicly accessible. Default: true (private)"),
  },
  async ({ markdown, title, draft }) => {
    const isDraft = draft ?? true;
    try {
      const result = await api<{ id: string; editToken: string }>("/api/docs", {
        method: "POST",
        body: JSON.stringify({ markdown, title, isDraft, source: "mcp" }),
      });
      saveToken(result.id, result.editToken);
      const url = `${BASE_URL}/${result.id}`;
      return textResult(
        `Document created:\n- URL: ${url}\n- ID: ${result.id}\n- Status: ${isDraft ? "private draft" : "publicly accessible"}`
      );
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_read",
  "Fetch a document's markdown content from Memory.Wiki",
  { id: z.string().describe("Document ID (the short code from the URL)") },
  async ({ id }) => {
    try {
      const doc = await fetchDoc(id);
      return textResult(`# ${doc.title || "Untitled"}\n\n${doc.markdown}`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_update",
  "Update an existing document's content on Memory.Wiki",
  {
    id: z.string().describe("Document ID"),
    markdown: z.string().describe("New markdown content"),
    title: z.string().optional().describe("New title"),
  },
  async ({ id, markdown, title }) => {
    try {
      const editToken = getToken(id) || "";
      await api(`/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ markdown, title, editToken, action: "auto-save" }),
      });
      return textResult(`Document ${id} updated successfully.`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_list",
  "List all documents owned by the current user on Memory.Wiki",
  {},
  async () => {
    if (!isLoggedIn()) return loginRequiredResult();
    try {
      const data = await api<{ documents: Array<{ id: string; title: string | null; updated_at: string; is_draft: boolean; view_count: number }> }>(
        "/api/user/documents"
      );
      const docs = data.documents || [];
      if (docs.length === 0) return textResult("No documents found.");
      const lines = docs.map((d, i) =>
        `${i + 1}. ${d.title || "Untitled"} (${d.id}) — ${d.is_draft ? "private" : "shared"} — ${d.view_count} views — ${d.updated_at}`
      );
      return textResult(`Found ${docs.length} documents:\n\n${lines.join("\n")}`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_delete",
  "Delete a document from Memory.Wiki (moves to trash, can be restored)",
  {
    id: z.string().describe("Document ID to delete"),
    permanent: z.boolean().optional().describe("If true, permanently delete (default: false = soft delete / trash)"),
  },
  async ({ id, permanent }) => {
    try {
      const editToken = getToken(id) || "";
      if (permanent) {
        await api(`/api/docs/${encodeURIComponent(id)}`, {
          method: "DELETE",
          body: JSON.stringify({ editToken }),
        });
      } else {
        await api(`/api/docs/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "soft-delete", editToken }),
        });
      }
      return textResult(permanent ? `Document ${id} permanently deleted.` : `Document ${id} moved to trash.`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_search",
  "Search your documents on Memory.Wiki by keyword (full-text search)",
  { query: z.string().describe("Search query (keywords to find in your documents)") },
  async ({ query }) => {
    if (!isLoggedIn()) return loginRequiredResult();
    try {
      const data = await api<{ results: Array<{ id: string; title: string; snippet: string; isDraft: boolean; viewCount: number; source: string | null; updatedAt: string }> }>(
        `/api/search?q=${encodeURIComponent(query)}`
      );
      const results = data.results || [];
      if (results.length === 0) return textResult(`No documents found matching "${query}".`);
      const lines = results.map((r, i) =>
        `${i + 1}. **${r.title}** (${r.id}) — ${r.isDraft ? "private" : "shared"} — ${r.viewCount} views — ${r.updatedAt}\n   ${r.snippet}`
      );
      return textResult(`Found ${results.length} document(s) matching "${query}":\n\n${lines.join("\n\n")}`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_hub_constellation",
  "Get the user's hub as a structured graph (concept nodes + typed edges + doc clusters). " +
    "Use this when an answer needs to navigate the user's knowledge by relationship — e.g. " +
    "'what depends on X', 'which docs cover X and Y together', 'what's at the center of this hub'. " +
    "URL-fetch (memory.wiki/hub/<slug>) gives the same data rendered as markdown; this returns the " +
    "underlying JSON so you can traverse it programmatically.",
  {
    limit_concepts: z.number().int().min(1).max(200).optional()
      .describe("Cap on concept nodes returned, ordered by weight (default 60)."),
    include_docs: z.boolean().optional()
      .describe("Include per-doc nodes alongside concepts (default true)."),
  },
  async ({ limit_concepts, include_docs }) => {
    if (!isLoggedIn()) return loginRequiredResult();
    try {
      type Node = {
        id: string;
        label: string;
        kind: "concept" | "entity" | "tag" | "doc";
        weight: number;
        description?: string | null;
        occurrence?: number;
        createdAt: string;
        docIds?: string[];
        bundleId?: string | null;
        intent?: string | null;
      };
      type Edge = {
        id: string;
        source: string;
        target: string;
        kind: "concept_doc" | "concept_concept";
        weight: number;
        label?: string;
      };
      const data = await api<{ nodes: Node[]; edges: Edge[] }>("/api/user/hub/constellation");
      const allNodes = data.nodes || [];
      const allEdges = data.edges || [];
      const conceptCap = limit_concepts ?? 60;
      const wantDocs = include_docs !== false;

      const concepts = allNodes
        .filter((n) => n.kind !== "doc")
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .slice(0, conceptCap);
      const conceptIdSet = new Set(concepts.map((c) => c.id));
      const docs = wantDocs ? allNodes.filter((n) => n.kind === "doc") : [];

      // Only emit edges whose endpoints survive the cap so the LLM can
      // resolve every reference without re-fetching.
      const visibleIds = new Set<string>([...conceptIdSet, ...docs.map((d) => d.id)]);
      const edges = allEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

      const payload = {
        meta: {
          total_concepts: allNodes.filter((n) => n.kind !== "doc").length,
          returned_concepts: concepts.length,
          total_docs: allNodes.filter((n) => n.kind === "doc").length,
          returned_docs: docs.length,
          total_edges: allEdges.length,
          returned_edges: edges.length,
          generated_at: new Date().toISOString(),
        },
        concepts: concepts.map((c) => ({
          id: c.id,
          label: c.label,
          kind: c.kind,
          weight: c.weight,
          occurrence: c.occurrence,
          description: c.description || undefined,
          docIds: c.docIds || undefined,
          createdAt: c.createdAt,
        })),
        docs: docs.map((d) => ({
          id: d.id,
          label: d.label,
          bundleId: d.bundleId || undefined,
          intent: d.intent || undefined,
          createdAt: d.createdAt,
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
          kind: e.kind,
          weight: e.weight,
          label: e.label || undefined,
        })),
      };
      return textResult(JSON.stringify(payload, null, 2));
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_bundle_constellation",
  "Get a single bundle as a structured concept graph (nodes + edges) scoped to " +
    "the concepts whose docs are bundle members. Returns the same shape as " +
    "mdfy_hub_constellation but bounded to one bundle — use this when an answer " +
    "needs to reason within a curated set, e.g. 'how do the ideas in this bundle " +
    "connect', 'which concept is central to this bundle'. URL-fetch " +
    "(memory.wiki/b/<id>) gives you the LLM-extracted graph_data narrative; this " +
    "returns the user's hub-level ontology sliced to the bundle's docs.",
  {
    bundle_id: z.string().describe("Bundle ID (the part after memory.wiki/b/)"),
  },
  async ({ bundle_id }) => {
    if (!isLoggedIn()) return loginRequiredResult();
    try {
      type Node = {
        id: string;
        label: string;
        kind: "concept" | "entity" | "tag" | "doc";
        weight: number;
        description?: string | null;
        occurrence?: number | null;
        docIds?: string[];
        createdAt: string;
      };
      type Edge = {
        id: string;
        source: string;
        target: string;
        kind: "concept_doc" | "concept_concept";
        weight: number;
        label?: string | null;
      };
      const data = await api<{
        bundleId: string;
        nodes: Node[];
        edges: Edge[];
        counts: { concepts: number; docs: number; edges: number; cappedConcepts: boolean };
        note?: string;
      }>(`/api/bundles/${encodeURIComponent(bundle_id)}/constellation`);
      return textResult(JSON.stringify(data, null, 2));
    } catch (err) { return errorResult(err); }
  }
);

// ──────────────────────────────────────────────────────────────────
// Append / Prepend
// ──────────────────────────────────────────────────────────────────

server.tool(
  "mdfy_append",
  "Append content to the end of an existing document",
  {
    id: z.string().describe("Document ID"),
    content: z.string().describe("Markdown content to append"),
    separator: z.string().optional().describe("Separator between existing content and new (default: \\n\\n)"),
  },
  async ({ id, content, separator }) => {
    try {
      const doc = await fetchDoc(id);
      const sep = separator ?? "\n\n";
      const newMd = doc.markdown + sep + content;
      const editToken = getToken(id) || "";
      await api(`/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ markdown: newMd, editToken, action: "auto-save" }),
      });
      return textResult(`Appended ${content.length} chars to ${id}.`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_prepend",
  "Prepend content to the beginning of a document",
  {
    id: z.string().describe("Document ID"),
    content: z.string().describe("Markdown content to prepend"),
  },
  async ({ id, content }) => {
    try {
      const doc = await fetchDoc(id);
      const newMd = content + "\n\n" + doc.markdown;
      const editToken = getToken(id) || "";
      await api(`/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ markdown: newMd, editToken, action: "auto-save" }),
      });
      return textResult(`Prepended ${content.length} chars to ${id}.`);
    } catch (err) { return errorResult(err); }
  }
);

// ──────────────────────────────────────────────────────────────────
// Outline / sections — parsing happens locally, no extra roundtrip
// ──────────────────────────────────────────────────────────────────

server.tool(
  "mdfy_outline",
  "Get the heading-based outline (table of contents) of a document",
  { id: z.string().describe("Document ID") },
  async ({ id }) => {
    try {
      const doc = await fetchDoc(id);
      const sections = parseHeadings(doc.markdown);
      if (sections.length === 0) return textResult(`Document "${doc.title || "Untitled"}" has no headings.`);
      const outline = sections
        .map((s) => `${"  ".repeat(s.level - 1)}- ${s.heading} (lines ${s.start + 1}-${s.end})`)
        .join("\n");
      return textResult(`# ${doc.title || "Untitled"}\n\n${outline}`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_extract_section",
  "Extract a specific section by heading text",
  {
    id: z.string().describe("Document ID"),
    heading: z.string().describe("Exact heading text (case-insensitive)"),
  },
  async ({ id, heading }) => {
    try {
      const doc = await fetchDoc(id);
      const section = findSection(doc.markdown, heading);
      if (!section) return errorResult(`Section "${heading}" not found`);
      const lines = doc.markdown.split("\n").slice(section.start, section.end);
      return textResult(lines.join("\n"));
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_replace_section",
  "Replace the content of a section identified by heading",
  {
    id: z.string().describe("Document ID"),
    heading: z.string().describe("Heading of section to replace"),
    newContent: z.string().describe("New content (include the heading line if you want to keep it)"),
  },
  async ({ id, heading, newContent }) => {
    try {
      const doc = await fetchDoc(id);
      const section = findSection(doc.markdown, heading);
      if (!section) return errorResult(`Section "${heading}" not found`);
      const lines = doc.markdown.split("\n");
      const newLines = [...lines.slice(0, section.start), ...newContent.split("\n"), ...lines.slice(section.end)];
      const newMd = newLines.join("\n");
      const editToken = getToken(id) || "";
      await api(`/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ markdown: newMd, editToken, action: "auto-save" }),
      });
      return textResult(`Section "${heading}" replaced in ${id}.`);
    } catch (err) { return errorResult(err); }
  }
);

// ──────────────────────────────────────────────────────────────────
// Duplicate / Import
// ──────────────────────────────────────────────────────────────────

server.tool(
  "mdfy_duplicate",
  "Duplicate an existing document under a new ID",
  {
    id: z.string().describe("Source document ID"),
    title: z.string().optional().describe("New title (defaults to 'Copy of <original>')"),
  },
  async ({ id, title }) => {
    try {
      const src = await fetchDoc(id);
      const newTitle = title || `Copy of ${src.title || "Untitled"}`;
      const result = await api<{ id: string; editToken: string }>("/api/docs", {
        method: "POST",
        body: JSON.stringify({ markdown: src.markdown, title: newTitle, isDraft: true, source: "mcp" }),
      });
      saveToken(result.id, result.editToken);
      return textResult(`Duplicated ${id} → ${result.id}\nURL: ${BASE_URL}/${result.id}`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_import_url",
  "Fetch a webpage and import it as a new Memory.Wiki document",
  {
    url: z.string().describe("URL to fetch"),
    title: z.string().optional().describe("Document title (extracted from <title> if omitted)"),
  },
  async ({ url, title }) => {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "mdfy-mcp/1.4.0" } });
      if (!res.ok) return errorResult(`HTTP ${res.status} fetching ${url}`);
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const docTitle = title || titleMatch?.[1].trim() || url;
      // Strip tags for a coarse markdown approximation. The server-side
      // import tool does a richer conversion; stdio keeps it minimal to
      // avoid pulling Turndown into the MCP package.
      const text = html
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const markdown = `# ${docTitle}\n\n> Source: ${url}\n\n${text}`;
      const result = await api<{ id: string; editToken: string }>("/api/docs", {
        method: "POST",
        body: JSON.stringify({ markdown, title: docTitle, isDraft: true, source: "mcp" }),
      });
      saveToken(result.id, result.editToken);
      return textResult(`Imported ${url}\n→ ${BASE_URL}/${result.id}\nID: ${result.id}\nLength: ${markdown.length} chars`);
    } catch (err) { return errorResult(err); }
  }
);

// ──────────────────────────────────────────────────────────────────
// Sharing controls
// ──────────────────────────────────────────────────────────────────

server.tool(
  "mdfy_publish",
  "Toggle a document between public (shared) and private (draft) on Memory.Wiki",
  {
    id: z.string().describe("Document ID"),
    published: z.boolean().describe("true = make publicly accessible, false = make private"),
  },
  async ({ id, published }) => {
    try {
      const editToken = getToken(id) || "";
      await api(`/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: published ? "publish" : "unpublish", editToken }),
      });
      return textResult(
        published
          ? `Document ${id} is now publicly accessible at ${BASE_URL}/${id}`
          : `Document ${id} is now private (draft).`
      );
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_set_allowed_emails",
  "Restrict access to specific emails (allowlist)",
  {
    id: z.string().describe("Document ID"),
    emails: z.array(z.string()).describe("Email addresses (empty array removes restriction)"),
  },
  async ({ id, emails }) => {
    const userId = getUserId();
    if (!userId) return loginRequiredResult();
    try {
      await api(`/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "set-allowed-emails", userId, allowedEmails: emails }),
      });
      return textResult(
        emails.length > 0
          ? `Restricted ${id} to ${emails.length} email(s): ${emails.join(", ")}.`
          : `Restriction removed from ${id} — anyone with the link can view.`
      );
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_set_expiry",
  "Set or clear expiration time on a document",
  {
    id: z.string().describe("Document ID"),
    expiresInHours: z.number().nullable().describe("Hours from now until the doc expires; pass null to clear"),
  },
  async ({ id, expiresInHours }) => {
    const userId = getUserId();
    if (!userId) return loginRequiredResult();
    try {
      const res = await api<{ expires_at: string | null }>(`/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "set-expiry", userId, expiresInHours }),
      });
      return textResult(
        res.expires_at ? `Document ${id} expires at ${res.expires_at}.` : `Expiry cleared on ${id}.`
      );
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_get_share_url",
  "Get the share URL and access metadata for a document",
  { id: z.string().describe("Document ID") },
  async ({ id }) => {
    try {
      const doc = await fetchDoc(id);
      const lines = [
        `URL: ${BASE_URL}/${id}`,
        `Title: ${doc.title || "Untitled"}`,
        `Status: ${doc.is_draft ? "private draft" : "publicly accessible"}`,
        `Password: ${doc.password_hash ? "yes" : "no"}`,
        `Expires: ${doc.expires_at || "never"}`,
        `Allowed emails: ${doc.allowed_emails && doc.allowed_emails.length ? doc.allowed_emails.join(", ") : "anyone with the link"}`,
        `Views: ${doc.view_count || 0}`,
      ];
      return textResult(lines.join("\n"));
    } catch (err) { return errorResult(err); }
  }
);

// ──────────────────────────────────────────────────────────────────
// Versions
// ──────────────────────────────────────────────────────────────────

interface VersionRow {
  id: string;
  version_number: number;
  change_summary: string | null;
  created_at: string;
  byte_size: number;
}

server.tool(
  "mdfy_versions",
  "List version history of a document",
  { id: z.string().describe("Document ID") },
  async ({ id }) => {
    try {
      const data = await api<{ versions: VersionRow[] }>(`/api/docs/${encodeURIComponent(id)}/versions`);
      const versions = data.versions || [];
      if (versions.length === 0) return textResult(`No version history for ${id}.`);
      const lines = versions.map((v) =>
        `v${v.version_number} (${v.id.slice(0, 8)}) — ${v.created_at} — ${v.byte_size}b — ${v.change_summary || "no summary"}`
      );
      return textResult(`${versions.length} version(s):\n\n${lines.join("\n")}`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_restore_version",
  "Restore a document to a previous version",
  {
    id: z.string().describe("Document ID"),
    versionId: z.string().describe("Version ID to restore (from mdfy_versions output)"),
  },
  async ({ id, versionId }) => {
    try {
      const v = await api<{ markdown: string; title: string | null }>(
        `/api/docs/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`
      );
      if (!v.markdown) return errorResult("Version content empty or not found");
      const editToken = getToken(id) || "";
      await api(`/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ markdown: v.markdown, title: v.title, editToken, action: "auto-save" }),
      });
      return textResult(`Restored ${id} to version ${versionId}.`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_diff",
  "Show diff between two versions of a document (line-level)",
  {
    id: z.string().describe("Document ID"),
    fromVersionId: z.string().describe("Older version ID"),
    toVersionId: z.string().describe("Newer version ID"),
  },
  async ({ id, fromVersionId, toVersionId }) => {
    try {
      const [a, b] = await Promise.all([
        api<{ markdown: string }>(`/api/docs/${encodeURIComponent(id)}/versions/${encodeURIComponent(fromVersionId)}`),
        api<{ markdown: string }>(`/api/docs/${encodeURIComponent(id)}/versions/${encodeURIComponent(toVersionId)}`),
      ]);
      const linesA = (a.markdown || "").split("\n");
      const linesB = (b.markdown || "").split("\n");
      const out: string[] = [];
      const max = Math.max(linesA.length, linesB.length);
      for (let i = 0; i < max; i++) {
        if (linesA[i] === linesB[i]) continue;
        if (linesA[i] !== undefined) out.push(`- ${linesA[i]}`);
        if (linesB[i] !== undefined) out.push(`+ ${linesB[i]}`);
      }
      return textResult(out.length === 0 ? "No differences." : "```diff\n" + out.join("\n") + "\n```");
    } catch (err) { return errorResult(err); }
  }
);

// ──────────────────────────────────────────────────────────────────
// Stats / Recent
// ──────────────────────────────────────────────────────────────────

server.tool(
  "mdfy_stats",
  "Get view stats and metadata for a document",
  { id: z.string().describe("Document ID") },
  async ({ id }) => {
    try {
      const doc = await fetchDoc(id);
      const lines = [
        `Title: ${doc.title || "Untitled"}`,
        `Status: ${doc.is_draft ? "draft" : "shared"}`,
        `Views: ${doc.view_count || 0}`,
        `Created: ${doc.created_at || "unknown"}`,
        `Last updated: ${doc.updated_at}`,
        `URL: ${BASE_URL}/${id}`,
      ];
      return textResult(lines.join("\n"));
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_recent",
  "List recently visited documents (requires login)",
  {},
  async () => {
    if (!isLoggedIn()) return loginRequiredResult();
    try {
      const data = await api<{ visits: Array<{ document_id: string; last_visited_at: string; documents: { id: string; title: string | null; updated_at: string } | null }> }>(
        "/api/user/recent"
      );
      const visits = data.visits || [];
      if (visits.length === 0) return textResult("No recent visits.");
      const lines = visits.map((v, i) => {
        const title = v.documents?.title || "Untitled";
        return `${i + 1}. ${title} (${v.document_id}) — visited ${v.last_visited_at}`;
      });
      return textResult(`Recent visits:\n\n${lines.join("\n")}`);
    } catch (err) { return errorResult(err); }
  }
);

// ──────────────────────────────────────────────────────────────────
// Folders
// ──────────────────────────────────────────────────────────────────

server.tool(
  "mdfy_folder_list",
  "List your folders (requires login)",
  {},
  async () => {
    if (!isLoggedIn()) return loginRequiredResult();
    try {
      const data = await api<{ folders: Array<{ id: string; name: string; parent_id: string | null; created_at: string }> }>(
        "/api/user/folders"
      );
      const folders = data.folders || [];
      if (folders.length === 0) return textResult("No folders.");
      const lines = folders.map((f) =>
        `- ${f.name} (${f.id})${f.parent_id ? ` [parent: ${f.parent_id}]` : ""}`
      );
      return textResult(`${folders.length} folder(s):\n\n${lines.join("\n")}`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_folder_create",
  "Create a new folder (requires login)",
  {
    name: z.string().describe("Folder name"),
    parentId: z.string().optional().describe("Parent folder ID for nesting"),
  },
  async ({ name, parentId }) => {
    if (!isLoggedIn()) return loginRequiredResult();
    try {
      const result = await api<{ id: string; name: string }>("/api/user/folders", {
        method: "POST",
        body: JSON.stringify({ name, parentId: parentId || null }),
      });
      return textResult(`Folder "${result.name}" created (${result.id}).`);
    } catch (err) { return errorResult(err); }
  }
);

server.tool(
  "mdfy_move_to_folder",
  "Move a document into a folder (or remove from folder by passing null)",
  {
    documentId: z.string().describe("Document ID to move"),
    folderId: z.string().nullable().describe("Folder ID, or null to remove from folder"),
  },
  async ({ documentId, folderId }) => {
    const userId = getUserId();
    if (!userId) return loginRequiredResult();
    try {
      await api(`/api/docs/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "move-to-folder", folderId, userId }),
      });
      return textResult(
        folderId ? `Moved ${documentId} → folder ${folderId}.` : `Removed ${documentId} from folder.`
      );
    } catch (err) { return errorResult(err); }
  }
);

// ──────────────────────────────────────────────────────────────────
// Render preview (utility — no API roundtrip)
// ──────────────────────────────────────────────────────────────────

server.tool(
  "mdfy_render_preview",
  "Get a preview-friendly hint for unsaved markdown. For a permanent rendered URL, use mdfy_create with draft=true instead.",
  { markdown: z.string().describe("Markdown content (passed for client-side analysis, not sent to Memory.Wiki)") },
  async ({ markdown }) => {
    const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
    const headingCount = (markdown.match(/^#{1,6}\s/gm) || []).length;
    const codeBlockCount = (markdown.match(/^```/gm) || []).length / 2;
    const hasMath = /\$\$[\s\S]+?\$\$|(?:^|[^\\$])\$[^$\n]+?\$/.test(markdown);
    const hasMermaid = /```mermaid/.test(markdown);
    const lines = [
      `Preview analysis (${markdown.length} chars, ${wordCount} words):`,
      `- Headings: ${headingCount}`,
      `- Code blocks: ${Math.floor(codeBlockCount)}`,
      `- Math: ${hasMath ? "yes" : "no"}`,
      `- Mermaid diagrams: ${hasMermaid ? "yes" : "no"}`,
      ``,
      `For a permanent rendered URL, call mdfy_create with draft=true. Paste the URL in any browser or AI tool to view.`,
    ];
    return textResult(lines.join("\n"));
  }
);

// ─── Start ───

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
