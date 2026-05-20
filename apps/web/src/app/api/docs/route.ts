import { NextRequest, NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { verifyAuthToken } from "@/lib/verify-auth";
import { corsHeaders, ensureAnonymousCookie, readAnonymousCookie } from "@/lib/anonymous-cookie";
import { appendHubLog } from "@/lib/hub-log";
import { maybeRefreshSuggestions } from "@/lib/hub-suggestions";
import { findRecentDuplicateDoc } from "@/lib/doc-dedup";
import { enqueueOntologyRefresh } from "@/lib/ontology-refresh";
import { extractTitleFromMd } from "@/lib/extract-title";

/**
 * CORS preflight for cross-origin capture (bookmarklet on chatgpt.com,
 * claude.ai, gemini.google.com → memory.wiki/api/docs). Trusted origins
 * defined in lib/anonymous-cookie.ts; everything else gets a no-op.
 */
export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  // Rate limit by IP (x-real-ip and x-forwarded-for are set by Vercel's proxy in production)
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = rateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 }
    );
  }

  let body: {
    markdown?: string;
    title?: string;
    password?: string;
    expiresIn?: number;
    userId?: string;
    userEmail?: string;
    anonymousId?: string;
    editMode?: string;
    isDraft?: boolean;
    source?: string;
    folderId?: string;
    // Compile-as-first-class — when this doc is created as the output of
    // /api/bundles/:id/synthesize, these fields persist its provenance so
    // the user can recompile and we can detect when it goes stale.
    compileKind?: "memo" | "faq" | "brief";
    compileFrom?: { bundleId?: string; docIds?: string[]; intent?: string | null };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // `password` removed from the data model — see commit notes. The
  // field is destructured for backward-compat with old clients but
  // ignored downstream so no new password-protected docs are
  // created.
  const { expiresIn, editMode, isDraft, source, folderId, compileKind, compileFrom } = body;
  // Title invariant: title column = H1 of body. We do NOT silently
  // mutate the body during creation. The only exception is a fresh
  // capture (POST) that passes a `title` hint with a body that
  // genuinely lacks an H1 — this is import-time explicit intent so
  // we prepend once, mirroring mdfy_create / PDF import. After that
  // first write, no save ever rewrites the body.
  const incomingMd = typeof body.markdown === "string" ? body.markdown : "";
  const incomingHint = typeof body.title === "string" ? body.title.trim() : "";
  const detectedH1 = extractTitleFromMd(incomingMd);
  let markdown: string = incomingMd;
  if ((!detectedH1 || detectedH1 === "Untitled") && incomingHint) {
    markdown = incomingMd.trim()
      ? `# ${incomingHint}\n\n${incomingMd}`
      : `# ${incomingHint}\n`;
  }
  const title: string = extractTitleFromMd(markdown);
  let { userId } = body;
  let { anonymousId } = body;

  // Verify JWT from Authorization header (VS Code extension, MCP, etc.)
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  if (!userId && verified?.userId) {
    userId = verified.userId;
  }

  // Resolve email → userId: check body.userEmail, then x-user-email header
  const resolvedEmail = body.userEmail || verified?.email || req.headers.get("x-user-email") || "";
  if (!userId && resolvedEmail) {
    if (supabase) {
      try {
        const { data } = await supabase.auth.admin.listUsers();
        const user = data?.users?.find(u => u.email?.toLowerCase() === resolvedEmail.toLowerCase());
        if (user) userId = user.id;
      } catch { /* ignore */ }
    }
  }

  // Also check x-user-id header as final fallback (web app)
  if (!userId) {
    userId = req.headers.get("x-user-id") || undefined;
  }

  // x-anonymous-id header fallback (extension and bookmarklet may pass it)
  if (!anonymousId) {
    anonymousId = req.headers.get("x-anonymous-id") || undefined;
  }

  // Cookie fallback: when neither body, header, nor user is provided, group
  // this capture under the browser's mdfy_anon cookie so the user can claim
  // every captured doc on sign-in.
  if (!userId && !anonymousId) {
    anonymousId = readAnonymousCookie(req) || undefined;
  }
  // If still nothing AND no auth, mint a fresh id now so the inserted row
  // has it. The Set-Cookie at the end of the handler persists it for next time.
  if (!userId && !anonymousId) {
    anonymousId = crypto.randomUUID();
  }

  // Allow empty markdown for auto-save (draft creation)
  if (typeof markdown !== "string") {
    return NextResponse.json({ error: "markdown must be a string" }, { status: 400 });
  }
  if (markdown.length > 500_000) {
    return NextResponse.json({ error: "Document too large (max 500KB)" }, { status: 413 });
  }

  // ─── Idempotency / dup-create guard ─────────────────────────────────────
  //
  // We've seen "MDs에 복제된 MD들이 엄청 많아졌음" — duplicate documents pile
  // up in a user's library because nothing on the server prevents the same
  // content from being POSTed twice in quick succession. Likely sources:
  //   • two browser tabs both running the local-tab → cloud-doc migration
  //     against the same `mdfy-tabs` localStorage state at boot
  //   • a Chrome-extension/bookmarklet capture retrying after a transient
  //     network failure
  //   • React 18 dev StrictMode double-invoking an effect that creates
  //     a draft (paths exist that intentionally re-trigger after auth)
  //   • the user accidentally double-clicking a "New Document" template
  //
  // Defense: before inserting, look for a recent doc by the SAME owner
  // (user_id OR anonymous_id) with IDENTICAL markdown + title created in
  // the last 30 seconds. If found, return THAT doc instead of inserting a
  // sibling. 30s is short enough that legitimate "new doc with the same
  // content" actions (rare) aren't blocked.
  //
  // The `Duplicate to my MDs` UI flow appends " (copy)" to the title, so
  // its title differs from the source — that path is NOT collapsed here.
  const dupHit = await findRecentDuplicateDoc(supabase, { userId, anonymousId }, markdown, title);
  if (dupHit) {
    // Telemetry — every dedup hit means we *prevented* a duplicate from
    // landing. Log the time delta + referer so we can spot which client
    // path is misbehaving (multi-tab migration, repeat-import, etc).
    const ageMs = Date.now() - new Date(dupHit.created_at).getTime();
    console.log(
      `[doc-dedup] hit user=${userId || "anon:" + (anonymousId || "?").slice(0, 8)}`,
      `existing=${dupHit.id} age=${Math.round(ageMs / 1000)}s`,
      `title=${(title || "").slice(0, 60)} bytes=${markdown.length}`,
      `referer=${req.headers.get("referer") || "-"}`,
    );
    const res = NextResponse.json({
      id: dupHit.id,
      editToken: dupHit.edit_token,
      created_at: dupHit.created_at,
      deduplicated: true,
    });
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    ensureAnonymousCookie(req, res, {
      skip: !!userId,
      explicitId: anonymousId ?? readAnonymousCookie(req),
    });
    return res;
  }

  const editToken = nanoid(32);

  // Password feature removed — new docs always have password_hash=null.
  const passwordHash: string | null = null;

  // Expiration: expiresIn is in hours (user-specified only)
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 60 * 60 * 1000).toISOString()
    : null;

  // Determine edit mode:
  // - logged in user → "account" (only owner edits)
  // - anonymous → "token" (edit_token = ownership proof)
  const resolvedEditMode = editMode || (userId ? "account" : "token");

  // Insert with two distinct retry strategies for 23505 unique
  // violations:
  //   - documents_pkey collision (random nanoid happened to match an
  //     existing one) → regenerate nanoid and retry
  //   - documents_owner_strict_dup_lock (migration 029 — atomic
  //     same-owner same-(title, markdown) guard) → don't insert, look
  //     up the existing row and return it as the dedup hit. This is
  //     the "race lost" branch: the application-layer dedup pre-check
  //     missed it because two concurrent requests both saw zero rows.
  let id: string = "";
  let insertError: { code?: string; message?: string } | null = null;
  let dupLockHit: { id: string; edit_token: string; created_at: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    id = nanoid(8);
    const { error } = await supabase.from("documents").insert({
      id,
      markdown,
      title: title || null,
      edit_token: editToken,
      password_hash: passwordHash,
      expires_at: expiresAt,
      user_id: userId || null,
      anonymous_id: (!userId && anonymousId) ? anonymousId : null,
      edit_mode: resolvedEditMode,
      is_draft: isDraft ?? true,
      source: source || null,
      folder_id: folderId || null,
      compile_kind: compileKind || null,
      compile_from: compileFrom || null,
      compiled_at: compileKind ? new Date().toISOString() : null,
    });
    if (!error) { insertError = null; break; }
    if (error.code === "23505") {
      const msg = error.message || "";
      if (msg.includes("documents_owner_strict_dup_lock")) {
        // Race lost — re-query for the surviving row and return it.
        const survivor = await findRecentDuplicateDoc(supabase, { userId, anonymousId }, markdown, title);
        if (survivor) { dupLockHit = survivor; break; }
        insertError = error; break;
      }
      // Otherwise it's a PK collision — regenerate id and retry.
      insertError = error;
      continue;
    }
    insertError = error; break;
  }

  if (dupLockHit) {
    console.log(
      `[doc-dedup] 23505 hit user=${userId} existing=${dupLockHit.id}`,
      `title=${(title || "").slice(0, 60)} bytes=${markdown.length}`,
    );
    const res = NextResponse.json({
      id: dupLockHit.id,
      editToken: dupLockHit.edit_token,
      created_at: dupLockHit.created_at,
      deduplicated: true,
    });
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    ensureAnonymousCookie(req, res, {
      skip: !!userId,
      explicitId: anonymousId ?? readAnonymousCookie(req),
    });
    return res;
  }

  if (insertError) {
    console.error("Supabase insert error:", insertError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  // Best-effort hub log entry. Anonymous docs aren't logged because
  // there's no user to attribute them to until claim time.
  if (userId) {
    void appendHubLog({
      userId,
      event: source === "auto-synthesis" ? "synthesis.created" : "doc.created",
      targetType: "document",
      targetId: id,
      summary: title || null,
      metadata: { source: source || null, isDraft: isDraft ?? true },
    });

    // W6 proactive bundle suggestions. Throttled per-user to once per
    // 12h inside maybeRefreshSuggestions, so frequent doc bursts
    // don't hammer the LLM. Skip auto-synthesis docs (they shouldn't
    // trigger their own clustering pass).
    if (source !== "auto-synthesis" && !isDraft) {
      const ownerId = userId;
      after(async () => {
        try {
          await maybeRefreshSuggestions(supabase, ownerId);
        } catch (err) {
          console.warn("Suggestion refresh failed:", err);
        }
      });
    }

    // Fold this doc into the user's hub ontology after the response
    // goes out. Per-doc cooldown inside enqueueOntologyRefresh damps
    // autosave bursts. Auto-synthesis docs are excluded because they
    // already represent a roll-up of other docs — re-extracting their
    // concepts would double-count.
    if (source !== "auto-synthesis") {
      const ownerId = userId;
      const docTitle = title || null;
      const docMarkdown = markdown;
      after(async () => {
        try {
          await enqueueOntologyRefresh({
            supabase,
            userId: ownerId,
            docId: id,
            title: docTitle,
            markdown: docMarkdown,
          });
        } catch (err) {
          console.warn("Ontology refresh failed:", err);
        }
      });
    }
  }

  const res = NextResponse.json({ id, editToken, created_at: new Date().toISOString() });
  // CORS for cross-origin captures
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  // Issue / refresh the anonymous cookie so subsequent captures from this
  // browser group together. Skip when authenticated.
  ensureAnonymousCookie(req, res, {
    skip: !!userId,
    explicitId: anonymousId ?? readAnonymousCookie(req),
  });
  return res;
}
