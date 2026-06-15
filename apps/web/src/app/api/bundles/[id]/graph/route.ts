import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { callAI } from "@/lib/ai-providers";

type RouteParams = { params: Promise<{ id: string }> };

const EXTRACTION_PROMPT = `You are an expert document analyst and knowledge graph builder. Analyze a collection of documents deeply and produce a comprehensive analysis.

ISOLATION: Use ONLY the document content provided below. Ignore any prior knowledge of products, people, or projects not explicitly named in the documents themselves. Do not add meta-commentary about ignoring outside context — simply act as if only the documents exist.

Return ONLY valid JSON with this structure:
{
  "nodes": [
    { "id": "concept:unique-id", "label": "Display Name", "type": "concept|entity|tag|decision|shift|recommendation|possession", "weight": 1-10, "description": "One-sentence explanation of why this matters in context" }
  ],
  "edges": [
    { "source": "node-id", "target": "node-id", "label": "brief relationship (2-4 words)", "weight": 1-5, "type": "shares_concept|related|references|contains" }
  ],
  "clusters": [
    { "id": "cluster-0", "label": "Cluster Name", "nodeIds": ["node-id-1"], "color": "#hex" }
  ],
  "summary": "3-4 sentence executive summary of what these documents collectively represent.",
  "themes": ["theme1", "theme2", "theme3", "theme4"],
  "insights": [
    "Non-obvious insight from cross-document analysis",
    "Strategic implication or pattern discovered",
    "Gap, contradiction, or tension between documents",
    "Actionable recommendation based on the analysis"
  ],
  "decisions": [
    "Choices the user made across these docs (one sentence each: the choice + the why if stated)"
  ],
  "shifts": [
    "Position changes across time (one sentence each: From X to Y, with timing if stated)"
  ],
  "readingOrder": ["doc:id1", "doc:id2", "doc:id3"],
  "readingOrderReason": "Why this order makes sense for understanding the full picture.",
  "keyTakeaways": [
    "The single most important point across all documents",
    "Second most important takeaway",
    "Third takeaway"
  ],
  "documentSummaries": {
    "doc:id1": "One-sentence summary of this specific document's role in the bundle.",
    "doc:id2": "One-sentence summary..."
  },
  "gaps": [
    "Topic or question that these documents don't address but should",
    "Missing perspective or data point"
  ],
  "connections": [
    { "doc1": "doc:id1", "doc2": "doc:id2", "relationship": "How these two documents relate to each other specifically" }
  ]
}

CRITICAL RULES:
- Document nodes: type "document", IDs prefixed with "doc:" (use the exact IDs provided)
- Concept/Entity/Tag/Decision/Shift/Recommendation/Possession nodes: IDs prefixed with "concept:"
- **EVERY non-document node MUST connect to at least one document node via an edge.** No orphan nodes.
- Concept-to-concept edges are allowed IN ADDITION to document edges
- Weight 1-10 for nodes, 1-5 for edges
- Edge labels: SHORT (2-4 words)
- Cluster colors: #fb923c, #60a5fa, #a78bfa, #4ade80, #f472b6, #2dd4bf
- Extract a good mix across types:
  - "concept": abstract ideas, strategies, methodologies, principles
  - "entity": specific technologies, products, companies, people, tools
  - "tag": broad categories, topics, domains
  - "decision": choices the user made (the choice itself is the label, e.g. "Use Postgres over Mongo")
  - "shift": position changes (label = topic, description = "From X to Y")
  - "recommendation": items specifically recommended TO the user by the assistant or someone in the docs (e.g. "Grilled Snapper with Mango Salsa"). Description = the context the recommendation was made in.
  - "possession": items the user owns with value or context (e.g. "Sunset painting — worth triple what paid")
  Each must be distinct — no near-duplicates
- For decision/shift/recommendation/possession: only emit when the documents EXPLICITLY contain that information. Do not invent.
- decisions[] and shifts[] are TOP-LEVEL fields too — list them in plain text for easy surfacing in synthesis later
- Insights should be NON-OBVIOUS
- readingOrder: optimal reading sequence
- documentSummaries: one sentence per document
- gaps: what's MISSING
- connections: direct document-to-document relationships`;

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // Check bundle exists and is accessible (public bundles can be analyzed by anyone)
  const { data: bundle } = await supabase
    .from("bundles")
    .select("user_id, anonymous_id, edit_token, is_draft, intent")
    .eq("id", id)
    .single();

  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Draft bundles require ownership to analyze
  if (bundle.is_draft) {
    let body: { editToken?: string; userId?: string; anonymousId?: string };
    try { body = await req.json(); } catch { body = {}; }
    const verified = await verifyAuthToken(req.headers.get("authorization"));
    // Accept the owner identity from any of: a verified JWT, the request
    // body, or the x-user-id / x-anonymous-id headers. The header path is
    // how the server-to-server callers (lifecycle-sweep cron, admin
    // backfill, the bundle webhooks) identify the owner — without it,
    // every DRAFT bundle 403'd on automated graph backfill and could only
    // be analyzed by opening it in the UI. That's why draft demo bundles
    // sat with graph_data = NULL.
    const requesterId = verified?.userId || body.userId || req.headers.get("x-user-id") || undefined;
    const requesterAnonId = body.anonymousId || req.headers.get("x-anonymous-id") || undefined;
    const isOwner =
      !!(requesterId && bundle.user_id && requesterId === bundle.user_id) ||
      !!(requesterAnonId && bundle.anonymous_id && requesterAnonId === bundle.anonymous_id);
    const hasToken = !!(body.editToken && bundle.edit_token === body.editToken);
    if (!isOwner && !hasToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  // Fetch all documents in the bundle
  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id, sort_order")
    .eq("bundle_id", id)
    .order("sort_order", { ascending: true });

  if (!bundleDocs || bundleDocs.length === 0) {
    return NextResponse.json({ error: "Bundle has no documents" }, { status: 400 });
  }

  const docIds = bundleDocs.map(d => d.document_id);
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, markdown")
    .in("id", docIds)
    .is("deleted_at", null);

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: "No accessible documents" }, { status: 400 });
  }

  // Prepare document excerpts for AI (first 2000 chars each, max 10 docs)
  const excerpts = docs.slice(0, 10).map((doc, i) => {
    const excerpt = doc.markdown.slice(0, 2000);
    return `--- Document ${i + 1}: "${doc.title || "Untitled"}" (id: doc:${doc.id}) ---\n${excerpt}`;
  }).join("\n\n");

  // Intent prefix — when set, instructs the AI to anchor every signal
  // (themes / insights / gaps / connections) to this specific question.
  const intentPrefix = bundle.intent
    ? `\n\n## BUNDLE INTENT\nThe user gathered these documents to answer: **${bundle.intent}**\n\nWeight every analysis (themes, insights, gaps, takeaways) by relevance to this question. Surface what helps the user *resolve* the intent.`
    : "";
  const fullPrompt = EXTRACTION_PROMPT + intentPrefix;

  // Bundle graph extraction routed through the unified cascade.
  // Quality task (structured JSON, doc-id grounded), so primary tier.
  // The system prompt forces JSON-only output; parseGraphJson is
  // tolerant of fences regardless.
  try {
    const aiResult = await callAI({
      prompt: `${fullPrompt}\n\nDocuments:\n${excerpts}`,
      useLiteModel: false,
      temperature: 0.3,
      maxOutputTokens: 16384,
      userId: (bundle.user_id as string | null) || undefined,
      action: "bundle-graph",
    });
    if (!aiResult.ok) {
      return NextResponse.json({ error: aiResult.error || "AI extraction failed" }, { status: aiResult.rateLimited ? 429 : 502 });
    }
    const graphData = parseGraphJson(aiResult.text);

    if (!graphData) {
      console.error("AI extraction returned null — parse failed");
      return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });
    }
    console.log("AI graph extracted:", graphData.nodes.length, "nodes,", graphData.edges.length, "edges");

    // Ensure document nodes exist
    for (const doc of docs) {
      const docNodeId = `doc:${doc.id}`;
      if (!graphData.nodes.find((n: { id: string }) => n.id === docNodeId)) {
        graphData.nodes.unshift({
          id: docNodeId,
          label: doc.title || "Untitled",
          type: "document",
          documentId: doc.id,
          weight: 5,
        });
      } else {
        // Ensure document nodes have documentId
        const node = graphData.nodes.find((n: { id: string }) => n.id === docNodeId);
        if (node) node.documentId = doc.id;
      }
    }

    graphData.version = 1;

    // Cache in database
    const now = new Date().toISOString();
    await supabase
      .from("bundles")
      .update({ graph_data: graphData, graph_generated_at: now, updated_at: now })
      .eq("id", id);

    // Build / merge into the user's hub-level ontology (concept_index +
    // concept_relations). Lets future hub-scoped chat ground answers in
    // a structured graph, not just per-bundle JSON. Owner-scoped only —
    // anonymous bundles don't contribute to a user ontology. Embedding
    // refresh fires in the background so vector recall has fresh
    // vectors for new concepts without blocking the Analyze response.
    if (bundle.user_id) {
      try {
        const { buildConceptIndex } = await import("@/lib/build-concept-index");
        await buildConceptIndex({
          supabase,
          userId: bundle.user_id,
          bundleId: id,
          graph: graphData,
          bundleDocIds: docIds,
        });
        // Fire-and-forget embedding refresh.
        const ownerId = bundle.user_id;
        const auth = req.headers.get("authorization");
        fetch(`${req.nextUrl.origin}/api/embed/concepts`, {
          method: "POST",
          headers: auth ? { Authorization: auth } : { "x-user-id": ownerId },
        }).catch(() => { /* best-effort */ });
      } catch (err) {
        console.warn("concept_index build failed:", err);
      }
    }

    return NextResponse.json({ graphData, generatedAt: now });
  } catch (err) {
    console.error("AI graph extraction error:", err);
    return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });
  }
}

