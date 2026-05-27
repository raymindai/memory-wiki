// Per-user job status. The Hub Compact CTA polls this to surface
// "Building…" / "Failed — Retry" / "Last built 5m ago" instead of
// blindly showing "Not built" forever.
//
// GET /api/user/jobs/status?kind=doc_ontology
// → { pending, running, failed, lastBuiltAt }

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getServerUserId } from "@/lib/supabase-server";
import { hasPendingOntology, countJobsByStatus, type JobKind } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "storage unavailable" }, { status: 503 });

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id") || (await getServerUserId());
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const kind = req.nextUrl.searchParams.get("kind") || "doc_ontology";
  const KNOWN: ReadonlyArray<JobKind> = [
    "doc_ontology", "doc_organize", "bundle_graph",
    "concept_embeddings", "bundle_embedding", "doc_embedding",
  ];
  if (!KNOWN.includes(kind as JobKind)) {
    return NextResponse.json({ pending: 0, running: 0, failed: 0, lastBuiltAt: null });
  }
  const status = kind === "doc_ontology"
    ? await hasPendingOntology(supabase, userId)
    : await countJobsByStatus(supabase, userId, kind as JobKind);
  return NextResponse.json(status);
}
