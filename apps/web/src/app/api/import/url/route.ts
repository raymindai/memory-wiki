// POST /api/import/url
//
// Body: { url: string }
//
// Fetches an arbitrary http(s) URL, converts the HTML body to
// markdown, and saves it as a draft document in the caller's hub.
// Same dedup contract as docs/PDF/GitHub/Obsidian/Notion.
//
// Why this exists: the AI-capture (Chrome ext / share URL paste)
// covers ChatGPT / Claude / Gemini. URL ingest covers everything
// else — blog posts, docs pages, public Notion pages without OAuth,
// HN comments, the long tail.

import { NextRequest, NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getServerUserId } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { appendHubLog } from "@/lib/hub-log";
import { findRecentDuplicateDoc, isStrictDupLockError } from "@/lib/doc-dedup";
import { enforceTitleInvariant } from "@/lib/extract-title";
import { importFromUrl, UrlImportError } from "@/lib/url-import";
import { uploadImageBuffer, rewriteMarkdownImages, findRemoteImages, mimeFromMagic } from "@/lib/import-images";

export const runtime = "nodejs";

interface ImportRow { id: string; title: string; url: string; host: string; deduplicated?: boolean }
interface ImportResult {
  imported: number;
  deduplicated: number;
  failed: number;
  docs: ImportRow[];
  /** Diagnostic counters for the image-rehost pass — surfaces in
   *  the UI so the user knows whether their images survived. */
  imagesFound?: number;
  imagesRehosted?: number;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = rateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id") || (await getServerUserId());
  if (!userId) {
    return NextResponse.json({ error: "Sign in to import a URL" }, { status: 401 });
  }

  let body: { url?: string };
  try { body = await req.json(); } catch { body = {}; }
  const rawUrl = (body.url || "").trim();
  if (!rawUrl) return NextResponse.json({ error: "url is required" }, { status: 400 });

  let fetched;
  try {
    fetched = await importFromUrl(rawUrl);
  } catch (err) {
    if (err instanceof UrlImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "URL import failed" }, { status: 502 });
  }

  // Rehost every absolute image URL the Turndown pass left behind.
  // Two reasons this needs parallel chunking + caps:
  //   1. Serial rehost of large image sets hits the Vercel function
  //      timeout (eopla.net articles can carry 50+ images).
  //   2. Pre-signed S3 URLs (X-Amz-Expires=600) are common and start
  //      expiring while a serial loop is still walking the list,
  //      causing late-image fetches to silently fail.
  // Cap total work at IMAGE_CAP — beyond that we keep the original
  // URLs (will rot eventually but at least the doc imports).
  const remoteImageUrls = findRemoteImages(fetched.markdown);
  const rehostMap = new Map<string, string>();
  const IMAGE_CAP = 60;
  const PER_IMAGE_TIMEOUT_MS = 12_000;
  const CONCURRENCY = 8;

  const targets = remoteImageUrls.slice(0, IMAGE_CAP);
  const rehostOne = async (u: string): Promise<void> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PER_IMAGE_TIMEOUT_MS);
    try {
      const r = await fetch(u, {
        headers: { "User-Agent": "mdfy.app/1.0 (Image rehost)" },
        redirect: "follow",
        signal: ctrl.signal,
      });
      if (!r.ok) return;
      const buf = Buffer.from(await r.arrayBuffer());
      const declared = r.headers.get("content-type") || "";
      const mime = declared.startsWith("image/") ? declared : mimeFromMagic(buf);
      if (!mime) return;
      const filename = u.split("?")[0].split("/").pop() || "image";
      const out = await uploadImageBuffer(buf, filename, mime, {
        supabase, ownerId: userId, trackQuota: false,
      });
      if (out) rehostMap.set(u, out.url);
    } catch (err) {
      console.warn(`url-import: rehost failed for ${u}:`, err instanceof Error ? err.message : err);
    } finally {
      clearTimeout(t);
    }
  };

  // Bounded-concurrency runner — process the queue in chunks of
  // CONCURRENCY without spawning all 60 fetches at once.
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(targets.slice(i, i + CONCURRENCY).map(rehostOne));
  }
  const rehostedMarkdown = rewriteMarkdownImages(fetched.markdown, rehostMap).markdown;

  const enforced = enforceTitleInvariant(rehostedMarkdown, fetched.title);
  const result: ImportResult = {
    imported: 0,
    deduplicated: 0,
    failed: 0,
    docs: [],
    imagesFound: remoteImageUrls.length,
    imagesRehosted: rehostMap.size,
  };
  const sourceTag = `url:${fetched.host}`;

  try {
    const dupHit = await findRecentDuplicateDoc(supabase, { userId }, enforced.markdown, enforced.title);
    if (dupHit) {
      result.deduplicated++;
      result.docs.push({ id: dupHit.id, title: enforced.title, url: fetched.url, host: fetched.host, deduplicated: true });
      return NextResponse.json(result);
    }

    let inserted = false;
    let lastError: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = nanoid(8);
      const editToken = nanoid(32);
      const { error } = await supabase.from("documents").insert({
        id,
        markdown: enforced.markdown,
        title: enforced.title,
        edit_token: editToken,
        user_id: userId,
        edit_mode: "account",
        is_draft: true,
        source: sourceTag,
        compile_from: { external: { provider: "url", url: fetched.url, host: fetched.host } },
      });
      if (!error) {
        result.imported++;
        result.docs.push({ id, title: enforced.title, url: fetched.url, host: fetched.host });
        inserted = true;
        break;
      }
      if (isStrictDupLockError(error)) {
        const survivor = await findRecentDuplicateDoc(supabase, { userId }, enforced.markdown, enforced.title);
        if (survivor) {
          result.deduplicated++;
          result.docs.push({ id: survivor.id, title: enforced.title, url: fetched.url, host: fetched.host, deduplicated: true });
          inserted = true;
          break;
        }
        lastError = error; break;
      }
      if (error.code === "23505") { lastError = error; continue; }
      lastError = error; break;
    }
    if (!inserted) {
      result.failed++;
      if (lastError) console.warn(`url-import: insert failed for ${fetched.url}:`, lastError.message);
    }
  } catch (err) {
    result.failed++;
    console.warn(`url-import: ${fetched.url} threw:`, err instanceof Error ? err.message : err);
  }

  if (result.imported > 0) {
    after(async () => {
      try {
        await appendHubLog({
          userId,
          event: "doc.imported",
          targetType: "document",
          targetId: result.docs[0]?.id || null,
          summary: `Imported "${result.docs[0]?.title || "page"}" from ${fetched.host}`,
          metadata: { provider: "url", url: fetched.url, host: fetched.host },
        });
      } catch { /* best-effort */ }
      try {
        const { enqueueOntologyRefresh } = await import("@/lib/ontology-refresh");
        for (const d of result.docs.filter((x) => !x.deduplicated)) {
          await enqueueOntologyRefresh({
            supabase, userId, docId: d.id, title: d.title, markdown: enforced.markdown,
          });
        }
      } catch (err) {
        console.warn("url-import: ontology refresh failed:", err instanceof Error ? err.message : err);
      }
    });
  }

  return NextResponse.json(result);
}