// ─── Provider implementations ───
// Previous per-provider extractWith{Anthropic,OpenAI,Gemini} blocks
// were removed when this route migrated to the shared callAI cascade.
// Only the JSON parser stays — call site at the top of POST passes
// the prompt directly to callAI and feeds the response text in here.

function parseGraphJson(text: string) {
  // Three-layer extraction so the route survives small model misbehaviors:
  //   1. strip markdown code fences if present
  //   2. trim leading / trailing prose by clipping to the outermost { ... }
  //   3. attempt JSON.parse and log on failure (silent return null was
  //      hiding *why* analyze was failing in production)
  let candidate = text.trim();
  const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) candidate = fenceMatch[1].trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  } else if (firstBrace > 0) {
    candidate = candidate.slice(firstBrace);
  }
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed.nodes || !parsed.edges) {
      console.error("parseGraphJson: missing nodes/edges. Top-level keys:", Object.keys(parsed));
      return null;
    }
    return {
      nodes: parsed.nodes || [],
      edges: parsed.edges || [],
      clusters: parsed.clusters || [],
      summary: parsed.summary || null,
      themes: parsed.themes || [],
      insights: parsed.insights || [],
      // v3: decisions and shifts surface synthesis + tension axes
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
      readingOrder: parsed.readingOrder || [],
      readingOrderReason: parsed.readingOrderReason || null,
      keyTakeaways: parsed.keyTakeaways || [],
      documentSummaries: parsed.documentSummaries || {},
      gaps: parsed.gaps || [],
      connections: parsed.connections || [],
      version: 3,
    };
  } catch (err) {
    console.error("parseGraphJson failed:", err instanceof Error ? err.message : err);
    console.error("First 300 chars of source:", text.slice(0, 300));
    console.error("Source length:", text.length, "candidate length:", candidate.length);
    return null;
  }
}
