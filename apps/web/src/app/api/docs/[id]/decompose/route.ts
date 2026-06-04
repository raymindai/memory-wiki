import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { callAI } from "@/lib/ai-providers";

type RouteParams = { params: Promise<{ id: string }> };

// Normalized substring matcher used by both POST (write-time) and GET
// (read-time) so the Stale flag has consistent semantics. Strict
// `markdown.includes(content)` flagged AI paraphrasing as Stale even when
// the user never touched the source — see route comment block below for
// details. By collapsing whitespace, unifying smart quotes / em-dashes,
// and lowercasing, we let "the AI tweaked a comma" pass while still
// catching real source edits.
function normalizeForMatch(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")     // smart single quotes → '
    .replace(/[“”]/g, '"')             // smart double quotes → "
    .replace(/[–—−]/g, "-")     // en-dash / em-dash / minus → -
    .replace(/[   ]/g, " ")     // non-breaking spaces → space
    .replace(/\s+/g, " ")                         // collapse all whitespace runs
    .trim()
    .toLowerCase();
}

function docHasChunk(docMarkdown: string, chunkContent: string): boolean {
  const haystack = normalizeForMatch(docMarkdown);
  const needle = normalizeForMatch(chunkContent);
  if (needle.length === 0) return true; // empty content shouldn't false-flag
  return haystack.includes(needle);
}

/**
 * Per-document AI semantic decomposition.
 *
 *   POST /api/docs/[id]/decompose          → run + cache
 *   POST /api/docs/[id]/decompose?force=1  → ignore cache, re-run
 *   GET  /api/docs/[id]/decompose          → return cached result (or 404)
 *
 * The AI breaks the document into typed chunks (concept / claim / example /
 * definition / task / question / context / evidence) and adds typed edges
 * (supports, elaborates, contradicts, exemplifies, depends_on, related).
 *
 * IMPORTANT: each chunk's `content` field is **verbatim** from the source
 * markdown so the editor can find-and-replace it later. The label is a 3-5
 * word AI-generated title.
 */

