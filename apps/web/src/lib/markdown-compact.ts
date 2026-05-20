// Token-economical markdown post-processing for /raw/* endpoints.
//
// Thesis: an Memory.Wiki URL should fetch as the densest possible representation
// of the underlying content so an LLM spends fewer tokens for the same
// information. Compact mode strips bytes that carry no meaning to a
// reader (blank-line padding, HTML comments, trailing whitespace) while
// preserving everything that DOES carry meaning (headings, lists, code
// blocks, tables, inline formatting).
//
// Code fences are intentionally left untouched — their inner whitespace
// is part of the content (Python indentation, ASCII art, etc.).

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const TRAILING_WS_RE = /[ \t]+$/gm;

/**
 * Best-effort token estimate. We use 4 chars/token as the universal
 * heuristic — matches OpenAI's tiktoken averages on English/code and is
 * a slight under-estimate on mixed Korean text. Author-facing badges
 * should round to nearest 100.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.round(text.length / 4);
}

/**
 * Compact a markdown body. Idempotent. Code fences (``` and ~~~) are
 * preserved byte-for-byte.
 */
export function compactMarkdown(input: string): string {
  if (!input) return "";

  // 1. Split out code fences so we don't touch their bodies.
  const segments: { kind: "code" | "text"; body: string }[] = [];
  const lines = input.split("\n");
  let inFence = false;
  let fenceMarker = "";
  let buf: string[] = [];
  const flush = (kind: "code" | "text") => {
    if (buf.length === 0) return;
    segments.push({ kind, body: buf.join("\n") });
    buf = [];
  };
  for (const line of lines) {
    const fenceMatch = line.match(/^(\s{0,3})(`{3,}|~{3,})/);
    if (!inFence && fenceMatch) {
      flush("text");
      inFence = true;
      fenceMarker = fenceMatch[2];
      buf.push(line);
      continue;
    }
    if (inFence) {
      buf.push(line);
      // Closing fence must match the opener length and char.
      const closing = line.match(/^(\s{0,3})(`{3,}|~{3,})\s*$/);
      if (closing && closing[2].startsWith(fenceMarker[0]) && closing[2].length >= fenceMarker.length) {
        flush("code");
        inFence = false;
        fenceMarker = "";
      }
      continue;
    }
    buf.push(line);
  }
  flush(inFence ? "code" : "text");

  // 2. Apply compaction to non-code segments only.
  const compactedText = (text: string): string =>
    text
      .replace(HTML_COMMENT_RE, "")
      .replace(TRAILING_WS_RE, "")
      .replace(/\n{3,}/g, "\n\n");

  const out = segments
    .map((s) => (s.kind === "text" ? compactedText(s.body) : s.body))
    .join("\n");

  return out.replace(/^\n+/, "").replace(/\n+$/, "\n");
}

/**
 * Build the standard token-economy headers attached to every /raw/*
 * response. Callers add their own Cache-Control / Link / Content-Type.
 */
export function tokenEconomyHeaders(body: string, opts: { compact: boolean; digest?: boolean }): Record<string, string> {
  return {
    "X-Token-Estimate": String(estimateTokens(body)),
    "X-Byte-Length": String(Buffer.byteLength(body, "utf8")),
    "X-Compact": opts.compact ? "1" : "0",
    ...(opts.digest ? { "X-Digest": "1" } : {}),
  };
}

/**
 * Parse the ?compact=1 query flag accepting common truthy spellings
 * (1, true, yes, on). Default false.
 */
export function isCompactRequested(url: string | URL): boolean {
  const u = typeof url === "string" ? new URL(url) : url;
  const v = (u.searchParams.get("compact") || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isDigestRequested(url: string | URL): boolean {
  const u = typeof url === "string" ? new URL(url) : url;
  const v = (u.searchParams.get("digest") || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

// Opt-OUT of the new digest-first defaults. `?full=1` on hub or
// bundle URLs returns the heavy, full-content payload instead of
// the lightweight digest. Also accepts `?digest=0` for symmetry.
export function isFullRequested(url: string | URL): boolean {
  const u = typeof url === "string" ? new URL(url) : url;
  const full = (u.searchParams.get("full") || "").toLowerCase();
  if (full === "1" || full === "true" || full === "yes" || full === "on") return true;
  const digest = u.searchParams.get("digest");
  if (digest !== null && (digest === "0" || digest.toLowerCase() === "false" || digest.toLowerCase() === "off")) {
    return true;
  }
  return false;
}
