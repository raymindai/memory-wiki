// POST /api/import/url
//
// Body: { url: string }
// Returns: text/event-stream (SSE)
//
//   event: stage    data: { key, label, done?, total? }
//   event: done     data: { id, title, host, deduplicated, imagesFound?, imagesRehosted? }
//   event: error    data: { message }
//
// Branches on URL kind:
//   - YouTube (youtube.com/watch, youtu.be/, /shorts, /embed)
//       → fetch oEmbed metadata + scrape transcript
//   - Anything else
//       → fetch HTML, Turndown to markdown, rehost images
//
// Same insert / dedup / source-tag / ontology-refresh path either way.

import { NextRequest, after } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getServerUserId } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { appendHubLog } from "@/lib/hub-log";
import { findRecentDuplicateDoc, isStrictDupLockError } from "@/lib/doc-dedup";
import { enforceTitleInvariant } from "@/lib/extract-title";
import { importFromUrl, UrlImportError } from "@/lib/url-import";
import { isYouTubeUrl, importFromYouTube, YouTubeImportError } from "@/lib/youtube-import";
import { uploadImageBuffer, rewriteMarkdownImages, findRemoteImages, mimeFromMagic } from "@/lib/import-images";
import { createSSEStream } from "@/lib/sse-stream";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = rateLimit(ip);
  if (!allowed) {
    // Plain JSON error — the SSE response only kicks in after we've
    // committed to running the import.
    return new Response(JSON.stringify({ error: "Too many requests. Try again in a minute." }), {
      status: 429, headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Storage not configured" }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id") || (await getServerUserId());
  if (!userId) {
    return new Response(JSON.stringify({ error: "Sign in to import a URL" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  let body: { url?: string };
  try { body = await req.json(); } catch { body = {}; }
  const rawUrl = (body.url || "").trim();
  if (!rawUrl) {
    return new Response(JSON.stringify({ error: "url is required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const { send, close, response } = createSSEStream();

  // Run the actual import in the background; the stream is already
  // wired up to the response below.
  (async () => {
    try {
      if (isYouTubeUrl(rawUrl)) {
        await runYouTubeImport({ rawUrl, supabase, userId, send });
      } else {
        await runWebImport({ rawUrl, supabase, userId, send });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      send("error", { message });
    } finally {
      close();
    }
  })();

  return response;
}

// ─── Web (HTML) import ──────────────────────────────────────────────

async function runWebImport(args: {
  rawUrl: string;
  supabase: ReturnType<typeof getSupabaseClient>;
  userId: string;
  send: (event: string, data: unknown) => void;
}) {
  const { rawUrl, supabase, userId, send } = args;
  if (!supabase) {
    send("error", { message: "Storage not configured" });
    return;
  }

  send("stage", { key: "fetch", label: "Fetching page…" });
  let fetched;
  try {
    fetched = await importFromUrl(rawUrl);
  } catch (err) {
    if (err instanceof UrlImportError) {
      send("error", { message: err.message });
    } else {
      send("error", { message: err instanceof Error ? err.message : "URL fetch failed" });
    }
    return;
  }

  send("stage", { key: "convert", label: `Converted ${fetched.host} → markdown` });

  // Image rehost — parallel + capped (see comment in earlier version).
  const remoteImageUrls = findRemoteImages(fetched.markdown);
  const rehostMap = new Map<string, string>();
  const IMAGE_CAP = 60;
  const PER_IMAGE_TIMEOUT_MS = 12_000;
  const CONCURRENCY = 8;
  const targets = remoteImageUrls.slice(0, IMAGE_CAP);
  send("stage", { key: "images", label: "Rehosting images", done: 0, total: targets.length });

  if (targets.length > 0) {
    let doneCount = 0;
    const rehostOne = async (u: string): Promise<void> => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PER_IMAGE_TIMEOUT_MS);
      try {
        const r = await fetch(u, {
          headers: { "User-Agent": "memory.wiki/1.0 (Image rehost)" },
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
        doneCount++;
        send("stage", { key: "images", label: "Rehosting images", done: doneCount, total: targets.length });
      }
    };
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      await Promise.all(targets.slice(i, i + CONCURRENCY).map(rehostOne));
    }
  }
  const rehostedMarkdown = rewriteMarkdownImages(fetched.markdown, rehostMap).markdown;
  const enforced = enforceTitleInvariant(rehostedMarkdown, fetched.title);

  send("stage", { key: "save", label: "Saving as draft…" });
  const inserted = await insertImportedDoc({
    supabase,
    userId,
    markdown: enforced.markdown,
    title: enforced.title,
    sourceTag: `url:${fetched.host}`,
    compileFromExternal: { provider: "url", url: fetched.url, host: fetched.host },
  });
  if (!inserted) {
    send("error", { message: "Couldn't save the imported page" });
    return;
  }

  send("done", {
    id: inserted.id,
    title: enforced.title,
    host: fetched.host,
    deduplicated: inserted.deduplicated,
    imagesFound: remoteImageUrls.length,
    imagesRehosted: rehostMap.size,
  });

  scheduleHubLogAndOntology({
    supabase,
    userId,
    docId: inserted.id,
    title: enforced.title,
    markdown: enforced.markdown,
    host: fetched.host,
    sourceUrl: fetched.url,
    deduplicated: inserted.deduplicated,
  });
}

// ─── YouTube import ─────────────────────────────────────────────────

async function runYouTubeImport(args: {
  rawUrl: string;
  supabase: ReturnType<typeof getSupabaseClient>;
  userId: string;
  send: (event: string, data: unknown) => void;
}) {
  const { rawUrl, supabase, userId, send } = args;
  if (!supabase) {
    send("error", { message: "Storage not configured" });
    return;
  }

  send("stage", { key: "fetch", label: "Reading video metadata…" });
  let yt;
  try {
    yt = await importFromYouTube(rawUrl, {
      onMetadata: () => send("stage", { key: "convert", label: "Loading watch page…" }),
      onTranscriptStart: () => send("stage", { key: "transcript", label: "Extracting transcript…" }),
    });
  } catch (err) {
    if (err instanceof YouTubeImportError) {
      send("error", { message: err.message });
    } else {
      send("error", { message: err instanceof Error ? err.message : "YouTube import failed" });
    }
    return;
  }

  const enforced = enforceTitleInvariant(yt.markdown, yt.title);

  send("stage", { key: "save", label: "Saving as draft…" });
  const inserted = await insertImportedDoc({
    supabase,
    userId,
    markdown: enforced.markdown,
    title: enforced.title,
    sourceTag: `url:youtube.com`,
    compileFromExternal: { provider: "youtube", url: yt.videoUrl, host: yt.host, videoId: yt.videoId, transcriptAvailable: yt.transcriptAvailable },
  });
  if (!inserted) {
    send("error", { message: "Couldn't save the imported video" });
    return;
  }

  send("done", {
    id: inserted.id,
    title: enforced.title,
    host: yt.host,
    deduplicated: inserted.deduplicated,
    transcriptAvailable: yt.transcriptAvailable,
  });

  scheduleHubLogAndOntology({
    supabase,
    userId,
    docId: inserted.id,
    title: enforced.title,
    markdown: enforced.markdown,
    host: yt.host,
    sourceUrl: yt.videoUrl,
    deduplicated: inserted.deduplicated,
  });
}

// ─── Shared DB insert + post-save tasks ─────────────────────────────

async function insertImportedDoc(args: {
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>;
  userId: string;
  markdown: string;
  title: string;
  sourceTag: string;
  compileFromExternal: Record<string, unknown>;
}): Promise<{ id: string; deduplicated: boolean } | null> {
  const { supabase, userId, markdown, title, sourceTag, compileFromExternal } = args;
  try {
    const dupHit = await findRecentDuplicateDoc(supabase, { userId }, markdown, title);
    if (dupHit) return { id: dupHit.id, deduplicated: true };

    for (let attempt = 0; attempt < 3; attempt++) {
      const id = nanoid(8);
      const editToken = nanoid(32);
      const { error } = await supabase.from("documents").insert({
        id,
        markdown,
        title,
        edit_token: editToken,
        user_id: userId,
        edit_mode: "account",
        is_draft: true,
        source: sourceTag,
        compile_from: { external: compileFromExternal },
      });
      if (!error) return { id, deduplicated: false };
      if (isStrictDupLockError(error)) {
        const survivor = await findRecentDuplicateDoc(supabase, { userId }, markdown, title);
        if (survivor) return { id: survivor.id, deduplicated: true };
        console.warn(`url-import: strict-dup-lock without survivor:`, error.message);
        return null;
      }
      if (error.code === "23505") continue; // id collision — retry
      console.warn(`url-import: insert failed (${error.code}):`, error.message);
      return null;
    }
  } catch (err) {
    console.warn(`url-import: insert threw:`, err instanceof Error ? err.message : err);
  }
  return null;
}

function scheduleHubLogAndOntology(args: {
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>;
  userId: string;
  docId: string;
  title: string;
  markdown: string;
  host: string;
  sourceUrl: string;
  deduplicated: boolean;
}) {
  if (args.deduplicated) return;
  const { supabase, userId, docId, title, markdown, host, sourceUrl } = args;
  after(async () => {
    try {
      await appendHubLog({
        userId,
        event: "doc.imported",
        targetType: "document",
        targetId: docId,
        summary: `Imported "${title}" from ${host}`,
        metadata: { provider: "url", url: sourceUrl, host },
      });
    } catch { /* best-effort */ }
    try {
      const { enqueueOntologyRefresh } = await import("@/lib/ontology-refresh");
      await enqueueOntologyRefresh({ supabase, userId, docId, title, markdown });
    } catch (err) {
      console.warn("url-import: ontology refresh failed:", err instanceof Error ? err.message : err);
    }
  });
}
