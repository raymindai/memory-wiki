// Shared extractors for the AI-facing markdown payloads (hub / bundle /
// doc raw routes). All three need the same `Facts → summary →
// firstParagraph` chain plus an H2 skeleton so an AI fetching any URL
// shape sees the same "what's in this doc at a glance" surface.

/**
 * Pull a curated `## Facts` block from a doc's markdown when the owner
 * has written one. Highest-fidelity per-doc signal — the owner has
 * hand-asserted the load-bearing claims.
 *
 * Convention:
 *   ## Facts
 *   - product launches 2026-06
 *   - target customer: AI agent devs
 *   - moat: cross-AI URL paste
 *
 * Returns null when the section doesn't exist or is empty.
 */
export function extractFacts(md: string): string | null {
  if (!md) return null;
  const m = md.match(/^##\s+Facts\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/im);
  if (!m) return null;
  const body = m[1].trim();
  if (!body) return null;
  const facts = body
    .split("\n")
    .map((l) => l.replace(/^[-*+>\s]+/, "").trim())
    .filter(Boolean);
  if (facts.length === 0) return null;
  const joined = facts.join(" · ");
  return joined.length > 600 ? joined.slice(0, 580).trimEnd() + "…" : joined;
}

/**
 * Strip the H1, leading frontmatter, blank lines, and bullet markers
 * from a markdown body to surface the first ~280 chars of real prose.
 * Zero LLM cost. Quality depends on the doc's first paragraph being
 * load-bearing.
 */
export function firstParagraph(md: string): string {
  if (!md) return "";
  let body = md;
  const fm = body.match(/^---\n[\s\S]*?\n---\n/);
  if (fm) body = body.slice(fm[0].length);
  body = body.replace(/^\s*#\s+[^\n]*\n+/, "");
  const lines = body.split("\n");
  const collected: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (collected.length > 0) break;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      if (collected.length > 0) break;
      continue;
    }
    collected.push(trimmed.replace(/^[-*+>]\s+/, ""));
    if (collected.join(" ").length >= 280) break;
  }
  let out = collected.join(" ").replace(/\s+/g, " ").trim();
  if (out.length > 320) out = out.slice(0, 300).trimEnd() + "…";
  return out;
}

/**
 * Pull H2 headings (and the first non-heading line under each) as a
 * compact skeleton outline. Lets the AI see a doc's *shape* even when
 * the prose extract only captures the lede. Particularly load-bearing
 * for templated docs (decks, application forms) and structure-heavy
 * docs (business plans, mechanism specs).
 *
 * Returns null if there are fewer than 2 H2 sections — for short docs
 * the gist alone is enough and the skeleton would be noise.
 */
export function extractSkeleton(md: string, maxLen = 380): string | null {
  if (!md) return null;
  const lines = md.split("\n");
  const sections: { heading: string; first: string }[] = [];
  let current: { heading: string; first: string } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      if (current) sections.push(current);
      current = { heading: h2[1].trim(), first: "" };
      continue;
    }
    if (current && !current.first && line && !/^#{1,6}\s/.test(line) && !/^---/.test(line)) {
      current.first = line.replace(/^[-*+>]\s+/, "").replace(/[*_`]/g, "").slice(0, 100);
    }
  }
  if (current) sections.push(current);
  if (sections.length < 2) return null;

  const parts: string[] = [];
  let len = 0;
  for (const s of sections) {
    const piece = s.first ? `${s.heading}: ${s.first}` : s.heading;
    if (len + piece.length + 3 > maxLen) {
      parts.push("…");
      break;
    }
    parts.push(piece);
    len += piece.length + 3;
  }
  return parts.join(" | ");
}

/**
 * Compose the standard gist (Facts → summary → firstParagraph). Use
 * this anywhere a per-doc one-paragraph summary needs to appear.
 */
export function docGist(md: string, summary?: string | null): string {
  return (
    extractFacts(md) ||
    (summary && summary.trim().length > 0 ? summary.trim() : "") ||
    firstParagraph(md)
  );
}
