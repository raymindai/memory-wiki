import { NextRequest, NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { syncBacklinks } from "@/lib/backlinks";
import { rateLimit } from "@/lib/rate-limit";
import { verifyAuthToken } from "@/lib/verify-auth";
import { synthesizeBundle } from "@/lib/synthesize";
import { appendHubLog } from "@/lib/hub-log";
import { findRecentDuplicateDoc, isStrictDupLockError } from "@/lib/doc-dedup";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = rateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: {
    title?: string;
    description?: string;
    documentIds?: string[];
    password?: string;
    userId?: string;
    userEmail?: string;
    anonymousId?: string;
    isDraft?: boolean;
    folderId?: string | null;
    /** v8 W4 option B — when this bundle was created by accepting a
     *  bundle-suggestion lint card, the cluster slug that backed the
     *  suggestion. Stored on bundle_ai_metadata.source_cluster_id so
     *  the same cluster never produces another suggestion. */
    sourceClusterId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, description, documentIds, password, anonymousId, isDraft, folderId } = body;
  let { userId } = body;

  // Verify JWT
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  if (!userId && verified?.userId) userId = verified.userId;

  // Resolve email → userId
  const resolvedEmail = body.userEmail || verified?.email || req.headers.get("x-user-email") || "";
  if (!userId && resolvedEmail) {
    try {
      const { data } = await supabase.auth.admin.listUsers();
      const user = data?.users?.find(u => u.email?.toLowerCase() === resolvedEmail.toLowerCase());
      if (user) userId = user.id;
    } catch { /* ignore */ }
  }
  if (!userId) userId = req.headers.get("x-user-id") || undefined;

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: "documentIds must be a non-empty array" }, { status: 400 });
  }
  if (documentIds.length > 50) {
    return NextResponse.json({ error: "Too many documents (max 50)" }, { status: 400 });
  }

  // ─── Dedup window — same logic as POST /api/docs ─────────────────────
  // If a bundle was just created (≤30s ago) by the same owner with the
  // same title + description + member set, return THAT bundle instead of
  // inserting a sibling. Catches multi-tab races, double-clicks, and
  // network retries from the bundle-create UI / bookmarklet.
  if ((userId || anonymousId)) {
    try {
      const sinceIso = new Date(Date.now() - 30_000).toISOString();
      const ownerFilter = userId
        ? { col: "user_id", val: userId }
        : { col: "anonymous_id", val: anonymousId! };
      const { data: recentBundles } = await supabase
        .from("bundles")
        .select("id, edit_token, title, description, created_at")
        .eq(ownerFilter.col, ownerFilter.val)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(8);
      const candidates = (recentBundles || []).filter((b) =>
        (b.title || null) === (title || null) &&
        (b.description || null) === (description || null)
      );
      // For each candidate, also check that its member set matches the
      // requested documentIds — different members = different bundle.
      for (const cand of candidates) {
        const { data: members } = await supabase
          .from("bundle_documents")
          .select("document_id")
          .eq("bundle_id", cand.id);
        const memberIds = new Set((members || []).map((m) => m.document_id));
        const requestedIds = new Set(documentIds);
        const sameSet = memberIds.size === requestedIds.size && [...requestedIds].every((id) => memberIds.has(id));
        if (sameSet) {
          return NextResponse.json({
            id: cand.id,
            editToken: cand.edit_token,
            created_at: cand.created_at,
            deduplicated: true,
          });
        }
      }
    } catch {
      // Best-effort — never block creation if dedup lookup fails.
    }
  }

  const editToken = nanoid(32);

  // Password hash (same format as documents)
  let passwordHash: string | null = null;
  if (password) {
    const salt = crypto.randomUUID();
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    passwordHash = `${salt}:${hash}`;
  }

  // Create bundle with retry on nanoid collision
  let id = "";
  let insertError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    id = nanoid(8);
    const { error } = await supabase.from("bundles").insert({
      id,
      title: title || "Untitled Bundle",
      description: description || null,
      edit_token: editToken,
      password_hash: passwordHash,
      user_id: userId || null,
      anonymous_id: (!userId && anonymousId) ? anonymousId : null,
      is_draft: isDraft ?? true,
      folder_id: folderId || null,
    });
    if (!error) { insertError = null; break; }
    if (error.code === "23505") { insertError = error; continue; }
    insertError = error; break;
  }

  if (insertError) {
    console.error("Bundle insert error:", insertError);
    return NextResponse.json({ error: "Failed to create bundle" }, { status: 500 });
  }

  // Self-wiring backlinks — extract refs from the bundle description.
  void syncBacklinks(supabase, "bundle", id, description || null);

  // Insert bundle_documents
  const bundleDocs = documentIds.map((docId, i) => ({
    bundle_id: id,
    document_id: docId,
    sort_order: i,
  }));
  const { error: docsError } = await supabase.from("bundle_documents").insert(bundleDocs);
  if (docsError) {
    // Clean up the bundle if documents insert fails
    await supabase.from("bundles").delete().eq("id", id);
    console.error("Bundle documents insert error:", docsError);
    return NextResponse.json({ error: "Failed to add documents to bundle" }, { status: 500 });
  }

  // v8 W4 option B — if this bundle was created from accepting a
  // bundle-suggestion, mark its source cluster so the same suggestion
  // never reappears. The bundle stays creator_type='user' since the
  // human explicitly accepted it; we only flag the cluster lineage.
  if (body.sourceClusterId && userId) {
    await supabase.from("bundle_ai_metadata").insert({
      bundle_id: id,
      creator_type: "user",
      creator_agent: "user-accepted-suggestion",
      triggered_by: "lint-bundle-suggestion",
      source_cluster_id: body.sourceClusterId,
    }).then(({ error }) => {
      if (error) console.warn("bundle_ai_metadata insert (sourceClusterId) failed", JSON.stringify({ id, err: error.message }));
    });
  }

  // Best-effort log entry.
  if (userId) {
    void appendHubLog({
      userId,
      event: "bundle.created",
      targetType: "bundle",
      targetId: id,
      summary: title || "Untitled Bundle",
      metadata: { documentCount: documentIds.length },
    });
  }

  // Schedule auto-synthesis after the response goes out. Next.js 15
  // `after()` keeps the function alive until the work completes, so the
  // synthesis page is durable even though the bundle creation returns
  // immediately. Authenticated users only. Anonymous bundles still work,
  // they just don't get auto-synthesis.
  if (userId) {
    const ownerId = userId;
    const memberCount = documentIds.length;
    after(async () => {
      try {
        await runAutoSynthesis(supabase, id, ownerId);
      } catch (err) {
        console.warn("Auto-synthesis failed:", err);
      }
    });

    // Auto graph analyse + embedding so the bundle is fetch-ready by
    // any external AI without the user having to click anything. Two
    // separate calls because the work is independent:
    //   - graph: ~60-70s LLM round-trip, needs ≥2 member docs
    //   - embed: <2s, only needs title + description + member titles
    // Both fire in parallel via Promise.all inside one after() block
    // so a single 504 on graph doesn't block the embed.
    after(async () => {
      const origin = req.nextUrl.origin;
      const tasks: Promise<unknown>[] = [];
      tasks.push(
        fetch(`${origin}/api/embed/bundle/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": ownerId },
        }).catch((err) => {
          console.warn("Auto-embed failed for bundle", id, err);
        }),
      );
      if (memberCount >= 2) {
        tasks.push(
          fetch(`${origin}/api/bundles/${id}/graph`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": ownerId },
            body: JSON.stringify({}),
          }).catch((err) => {
            console.warn("Auto-graph failed for bundle", id, err);
          }),
        );
      }
      await Promise.all(tasks);
    });
  }

  return NextResponse.json({ id, editToken, created_at: new Date().toISOString() });
}

/**
 * Best-effort: synthesize the bundle and persist as a wiki doc. Errors
 * here never break bundle creation — they're logged and dropped.
 */
async function runAutoSynthesis(
  supabase: ReturnType<typeof getSupabaseClient>,
  bundleId: string,
  userId: string,
) {
  if (!supabase) return;
  const result = await synthesizeBundle(supabase, bundleId, "wiki");
  if (!result) return;
  const synthEditToken = nanoid(32);
  const now = new Date().toISOString();
  // Title invariant — title is always the markdown's H1.
  const { enforceTitleInvariant } = await import("@/lib/extract-title");
  const enforced = enforceTitleInvariant(result.markdown, "Synthesis");

  // Same dedup contract docs/PDF/MCP use: pre-check, then handle the
  // 23505 partial-UNIQUE race if two concurrent synthesis runs slip
  // past the SELECT. Without these branches, a race leaves the user
  // staring at a 500 even though the canonical row was just written.
  const dupHit = await findRecentDuplicateDoc(supabase, { userId }, enforced.markdown, enforced.title);
  if (dupHit) return; // canonical synthesis already exists for this content

  // Retry on documents_pkey collisions (random nanoid collision); fall
  // through silently when the strict dup-lock fires (canonical exists).
  let insertError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const synthId = nanoid(8);
    const { error } = await supabase.from("documents").insert({
      id: synthId,
      markdown: enforced.markdown,
      title: enforced.title,
      edit_token: synthEditToken,
      user_id: userId,
      edit_mode: "account",
      is_draft: false,
      source: "auto-synthesis",
      compile_kind: "wiki",
      compile_from: { sources: [{ bundleId, docIds: result.sourceDocIds, intent: result.intent ?? null, compiledAt: now }] },
      compiled_at: now,
    });
    if (!error) return;
    if (isStrictDupLockError(error)) return; // canonical exists, no-op
    if (error.code === "23505") { insertError = error; continue; } // pkey collision, retry
    insertError = error; break;
  }
  if (insertError) {
    console.warn("auto-synthesis insert failed:", insertError.message);
  }
}

export async function GET(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  let userId = verified?.userId || req.headers.get("x-user-id");
  const anonymousId = req.headers.get("x-anonymous-id");
  const userEmail = verified?.email || req.headers.get("x-user-email");

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // Resolve email → userId
  if (!userId && userEmail) {
    try {
      const { data } = await supabase.auth.admin.listUsers();
      const user = data?.users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
      if (user) userId = user.id;
    } catch { /* ignore */ }
  }

  if (!userId && !anonymousId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("bundles")
    .select("id, title, description, is_draft, password_hash, allowed_emails, edit_mode, view_count, layout, folder_id, visibility, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (anonymousId) {
    query = query.eq("anonymous_id", anonymousId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch bundles" }, { status: 500 });
  }

  const bundleIds = (data || []).map(b => b.id);
  // Doc counts + attribution (sidecar) in parallel.
  const [docCountRes, attrRes] = await Promise.all([
    bundleIds.length > 0
      ? supabase.from("bundle_documents").select("bundle_id").in("bundle_id", bundleIds)
      : Promise.resolve({ data: [] as { bundle_id: string }[] }),
    bundleIds.length > 0
      ? supabase.from("bundle_ai_metadata").select("bundle_id, creator_type, creator_agent, user_edits_count").in("bundle_id", bundleIds)
      : Promise.resolve({ data: [] as Array<{ bundle_id: string; creator_type: string; creator_agent: string | null; user_edits_count: number }> }),
  ]);

  const docCounts: Record<string, number> = {};
  for (const row of (docCountRes.data || []) as { bundle_id: string }[]) {
    docCounts[row.bundle_id] = (docCounts[row.bundle_id] || 0) + 1;
  }
  const attribution: Record<string, { creator_type: string; creator_agent: string | null; user_edits_count: number }> = {};
  for (const row of (attrRes.data || []) as Array<{ bundle_id: string; creator_type: string; creator_agent: string | null; user_edits_count: number }>) {
    attribution[row.bundle_id] = { creator_type: row.creator_type, creator_agent: row.creator_agent, user_edits_count: row.user_edits_count };
  }

  const bundles = (data || []).map(b => {
    const { password_hash, allowed_emails, ...rest } = b as { password_hash?: string | null; allowed_emails?: string[] | null } & Record<string, unknown>;
    const allowedCount = Array.isArray(allowed_emails) ? allowed_emails.length : 0;
    const attr = attribution[b.id];
    return {
      ...rest,
      has_password: !!password_hash,
      allowed_emails_count: allowedCount,
      documentCount: docCounts[b.id] || 0,
      // Default to 'user' when no sidecar row exists — absence = user-created.
      creator_type: (attr?.creator_type ?? "user") as "user" | "ai",
      creator_agent: attr?.creator_agent ?? null,
      user_edits_count: attr?.user_edits_count ?? 0,
    };
  });

  return NextResponse.json({ bundles });
}
