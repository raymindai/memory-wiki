import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { findRecentDuplicateDoc, isStrictDupLockError } from "@/lib/doc-dedup";

// ─── Helpers ───

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://memory.wiki";

function errorResult(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// sha256Base64 helper removed alongside mdfy_set_password — no other
// callers needed it.

// Strip HTML tags + decode entities → plaintext markdown-ish
function htmlToMarkdownLite(html: string): string {
  let s = html;
  // Remove script/style entirely
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Headings
  for (let i = 6; i >= 1; i--) {
    const re = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)</h${i}>`, "gi");
    s = s.replace(re, (_, inner) => `\n\n${"#".repeat(i)} ${inner.replace(/<[^>]+>/g, "").trim()}\n\n`);
  }
  // Links
  s = s.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => `[${txt.replace(/<[^>]+>/g, "").trim()}](${href})`);
  // Code blocks
  s = s.replace(/<pre[^>]*>[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi, (_, code) => `\n\n\`\`\`\n${code.replace(/<[^>]+>/g, "")}\n\`\`\`\n\n`);
  // Inline code
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${c.replace(/<[^>]+>/g, "")}\``);
  // Bold/italic
  s = s.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  s = s.replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  // List items
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `- ${inner.replace(/<[^>]+>/g, "").trim()}\n`);
  // Paragraphs
  s = s.replace(/<\/?p[^>]*>/gi, "\n\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, "");
  // Decode common entities
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Collapse whitespace
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

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
  // compute end of each section as start of next same-or-higher-level heading
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
  const sections = parseHeadings(markdown);
  const target = heading.trim().toLowerCase();
  return sections.find((s) => s.heading.toLowerCase() === target) || null;
}

// ─── MCP Server ───

