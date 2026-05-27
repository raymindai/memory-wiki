/**
 * Pull image URLs out of a markdown blob. Picks up both flavours:
 *   - GFM:  ![alt](url "title")
 *   - HTML: <img src="url" ...>
 *
 * Returns absolute URLs only — relative paths are dropped because the
 * gallery renders outside the originating doc and a `./screenshot.png`
 * would 404 from the bundle/hub viewer. Keeps insertion order, dedupes.
 */
export function extractImageUrls(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const url = raw.trim();
    if (!url) return;
    if (!/^(https?:|\/)/i.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };
  const mdRe = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(markdown)) !== null) push(m[1]);
  const htmlRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  while ((m = htmlRe.exec(markdown)) !== null) push(m[1]);
  return out;
}

export type DocImageGroup = {
  docId: string;
  docTitle: string;
  urls: string[];
};

/**
 * Collect per-doc image groups from a list of docs. Empty groups are
 * dropped so the caller can render `.map` without an "0 images" stub.
 */
export function collectDocImages(
  docs: Array<{ id: string; title: string; markdown: string | null | undefined }>,
): DocImageGroup[] {
  return docs
    .map((d) => ({ docId: d.id, docTitle: d.title || "Untitled", urls: extractImageUrls(d.markdown) }))
    .filter((g) => g.urls.length > 0);
}
