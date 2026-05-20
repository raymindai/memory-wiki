// POST /api/import/notion
//
// Body: { token: string, pageUrl?: string, pageId?: string }
//
// Pulls a Notion page (the one whose URL/id was pasted) via the
// caller's internal integration token, converts the block tree to
// markdown, and inserts it as a draft document in their hub. Same
// dedup contract as the other ingest surfaces (GitHub / Obsidian /
// PDF / MCP) so re-running is idempotent.
//
// v1 is single-page only; recursive child-page walks land in v2
// once we agree on a sane depth cap. Multi-page is also achievable
// today by POSTing N times — the dedup means repeat posts are safe.
//
// Why integration tokens (not OAuth) for v1: OAuth needs a public
// client_id + per-user encrypted token storage. Internal integration
// tokens cover the "I want my Notion notes in memory.wiki" path with zero
// infra; the user pastes the token once per import.

import { NextRequest, NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getServerUserId } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { appendHubLog } from "@/lib/hub-log";
import { findRecentDuplicateDoc, isStrictDupLockError } from "@/lib/doc-dedup";
import { enforceTitleInvariant } from "@/lib/extract-title";
import { parseNotionPageId, importNotionPage, NotionImportError } from "@/lib/notion-import";
import { uploadImageBuffer, rewriteMarkdownImages, findRemoteImages, mimeFromMagic } from "@/lib/import-images";

interface ImportRow { id: string; title: string; notionPageId: string; pageUrl: string; deduplicated?: boolean }
interface ImportResult { imported: number; deduplicated: number; failed: number; docs: ImportRow[] }

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
    return NextResponse.json({ error: "Sign in to import from Notion" }, { status: 401 });
  }

  let body: { token?: string; pageUrl?: string; pageId?: string };
  try { body = await req.json(); } catch { body = {}; }
  const token = (body.token || "").trim();
  if (!token) return NextResponse.json({ error: "Notion integration token is required" }, { status: 400 });

  const idInput = (body.pageId || body.pageUrl || "").trim();
  if (!idInput) return NextResponse.json({ error: "pageUrl or pageId is required" }, { status: 400 });

  const pageId = parseNotionPageId(idInput);
  if (!pageId) {
    return NextResponse.json({ error: "Couldn't parse a Notion page ID from that input" }, { status: 400 });
  }

  let page;
  try {
    page = await importNotionPage(token, pageId);
  } catch (err) {
    if (err instanceof NotionImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Notion fetch failed" }, { status: 502 });
  }

  const result: ImportResult = { imported: 0, deduplicated: 0, failed: 0, docs: [] };

  // Notion image blocks come back as S3 signed URLs that expire in
  // ~1 hour, so the imported doc would 404 its images by the time
  // anyone re-reads it. Rehost every remote image we extracted into
  // our document-images bucket before we persist the markdown.
  const remoteUrls = findRemoteImages(page.markdown);
  const rehostMap = new Map<string, string>();
  for (const url of remoteUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const declared = res.headers.get("content-type") || null;
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = declared && declared.startsWith("image/") ? declared : mimeFromMagic(buf);
      if (!mime) continue;
      const filename = url.split("?")[0].split("/").pop() || "image";
      const out = await uploadImageBuffer(buf, filename, mime, {
        supabase, ownerId: userId, trackQuota: false,
      });
      if (out) rehostMap.set(url, out.url);
    } catch (err) {
      console.warn(`notion-import: rehost failed for ${url}:`, err instanceof Error ? err.message : err);
    }
  }
  const rehosted = rewriteMarkdownImages(page.markdown, rehostMap);
  const enforced = enforceTitleInvariant(rehosted.markdown, page.title);

  try {
    const dupHit = await findRecentDuplicateDoc(supabase, { userId }, enforced.markdown, enforced.title);
    if (dupHit) {
      result.deduplicated++;
      result.docs.push({ id: dupHit.id, title: enforced.title, notionPageId: page.id, pageUrl: page.pageUrl, deduplicated: true });
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
        source: "notion",
        // Same convention as github/obsidian: stash provenance so a
        // future re-sync can find the original Notion page.
        compile_from: { external: { provider: "notion", pageId: page.id, url: page.pageUrl } },
      });
      if (!error) {
        result.imported++;
        result.docs.push({ id, title: enforced.title, notionPageId: page.id, pageUrl: page.pageUrl });
        inserted = true;
        break;
      }
      if (isStrictDupLockError(error)) {
        const survivor = await findRecentDuplicateDoc(supabase, { userId }, enforced.markdown, enforced.title);
        if (survivor) {
          result.deduplicated++;
          result.docs.push({ id: survivor.id, title: enforced.title, notionPageId: page.id, pageUrl: page.pageUrl, deduplicated: true });
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
      if (lastError) console.warn(`notion-import: insert failed for ${page.id}:`, lastError.message);
    }
  } catch (err) {
    result.failed++;
    console.warn(`notion-import: ${page.id} threw:`, err instanceof Error ? err.message : err);
  }

  if (result.imported > 0) {
    after(async () => {
      try {
        await appendHubLog({
          userId,
          event: "doc.imported",
          targetType: "document",
          targetId: result.docs[0]?.id || null,
          summary: `Imported "${result.docs[0]?.title || "Notion page"}" from Notion`,
          metadata: { provider: "notion", pageId: page.id, url: page.pageUrl },
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
        console.warn("notion-import: ontology refresh failed:", err instanceof Error ? err.message : err);
      }
    });
  }

  return NextResponse.json(result);
}
