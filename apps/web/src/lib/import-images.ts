/**
 * Server-side image upload helper used by every /api/import/* route
 * that needs to preserve images from the source document.
 *
 * Mirrors the conversion + dedup + quota logic of /api/upload/route.ts
 * but skips the HTTP round-trip — import handlers already have the
 * Supabase client + ownerId in scope, so they call this directly with
 * a Buffer.
 *
 * What it does per image:
 *   1. Validate MIME + size against the same ALLOWED_TYPES + 5MB cap.
 *   2. Convert raster formats (PNG, JPEG, original WebP) to optimized
 *      WebP via sharp. Keep SVG + GIF as-is.
 *   3. Hash the result (first 16 hex chars of sha256). The hash is
 *      the storage filename, so the same image embedded twice in the
 *      same document — or across two documents — deduplicates.
 *   4. Upload to the `document-images` bucket under `<ownerId>/<hash>.<ext>`
 *      with upsert=true. Public URL goes back to the caller.
 *   5. Atomically increment storage usage on the profile row when the
 *      uploader is authenticated.
 *
 * Failure is non-throwing — every wrapper returns `null` on error and
 * logs to console.warn so a single broken image inside a big import
 * doesn't poison the rest of the document.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import crypto from "crypto";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface UploadResult {
  url: string;
  hash: string;
  bytes: number;
}

/**
 * Best-effort MIME guess from the lowercased extension. Used when the
 * source format gives us a filename but not a Content-Type.
 */
export function mimeFromExt(ext: string): string | null {
  switch (ext.toLowerCase().replace(/^\./, "")) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return null;
  }
}

/**
 * Sniff the MIME type from the first few bytes of a buffer when no
 * filename / declared type is reliable (e.g. PDF image XObjects).
 */
export function mimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  // WebP: "RIFF...WEBP"
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  // SVG: tolerate leading whitespace / BOM
  const head = buf.subarray(0, Math.min(buf.length, 64)).toString("utf8").trimStart();
  if (/^<\?xml/.test(head) || /^<svg/i.test(head)) return "image/svg+xml";
  return null;
}

export interface UploadOpts {
  supabase: SupabaseClient;
  /** Owner id — Supabase user UUID, "anon-<anonId>", or "public". */
  ownerId: string;
  /** Whether to count this against the user's storage quota. Anonymous
   *  imports bypass the quota row but still get rate-limited at the
   *  caller's HTTP layer. */
  trackQuota?: boolean;
}

/**
 * Upload a single image buffer to the document-images bucket and
 * return its public URL. Returns null when the input is invalid or
 * the upload fails — callers should treat null as "drop this image,
 * keep the rest of the document."
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  hintFilename: string,
  hintContentType: string | null,
  opts: UploadOpts,
): Promise<UploadResult | null> {
  if (!buffer || buffer.length === 0) return null;
  if (buffer.length > MAX_FILE_BYTES) {
    console.warn(`[import-images] dropping ${hintFilename}: ${buffer.length} bytes exceeds cap`);
    return null;
  }

  // Resolve content type from declared hint, then filename ext, then magic bytes.
  let contentType = hintContentType?.toLowerCase() || null;
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    const fromExt = mimeFromExt(hintFilename.split(".").pop() || "");
    if (fromExt && ALLOWED_TYPES.has(fromExt)) contentType = fromExt;
  }
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    const fromMagic = mimeFromMagic(buffer);
    if (fromMagic && ALLOWED_TYPES.has(fromMagic)) contentType = fromMagic;
  }
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    console.warn(`[import-images] dropping ${hintFilename}: unsupported type ${hintContentType || "unknown"}`);
    return null;
  }

  // WebP-convert raster formats; preserve SVG + GIF.
  let uploadBuffer: Buffer;
  let uploadContentType: string;
  let ext: string;
  // Same policy as /api/upload — every raster lands as WebP, GIF
  // becomes animated WebP. SVG stays vector. URL-import rehosts
  // route through here when the server pulls images out of a
  // fetched page, so this is the second of two enforcement points.
  if (contentType === "image/svg+xml") {
    uploadBuffer = buffer;
    uploadContentType = "image/svg+xml";
    ext = "svg";
  } else {
    try {
      const animated = contentType === "image/gif";
      uploadBuffer = await sharp(buffer, animated ? { animated: true } : {})
        .webp({ quality: 85 })
        .toBuffer();
      uploadContentType = "image/webp";
      ext = "webp";
    } catch (err) {
      // sharp choked — fall back to the raw buffer + declared type so
      // the user at least keeps the image.
      console.warn(`[import-images] sharp failed for ${hintFilename}; falling back to raw`, err);
      uploadBuffer = buffer;
      uploadContentType = contentType;
      ext = contentType === "image/png" ? "png"
          : contentType === "image/jpeg" ? "jpg"
          : contentType === "image/gif" ? "gif"
          : "webp";
    }
  }

  const hash = crypto.createHash("sha256").update(uploadBuffer).digest("hex").slice(0, 16);
  const storagePath = `${opts.ownerId}/${hash}.${ext}`;

  const { error: uploadError } = await opts.supabase.storage
    .from("document-images")
    .upload(storagePath, uploadBuffer, {
      contentType: uploadContentType,
      upsert: true,
    });
  if (uploadError) {
    console.warn(`[import-images] supabase upload failed for ${storagePath}:`, uploadError.message);
    return null;
  }

  const { data: urlData } = opts.supabase.storage
    .from("document-images")
    .getPublicUrl(storagePath);

  // Quota tracking — best-effort, won't fail the upload.
  if (opts.trackQuota && !opts.ownerId.startsWith("anon-") && opts.ownerId !== "public") {
    try {
      const { data: profile } = await opts.supabase
        .from("profiles")
        .select("storage_used_bytes")
        .eq("id", opts.ownerId)
        .single();
      if (profile) {
        await opts.supabase
          .from("profiles")
          .update({ storage_used_bytes: (profile.storage_used_bytes || 0) + uploadBuffer.length })
          .eq("id", opts.ownerId);
      }
    } catch {
      /* swallow — quota drift is recoverable; image lock-out is not */
    }
  }

  return { url: urlData.publicUrl, hash, bytes: uploadBuffer.length };
}

