import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { embedText, prepareEmbeddingInput, vectorToSql } from "@/lib/embeddings";
import { rerank } from "@/lib/reranker";
import { logRecall } from "@/lib/recall-telemetry";

// Phase 1 — public Recall API.
//
// POST /api/hub/<slug>/recall
//   body: { question: string, k?: number }
//   → { hub: { slug, display_name }, results: [{ id, title, url, snippet, distance, updated_at }] }
//
// Owner-aware semantic search but PUBLIC — anyone with the hub URL can
// ask a question against that hub's public docs and get the top-k
// matches. Designed for AI agents that paste the hub URL today: instead
// of fetching the entire markdown index, they call this endpoint with
// their actual question and get a fraction of the tokens with much
// better precision.
//
// Privacy: the underlying RPC restricts to is_draft=false +
// password_hash IS NULL + no allowed_emails. Drafts, password-protected,
// and email-restricted docs never leak via this surface.

const MAX_K = 20;
const DEFAULT_K = 5;
const SLUG_RE = /^[a-z0-9_-]{3,32}$/;

interface PublicHubRecallBody {
  question?: string;
  k?: number;
  /** Retrieval granularity:
   *    "doc"    — whole-doc matches (default, Phase 1)
   *    "chunk"  — paragraph-level matches (Phase 2)
   *    "bundle" — curated bundle matches (Phase 3) */
  level?: "doc" | "chunk" | "bundle";
  /** When true on level="chunk", merges BM25 + vector cosine via
   *  reciprocal rank fusion (Phase 4). No effect on doc/bundle levels. */
  hybrid?: boolean;
  /** When true, runs a cross-encoder rerank pass on the first-pass
   *  candidates before truncating to k. Doubles the per-call cost
   *  (one Anthropic Haiku request) but materially improves
   *  precision on ambiguous queries. */
  rerank?: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const t0 = Date.now();
  const { slug } = await params;
  const ua = request.headers.get("user-agent")?.replace(/[\r\n]+/g, " ") || null;
  const referer = request.headers.get("referer")?.replace(/[\r\n]+/g, " ") || null;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  let body: PublicHubRecallBody;
  try {
    body = (await request.json()) as PublicHubRecallBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const question = (body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "question_required" }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "question_too_long" }, { status: 400 });
  }

  const k = Math.min(Math.max(body.k ?? DEFAULT_K, 1), MAX_K);
  const level: "doc" | "chunk" | "bundle" =
    body.level === "chunk" || body.level === "bundle" ? body.level : "doc";
  const hybrid = !!body.hybrid && level === "chunk";
  const useRerank = !!body.rerank;
  // Pull a wider first-pass when reranking — gives the cross-encoder
  // more candidates to reorder before we truncate to `k`.
  const fetchK = useRerank ? Math.min(MAX_K, k * 4) : k;
  let embedMs = 0;
  let searchMs = 0;
  let rerankMs = 0;

  // Resolve hub → owner user_id; only public hubs are eligible.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, hub_slug, display_name, hub_public")
    .eq("hub_slug", slug)
    .single();
  if (!profile || !profile.hub_public) {
    logRecall({
      slug, questionChars: question.length, level, hybrid,
      rerankRequested: useRerank, reranked: false, k, fetchK,
      resultCount: 0, embedMs: 0, searchMs: 0, rerankMs: 0,
      totalMs: Date.now() - t0, status: 404, errorCode: "hub_not_public",
      ua, referer,
    });
    return NextResponse.json({ error: "hub_not_public" }, { status: 404 });
  }

  // Embed the question. Best-effort; if the embedding provider is
  // unreachable we fail loud so the caller can decide what to do.
  let queryVec: number[];
  const tEmbed = Date.now();
  try {
    queryVec = await embedText(prepareEmbeddingInput(null, question));
  } catch (err) {
    embedMs = Date.now() - tEmbed;
    logRecall({
      slug, questionChars: question.length, level, hybrid,
      rerankRequested: useRerank, reranked: false, k, fetchK,
      resultCount: 0, embedMs, searchMs: 0, rerankMs: 0,
      totalMs: Date.now() - t0, status: 502, errorCode: "embedding_failed",
      ua, referer,
    });
    return NextResponse.json(
      { error: "embedding_failed", detail: (err as Error).message },
      { status: 502 },
    );
  }
  embedMs = Date.now() - tEmbed;

  let results: unknown[];
  const tSearch = Date.now();

  if (level === "bundle") {
    const { data: rows, error } = await supabase.rpc("match_public_hub_bundles", {
      query_embedding: vectorToSql(queryVec),
      p_hub_user_id: profile.id,
      match_count: fetchK,
    });
    if (error) {
      searchMs = Date.now() - tSearch;
      logRecall({
        slug, questionChars: question.length, level, hybrid,
        rerankRequested: useRerank, reranked: false, k, fetchK,
        resultCount: 0, embedMs, searchMs, rerankMs: 0,
        totalMs: Date.now() - t0, status: 500, errorCode: "search_failed",
        ua, referer,
      });
      return NextResponse.json({ error: "search_failed", detail: error.message }, { status: 500 });
    }

    type BundleRow = {
      id: string;
      title: string | null;
      description: string | null;
      updated_at: string;
      document_count: number;
      distance: number;
    };

    results = (rows as BundleRow[] | null || []).map((r) => ({
      id: r.id,
      title: r.title || "Untitled Bundle",
      description: r.description || "",
      url: `https://memory.wiki/b/${r.id}`,
      raw_url: `https://memory.wiki/raw/bundle/${r.id}`,
      document_count: Number(r.document_count),
      distance: Number(r.distance.toFixed(4)),
      updated_at: r.updated_at,
    }));
  } else if (level === "chunk" && hybrid) {
    const { data: rows, error } = await supabase.rpc("hybrid_match_public_hub_chunks", {
      query_text: question,
      query_embedding: vectorToSql(queryVec),
      p_hub_user_id: profile.id,
      match_count: fetchK,
    });
    if (error) {
      searchMs = Date.now() - tSearch;
      logRecall({
        slug, questionChars: question.length, level, hybrid,
        rerankRequested: useRerank, reranked: false, k, fetchK,
        resultCount: 0, embedMs, searchMs, rerankMs: 0,
        totalMs: Date.now() - t0, status: 500, errorCode: "search_failed",
        ua, referer,
      });
      return NextResponse.json({ error: "search_failed", detail: error.message }, { status: 500 });
    }

    type HybridChunkRow = {
      chunk_id: number;
      doc_id: string;
      chunk_idx: number;
      heading: string | null;
      heading_path: string | null;
      markdown: string;
      doc_title: string | null;
      doc_updated_at: string;
      vector_rank: number | null;
      fts_rank: number | null;
      rrf_score: number;
    };

    results = (rows as HybridChunkRow[] | null || []).map((r) => ({
      chunk_id: r.chunk_id,
      doc_id: r.doc_id,
      chunk_idx: r.chunk_idx,
      heading: r.heading,
      heading_path: r.heading_path,
      markdown: r.markdown,
      doc_title: r.doc_title || "Untitled",
      doc_url: `https://memory.wiki/${r.doc_id}`,
      raw_url: `https://memory.wiki/raw/${r.doc_id}`,
      vector_rank: r.vector_rank,
      fts_rank: r.fts_rank,
      rrf_score: Number(r.rrf_score.toFixed(5)),
      updated_at: r.doc_updated_at,
    }));
  } else if (level === "chunk") {
    const { data: rows, error } = await supabase.rpc("match_public_hub_chunks", {
      query_embedding: vectorToSql(queryVec),
      p_hub_user_id: profile.id,
      match_count: fetchK,
    });
    if (error) {
      searchMs = Date.now() - tSearch;
      logRecall({
        slug, questionChars: question.length, level, hybrid,
        rerankRequested: useRerank, reranked: false, k, fetchK,
        resultCount: 0, embedMs, searchMs, rerankMs: 0,
        totalMs: Date.now() - t0, status: 500, errorCode: "search_failed",
        ua, referer,
      });
      return NextResponse.json({ error: "search_failed", detail: error.message }, { status: 500 });
    }

    type ChunkRow = {
      chunk_id: number;
      doc_id: string;
      chunk_idx: number;
      heading: string | null;
      heading_path: string | null;
      markdown: string;
      doc_title: string | null;
      doc_updated_at: string;
      distance: number;
    };

    results = (rows as ChunkRow[] | null || []).map((r) => ({
      chunk_id: r.chunk_id,
      doc_id: r.doc_id,
      chunk_idx: r.chunk_idx,
      heading: r.heading,
      heading_path: r.heading_path,
      markdown: r.markdown,
      doc_title: r.doc_title || "Untitled",
      doc_url: `https://memory.wiki/${r.doc_id}`,
      raw_url: `https://memory.wiki/raw/${r.doc_id}`,
      distance: Number(r.distance.toFixed(4)),
      updated_at: r.doc_updated_at,
    }));
  } else {
    const { data: rows, error } = await supabase.rpc("match_public_hub_docs", {
      query_embedding: vectorToSql(queryVec),
      p_hub_user_id: profile.id,
      match_count: fetchK,
    });
    if (error) {
      searchMs = Date.now() - tSearch;
      logRecall({
        slug, questionChars: question.length, level, hybrid,
        rerankRequested: useRerank, reranked: false, k, fetchK,
        resultCount: 0, embedMs, searchMs, rerankMs: 0,
        totalMs: Date.now() - t0, status: 500, errorCode: "search_failed",
        ua, referer,
      });
      return NextResponse.json({ error: "search_failed", detail: error.message }, { status: 500 });
    }

    type DocRow = {
      id: string;
      title: string | null;
      markdown: string;
      updated_at: string;
      source: string | null;
      distance: number;
    };

    results = (rows as DocRow[] | null || []).map((r) => {
      const cleaned = (r.markdown || "")
        .replace(/^---[\s\S]*?---\s*/m, "")
        .replace(/^#+\s+.*$/gm, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return {
        id: r.id,
        title: r.title || "Untitled",
        url: `https://memory.wiki/${r.id}`,
        raw_url: `https://memory.wiki/raw/${r.id}`,
        snippet: cleaned.slice(0, 200),
        distance: Number(r.distance.toFixed(4)),
        updated_at: r.updated_at,
      };
    });
  }

  searchMs = Date.now() - tSearch;

  // Optional cross-encoder rerank pass. Each result gets a
  // `rerank_score` 0..1 and the array is reordered descending by
  // it. Falls back to the first-pass ordering when no reranker
  // provider is configured (lib/reranker handles that gracefully).
  let reranked = false;
  if (useRerank && Array.isArray(results) && results.length > 1) {
    type Anyish = Record<string, unknown>;
    const candidates = (results as Anyish[]).map((r, idx) => ({
      id: String((r.chunk_id ?? r.id ?? idx) as string | number),
      text: String(
        (r.markdown as string | undefined)
          ?? (r.snippet as string | undefined)
          ?? (r.description as string | undefined)
          ?? "",
      ),
      _ref: r,
    }));
    const tRerank = Date.now();
    const ranked = await rerank(question, candidates);
    rerankMs = Date.now() - tRerank;
    if (ranked.length > 0) {
      reranked = true;
      results = ranked.map((rr) => ({
        ...(rr.candidate as { _ref: Anyish })._ref,
        rerank_score: Number(rr.score.toFixed(4)),
      }));
    }
  }

  // Always truncate to the requested k AFTER any rerank, so the
  // caller gets exactly the top-k they asked for.
  if (Array.isArray(results) && results.length > k) {
    results = results.slice(0, k);
  }

  const resultCount = Array.isArray(results) ? results.length : 0;
  logRecall({
    slug, questionChars: question.length, level, hybrid,
    rerankRequested: useRerank, reranked, k, fetchK,
    resultCount, embedMs, searchMs, rerankMs,
    totalMs: Date.now() - t0, status: 200,
    ua, referer,
  });

  return NextResponse.json(
    {
      hub: { slug, display_name: profile.display_name || slug },
      question,
      level,
      results,
      meta: {
        retrieval: hybrid ? "hybrid_rrf" : "vector",
        model: "text-embedding-3-small",
        dim: 1536,
        k,
        hybrid,
        reranked,
        timing_ms: {
          embed: embedMs,
          search: searchMs,
          rerank: rerankMs,
          total: Date.now() - t0,
        },
      },
    },
    {
      headers: {
        // No edge cache — the response is question-specific and cheap to recompute.
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return NextResponse.json(
    {
      message: "POST { question, k? } to query this hub semantically",
      example: {
        method: "POST",
        url: `https://memory.wiki/api/hub/${slug}/recall`,
        body: { question: "How does X work?", k: 5 },
      },
    },
    { headers: { Allow: "POST, GET" } },
  );
}
