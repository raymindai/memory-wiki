import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { embedText, hashEmbeddingSource, prepareEmbeddingInput, vectorToSql } from "@/lib/embeddings";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/embed/bundle/[id]
 *
 * Phase 3 RAG — recompute the bundle's embedding from
 * (title + description + member doc titles). Idempotent via
 * embedding_source_hash, same pattern as the doc embed route.
 *
 * Triggered:
 *   - bundle metadata edit (title/description)
 *   - bundle membership change (add / remove docs)
 *   - manual backfill via scripts/backfill-bundle-embeddings.mjs
 *
 * Authorization: caller must own the bundle.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const requesterId = verified?.userId || req.headers.get("x-user-id");
  const requesterAnonId = req.headers.get("x-anonymous-id");

  const { data: bundle, error: fetchErr } = await supabase
    .from("bundles")
    .select("id, title, description, user_id, anonymous_id, embedding_source_hash, embedding_updated_at")
    .eq("id", id)
    .single();
  if (fetchErr || !bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwner =
    !!(requesterId && bundle.user_id && requesterId === bundle.user_id) ||
    !!(requesterAnonId && bundle.anonymous_id && requesterAnonId === bundle.anonymous_id);
  if (!isOwner) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  // Pull member doc titles to enrich the embedding signal — a bundle's
  // "AI Memory Stack" is much more identifiable when the embedded text
  // also mentions "Mem0 Architecture Notes / Letta vs Mem0 / ...".
  const { data: memberRows } = await supabase
    .from("bundle_documents")
    .select("document_id")
    .eq("bundle_id", id)
    .order("sort_order", { ascending: true });
  const docIds = (memberRows || []).map((r) => r.document_id);
  let memberTitles: string[] = [];
  if (docIds.length > 0) {
    const { data: titleRows } = await supabase
      .from("documents")
      .select("id, title")
      .in("id", docIds)
      .is("deleted_at", null);
    const byId = new Map<string, string | null>(
      (titleRows || []).map((d) => [d.id as string, d.title as string | null]),
    );
    memberTitles = docIds
      .map((id) => byId.get(id) || null)
      .filter((t): t is string => !!t);
  }

  const titleStr = (bundle.title || "Untitled Bundle").trim();
  const descStr = (bundle.description || "").trim();
  const memberLine = memberTitles.length > 0
    ? `Members: ${memberTitles.join("; ")}`
    : "";
  const composite = [titleStr, descStr, memberLine].filter(Boolean).join("\n\n");

  if (composite.length < 8) {
    return NextResponse.json({
      skipped: true,
      reason: "empty",
      embedding_updated_at: bundle.embedding_updated_at || null,
    });
  }

  const input = prepareEmbeddingInput(null, composite);
  const hash = hashEmbeddingSource(input);
  if (bundle.embedding_source_hash === hash) {
    return NextResponse.json({
      skipped: true,
      reason: "unchanged",
      embedding_updated_at: bundle.embedding_updated_at || null,
    });
  }

  let vec: number[];
  try {
    vec = await embedText(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "embed failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from("bundles")
    .update({
      embedding: vectorToSql(vec),
      embedding_source_hash: hash,
      embedding_updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: `update_failed: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ embedded: true, member_count: memberTitles.length });
}
