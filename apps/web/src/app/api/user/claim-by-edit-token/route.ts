// POST /api/user/claim-by-edit-token
//
// Lets a logged-in caller claim orphan anonymous documents by proving
// ownership with the edit_token the CLI stored at create time. Closes
// the UX gap where `mw publish` before `mw login` leaves the doc
// permanently unreachable through the web-side migrate flow (which
// only knows the browser cookie's anonymous_id).
//
// Body shape:
//   { tokens: { "<docId>": "<editToken>", ... } }
//
// For each (docId, editToken):
//   - Look up the doc.
//   - If user_id already belongs to caller, no-op (idempotent).
//   - If user_id is set to someone else, fail this entry (no takeover).
//   - If edit_token matches and user_id is null, assign caller's
//     user_id and clear anonymous_id.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

type ClaimItem = {
  id: string;
  status: "claimed" | "already-owned" | "wrong-token" | "not-found" | "owned-by-other";
  reason?: string;
};

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const callerUserId = verified?.userId || req.headers.get("x-user-id") || "";
  const callerEmail = (verified?.email || req.headers.get("x-user-email") || "").toLowerCase();

  if (!callerUserId && !callerEmail) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // If only email is available, resolve to user_id by lookup.
  let userId = callerUserId;
  if (!userId && callerEmail) {
    const { data: row } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", callerEmail)
      .single();
    if (row?.id) userId = row.id;
  }
  if (!userId) {
    return NextResponse.json({ error: "could not resolve user_id" }, { status: 401 });
  }

  let body: { tokens?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const tokens = body?.tokens || {};
  const entries = Object.entries(tokens).filter(
    ([id, tok]) => typeof id === "string" && id.length > 0 && typeof tok === "string" && tok.length > 0,
  );
  if (entries.length === 0) {
    return NextResponse.json({ error: "tokens object empty" }, { status: 400 });
  }

  const items: ClaimItem[] = [];
  let claimed = 0;

  // Process serially. Volume is typically small (a developer's local
  // tokens.json with a handful to dozens of entries).
  for (const [id, editToken] of entries) {
    const { data: doc } = await supabase
      .from("documents")
      .select("id, user_id, edit_token, anonymous_id")
      .eq("id", id)
      .single();
    if (!doc) {
      items.push({ id, status: "not-found" });
      continue;
    }
    if (doc.user_id === userId) {
      items.push({ id, status: "already-owned" });
      continue;
    }
    if (doc.user_id && doc.user_id !== userId) {
      items.push({ id, status: "owned-by-other", reason: "doc already claimed by another user" });
      continue;
    }
    if (!doc.edit_token || doc.edit_token !== editToken) {
      items.push({ id, status: "wrong-token" });
      continue;
    }
    // user_id is null, edit_token matches, assign to caller.
    const { error } = await supabase
      .from("documents")
      .update({ user_id: userId, anonymous_id: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      items.push({ id, status: "wrong-token", reason: `db error: ${error.message}` });
      continue;
    }
    items.push({ id, status: "claimed" });
    claimed++;
  }

  return NextResponse.json({
    claimed,
    attempted: entries.length,
    items,
  });
}
