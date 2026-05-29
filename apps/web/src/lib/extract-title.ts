/**
 * Extract title from markdown (first # heading, or "Untitled" fallback).
 *
 * Strips inline markdown formatting from the heading so the title
 * reads as plain prose everywhere it's displayed (browser tab,
 * viewer header chip, sidebar row, OG preview). A heading like
 * `# Foo / [bar](https://bar.com) **baz**` would otherwise surface
 * with the link/bold syntax intact and read as raw markdown to
 * non-editing visitors.
 */
export function extractTitleFromMd(md: string): string {
  const match = md.match(/^#\s+(.+)/m);
  if (!match) return "Untitled";
  return stripInlineMarkdown(match[1]).trim() || "Untitled";
}

/**
 * Strip inline markdown formatting and leave just the visible text.
 * Conservative: only touches well-known inline constructs (links,
 * images, bold/italic markers, inline code backticks, raw HTML tags,
 * footnote refs). Anything else passes through.
 *
 * Sequence matters — link/image first (greedy on bracket+paren pair),
 * then strip emphasis runs, then unwrap inline code.
 */
function stripInlineMarkdown(s: string): string {
  let out = s;
  // ![alt](url) → alt
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // [text](url) → text
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // [text][ref] → text
  out = out.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
  // Footnote markers [^1]
  out = out.replace(/\[\^[^\]]+\]/g, "");
  // **bold**, __bold__, *italic*, _italic_  (non-greedy)
  out = out.replace(/(\*\*|__)(.+?)\1/g, "$2");
  out = out.replace(/(\*|_)(.+?)\1/g, "$2");
  // ~~strike~~
  out = out.replace(/~~(.+?)~~/g, "$1");
  // `code`
  out = out.replace(/`([^`]+)`/g, "$1");
  // Raw inline HTML tags like <em>X</em>
  out = out.replace(/<\/?[a-z][a-z0-9-]*[^>]*>/gi, "");
  // Trailing/leading whitespace from removals
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Title invariant: title column must equal the body's first H1.
 *
 * NON-MUTATING. Returns `{ markdown, title }` where:
 *  - `markdown` is returned UNCHANGED (no H1 ever prepended)
 *  - `title === extractTitleFromMd(markdown)` ("Untitled" when the
 *    body has no H1)
 *
 * Earlier this helper used to silently prepend `# <fallback>` when
 * the body lacked an H1. That mutated user content on every save —
 * a doc that had been captured from an AI without an H1 would gain
 * an unwanted heading line on its very next autosave. Body
 * mutation now requires explicit caller intent (rename via
 * spliceH1, or import paths that prepend before calling).
 *
 * `fallbackTitle` is accepted for source-compat only; it has no
 * effect on the returned markdown or title. Callers that want a
 * fallback name embedded in the body should prepend `# <name>\n\n`
 * themselves before invoking this helper.
 */
export function enforceTitleInvariant(
  markdown: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fallbackTitle?: string | null,
): { markdown: string; title: string } {
  const md = markdown || "";
  const title = extractTitleFromMd(md);
  return { markdown: md, title };
}

/**
 * Splice a new H1 line into existing markdown. Used by rename flows
 * that change only the title without touching the body. Idempotent —
 * calling with the same title twice yields identical output.
 */
export function spliceH1(markdown: string, newTitle: string): string {
  const md = markdown || "";
  const lines = md.split("\n");
  const h1Idx = lines.findIndex((l) => /^#\s+/.test(l));
  if (h1Idx >= 0) {
    lines[h1Idx] = `# ${newTitle}`;
    return lines.join("\n");
  }
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    return `# ${newTitle}\n`;
  }
  return `# ${newTitle}\n\n${md}`;
}
