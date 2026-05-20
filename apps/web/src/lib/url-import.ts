// Server-side URL → Markdown ingest.
//
// Fetches an arbitrary http(s) URL, parses the HTML with linkedom
// (no native DOM in Node), extracts the densest content block,
// strips chrome (nav / aside / footer / scripts / forms), and runs
// Turndown to produce markdown.
//
// We deliberately don't ship the full content-extraction heuristic
// stack (Readability et al.) — for v1 the user is pulling specific
// pages they already trust, and a small set of structural rules
// covers the common case (blog post / docs page) without an extra
// dependency.

import { parseHTML } from "linkedom";
import TurndownService from "turndown";
// @ts-expect-error — no types for turndown-plugin-gfm
import { gfm } from "turndown-plugin-gfm";

export class UrlImportError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5MB upper bound on a single fetch
const FETCH_TIMEOUT_MS = 12_000;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Pick the densest content element in the parsed document. Falls
 * back to body. The heuristic is intentionally simple: prefer
 * `<article>` > `<main>` > the longest `<section>` > `body`.
 */
function pickContentRoot(document: Document): Element {
  const candidates: Element[] = [];
  document.querySelectorAll("article").forEach((n) => candidates.push(n));
  if (candidates.length > 0) {
    return candidates.sort((a, b) => (b.textContent || "").length - (a.textContent || "").length)[0];
  }
  const main = document.querySelector("main");
  if (main && (main.textContent || "").length > 200) return main;
  const sections = Array.from(document.querySelectorAll("section"))
    .filter((s) => (s.textContent || "").length > 400)
    .sort((a, b) => (b.textContent || "").length - (a.textContent || "").length);
  if (sections[0]) return sections[0];
  return document.body || document.documentElement;
}

function stripChrome(root: Element) {
  const selectors = [
    "script", "style", "noscript", "template",
    "nav", "header > nav", "footer", "aside", "form",
    "[role=\"navigation\"]", "[role=\"banner\"]", "[role=\"contentinfo\"]",
    "[aria-hidden=\"true\"]",
    ".nav", ".navbar", ".sidebar", ".cookie", ".cookies",
    ".ad", ".ads", ".advert", ".promo",
    ".share", ".social", ".newsletter", ".subscribe",
  ];
  for (const sel of selectors) {
    root.querySelectorAll(sel).forEach((n) => n.remove());
  }
}

function deriveTitle(document: Document, fallback: string): string {
  const og = document.querySelector("meta[property=\"og:title\"]")?.getAttribute("content");
  if (og && og.trim()) return og.trim();
  const titleTag = document.querySelector("title")?.textContent?.trim();
  if (titleTag) return titleTag.replace(/\s*[—–|·]\s*.+$/, "").trim() || titleTag;
  const h1 = document.querySelector("h1")?.textContent?.trim();
  if (h1) return h1;
  return fallback;
}

export interface UrlImportResult {
  url: string;
  host: string;
  title: string;
  markdown: string;
}

export async function importFromUrl(rawUrl: string): Promise<UrlImportResult> {
  if (!isHttpUrl(rawUrl)) {
    throw new UrlImportError("Provide a full http(s):// URL", 400);
  }
  const url = new URL(rawUrl);
  // Block well-known internal addresses to avoid SSRF surface. Anyone
  // wanting to import private intranet pages can paste their content
  // directly into mdfy instead — that's not what this endpoint is for.
  if (/^(127\.|10\.|192\.168\.|0\.|localhost$)/i.test(url.hostname) || url.hostname.endsWith(".local")) {
    throw new UrlImportError("Localhost / private addresses are not allowed", 400);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        // Identify ourselves so site owners can recognise the traffic.
        "User-Agent": "memory.wiki/1.0 (URL import; +https://memory.wiki/about)",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as { name?: string })?.name === "AbortError") {
      throw new UrlImportError("Fetch timed out", 504);
    }
    throw new UrlImportError(`Couldn't fetch: ${(err as Error).message}`, 502);
  }
  clearTimeout(timer);

  if (!res.ok) {
    throw new UrlImportError(`Upstream returned ${res.status}`, res.status);
  }
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.startsWith("text/html") && !ct.startsWith("application/xhtml")) {
    throw new UrlImportError(`Not HTML (content-type ${ct || "unknown"})`, 415);
  }

  // Pull the body with a size cap.
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_HTML_BYTES) {
    throw new UrlImportError(`Page too large (${Math.round(ab.byteLength / 1024)} KB)`, 413);
  }
  const html = Buffer.from(ab).toString("utf-8");

  const { document } = parseHTML(html);
  const title = deriveTitle(document, url.hostname);

  const root = pickContentRoot(document);
  stripChrome(root);

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.use(gfm);
  // Drop link href targets that point at javascript: — they're noise
  // and would render as broken markdown links.
  turndown.addRule("strip-js-links", {
    filter: (node) => node.nodeName === "A" && /^javascript:/i.test((node as HTMLAnchorElement).getAttribute("href") || ""),
    replacement: (_c, node) => (node as HTMLElement).textContent || "",
  });

  let markdown = "";
  try {
    markdown = turndown.turndown(root as unknown as HTMLElement);
  } catch (err) {
    throw new UrlImportError(`Conversion failed: ${(err as Error).message}`, 500);
  }

  // Tidy: collapse triple-blank-lines.
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  // Resolve any relative image refs against the source URL so the
  // markdown we hand back has only absolute URLs. Relative refs
  // would otherwise be unfetchable (we no longer have the page
  // base) and would render as broken in mdfy.
  markdown = markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (full, alt, target, titleAttr) => {
    if (/^(https?:|data:)/i.test(target)) return full;
    try {
      const abs = new URL(target, url).toString();
      return `![${alt}](${abs}${titleAttr || ""})`;
    } catch {
      return full;
    }
  });

  const finalBody = [
    `# ${title}`,
    "",
    markdown,
    "",
    "---",
    `_Imported from <${url.toString()}>_`,
    "",
  ].join("\n");

  return {
    url: url.toString(),
    host: url.hostname,
    title,
    markdown: finalBody,
  };
}