function createMcpServer(userId?: string) {
  const server = new McpServer({ name: "mdfy", version: "1.4.0" });
  const supabase = getSupabaseClient();
  const requireDb = () => supabase ?? null;

  // ─── Core CRUD ───

  server.tool(
    "mdfy_create",
    "Create a new Markdown document on memory.wiki and get a shareable URL",
    {
      markdown: z.string().describe("Markdown content"),
      title: z.string().optional().describe("Document title"),
      draft: z.boolean().optional().describe("If true, private. Default: true"),
    },
    async ({ markdown, title, draft }) => {
      if (!supabase) return errorResult("Storage not configured");
      const isDraft = draft ?? true;
      // mdfy_create is an import-time write, so body mutation here is
      // explicit (not a silent autosave side-effect): if the body has
      // no H1 and the caller supplied a title, prepend it as H1 so
      // the new doc has a proper heading. Otherwise the body is
      // stored verbatim and the title falls out of extractTitleFromMd.
      const { extractTitleFromMd } = await import("@/lib/extract-title");
      let storedMarkdown = markdown;
      const detectedH1 = extractTitleFromMd(markdown);
      if ((!detectedH1 || detectedH1 === "Untitled") && title && title.trim()) {
        storedMarkdown = `# ${title.trim()}\n\n${markdown}`;
      }
      const storedTitle: string = extractTitleFromMd(storedMarkdown);
      // 30s same-content dedup so an MCP client that retries on transient
      // error (or an LLM that calls mdfy_create twice for the same output)
      // doesn't pile up a sibling row.
      const dupHit = await findRecentDuplicateDoc(
        supabase,
        { userId },
        storedMarkdown,
        storedTitle,
      );
      if (dupHit) {
        return textResult(`Document already exists (deduplicated):\n- URL: ${BASE_URL}/${dupHit.id}\n- ID: ${dupHit.id}`);
      }
      const id = nanoid(8);
      const editToken = nanoid(32);
      const { error } = await supabase.from("documents").insert({
        id, markdown: storedMarkdown, title: storedTitle,
        edit_token: editToken,
        user_id: userId || null,
        edit_mode: userId ? "account" : "token",
        is_draft: isDraft, source: "mcp",
      });
      if (error) {
        if (isStrictDupLockError(error)) {
          // Race lost — return the existing identical doc.
          const survivor = await findRecentDuplicateDoc(supabase, { userId }, storedMarkdown, storedTitle);
          if (survivor) {
            return textResult(`Document already exists (deduplicated):\n- URL: ${BASE_URL}/${survivor.id}\n- ID: ${survivor.id}`);
          }
        }
        return errorResult(`Failed to create: ${error.message}`);
      }
      // Background ontology refresh so MCP-created docs flow into the
      // hub's concept index just like web-created ones. Fire-and-forget.
      if (userId) {
        const ownerId = userId;
        const docId = id;
        const docTitle = storedTitle;
        const docMarkdown = storedMarkdown;
        void (async () => {
          try {
            const { enqueueOntologyRefresh } = await import("@/lib/ontology-refresh");
            await enqueueOntologyRefresh({
              supabase,
              userId: ownerId,
              docId,
              title: docTitle,
              markdown: docMarkdown,
            });
          } catch (err) {
            console.warn("Ontology refresh failed (mcp create):", err);
          }
        })();
      }
      return textResult(`Document created:\n- URL: ${BASE_URL}/${id}\n- ID: ${id}\n- Status: ${isDraft ? "private draft" : "publicly accessible"}`);
    }
  );

  server.tool(
    "mdfy_read",
    "Fetch a document's markdown content",
    { id: z.string().describe("Document ID") },
    async ({ id }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("documents").select("markdown, title").eq("id", id).single();
      if (error || !data) return errorResult("Document not found");
      return textResult(`# ${data.title || "Untitled"}\n\n${data.markdown}`);
    }
  );

  server.tool(
    "mdfy_update",
    "Update an existing document's content or title",
    {
      id: z.string().describe("Document ID"),
      markdown: z.string().describe("New markdown content"),
      title: z.string().optional(),
    },
    async ({ id, markdown, title }) => {
      if (!supabase) return errorResult("Storage not configured");
      // mdfy_update is a content replacement — we do NOT silently
      // mutate the body. If the caller passes a body without H1 plus
      // an explicit `title` argument, treat that as intent to set a
      // heading and prepend it once. Otherwise the body wins.
      const { extractTitleFromMd } = await import("@/lib/extract-title");
      let storedMarkdown = markdown;
      const detectedH1 = extractTitleFromMd(markdown);
      if ((!detectedH1 || detectedH1 === "Untitled") && title && title.trim()) {
        storedMarkdown = `# ${title.trim()}\n\n${markdown}`;
      }
      const storedTitle: string = extractTitleFromMd(storedMarkdown);
      const update: Record<string, unknown> = {
        markdown: storedMarkdown,
        title: storedTitle,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("documents").update(update).eq("id", id);
      if (error) return errorResult(`Failed: ${error.message}`);
      if (userId) {
        const ownerId = userId;
        const docId = id;
        const docTitle = storedTitle || null;
        const docMarkdown = storedMarkdown;
        void (async () => {
          try {
            const { enqueueOntologyRefresh } = await import("@/lib/ontology-refresh");
            await enqueueOntologyRefresh({
              supabase,
              userId: ownerId,
              docId,
              title: docTitle,
              markdown: docMarkdown,
            });
          } catch (err) {
            console.warn("Ontology refresh failed (mcp update):", err);
          }
        })();
      }
      return textResult(`Document ${id} updated.`);
    }
  );

  server.tool(
    "mdfy_delete",
    "Delete a document",
    { id: z.string().describe("Document ID") },
    async ({ id }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) return errorResult(`Failed: ${error.message}`);
      return textResult(`Document ${id} deleted.`);
    }
  );

  server.tool(
    "mdfy_list",
    "List documents owned by current user",
    {},
    async () => {
      if (!userId) return errorResult("Not authenticated");
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("documents")
        .select("id, title, updated_at, is_draft, view_count")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }).limit(50);
      if (error) return errorResult(error.message);
      const docs = data || [];
      if (docs.length === 0) return textResult("No documents.");
      return textResult(`${docs.length} documents:\n\n` + docs.map((d, i) =>
        `${i + 1}. ${d.title || "Untitled"} (${d.id}) — ${d.is_draft ? "private" : "shared"} — ${d.view_count} views`
      ).join("\n"));
    }
  );

  server.tool(
    "mdfy_search",
    "Full-text search through your documents",
    { query: z.string().describe("Search query") },
    async ({ query }) => {
      if (!userId) return errorResult("Not authenticated");
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("documents")
        .select("id, title, markdown, is_draft, updated_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .or(`title.ilike.%${query}%,markdown.ilike.%${query}%`)
        .order("updated_at", { ascending: false }).limit(20);
      if (error) return errorResult(error.message);
      const results = data || [];
      if (results.length === 0) return textResult(`No results for "${query}".`);
      return textResult(`${results.length} result(s):\n\n` + results.map((r, i) => {
        const snippet = r.markdown.slice(0, 100).replace(/\n/g, " ");
        return `${i + 1}. **${r.title || "Untitled"}** (${r.id})\n   ${snippet}...`;
      }).join("\n\n"));
    }
  );

  // ─── Append / Prepend ───

  server.tool(
    "mdfy_append",
    "Append content to the end of an existing document",
    {
      id: z.string().describe("Document ID"),
      content: z.string().describe("Markdown content to append"),
      separator: z.string().optional().describe("Separator between existing content and new (default: \\n\\n)"),
    },
    async ({ id, content, separator }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error: readErr } = await supabase.from("documents").select("markdown, title").eq("id", id).single();
      if (readErr || !data) return errorResult("Document not found");
      const sep = separator ?? "\n\n";
      const newMd = data.markdown + sep + content;
      // Enforce H1=title invariant — append-style writes can move
      // the H1 line if the prefix didn't already have one.
      const { enforceTitleInvariant } = await import("@/lib/extract-title");
      const enforced = enforceTitleInvariant(newMd, data.title || "");
      const { error } = await supabase.from("documents").update({
        markdown: enforced.markdown,
        title: enforced.title,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) return errorResult(error.message);
      return textResult(`Appended ${content.length} chars to ${id}.`);
    }
  );

  server.tool(
    "mdfy_prepend",
    "Prepend content to the beginning of a document",
    { id: z.string(), content: z.string() },
    async ({ id, content }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error: readErr } = await supabase.from("documents").select("markdown, title").eq("id", id).single();
      if (readErr || !data) return errorResult("Document not found");
      const newMd = content + "\n\n" + data.markdown;
      // Prepending content may introduce a new H1; the invariant
      // helper picks it up so the stored title follows.
      const { enforceTitleInvariant } = await import("@/lib/extract-title");
      const enforced = enforceTitleInvariant(newMd, data.title || "");
      const { error } = await supabase.from("documents").update({
        markdown: enforced.markdown,
        title: enforced.title,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) return errorResult(error.message);
      return textResult(`Prepended ${content.length} chars to ${id}.`);
    }
  );

  // ─── Outline / Sections ───

  server.tool(
    "mdfy_outline",
    "Get the heading-based outline (table of contents) of a document",
    { id: z.string().describe("Document ID") },
    async ({ id }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("documents").select("title, markdown").eq("id", id).single();
      if (error || !data) return errorResult("Document not found");
      const sections = parseHeadings(data.markdown);
      if (sections.length === 0) return textResult(`Document "${data.title || "Untitled"}" has no headings.`);
      const outline = sections.map((s) => `${"  ".repeat(s.level - 1)}- ${s.heading} (lines ${s.start + 1}-${s.end})`).join("\n");
      return textResult(`# ${data.title || "Untitled"}\n\n${outline}`);
    }
  );

  server.tool(
    "mdfy_extract_section",
    "Extract a specific section by heading text",
    {
      id: z.string(),
      heading: z.string().describe("Exact heading text (case-insensitive)"),
    },
    async ({ id, heading }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("documents").select("markdown").eq("id", id).single();
      if (error || !data) return errorResult("Document not found");
      const section = findSection(data.markdown, heading);
      if (!section) return errorResult(`Section "${heading}" not found`);
      const lines = data.markdown.split("\n").slice(section.start, section.end);
      return textResult(lines.join("\n"));
    }
  );

  server.tool(
    "mdfy_replace_section",
    "Replace the content of a section identified by heading",
    {
      id: z.string(),
      heading: z.string().describe("Heading of section to replace"),
      newContent: z.string().describe("New content (include the heading line if you want to keep it)"),
    },
    async ({ id, heading, newContent }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error: readErr } = await supabase.from("documents").select("markdown, title").eq("id", id).single();
      if (readErr || !data) return errorResult("Document not found");
      const section = findSection(data.markdown, heading);
      if (!section) return errorResult(`Section "${heading}" not found`);
      const lines = data.markdown.split("\n");
      const newLines = [...lines.slice(0, section.start), ...newContent.split("\n"), ...lines.slice(section.end)];
      const newMd = newLines.join("\n");
      // Replacing a section can drop or alter the H1 line — re-derive.
      const { enforceTitleInvariant } = await import("@/lib/extract-title");
      const enforced = enforceTitleInvariant(newMd, data.title || "");
      const { error } = await supabase.from("documents").update({
        markdown: enforced.markdown,
        title: enforced.title,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) return errorResult(error.message);
      return textResult(`Section "${heading}" replaced in ${id}.`);
    }
  );

  // ─── Duplicate / Import ───

  server.tool(
    "mdfy_duplicate",
    "Duplicate an existing document under a new ID",
    {
      id: z.string().describe("Source document ID"),
      title: z.string().optional().describe("New title (defaults to 'Copy of <original>')"),
    },
    async ({ id, title }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error: readErr } = await supabase.from("documents").select("markdown, title").eq("id", id).single();
      if (readErr || !data) return errorResult("Source document not found");
      const newId = nanoid(8);
      const editToken = nanoid(32);
      const newTitle = title || `Copy of ${data.title || "Untitled"}`;
      // Splice the new title into the body's H1 so the duplicate
      // satisfies the title=H1 invariant from the moment it lands.
      const { spliceH1, enforceTitleInvariant } = await import("@/lib/extract-title");
      const splicedMd = spliceH1(data.markdown || "", newTitle);
      const enforced = enforceTitleInvariant(splicedMd, newTitle);
      const { error } = await supabase.from("documents").insert({
        id: newId, markdown: enforced.markdown, title: enforced.title,
        edit_token: editToken,
        user_id: userId || null,
        edit_mode: userId ? "account" : "token",
        is_draft: true, source: "mcp",
      });
      if (error) return errorResult(`Failed: ${error.message}`);
      return textResult(`Duplicated ${id} → ${newId}\nURL: ${BASE_URL}/${newId}`);
    }
  );

  server.tool(
    "mdfy_import_url",
    "Fetch a webpage and import it as a new memory.wiki document",
    {
      url: z.string().describe("URL to fetch"),
      title: z.string().optional(),
    },
    async ({ url, title }) => {
      if (!supabase) return errorResult("Storage not configured");
      try {
        const res = await fetch(url, { headers: { "User-Agent": "mdfy-mcp/1.4.0" } });
        if (!res.ok) return errorResult(`HTTP ${res.status} fetching ${url}`);
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const docTitle = title || titleMatch?.[1].trim() || url;
        const rawMd = `> Source: ${url}\n\n` + htmlToMarkdownLite(html);
        // Import-time explicit prepend: if the converted body has no
        // H1, surface the page's <title> as the doc heading. The
        // helper is only invoked to read the resulting H1.
        const { extractTitleFromMd } = await import("@/lib/extract-title");
        const detectedH1 = extractTitleFromMd(rawMd);
        const markdown = (!detectedH1 || detectedH1 === "Untitled")
          ? `# ${docTitle}\n\n${rawMd}`
          : rawMd;
        const finalTitle = extractTitleFromMd(markdown);
        // Dedup: importing the same URL twice in quick succession should
        // not create a sibling — common when an LLM retries on transient
        // failure or an agent re-runs a tool call.
        const dupHit = await findRecentDuplicateDoc(
          supabase,
          { userId },
          markdown,
          finalTitle,
        );
        if (dupHit) {
          return textResult(`Already imported ${url} (deduplicated)\n→ ${BASE_URL}/${dupHit.id}\nID: ${dupHit.id}`);
        }
        const newId = nanoid(8);
        const editToken = nanoid(32);
        const { error } = await supabase.from("documents").insert({
          id: newId, markdown, title: finalTitle,
          edit_token: editToken,
          user_id: userId || null,
          edit_mode: userId ? "account" : "token",
          is_draft: true, source: "mcp",
        });
        if (error) {
          if (isStrictDupLockError(error)) {
            const survivor = await findRecentDuplicateDoc(supabase, { userId }, markdown, finalTitle);
            if (survivor) return textResult(`Already imported ${url} (deduplicated)\n→ ${BASE_URL}/${survivor.id}\nID: ${survivor.id}`);
          }
          return errorResult(`Failed to save: ${error.message}`);
        }
        return textResult(`Imported ${url}\n→ ${BASE_URL}/${newId}\nID: ${newId}\nLength: ${markdown.length} chars`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : "fetch failed");
      }
    }
  );

  // ─── Sharing controls ───

  // mdfy_set_password removed — password gating is no longer a
  // supported access mode. The three real states are Private /
  // Specific people only / Anyone with the link.

  server.tool(
    "mdfy_set_expiry",
    "Set or clear expiration time on a document",
    {
      id: z.string(),
      expiresInHours: z.number().nullable().describe("Hours from now (null clears expiry)"),
    },
    async ({ id, expiresInHours }) => {
      if (!supabase) return errorResult("Storage not configured");
      const expiresAt = expiresInHours
        ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
        : null;
      const { error } = await supabase.from("documents").update({ expires_at: expiresAt }).eq("id", id);
      if (error) return errorResult(error.message);
      return textResult(expiresAt ? `Expires at ${expiresAt}` : `Expiry cleared on ${id}.`);
    }
  );

  server.tool(
    "mdfy_set_allowed_emails",
    "Restrict access to specific emails (allowlist)",
    {
      id: z.string(),
      emails: z.array(z.string()).describe("Email addresses (empty array removes restriction)"),
    },
    async ({ id, emails }) => {
      if (!supabase) return errorResult("Storage not configured");
      const allowed = emails.length > 0 ? emails : null;
      const { error } = await supabase.from("documents").update({ allowed_emails: allowed }).eq("id", id);
      if (error) return errorResult(error.message);
      return textResult(allowed ? `Restricted ${id} to ${allowed.length} email(s).` : `Restriction removed.`);
    }
  );

  server.tool(
    "mdfy_get_share_url",
    "Get the share URL and access metadata for a document",
    { id: z.string() },
    async ({ id }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("documents")
        .select("title, is_draft, password_hash, expires_at, allowed_emails, view_count")
        .eq("id", id).single();
      if (error || !data) return errorResult("Document not found");
      const lines = [
        `URL: ${BASE_URL}/${id}`,
        `Title: ${data.title || "Untitled"}`,
        `Status: ${data.is_draft ? "private draft" : "publicly accessible"}`,
        `Password: ${data.password_hash ? "yes" : "no"}`,
        `Expires: ${data.expires_at || "never"}`,
        `Allowed emails: ${data.allowed_emails?.length ? data.allowed_emails.join(", ") : "anyone"}`,
        `Views: ${data.view_count || 0}`,
      ];
      return textResult(lines.join("\n"));
    }
  );

  server.tool(
    "mdfy_publish",
    "Toggle a document between published (shared) and draft (private)",
    { id: z.string(), published: z.boolean() },
    async ({ id, published }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { error } = await supabase.from("documents").update({ is_draft: !published }).eq("id", id);
      if (error) return errorResult(error.message);
      return textResult(published ? `${id} is now public: ${BASE_URL}/${id}` : `${id} is now private.`);
    }
  );

  // ─── Versions ───

  server.tool(
    "mdfy_versions",
    "List version history of a document",
    { id: z.string() },
    async ({ id }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("document_versions")
        .select("id, version_number, change_summary, created_at, byte_size")
        .eq("document_id", id)
        .order("version_number", { ascending: false }).limit(50);
      if (error) return errorResult(error.message);
      const versions = data || [];
      if (versions.length === 0) return textResult(`No version history for ${id}.`);
      return textResult(`${versions.length} version(s):\n\n` + versions.map((v) =>
        `v${v.version_number} (${v.id.slice(0, 8)}) — ${v.created_at} — ${v.byte_size}b — ${v.change_summary || "no summary"}`
      ).join("\n"));
    }
  );

  server.tool(
    "mdfy_restore_version",
    "Restore a document to a previous version",
    { id: z.string(), versionId: z.string() },
    async ({ id, versionId }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data: version, error: vErr } = await supabase.from("document_versions")
        .select("markdown, title").eq("id", versionId).single();
      if (vErr || !version) return errorResult("Version not found");
      // Older versions may pre-date the title=H1 invariant; enforce it
      // on restore so the doc lands consistent regardless of when the
      // version was captured.
      const { enforceTitleInvariant } = await import("@/lib/extract-title");
      const enforced = enforceTitleInvariant(version.markdown, version.title || "");
      const { error } = await supabase.from("documents")
        .update({ markdown: enforced.markdown, title: enforced.title, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return errorResult(error.message);
      return textResult(`Restored ${id} to version ${versionId}.`);
    }
  );

  server.tool(
    "mdfy_diff",
    "Show diff between two versions of a document (line-level)",
    { id: z.string(), fromVersionId: z.string(), toVersionId: z.string() },
    async ({ id, fromVersionId, toVersionId }) => {
      if (!supabase) return errorResult("Storage not configured");
      const [a, b] = await Promise.all([
        supabase.from("document_versions").select("markdown").eq("id", fromVersionId).single(),
        supabase.from("document_versions").select("markdown").eq("id", toVersionId).single(),
      ]);
      if (a.error || !a.data) return errorResult("From version not found");
      if (b.error || !b.data) return errorResult("To version not found");
      const linesA = a.data.markdown.split("\n");
      const linesB = b.data.markdown.split("\n");
      const out: string[] = [];
      const max = Math.max(linesA.length, linesB.length);
      for (let i = 0; i < max; i++) {
        if (linesA[i] === linesB[i]) continue;
        if (linesA[i] !== undefined) out.push(`- ${linesA[i]}`);
        if (linesB[i] !== undefined) out.push(`+ ${linesB[i]}`);
      }
      void id;
      return textResult(out.length === 0 ? "No differences." : "```diff\n" + out.join("\n") + "\n```");
    }
  );

  // ─── Stats / Recent ───

  server.tool(
    "mdfy_stats",
    "Get view stats and metadata for a document",
    { id: z.string() },
    async ({ id }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("documents")
        .select("title, view_count, created_at, updated_at, is_draft")
        .eq("id", id).single();
      if (error || !data) return errorResult("Document not found");
      return textResult([
        `Title: ${data.title || "Untitled"}`,
        `Status: ${data.is_draft ? "draft" : "shared"}`,
        `Views: ${data.view_count || 0}`,
        `Created: ${data.created_at}`,
        `Last updated: ${data.updated_at}`,
        `URL: ${BASE_URL}/${id}`,
      ].join("\n"));
    }
  );

  server.tool(
    "mdfy_recent",
    "List recently visited documents",
    {},
    async () => {
      if (!userId) return errorResult("Not authenticated");
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("user_visits")
        .select("document_id, visited_at, documents!inner(title, is_draft)")
        .eq("user_id", userId)
        .order("visited_at", { ascending: false }).limit(20);
      if (error) return errorResult(error.message);
      const visits = data || [];
      if (visits.length === 0) return textResult("No recent visits.");
      return textResult(visits.map((v, i) => {
        const doc = (v as unknown as { documents: { title: string | null; is_draft: boolean } }).documents;
        return `${i + 1}. ${doc.title || "Untitled"} (${v.document_id}) — ${v.visited_at}`;
      }).join("\n"));
    }
  );

  // ─── Folders ───

  server.tool(
    "mdfy_folder_list",
    "List your folders",
    {},
    async () => {
      if (!userId) return errorResult("Not authenticated");
      if (!supabase) return errorResult("Storage not configured");
      const { data, error } = await supabase.from("folders")
        .select("id, name, parent_id, created_at")
        .eq("user_id", userId)
        .order("name");
      if (error) return errorResult(error.message);
      const folders = data || [];
      if (folders.length === 0) return textResult("No folders.");
      return textResult(`${folders.length} folder(s):\n\n` + folders.map((f) =>
        `- ${f.name} (${f.id})${f.parent_id ? ` [parent: ${f.parent_id}]` : ""}`
      ).join("\n"));
    }
  );

  server.tool(
    "mdfy_folder_create",
    "Create a new folder",
    {
      name: z.string().describe("Folder name"),
      parentId: z.string().optional().describe("Parent folder ID for nesting"),
    },
    async ({ name, parentId }) => {
      if (!userId) return errorResult("Not authenticated");
      if (!supabase) return errorResult("Storage not configured");
      const id = nanoid(12);
      const { error } = await supabase.from("folders").insert({
        id, name, user_id: userId,
        parent_id: parentId || null,
      });
      if (error) return errorResult(error.message);
      return textResult(`Folder "${name}" created (${id}).`);
    }
  );

  server.tool(
    "mdfy_move_to_folder",
    "Move a document into a folder",
    { documentId: z.string(), folderId: z.string().nullable().describe("null to remove from folder") },
    async ({ documentId, folderId }) => {
      if (!supabase) return errorResult("Storage not configured");
      const { error } = await supabase.from("documents").update({ folder_id: folderId }).eq("id", documentId);
      if (error) return errorResult(error.message);
      return textResult(folderId ? `Moved ${documentId} → folder ${folderId}.` : `Removed ${documentId} from folder.`);
    }
  );

  // ─── Render preview ───

  server.tool(
    "mdfy_render_preview",
    "Get the public render URL for previewing markdown without saving",
    { markdown: z.string().describe("Markdown to preview") },
    async ({ markdown }) => {
      // For now just return the hash-share URL (memory.wiki supports it via /#md=...)
      // True render would need WASM access; this gives users a quick preview link.
      void markdown;
      return textResult(`To preview: paste markdown into ${BASE_URL} (it renders live in browser).\nFor a permanent preview, use mdfy_create with draft=true.`);
    }
  );

  void requireDb; // typescript: keep unused helper in scope
  return server;
}

// ─── HTTP Handler ───

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id") || undefined;
    const server = createMcpServer(userId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => nanoid(16) });
    await server.connect(transport);
    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (transport as any).handleRequest(body, req);
    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-user-email",
      },
    });
  } catch (err) {
    console.error("[MCP] Error:", err);
    return new Response(JSON.stringify({ error: "MCP server error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-user-email",
    },
  });
}
