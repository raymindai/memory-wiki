/**
 * Small utility helpers extracted from MdEditor.tsx — pure functions
 * with no React deps. Live here so other editor-adjacent modules
 * (tabs, share modal, sidebar) can reach for them without dragging
 * the full editor module along.
 */

/** Truncate title respecting grapheme clusters (emoji-safe). */
export function truncateTitle(title: string, max: number): string {
  if (title.length <= max) return title;
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const segments = [...segmenter.segment(title)];
    if (segments.length <= max) return title;
    return segments.slice(0, max).map(s => s.segment).join("") + "...";
  }
  return title.slice(0, max) + "...";
}

/**
 * GitHub-style identicon — a 5x5 horizontally-symmetric grid of square
 * blocks in one saturated colour on a light field, exactly the shape
 * GitHub serves for accounts without a photo. Pure, deterministic, and
 * dependency-free, so it renders identically on the server and client.
 * Returned as an SVG data URI usable anywhere an avatar URL is expected.
 */
export function githubIdenticon(seed: string, size = 40): string {
  // cyrb53 — fast 53-bit hash with good avalanche. Two salts give
  // independent streams for the cell pattern and the hue.
  const hash = (str: string, salt = 0): number => {
    let h1 = 0xdeadbeef ^ salt;
    let h2 = 0x41c6ce57 ^ salt;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  };

  const cells = hash(seed, 0);
  const hue = hash(seed, 1) % 360;
  const color = `hsl(${hue},58%,52%)`;
  const bg = "#f0f0f0";

  // Compute the left three columns (15 bits) and mirror columns 0,1 onto
  // 4,3 for the left-right symmetry that defines the GitHub look. Column
  // 2 is the mirror axis.
  const on: boolean[][] = Array.from({ length: 5 }, () => new Array(5).fill(false));
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 5; r++) {
      const filled = ((cells >> (c * 5 + r)) & 1) === 1;
      on[r][c] = filled;
      on[r][4 - c] = filled;
    }
  }

  // Half-cell quiet zone all around: image is 6 units wide, the 5-cell
  // grid sits centred (offset = half a unit) — matches GitHub's framing.
  const unit = size / 6;
  const off = unit / 2;
  let rects = "";
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (on[r][c]) {
        rects += `<rect x="${(off + c * unit).toFixed(2)}" y="${(off + r * unit).toFixed(2)}" width="${unit.toFixed(2)}" height="${unit.toFixed(2)}"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/><g fill="${color}">${rects}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Shared avatar style → URL helper. The "identicon" style (including
 *  legacy profile rows that stored it) renders the GitHub-style pixel
 *  identicon; every other style maps to its DiceBear generator. */
function dicebearStyleUrl(style: string, seed: string, size: number): string {
  if (style === "identicon") return githubIdenticon(seed, size);
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

/** DiceBear shapes — default avatar fallback. */
export function dicebearUrl(seed: string, size = 40): string {
  return dicebearStyleUrl("shapes", seed, size);
}

/**
 * Resolve the best avatar URL.
 *
 * Priority:
 *   1. `avatar_style` (when not "oauth") — user explicitly picked a
 *      DiceBear style in Settings. Beats the OAuth photo so the picker
 *      actually takes effect.
 *   2. `profile.avatar_url` — uploaded / cached avatar.
 *   3. OAuth metadata avatar (Google / GitHub photo).
 *   4. GitHub-style identicon generated from the email seed.
 *
 * Centralised here so the editor header / profile menu / settings page
 * all show the SAME avatar after a Settings change.
 */
export function resolveAvatar(
  profile: { avatar_url?: string | null; avatar_style?: string | null } | null,
  user: { email?: string; user_metadata?: { avatar_url?: string } } | null,
  size = 40,
): string {
  const seed = user?.email || "user";
  const style = profile?.avatar_style;
  // "upload" is the marker the user picked their own uploaded image —
  // serve avatar_url verbatim. Falls back to OAuth/dicebear only if
  // the upload row got cleared somehow.
  if (style === "upload") {
    return profile?.avatar_url || user?.user_metadata?.avatar_url || githubIdenticon(seed, size);
  }
  if (style && style !== "oauth") {
    return dicebearStyleUrl(style, seed, size);
  }
  return profile?.avatar_url || user?.user_metadata?.avatar_url || githubIdenticon(seed, size);
}

/** Splice a new title into the first H1 line, or prepend one if no H1
 *  exists. Used by the Duplicate flow so the resulting markdown's H1
 *  matches the new tab title — the server enforces DB.title = H1, so
 *  without this the server overwrites our chosen title back to the
 *  source H1, which then collides with the source row in dedup. */
export function rewriteH1(md: string, newTitle: string): string {
  const lines = md.split("\n");
  const h1Idx = lines.findIndex(l => /^#\s+/.test(l));
  if (h1Idx >= 0) {
    lines[h1Idx] = `# ${newTitle}`;
    return lines.join("\n");
  }
  return md.trim() ? `# ${newTitle}\n\n${md}` : `# ${newTitle}\n`;
}

/** Heuristic title suggestion for a multi-doc bundle. Looks for tokens
 *  that appear in 2+ titles (case-insensitive, stopwords filtered);
 *  joins the top 2 with " + ". Falls back to "<first title> + N more". */
export function suggestBundleTitle(docs: Array<{ title: string }>): string {
  if (docs.length === 0) return "";
  if (docs.length === 1) return docs[0].title || "Untitled";
  const stop = new Set(["a","an","the","and","or","of","in","on","at","to","for","with","from","by","is","are","was","were","be","been","as","my","your","our","this","that"]);
  const counts = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set<string>();
    for (const tok of (d.title || "").toLowerCase().split(/[\s\-_,.;:()[\]/]+/)) {
      if (tok.length < 3 || stop.has(tok)) continue;
      if (seen.has(tok)) continue;
      seen.add(tok);
      counts.set(tok, (counts.get(tok) || 0) + 1);
    }
  }
  const common = Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
  if (common.length === 0) {
    return `${docs[0].title || "Untitled"} + ${docs.length - 1} more`;
  }
  return `${common.join(" + ")} (${docs.length})`;
}
