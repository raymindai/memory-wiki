import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { embedText, prepareEmbeddingInput, vectorToSql } from "@/lib/embeddings";
import { bridgeConcepts, conceptBridgedDocIds, describeConceptBridge } from "@/lib/concept-bridge";

// `?deep=1` upgrades the default fast full-text search into ontology-grounded
// hybrid recall: full-text + semantic (doc vectors) + concept bridge (the
// same match_user_concepts + 1-hop concept_relations walk that powers
// hub-chat). The web search box stays on the instant FTS path; agents (MCP
// mw_search) pass deep=1 so a pull of memory inherits the graph, surfacing
// docs that are about a related concept even when the text doesn't match.
type DocRow = {
  id: string;
  title: string | null;
  markdown: string | null;
  created_at?: string;
  updated_at: string;
  is_draft?: boolean;
  view_count?: number;
  source?: string | null;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const deepParam = req.nextUrl.searchParams.get("deep");
  const deep = deepParam === "1" || deepParam === "true";

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  const anonymousId = req.headers.get("x-anonymous-id");

  if (!userId && !anonymousId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  try {
    // Build query — try full-text search first, fallback to ILIKE for CJK content
    const baseSelect = "id, title, markdown, created_at, updated_at, is_draft, view_count, source";
    const ownerFilter = userId ? { user_id: userId } : anonymousId ? { anonymous_id: anonymousId } : null;

    // Try FTS first (works well for English/Latin)
    let ftsQuery = supabase
      .from("documents")
      .select(baseSelect)
      .is("deleted_at", null)
      .textSearch("fts", q, { type: "websearch" })
      .order("updated_at", { ascending: false })
      .limit(20);
    if (ownerFilter) {
      const [key, val] = Object.entries(ownerFilter)[0];
      ftsQuery = ftsQuery.eq(key, val);
    }

    let { data, error } = await ftsQuery;

    // Fallback: ILIKE for CJK and non-Latin content (when FTS returns nothing)
    if (!error && (!data || data.length === 0)) {
      // Escape SQL LIKE wildcards (%, _) so user input is treated literally
      const escaped = q.replace(/[%_\\]/g, (c) => `\\${c}`);
      const likePattern = `%${escaped}%`;

      // Build two separate ILIKE queries instead of .or() to avoid PostgREST
      // comma-parsing issues when user input contains commas or periods
      const buildQuery = (column: string) => {
        let qb = supabase
          .from("documents")
          .select(baseSelect)
          .is("deleted_at", null)
          .ilike(column, likePattern)
          .order("updated_at", { ascending: false })
          .limit(20);
        if (ownerFilter) {
          const [key, val] = Object.entries(ownerFilter)[0];
          qb = qb.eq(key, val);
        }
        return qb;
      };

      const [titleResult, markdownResult] = await Promise.all([
        buildQuery("title"),
        buildQuery("markdown"),
      ]);

      // Merge and deduplicate results
      const merged = new Map<string, (typeof titleResult.data extends (infer T)[] | null ? T : never)>();
      for (const doc of (titleResult.data || [])) {
        merged.set(doc.id, doc);
      }
      for (const doc of (markdownResult.data || [])) {
        if (!merged.has(doc.id)) merged.set(doc.id, doc);
      }

      if (!titleResult.error && !markdownResult.error) {
        data = Array.from(merged.values())
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 20);
        error = null;
      }
    }

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    // Collect every signal per doc. Text (FTS/ILIKE) is the base layer.
    const bySignal = new Map<string, { row: DocRow; signals: Set<string>; concept?: string; score?: number }>();
    const addRow = (row: DocRow, signal: string, extra?: { concept?: string; score?: number }) => {
      const cur = bySignal.get(row.id);
      if (cur) {
        cur.signals.add(signal);
        if (extra?.concept && !cur.concept) cur.concept = extra.concept;
        if (extra?.score != null && cur.score == null) cur.score = extra.score;
        return;
      }
      bySignal.set(row.id, { row: row as DocRow, signals: new Set([signal]), concept: extra?.concept, score: extra?.score });
    };
    for (const doc of (data || []) as DocRow[]) addRow(doc, "text");

    // Deep mode: add semantic (doc vectors) + concept-bridged docs. Concept
    // bridge needs a user (concepts are user-scoped); anon callers still get
    // the semantic layer. Best-effort — failures leave the FTS results intact.
    let conceptSummary: string | null = null;
    if (deep && (userId || anonymousId)) {
      try {
        const queryVec = await embedText(prepareEmbeddingInput(null, q));
        const queryVecSql = vectorToSql(queryVec);

        const { data: semRows } = await supabase.rpc("match_documents_by_embedding", {
          query_embedding: queryVecSql,
          match_count: 15,
          p_user_id: userId ?? null,
          p_anonymous_id: anonymousId ?? null,
        });
        for (const r of (semRows || []) as Array<DocRow & { distance?: number }>) {
          addRow(r, "semantic", { score: typeof r.distance === "number" ? 1 - r.distance : undefined });
        }

        if (userId) {
          const bridge = await bridgeConcepts(supabase, userId, queryVecSql, q);
          conceptSummary = describeConceptBridge(bridge);
          const bridged = conceptBridgedDocIds(bridge, { limit: 12 });
          const conceptById = new Map(bridged.map((b) => [b.id, b.concept]));
          const missing = bridged.filter((b) => !bySignal.has(b.id)).map((b) => b.id);
          if (missing.length) {
            const { data: bridgedRows } = await supabase
              .from("documents")
              .select(baseSelect)
              .in("id", missing)
              .is("deleted_at", null);
            for (const r of (bridgedRows || []) as DocRow[]) addRow(r, "concept", { concept: conceptById.get(r.id) });
          }
          // Tag concept signal onto docs already surfaced by text/semantic.
          for (const b of bridged) {
            const cur = bySignal.get(b.id);
            if (cur) {
              cur.signals.add("concept");
              if (!cur.concept) cur.concept = b.concept;
            }
          }
        }
      } catch (e) {
        console.warn("[search] deep enrichment failed (FTS results stand):", e);
      }
    }

    // Rank: more independent signals first (text > semantic > concept),
    // then recency. A pure concept-bridged doc still ranks (that is the
    // graph's value) but below a text/semantic match.
    const rank = (e: { signals: Set<string> }) =>
      (e.signals.has("text") ? 4 : 0) + (e.signals.has("semantic") ? 2 : 0) + (e.signals.has("concept") ? 1 : 0);
    const merged = [...bySignal.values()]
      .sort((a, b) => rank(b) - rank(a) || new Date(b.row.updated_at).getTime() - new Date(a.row.updated_at).getTime())
      .slice(0, 20);

    // Generate snippets — find query terms in markdown and extract context.
    const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const results = merged.map(({ row: doc, signals, concept, score }) => {
      const md = doc.markdown || "";
      let snippet = "";
      for (const term of terms) {
        const idx = md.toLowerCase().indexOf(term);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(md.length, idx + term.length + 80);
          snippet = (start > 0 ? "..." : "") + md.slice(start, end).replace(/\n/g, " ") + (end < md.length ? "..." : "");
          break;
        }
      }
      if (!snippet) {
        snippet = md.slice(0, 120).replace(/\n/g, " ") + (md.length > 120 ? "..." : "");
      }
      return {
        id: doc.id,
        title: doc.title || "Untitled",
        snippet,
        isDraft: doc.is_draft,
        viewCount: doc.view_count || 0,
        source: doc.source,
        updatedAt: doc.updated_at,
        createdAt: doc.created_at,
        ...(deep ? { via: [...signals], viaConcept: concept ?? null, score: score ?? null } : {}),
      };
    });

    return NextResponse.json({ results, query: q, ...(deep ? { deep: true, concepts: conceptSummary } : {}) });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
