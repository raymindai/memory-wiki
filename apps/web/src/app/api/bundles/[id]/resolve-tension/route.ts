import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { callAI } from "@/lib/ai-providers";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Reconcile two contradicting chunks identified in the Discoveries panel.
 *
 *   POST /api/bundles/[id]/resolve-tension
 *   Body: {
 *     source: { docTitle, chunkLabel, chunkContent, chunkType },
 *     target: { docTitle, chunkLabel, chunkContent, chunkType },
 *     intent?: string,   // optional bundle intent
 *     editToken?, userId?, anonymousId?
 *   }
 *
 * Returns { resolution: string } — a 2-3 paragraph reconciliation suggesting
 * how to think about the apparent contradiction (often it's not a real
 * conflict, but different scopes / time horizons / definitions).
 */

const RESOLVE_PROMPT = `You are an analyst helping a user reconcile two apparently contradicting statements pulled from different documents.

Given two chunks (A and B) that the bundle's AI flagged as in tension, do this:

1. **Identify the nature of the disagreement.** Is it really a contradiction, or do they apply to different scopes / time horizons / audiences / definitions?
2. **Propose a reconciliation.** When can both be true? Or which one is more reliable, and why?
3. **Suggest a resolving move.** What would the user need to know or do to settle this?

Output STRICT markdown:

**Diagnosis.** <One paragraph describing what's actually at stake — is this a real conflict, a context mismatch, or a definitional gap?>

**Reconciliation.** <One paragraph: when can both hold? Or how does one supersede the other?>

**Next move.** <One sentence: a concrete action or question that would resolve this for the user.>

CRITICAL RULES:
- Maximum 200 words.
- Be specific — refer to the chunk content, not in generalities.
- Never just restate the contradiction. Always propose a synthesis or clarifying question.
- If the chunks aren't actually in tension on inspection, say that explicitly.`;

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  let body: {
    source?: { docTitle?: string; chunkLabel?: string; chunkContent?: string; chunkType?: string };
    target?: { docTitle?: string; chunkLabel?: string; chunkContent?: string; chunkType?: string };
    intent?: string;
    editToken?: string;
    userId?: string;
    anonymousId?: string;
  };
  try { body = await req.json(); } catch { body = {}; }
  if (!body.source?.chunkContent || !body.target?.chunkContent) {
    return NextResponse.json({ error: "source + target chunk content required" }, { status: 400 });
  }

  const { data: bundle } = await supabase
    .from("bundles")
    .select("user_id, anonymous_id, edit_token, is_draft, intent")
    .eq("id", id)
    .single();
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Resolve caller identity up-front so it's available for usage
  // attribution on the callAI below, regardless of the draft branch.
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = body.userId || verified?.userId || req.headers.get("x-user-id") || undefined;
  const anonymousId = body.anonymousId || req.headers.get("x-anonymous-id") || undefined;

  if (bundle.is_draft) {
    const isOwner =
      !!(userId && bundle.user_id && userId === bundle.user_id) ||
      !!(anonymousId && bundle.anonymous_id && anonymousId === bundle.anonymous_id);
    const hasToken = !!(body.editToken && bundle.edit_token === body.editToken);
    if (!isOwner && !hasToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const intentLine = bundle.intent
    ? `\nUser's intent: "${bundle.intent}". Frame the reconciliation around this question.`
    : "";

  const prompt = `${RESOLVE_PROMPT}${intentLine}

---

## Chunk A (from "${body.source.docTitle || "untitled"}", type: ${body.source.chunkType || "unknown"})
**Label:** ${body.source.chunkLabel || ""}
**Content:**
${body.source.chunkContent}

---

## Chunk B (from "${body.target.docTitle || "untitled"}", type: ${body.target.chunkType || "unknown"})
**Label:** ${body.target.chunkLabel || ""}
**Content:**
${body.target.chunkContent}`;

  try {
    const result = await callAI({
      prompt,
      useLiteModel: true,        // short tension-resolution reply
      temperature: 0.3,
      maxOutputTokens: 768,
      userId: userId || (bundle.user_id as string | null) || undefined,
      anonymousId,
      action: "bundle-tension",
    });
    if (!result.ok) {
      console.error("Resolve tension AI error:", result.error);
      return NextResponse.json({ error: result.error || "AI resolution failed" }, { status: result.rateLimited ? 429 : 502 });
    }
    return NextResponse.json({ resolution: result.text });
  } catch (err) {
    console.error("Resolve tension AI error:", err);
    return NextResponse.json({ error: "AI resolution failed" }, { status: 500 });
  }
}
