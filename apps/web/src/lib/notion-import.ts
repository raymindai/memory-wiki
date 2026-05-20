// Notion → Markdown converter.
//
// v1 surface: the user pastes an internal-integration token
// (`secret_…`) + a page URL or ID. We fetch the page metadata + its
// block tree, convert the most common block types to markdown, and
// hand the result back to the import route. No OAuth dance, no
// token storage — the user pastes the token per-import.
//
// Why no OAuth yet: building a Notion OAuth provider needs a public
// client_id, redirect URL, and per-user encrypted token storage.
// We can layer that on later. Internal integration tokens cover the
// "I want my Notion notes in memory.wiki" path with zero infra.
//
// Block coverage: paragraph, heading_1/2/3, bulleted/numbered list,
// to_do, toggle, code, quote, divider, callout, image, table,
// bookmark, link_preview, equation, child_page (as a link only —
// not recursed). Unsupported block types fall through to an
// HTML comment so the user can see what was dropped.

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

export class NotionImportError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

interface NotionRichText {
  type: "text" | "mention" | "equation";
  plain_text: string;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    underline?: boolean;
  };
  href?: string | null;
  text?: { content: string; link: { url: string } | null };
  equation?: { expression: string };
}

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  to_do?: { rich_text: NotionRichText[]; checked?: boolean };
  toggle?: { rich_text: NotionRichText[] };
  code?: { rich_text: NotionRichText[]; language?: string };
  quote?: { rich_text: NotionRichText[] };
  callout?: { rich_text: NotionRichText[]; icon?: { emoji?: string } | null };
  divider?: Record<string, never>;
  image?: { type: "external" | "file"; external?: { url: string }; file?: { url: string }; caption?: NotionRichText[] };
  bookmark?: { url: string; caption?: NotionRichText[] };
  link_preview?: { url: string };
  equation?: { expression: string };
  child_page?: { title: string };
  table?: { table_width: number; has_column_header?: boolean };
  table_row?: { cells: NotionRichText[][] };
  embed?: { url: string };
}

interface NotionPage {
  id: string;
  properties?: Record<string, { title?: NotionRichText[] }>;
  url?: string;
}

/**
 * Accepts a Notion page URL ("…/Some-Page-32-character-id"), bare 32-char
 * UUID (no dashes), or hyphenated UUID. Returns the hyphenated UUID, or
 * null when the input doesn't contain a recognisable id.
 */
export function parseNotionPageId(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  // Already hyphenated UUID
  const hyphenated = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (hyphenated) return hyphenated[0].toLowerCase();
  // Bare 32-char id at the tail of a URL / standalone
  const bare = raw.match(/[0-9a-f]{32}/i);
  if (bare) {
    const s = bare[0].toLowerCase();
    return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
  }
  return null;
}

function notionFetch(token: string, path: string): Promise<Response> {
  return fetch(`${NOTION_API}${path}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });
}

function richTextToMarkdown(rt: NotionRichText[] | undefined): string {
  if (!rt || rt.length === 0) return "";
  return rt.map((piece) => {
    if (piece.type === "equation" && piece.equation?.expression) {
      return `$${piece.equation.expression}$`;
    }
    const text = piece.plain_text || "";
    if (!text) return "";
    const a = piece.annotations || {};
    let out = text;
    if (a.code) out = "`" + out + "`";
    if (a.bold) out = `**${out}**`;
    if (a.italic) out = `*${out}*`;
    if (a.strikethrough) out = `~~${out}~~`;
    const href = piece.href || piece.text?.link?.url;
    if (href) out = `[${out}](${href})`;
    return out;
  }).join("");
}

function indentLines(text: string, level: number): string {
  if (level <= 0) return text;
  const pad = "  ".repeat(level);
  return text.split("\n").map((l) => l ? pad + l : l).join("\n");
}

async function fetchAllChildren(token: string, blockId: string): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 50; page++) { // safety cap; 50 * 100 = 5000 blocks
    const qs = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const res = await notionFetch(token, `/blocks/${blockId}/children${qs}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new NotionImportError(`Notion blocks fetch failed (${res.status}): ${body.slice(0, 200)}`, res.status);
    }
    const json = await res.json();
    const results: NotionBlock[] = json.results || [];
    out.push(...results);
    if (!json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
  }
  return out;
}