const DECOMPOSE_PROMPT = `You are a knowledge architect. Break the given document into semantic chunks — units of meaning that stand on their own.

Return ONLY valid JSON:
{
  "chunks": [
    {
      "id": "c1",
      "type": "concept|claim|example|definition|task|question|context|evidence",
      "label": "3-5 word title",
      "content": "EXACT verbatim substring from the document — must match character-for-character so an editor can find-and-replace it",
      "weight": 1-10
    }
  ],
  "edges": [
    {
      "source": "c1",
      "target": "c2",
      "type": "supports|elaborates|contradicts|exemplifies|depends_on|related",
      "label": "2-4 word relationship",
      "weight": 1-5
    }
  ]
}

CHUNK TYPES — pick the closest match:
- concept: an abstract idea, model, framework, principle
- claim: an assertion or argument the author is making
- example: a concrete instance illustrating something
- definition: explaining what a term/thing IS
- task: an action item, todo, recommendation
- question: an open question, area of uncertainty
- context: background, setup, framing material
- evidence: data, quotes, citations, supporting facts

CRITICAL RULES:
- chunk.content MUST be a verbatim substring from the document (whitespace OK to differ slightly, but the prose must match). Do NOT summarize or paraphrase the content field.
- chunk.label is YOUR short title (3-5 words). chunk.content is THEIR words.
- Aim for 5-20 chunks for typical documents. Don't fragment short paragraphs into multiple chunks.
- Every chunk should have a clear semantic role. If a paragraph is just a bridge, fold it into the surrounding chunk.
- weight: 1-10 reflects importance to the document's overall point.
- edges: connect chunks that have a meaningful relationship. Aim for ~1-2 edges per chunk on average. No orphan chunks if possible.
- edge.type: pick the strongest relationship type that applies.
- Return raw JSON only — no markdown code fences, no commentary.`;

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const { data: doc } = await supabase
    .from("documents")
    .select("user_id, anonymous_id, edit_mode, allowed_emails, semantic_chunks, decomposed_at, markdown")
    .eq("id", id)
    .single();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Visibility: same rules as /api/docs/[id] — owner via JWT/anonymousId, or
  // public via edit_mode = "public" / "view".
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  const anonymousId = req.headers.get("x-anonymous-id");
  const isOwner =
    !!(userId && doc.user_id && userId === doc.user_id) ||
    !!(anonymousId && doc.anonymous_id && anonymousId === doc.anonymous_id);
  const isPublicReadable = doc.edit_mode === "public" || doc.edit_mode === "view";
  if (!isOwner && !isPublicReadable) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!doc.semantic_chunks) {
    // 200 + null payload instead of 404. The bundle viewer's discovery
    // loader fires this against every member doc; a 404 there is a
    // silent "no cache yet" but DevTools shows it as a red error,
    // polluting the console. Caller already gates on `semanticChunks`,
    // so no behavior change.
    return NextResponse.json({ semanticChunks: null, cached: false });
  }
  // Re-verify each cached chunk against the CURRENT markdown — the cached
  // `found` flag was computed at decomposition time. If the user has since
  // edited the source doc, that's the only condition that should make a
  // chunk Stale. Re-check here using the same normalized matcher used at
  // write time so behaviour is symmetric.
  type ChunkLike = { content: string; found?: boolean };
  type CachedChunks = { chunks: ChunkLike[] } & Record<string, unknown>;
  const cached = doc.semantic_chunks as CachedChunks | null;
  const reverified = cached
    ? { ...cached, chunks: cached.chunks.map((c) => ({ ...c, found: docHasChunk(doc.markdown, c.content) })) }
    : cached;
  return NextResponse.json({ semanticChunks: reverified, generatedAt: doc.decomposed_at });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  let body: { editToken?: string; userId?: string; anonymousId?: string; intent?: string };
  try { body = await req.json(); } catch { body = {}; }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, markdown, user_id, anonymous_id, edit_token, edit_mode, allowed_emails, semantic_chunks, decomposed_at")
    .eq("id", id)
    .single();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auth: owner only (writing semantic_chunks back to the row). Mirror the
  // same header/body fallback chain the rest of the API uses so anonymous
  // users with x-anonymous-id and signed-in users with x-user-id (no JWT)
  // both work.
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = body.userId || verified?.userId || req.headers.get("x-user-id") || undefined;
  const anonymousId = body.anonymousId || req.headers.get("x-anonymous-id") || undefined;
  const isOwner =
    !!(userId && doc.user_id && userId === doc.user_id) ||
    !!(anonymousId && doc.anonymous_id && anonymousId === doc.anonymous_id);
  const hasToken = !!(body.editToken && doc.edit_token === body.editToken);
  if (!isOwner && !hasToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!force && doc.semantic_chunks) {
    return NextResponse.json({ semanticChunks: doc.semantic_chunks, generatedAt: doc.decomposed_at, cached: true });
  }

  if (!doc.markdown || !doc.markdown.trim()) {
    return NextResponse.json({ error: "Document is empty" }, { status: 400 });
  }

  // Cap input — long docs get the first 12k chars (most use cases fit easily).
  const excerpt = doc.markdown.slice(0, 12000);
  // When the bundle (or caller) provides an intent, the AI weights chunks by
  // relevance to it — task / question chunks tied to the intent get higher
  // weight, irrelevant context drops in importance.
  const intentLine = body.intent && body.intent.trim()
    ? `\n\nReader's intent (weight chunks by relevance to this): "${body.intent.trim()}"`
    : "";
  const prompt = `${DECOMPOSE_PROMPT}${intentLine}\n\nDocument title: "${doc.title || "Untitled"}"\n\nDocument content:\n${excerpt}`;

  try {
    const ai = await callAI({
      prompt,
      useLiteModel: true,
      temperature: 0.3,
      maxOutputTokens: 4096,
      userId,
      anonymousId,
      action: "doc-decompose",
    });
    if (!ai.ok) {
      return NextResponse.json({ error: ai.error || "AI extraction failed" }, { status: ai.rateLimited ? 429 : 502 });
    }
    const result = parseChunksJson(ai.text);
    if (!result) return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });

    // Verify chunk content can still be located in the source. AI commonly
    // tweaks whitespace, smart quotes, or dash style despite the prompt —
    // a strict `markdown.includes(content)` check then false-flags chunks
    // as Stale even though the user never edited the source. Stale should
    // mean "the source DOC was changed after decomposition," not "the AI
    // paraphrased a comma." docHasChunk normalizes both sides before
    // substring testing.
    for (const c of result.chunks) {
      c.found = docHasChunk(doc.markdown, c.content);
    }
    result.version = 1;

    const now = new Date().toISOString();
    await supabase
      .from("documents")
      .update({ semantic_chunks: result, decomposed_at: now })
      .eq("id", id);

    return NextResponse.json({ semanticChunks: result, generatedAt: now, cached: false });
  } catch (err) {
    console.error("Decompose AI error:", err);
    return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });
  }
}

// ─── Types + provider impls ─────────────────────────────────────────────

interface SemanticChunk {
  id: string;
  type: string;
  label: string;
  content: string;
  weight: number;
  found?: boolean;
}
interface SemanticEdge {
  source: string;
  target: string;
  type: string;
  label?: string;
  weight: number;
}
interface SemanticChunksResult {
  chunks: SemanticChunk[];
  edges: SemanticEdge[];
  version?: number;
}

// Provider-specific implementations removed — routes through callAI.

function parseChunksJson(text: string): SemanticChunksResult | null {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (m ? m[1] : text).trim();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.chunks)) return null;
    return {
      chunks: parsed.chunks.map((c: Record<string, unknown>, i: number) => ({
        id: typeof c.id === "string" && c.id ? c.id : `c${i + 1}`,
        type: typeof c.type === "string" ? c.type : "context",
        label: typeof c.label === "string" ? c.label : "Untitled chunk",
        content: typeof c.content === "string" ? c.content : "",
        weight: typeof c.weight === "number" ? Math.max(1, Math.min(10, c.weight)) : 5,
      })),
      edges: Array.isArray(parsed.edges) ? parsed.edges.map((e: Record<string, unknown>) => ({
        source: String(e.source || ""),
        target: String(e.target || ""),
        type: typeof e.type === "string" ? e.type : "related",
        label: typeof e.label === "string" ? e.label : undefined,
        weight: typeof e.weight === "number" ? Math.max(1, Math.min(5, e.weight)) : 2,
      })).filter((e: SemanticEdge) => e.source && e.target) : [],
    };
  } catch {
    return null;
  }
}