/**
 * Walk a markdown body, find every `![alt](path)` whose `path` matches
 * a key in `imageMap`, and rewrite the path to the new URL. Returns the
 * rewritten markdown plus the count of references touched.
 *
 * The matching is intentionally generous about path normalisation —
 * Obsidian / Notion exports can spell the same image as `./img.png`,
 * `img.png`, `attachments/img.png`, or URL-encoded variants. We try
 * a few common normalisations.
 */
export function rewriteMarkdownImages(
  markdown: string,
  imageMap: Map<string, string>,
): { markdown: string; rewritten: number } {
  if (imageMap.size === 0) return { markdown, rewritten: 0 };

  // Lowercased key index for case-insensitive lookups + a trailing-segment
  // index so `attachments/img.png` matches a body ref to just `img.png`.
  const exactLower = new Map<string, string>();
  const byTail = new Map<string, string>();
  for (const [key, url] of imageMap) {
    exactLower.set(key.toLowerCase(), url);
    const tail = key.split(/[\\/]/).pop() || key;
    if (!byTail.has(tail.toLowerCase())) byTail.set(tail.toLowerCase(), url);
  }

  let rewritten = 0;
  const out = markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (full, alt, target, titleAttr) => {
    if (/^https?:\/\//i.test(target) || /^data:/i.test(target)) return full;
    let key = target.replace(/^\.\//, "");
    try { key = decodeURIComponent(key); } catch { /* malformed escape */ }
    const lookup =
      exactLower.get(key.toLowerCase())
      || exactLower.get(target.toLowerCase())
      || byTail.get((key.split(/[\\/]/).pop() || "").toLowerCase());
    if (!lookup) return full;
    rewritten++;
    return `![${alt}](${lookup}${titleAttr || ""})`;
  });

  // Obsidian-style `![[image.png]]` embed (still emitted by some export
  // tools even though we don't preserve wikilinks elsewhere).
  const out2 = out.replace(/!\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (full, target) => {
    const key = target.trim();
    const lookup =
      exactLower.get(key.toLowerCase())
      || byTail.get((key.split(/[\\/]/).pop() || "").toLowerCase());
    if (!lookup) return full;
    rewritten++;
    return `![](${lookup})`;
  });

  return { markdown: out2, rewritten };
}

/**
 * Convenience: scan a markdown body for inline image references that
 * look like absolute URLs (`![](https://...)`). The caller can pass
 * each URL to a fetcher + uploadImageBuffer to rehost. We don't run
 * the fetch here — it's caller-specific (auth headers for private
 * GitHub repos, etc.).
 */
export function findRemoteImages(markdown: string): string[] {
  const out = new Set<string>();
  const re = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
}