async function blockToMarkdown(token: string, block: NotionBlock, indent = 0): Promise<string[]> {
  const lines: string[] = [];
  const t = block.type;
  const inline = (rt?: NotionRichText[]) => richTextToMarkdown(rt);

  switch (t) {
    case "paragraph": {
      const text = inline(block.paragraph?.rich_text);
      lines.push(indentLines(text || "", indent));
      break;
    }
    case "heading_1":
      lines.push(`# ${inline(block.heading_1?.rich_text)}`);
      break;
    case "heading_2":
      lines.push(`## ${inline(block.heading_2?.rich_text)}`);
      break;
    case "heading_3":
      lines.push(`### ${inline(block.heading_3?.rich_text)}`);
      break;
    case "bulleted_list_item":
      lines.push(indentLines(`- ${inline(block.bulleted_list_item?.rich_text)}`, indent));
      break;
    case "numbered_list_item":
      lines.push(indentLines(`1. ${inline(block.numbered_list_item?.rich_text)}`, indent));
      break;
    case "to_do":
      lines.push(indentLines(`- [${block.to_do?.checked ? "x" : " "}] ${inline(block.to_do?.rich_text)}`, indent));
      break;
    case "toggle":
      // Render as a normal bullet — the toggle's contents follow via children.
      lines.push(indentLines(`- ${inline(block.toggle?.rich_text)}`, indent));
      break;
    case "code": {
      const lang = (block.code?.language || "").toLowerCase().replace(/\s+/g, "");
      const text = (block.code?.rich_text || []).map((p) => p.plain_text || "").join("");
      lines.push(indentLines("```" + lang, indent));
      for (const codeLine of text.split("\n")) lines.push(indentLines(codeLine, indent));
      lines.push(indentLines("```", indent));
      break;
    }
    case "quote":
      lines.push(indentLines(`> ${inline(block.quote?.rich_text)}`, indent));
      break;
    case "callout": {
      const icon = block.callout?.icon?.emoji ? block.callout.icon.emoji + " " : "";
      lines.push(indentLines(`> ${icon}${inline(block.callout?.rich_text)}`, indent));
      break;
    }
    case "divider":
      lines.push("---");
      break;
    case "image": {
      const url = block.image?.external?.url || block.image?.file?.url || "";
      const cap = inline(block.image?.caption) || "image";
      if (url) lines.push(indentLines(`![${cap}](${url})`, indent));
      break;
    }
    case "bookmark": {
      const url = block.bookmark?.url || "";
      const cap = inline(block.bookmark?.caption) || url;
      if (url) lines.push(indentLines(`[${cap}](${url})`, indent));
      break;
    }
    case "link_preview": {
      const url = block.link_preview?.url || "";
      if (url) lines.push(indentLines(`[${url}](${url})`, indent));
      break;
    }
    case "embed": {
      const url = block.embed?.url || "";
      if (url) lines.push(indentLines(`[${url}](${url})`, indent));
      break;
    }
    case "equation": {
      const expr = block.equation?.expression || "";
      if (expr) lines.push(`$$${expr}$$`);
      break;
    }
    case "child_page":
      // Linking only — recursion across child pages is a separate
      // surface (would inflate the import unpredictably).
      lines.push(indentLines(`- 📄 ${block.child_page?.title || "(untitled child page)"}`, indent));
      break;
    case "table": {
      // Tables expose their cells via table_row children. We materialise
      // them inline here so the markdown ends up as a real GFM table.
      const rows = await fetchAllChildren(token, block.id);
      const cellsPerRow = rows
        .filter((r) => r.type === "table_row")
        .map((r) => (r.table_row?.cells || []).map((cellRichText) => richTextToMarkdown(cellRichText).replace(/\|/g, "\\|").replace(/\n+/g, " ")));
      if (cellsPerRow.length > 0) {
        const width = Math.max(...cellsPerRow.map((r) => r.length));
        const headerRow = cellsPerRow[0];
        lines.push(`| ${headerRow.concat(Array(Math.max(0, width - headerRow.length)).fill("")).join(" | ")} |`);
        lines.push(`| ${Array(width).fill("---").join(" | ")} |`);
        for (const row of cellsPerRow.slice(1)) {
          lines.push(`| ${row.concat(Array(Math.max(0, width - row.length)).fill("")).join(" | ")} |`);
        }
      }
      return lines; // Don't recurse — children already consumed.
    }
    default:
      lines.push(indentLines(`<!-- notion: unsupported block type "${t}" -->`, indent));
      break;
  }

  // Recurse into children for blocks that nest (toggles, callouts,
  // lists, quotes, etc.) — Notion exposes them all via /blocks/{id}/children.
  if (block.has_children && t !== "child_page" && t !== "table") {
    const children = await fetchAllChildren(token, block.id);
    for (const child of children) {
      const childLines = await blockToMarkdown(token, child, indent + 1);
      lines.push(...childLines);
    }
  }

  return lines;
}

function titleFromPage(page: NotionPage): string {
  // Pages typed as "page" expose title under properties.title.title;
  // database items can use any of their properties — we walk all of
  // them and pick the first that has a non-empty title array.
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    const candidate = props[key];
    if (candidate?.title && candidate.title.length > 0) {
      return richTextToMarkdown(candidate.title) || "Untitled";
    }
  }
  return "Untitled";
}

export async function importNotionPage(token: string, pageId: string): Promise<{ id: string; title: string; markdown: string; pageUrl: string }> {
  if (!/^secret_/.test(token) && !/^ntn_/.test(token)) {
    // Notion tokens have changed prefix conventions over the years —
    // accept both. We don't validate further; the API call is the
    // real check.
  }
  const res = await notionFetch(token, `/pages/${pageId}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new NotionImportError(`Notion page fetch failed (${res.status}): ${body.slice(0, 200)}`, res.status);
  }
  const page = (await res.json()) as NotionPage;
  const title = titleFromPage(page);

  const topBlocks = await fetchAllChildren(token, pageId);
  const lines: string[] = [`# ${title}`, ""];
  for (const b of topBlocks) {
    const ls = await blockToMarkdown(token, b);
    lines.push(...ls);
    // Add a blank line between top-level blocks so the markdown renders
    // with paragraph spacing.
    lines.push("");
  }

  // Tidy: collapse 3+ consecutive blank lines down to 2.
  const markdown = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";

  return {
    id: pageId,
    title,
    markdown,
    pageUrl: page.url || `https://www.notion.so/${pageId.replace(/-/g, "")}`,
  };
}
