import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { embedBatch, embedText, hashEmbeddingSource, prepareEmbeddingInput, vectorToSql } from "@/lib/embeddings";
import { chunkDocument } from "@/lib/chunk-doc";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/embed/[id]
 *
 * Recompute the doc's embedding if its content changed since the last
 * embedding. Idempotent — safe to call after every auto-save; the
 * `embedding_source_hash` short-circuits when nothing changed, avoiding
 * the OpenAI roundtrip entirely.
 *
 * Authorization: caller must own the doc (user_id or anonymous_id).
 * Embedding is per-user knowledge work, not a public action.
 *
 * Returns:
 *   { skipped: true, reason: "unchanged" }  — no work done
 *   { embedded: true, tokens: ~ }           — re-embedded
 *   { skipped: true, reason: "empty" }      — body too short to embed
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const requesterId = verified?.userId || req.headers.get("x-user-id");
  const requesterAnonId = req.headers.get("x-anonymous-id");

  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("id, markdown, title, user_id, anonymous_id, deleted_at, embedding_source_hash, allowed_editors")
    .eq("id", id)
    .single();

  if (fetchErr || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.deleted_at) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner =
    !!(requesterId && doc.user_id && requesterId === doc.user_id) ||
    !!(requesterAnonId && doc.anonymous_id && requesterAnonId === doc.anonymous_id);
  // Editor-role users (allowed_editors) also schedule embeds when
  // they save. Refusing those calls produced a 403 in the browser
  // console every time a collaborator typed — harmless to the
  // editor flow but noisy, and it left the doc's embedding stale
  // until the owner opened the doc.
  const requesterEmail = verified?.email || req.headers.get("x-user-email") || "";
  const allowedEditors = (doc.allowed_editors || []) as string[];
  const isAllowedEditor = !!requesterEmail && allowedEditors.some((e) => e.toLowerCase() === requesterEmail.toLowerCase());
  if (!isOwner && !isAllowedEditor) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const input = prepareEmbeddingInput(doc.title, doc.markdown);
  if (input.length < 20) {
    // Too little content to embed meaningfully — skip silently. Hub
    // search wouldn't surface it anyway.
    return NextResponse.json({ skipped: true, reason: "empty" });
  }

  const hash = hashEmbeddingSource(input);
  let docEmbedded: boolean;
  if (doc.embedding_source_hash === hash) {
    // Doc-level embedding is current. Fall through to chunk refresh —
    // chunks were added in Phase 2 RAG and may need a one-time backfill
    // for docs whose body never changed since the chunk table existed.
    // Both paths are idempotent: chunk hash diff is the actual gate.
    docEmbedded = false;
  } else {
    let vec: number[];
    try {
      vec = await embedText(input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "embed failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Use raw SQL via RPC since supabase-js doesn't natively serialize
    // pgvector arrays. The vectorToSql helper formats "[v1,v2,...]" which
    // pgvector parses on insert via implicit cast.
    const { error: updateErr } = await supabase
      .from("documents")
      .update({
        embedding: vectorToSql(vec),
        embedding_source_hash: hash,
        embedding_updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: `update failed: ${updateErr.message}` }, { status: 500 });
    }
    docEmbedded = true;
  }

  // ─── Chunk-level refresh (Phase 2 RAG) ─────────────────────────────
  // Re-chunk the doc, diff the new chunk hashes against what's stored,
  // and only embed the chunks that changed. Stale chunks (those that
  // no longer exist in the new split) are deleted. Best-effort — a
  // failure here doesn't fail the doc-level embed; the next save will
  // try again. Runs even when doc-level was a hash hit, so previously
  // un-chunked docs get backfilled.
  let chunkResult: { chunks: number; embedded: number; deleted: number } | null = null;
  try {
    chunkResult = await refreshDocChunks(id, doc.markdown);
  } catch (err) {
    return NextResponse.json({
      docEmbedded,
      chunkRefresh: { error: err instanceof Error ? err.message : "chunk refresh failed" },
    });
  }

  return NextResponse.json({
    docEmbedded,
    embedded: docEmbedded,                 // backwards-compat key
    chunks: chunkResult,
    skipped: !docEmbedded && chunkResult?.embedded === 0 ? { reason: "unchanged" } : undefined,
  });
}

// Idempotent chunk refresh. Mirrors the doc-level pattern:
//   1. compute new chunks + hashes
//   2. read stored (chunk_idx, hash) for this doc
//   3. delete chunk_idx values that no longer exist
//   4. embed only the chunks whose hash changed (or new ones)
//   5. upsert markdown / hash / embedding for each touched chunk
async function refreshDocChunks(
  docId: string,
  markdown: string,
): Promise<{ chunks: number; embedded: number; deleted: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("supabase unavailable");

  const newChunks = chunkDocument(markdown || "");

  const { data: stored } = await supabase
    .from("document_chunks")
    .select("chunk_idx, hash")
    .eq("doc_id", docId);
  const storedByIdx = new Map<number, string>();
  for (const row of stored || []) {
    storedByIdx.set(row.chunk_idx as number, row.hash as string);
  }

  // Delete chunks that no longer exist in the new split.
  const newIdxSet = new Set(newChunks.map((c) => c.chunk_idx));
  const toDelete = Array.from(storedByIdx.keys()).filter((idx) => !newIdxSet.has(idx));
  if (toDelete.length > 0) {
    await supabase
      .from("document_chunks")
      .delete()
      .eq("doc_id", docId)
      .in("chunk_idx", toDelete);
  }

  // Find which chunks need (re-)embedding.
  const toEmbed = newChunks.filter(
    (c) => storedByIdx.get(c.chunk_idx) !== c.hash,
  );

  if (toEmbed.length === 0) {
    return { chunks: newChunks.length, embedded: 0, deleted: toDelete.length };
  }

  const inputs = toEmbed.map((c) => prepareEmbeddingInput(c.heading_path, c.markdown));
  // embedBatch caps at 100 inputs/call. Most docs split into <30 chunks,
  // so a single batch call covers the common case; if a giant doc ever
  // exceeds the cap we slice it ourselves.
  const vectors: number[][] = [];
  for (let i = 0; i < inputs.length; i += 100) {
    const slice = inputs.slice(i, i + 100);
    const batch = await embedBatch(slice);
    vectors.push(...batch);
  }

  const now = new Date().toISOString();
  const upserts = toEmbed.map((c, i) => ({
    doc_id: docId,
    chunk_idx: c.chunk_idx,
    heading: c.heading,
    heading_path: c.heading_path,
    markdown: c.markdown,
    hash: c.hash,
    embedding: vectorToSql(vectors[i]),
    embedded_at: now,
  }));
  // Chunks unchanged but already in the table need their markdown / heading
  // updated too if (theoretically) heading_path moved without changing text.
  // The hash being equal means body+heading unchanged, so no upsert needed.
  const { error } = await supabase
    .from("document_chunks")
    .upsert(upserts, { onConflict: "doc_id,chunk_idx" });
  if (error) throw new Error(`chunk upsert: ${error.message}`);

  return { chunks: newChunks.length, embedded: toEmbed.length, deleted: toDelete.length };
}
