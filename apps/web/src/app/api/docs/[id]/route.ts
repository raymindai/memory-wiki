import { NextRequest, NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { syncBacklinks } from "@/lib/backlinks";
import { verifyAuthToken } from "@/lib/verify-auth";
import { rateLimit } from "@/lib/rate-limit";
import { extractTitleFromMd, spliceH1 } from "@/lib/extract-title";
import { evaluateAntiTemplateGuard } from "@/lib/anti-template-guard";

type RouteParams = { params: Promise<{ id: string }> };

// Validate document ID: only alphanumeric, hyphen, underscore (nanoid charset)
function isValidDocId(id: string): boolean {
  return /^[\w-]+$/.test(id);
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  if (!isValidDocId(id)) {
    return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // Verify JWT for authenticated requests
  const verified = await verifyAuthToken(_req.headers.get("authorization"));

  const { data, error } = await supabase
    .from("documents")
    .select("id, markdown, title, created_at, updated_at, view_count, password_hash, expires_at, edit_mode, user_id, anonymous_id, is_draft, allowed_emails, allowed_editors, edit_token, deleted_at, source, compile_kind, compile_from, compiled_at, intent")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft-deleted documents are not accessible (except by owner)
  if (data.deleted_at) {
    const requesterId = verified?.userId || _req.headers.get("x-user-id");
    const isOwner = !!(requesterId && data.user_id && requesterId === data.user_id);
    if (!isOwner) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: "Document expired" }, { status: 410 });
  }

  // Use JWT-verified userId first, then header fallback (web app uses x-user-id)
  const requesterId = verified?.userId || _req.headers.get("x-user-id");
  const requesterAnonId = _req.headers.get("x-anonymous-id");

  // Draft documents: only accessible by owner
  if (data.is_draft) {
    // Resolve email to userId for MCP and other email-only clients
    let resolvedOwnerId = requesterId;
    if (!resolvedOwnerId && !requesterAnonId) {
      const reqEmail = verified?.email || _req.headers.get("x-user-email") || "";
      if (reqEmail && data.user_id) {
        try {
          const { data: ownerUser } = await supabase.auth.admin.getUserById(data.user_id);
          if (ownerUser?.user?.email?.toLowerCase() === reqEmail.toLowerCase()) {
            resolvedOwnerId = data.user_id;
          }
        } catch { /* ignore */ }
      }
    }
    const isDraftOwner =
      !!(resolvedOwnerId && data.user_id && resolvedOwnerId === data.user_id) ||
      !!(requesterAnonId && data.anonymous_id && requesterAnonId === data.anonymous_id);
    if (!isDraftOwner) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Email-restricted access: if allowed_emails is set, only those emails (+ owner) can access
  const allowedEmails: string[] = data.allowed_emails || [];
  if (allowedEmails.length > 0) {
    const requesterEmail = verified?.email || _req.headers.get("x-user-email") || "";
    const isOwner = !!(requesterId && data.user_id && requesterId === data.user_id);
    const isAllowed = allowedEmails.some(e => e.toLowerCase() === requesterEmail.toLowerCase());
    if (!isOwner && !isAllowed) {
      return NextResponse.json({ error: "Access restricted", restricted: true, message: "This document is restricted to specific people." }, { status: 403 });
    }
  }

  // Check password (supports both salted "salt:hash" and legacy unsalted formats).
  // OWNER BYPASS: the owner of a password-protected doc must NOT be asked
  // for the password to view their own row. The previous flow returned 401
  // even when the requester was the owner — the editor then showed an
  // empty doc because /api/docs/<id> failed before returning markdown.
  // Bundles already skip the password gate for owners; aligning docs to
  // match.
  const hasPassword = !!data.password_hash;
  const isDocOwner =
    !!(requesterId && data.user_id && requesterId === data.user_id) ||
    !!(requesterAnonId && data.anonymous_id && requesterAnonId === data.anonymous_id);
  if (hasPassword && !isDocOwner) {
    const providedPassword = _req.headers.get("x-document-password") || "";
    if (!providedPassword) {
      return NextResponse.json({ error: "Password required", passwordRequired: true }, { status: 401 });
    }
    // Rate limit password attempts
    const ip = _req.headers.get("x-real-ip") || _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`pwd:${ip}:${id}`);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    const encoder = new TextEncoder();
    let passwordMatch = false;
    if (data.password_hash.includes(":")) {
      const [salt, storedHash] = data.password_hash.split(":", 2);
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(salt + providedPassword));
      const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      passwordMatch = hash === storedHash;
    } else {
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(providedPassword));
      const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      passwordMatch = hash === data.password_hash;
    }
    if (!passwordMatch) {
      return NextResponse.json({ error: "Wrong password", passwordRequired: true }, { status: 403 });
    }
  }

  // Check ownership: by user_id or anonymous_id
  const isOwnedByRequester =
    !!(requesterId && data.user_id && requesterId === data.user_id) ||
    !!(requesterAnonId && data.anonymous_id && requesterAnonId === data.anonymous_id);

  // Increment view count (fire-and-forget) — skip for owner and realtime refreshes
  const skipViewCount = _req.headers.get("x-no-view-count") === "1";
  if (!isOwnedByRequester && !skipViewCount) {
    supabase
      .from("documents")
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq("id", id)
      .then(() => {});
  }

  // Don't expose sensitive fields
  const { password_hash: _ph, user_id: _uid, anonymous_id: _aid, allowed_emails: _ae, allowed_editors: _aed, edit_token: _et, deleted_at: _da, ...safeData } = data;

  // Check if requester is an allowed editor (for non-owner edit access)
  const requesterEmail = verified?.email || _req.headers.get("x-user-email") || "";
  const isAllowedEditor = (data.allowed_editors || []).some((e: string) => e.toLowerCase() === requesterEmail.toLowerCase());

  // Resolve owner email for non-owners (so they can see who owns the doc)
  let ownerEmail: string | undefined;
  if (!isOwnedByRequester && data.user_id) {
    try {
      const { data: ownerAuth } = await supabase.auth.admin.getUserById(data.user_id);
      ownerEmail = ownerAuth?.user?.email || undefined;
    } catch { /* ignore */ }
  }

  // Compile staleness: a synthesis doc (compile_from set) is stale when
  // any of its source docs were updated AFTER the synthesis was compiled.
  // Aggregates docIds across ALL source bundles (compile_from.sources)
  // so multi-source compiled docs flag stale on any branch.
  let isCompileStale = false;
  let latestSourceUpdatedAt: string | null = null;
  if (data.compile_kind && data.compiled_at && data.compile_from) {
    try {
      const { readCompileSources } = await import("@/lib/compile-sources");
      const sources = readCompileSources(data.compile_from, data.compiled_at);
      const allSourceDocIds = Array.from(new Set(sources.flatMap((s) => s.docIds)));
      if (allSourceDocIds.length > 0) {
        const { data: sourceRows } = await supabase
          .from("documents")
          .select("updated_at")
          .in("id", allSourceDocIds)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (sourceRows && sourceRows.length > 0) {
          latestSourceUpdatedAt = sourceRows[0].updated_at;
          if (new Date(latestSourceUpdatedAt!).getTime() > new Date(data.compiled_at).getTime()) {
            isCompileStale = true;
          }
        }
      }
    } catch { /* best-effort — don't block the read */ }
  }

  // Bundle membership — surface every bundle that includes this
  // doc so the editor can render an "in N bundles: …" banner.
  // Owner-only by query: bundle_documents has no read RLS gate,
  // but we filter to bundles the requester owns to avoid leaking
  // others' titles via cross-references.
  let inBundles: Array<{ id: string; title: string }> = [];
  if (isOwnedByRequester) {
    try {
      const { data: links } = await supabase
        .from("bundle_documents")
        .select("bundle_id")
        .eq("document_id", id);
      const bundleIds = Array.from(new Set((links || []).map((l) => l.bundle_id)));
      if (bundleIds.length > 0) {
        const { data: bundleRows } = await supabase
          .from("bundles")
          .select("id, title")
          .in("id", bundleIds)
          .eq("user_id", data.user_id || "");
        inBundles = (bundleRows || []).map((b) => ({ id: b.id, title: b.title || "Untitled Bundle" }));
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    ...safeData,
    hasPassword,
    editMode: data.edit_mode || "token",
    isOwner: isOwnedByRequester,
    isCompileStale,
    latestSourceUpdatedAt,
    isEditor: isAllowedEditor,
    inBundles,
    ...(isOwnedByRequester ? { editToken: data.edit_token, allowedEmails: data.allowed_emails || [], allowedEditors: data.allowed_editors || [] } : {}),
    ...(ownerEmail ? { ownerEmail } : {}),
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!isValidDocId(id)) {
    return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: {
    action?: string;
    editToken?: string;
    markdown?: string;
    title?: string;
    userId?: string;
    userEmail?: string;
    allowedEmails?: string[];
    allowedEditors?: string[];
    anonymousId?: string;
    changeSummary?: string;
    editMode?: string;
    isDraft?: boolean;
    source?: string;
    folderId?: string | null;
    sortOrder?: number;
    expectedUpdatedAt?: string;
    intent?: string | null;
    expiresInHours?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify JWT — use verified identity over body values when available
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  if (verified) {
    body.userId = verified.userId;
    body.userEmail = verified.email;
  } else {
    // No verified bearer. Fall back to identity headers the client
    // also sends — useAutoSave + other PATCH paths mirror
    // /api/docs's GET shape with x-user-id / x-user-email so server
    // can still resolve the caller when the bearer is missing or
    // mid-refresh. Without these header reads the auto-save was
    // failing 403 on every Editor-role save when getSession()
    // briefly returned null on the client.
    if (!body.userId) {
      const headerUserId = req.headers.get("x-user-id") || "";
      if (headerUserId) body.userId = headerUserId;
    }
    if (!body.userEmail) {
      const headerEmail = req.headers.get("x-user-email") || "";
      if (headerEmail) body.userEmail = headerEmail;
    }
    if (!body.userId && body.userEmail) {
      // Fallback: resolve email → userId (for non-JWT clients with editToken)
      try {
        const { data } = await supabase.auth.admin.listUsers();
        const user = data?.users?.find(u => u.email?.toLowerCase() === body.userEmail!.toLowerCase());
        if (user) body.userId = user.id;
      } catch { /* ignore */ }
    }
  }

  // Size limit (same as POST)
  if (body.markdown && body.markdown.length > 500_000) {
    return NextResponse.json({ error: "Document too large (max 500KB)" }, { status: 413 });
  }

  // Protect against empty content overwrite — never save blank document
  if (body.action === "auto-save" && body.markdown !== undefined && !body.markdown.trim()) {
    return NextResponse.json({ error: "Cannot save empty document" }, { status: 400 });
  }

  // ─── Action: rotate-token ───
  if (body.action === "rotate-token") {
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const { data: doc } = await supabase.from("documents").select("user_id").eq("id", id).single();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!doc.user_id || doc.user_id !== userId) {
      return NextResponse.json({ error: "Only the owner can rotate the token" }, { status: 403 });
    }
    const newToken = nanoid(32);
    const { error } = await supabase.from("documents").update({ edit_token: newToken }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to rotate token" }, { status: 500 });
    return NextResponse.json({ ok: true, editToken: newToken });
  }

  // ─── Action: change-edit-mode ───
  if (body.action === "change-edit-mode") {
    const { userId, editMode: newEditMode } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    if (!newEditMode || !["owner", "token", "view"].includes(newEditMode)) {
      return NextResponse.json({ error: "Invalid editMode" }, { status: 400 });
    }
    const { data: doc } = await supabase.from("documents").select("user_id").eq("id", id).single();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!doc.user_id || doc.user_id !== userId) {
      return NextResponse.json({ error: "Only the owner can change edit mode" }, { status: 403 });
    }
    const { error } = await supabase.from("documents").update({ edit_mode: newEditMode }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to change edit mode" }, { status: 500 });
    return NextResponse.json({ ok: true, editMode: newEditMode });
  }

  // ─── Action: set-allowed-emails (viewers + editors) ───
  if (body.action === "set-allowed-emails") {
    const { userId, allowedEmails, allowedEditors } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const { data: doc } = await supabase.from("documents").select("user_id").eq("id", id).single();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!doc.user_id || doc.user_id !== userId) {
      return NextResponse.json({ error: "Only the owner can manage access" }, { status: 403 });
    }
    const updates: Record<string, unknown> = {};
    if (Array.isArray(allowedEmails)) {
      if (allowedEmails.length > 50) return NextResponse.json({ error: "Too many allowed emails (max 50)" }, { status: 400 });
      updates.allowed_emails = allowedEmails.map((e: string) => e.trim().toLowerCase()).filter((e: string) => e.includes("@"));
    }
    if (Array.isArray(allowedEditors)) {
      if (allowedEditors.length > 50) return NextResponse.json({ error: "Too many allowed editors (max 50)" }, { status: 400 });
      updates.allowed_editors = allowedEditors.map((e: string) => e.trim().toLowerCase()).filter((e: string) => e.includes("@"));
    }
    const { error } = await supabase.from("documents").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json({ ok: true, allowedEmails: updates.allowed_emails, allowedEditors: updates.allowed_editors });
  }

  // ─── Action: snapshot (create version history entry without updating content) ───
  if (body.action === "snapshot") {
    const { userId, anonymousId, editToken, changeSummary } = body;

    const { data: doc } = await supabase
      .from("documents")
      .select("edit_token, markdown, title, user_id, anonymous_id, allowed_editors")
      .eq("id", id)
      .single();

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Permission: owner, token holder, or editor-role (allowed_editors).
    // Collaborators with edit access trigger snapshots from the same client
    // path owners use; refusing them produced a 403 on every keystroke.
    const isOwner =
      !!(userId && doc.user_id && userId === doc.user_id) ||
      !!(anonymousId && doc.anonymous_id && anonymousId === doc.anonymous_id);
    const hasToken = !!(editToken && doc.edit_token === editToken);
    const resolvedEmail = body.userEmail || verified?.email || req.headers.get("x-user-email") || "";
    const allowedEditors = (doc.allowed_editors || []) as string[];
    const isAllowedEditor = !!resolvedEmail && allowedEditors.some((e) => e.toLowerCase() === resolvedEmail.toLowerCase());
    if (!isOwner && !hasToken && !isAllowedEditor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create version snapshot of current content
    const { data: latestVersion } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("document_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (latestVersion?.version_number || 0) + 1;

    await supabase.from("document_versions").insert({
      document_id: id,
      markdown: doc.markdown,
      title: doc.title,
      version_number: nextVersion,
      created_by: userId || null,
      change_summary: changeSummary ? changeSummary.slice(0, 500) : "Session snapshot",
    });

    return NextResponse.json({ ok: true, version: nextVersion });
  }

  // ─── Action: refresh-concepts — re-run ontology extraction for one doc.
  //     Owner-only. Used by the "Needs review" sidebar's Resolve
  //     button on orphan findings: a doc that isn't in concept_index
  //     usually just hasn't been processed yet, so kicking the
  //     refresher pulls it into the ontology and the orphan goes
  //     away on the next re-scan. ───
  if (body.action === "refresh-concepts") {
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const { data: doc } = await supabase
      .from("documents")
      .select("user_id, title, markdown")
      .eq("id", id)
      .single();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (doc.user_id !== userId) {
      return NextResponse.json({ error: "Only the owner can refresh concepts" }, { status: 403 });
    }
    try {
      const { enqueueOntologyRefresh } = await import("@/lib/ontology-refresh");
      // Force = true: bypass the cooldown / delta gate. The Resolve
      // button is an explicit user request — they want it to run NOW,
      // not "maybe in 30 minutes after the next save".
      await enqueueOntologyRefresh({
        supabase,
        userId,
        docId: id,
        title: doc.title || "",
        markdown: doc.markdown || "",
        force: true,
      });
    } catch (err) {
      return NextResponse.json({ error: "Concept refresh failed", detail: (err as Error).message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Action: soft-delete (move to trash) ───
  if (body.action === "soft-delete") {
    const { data: doc } = await supabase
      .from("documents")
      .select("user_id, anonymous_id, edit_token")
      .eq("id", id)
      .single();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner = !!(body.userId && doc.user_id === body.userId) ||
      !!(body.anonymousId && doc.anonymous_id === body.anonymousId);
    const hasToken = !!(body.editToken && doc.edit_token === body.editToken);
    if (!isOwner && !hasToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { error } = await supabase.from("documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to trash" }, { status: 500 });
    // Also detach this doc from every bundle that references it. Without
    // this, bundle_documents accumulates orphan rows that point at trashed
    // docs — the bundle GET filters them out via deleted_at, so the user
    // never sees the dangling member, but the link stays in the DB and
    // shows up in audits + cross-doc analyses. Hard DELETE handles this
    // automatically via the ON DELETE CASCADE FK; soft-delete needs to do
    // it explicitly. Restoring from trash will not re-attach the doc to
    // its old bundles — the user must add it back, which is the intended
    // semantic for "trash means break this relationship".
    await supabase.from("bundle_documents").delete().eq("document_id", id);
    // Drop chunk-level embeddings too. Hard DELETE cascades them via FK,
    // but soft-delete leaves them behind — they'd keep surfacing the
    // trashed doc in semantic recall (match_public_hub_chunks reads from
    // document_chunks directly). Restoring from trash will require a
    // re-embed which the auto-save flow handles on next edit.
    await supabase.from("document_chunks").delete().eq("doc_id", id);
    return NextResponse.json({ ok: true });
  }

  // ─── Action: restore (restore from trash) ───
  if (body.action === "restore") {
    const { data: doc } = await supabase
      .from("documents")
      .select("user_id, anonymous_id, edit_token")
      .eq("id", id)
      .single();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner = !!(body.userId && doc.user_id === body.userId) ||
      !!(body.anonymousId && doc.anonymous_id === body.anonymousId);
    const hasToken = !!(body.editToken && doc.edit_token === body.editToken);
    if (!isOwner && !hasToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { error } = await supabase.from("documents")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to restore" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ─── Action: auto-save (no version history) ───
  if (body.action === "auto-save") {
    const { markdown, title, userId, anonymousId, editToken, expectedUpdatedAt } = body;

    const { data: doc } = await supabase
      .from("documents")
      .select("edit_token, user_id, anonymous_id, edit_mode, expires_at, allowed_editors, updated_at, markdown, title")
      .eq("id", id)
      .single();

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check expiry
    if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
      return NextResponse.json({ error: "Document expired" }, { status: 410 });
    }

    // Permission check: owner, editToken holder, OR an email in
    // allowed_editors. The Editor role from ShareModal writes into
    // allowed_editors; without this check those promotions had no
    // server-side effect.
    // Identity resolution order: body > verified > headers. Headers
    // are the last-resort source because the body-level identity is
    // hydrated from headers (and lookup-by-email) above, but we still
    // re-check here to cover the edge case where verifyAuthToken
    // succeeded WITHOUT email (e.g. an OAuth-only JWT with email
    // claim missing) and the client also sent x-user-email.
    const resolvedUserId = userId || req.headers.get("x-user-id") || "";
    const resolvedEmail = body.userEmail || verified?.email || req.headers.get("x-user-email") || "";
    const isOwner =
      !!(resolvedUserId && doc.user_id && resolvedUserId === doc.user_id) ||
      !!(anonymousId && doc.anonymous_id && anonymousId === doc.anonymous_id);
    const hasToken = !!(editToken && doc.edit_token === editToken);
    const allowedEditors = (doc.allowed_editors || []) as string[];
    const isAllowedEditor = !!resolvedEmail && allowedEditors.some((e) => e.toLowerCase() === resolvedEmail.toLowerCase());

    if (!isOwner && !hasToken && !isAllowedEditor) {
      return NextResponse.json({ error: "Only the owner can edit this document" }, { status: 403 });
    }

    // Conflict detection: if expectedUpdatedAt is provided, compare with actual updated_at
    if (expectedUpdatedAt && doc.updated_at) {
      const expected = new Date(expectedUpdatedAt).getTime();
      const actual = new Date(doc.updated_at).getTime();
      if (actual > expected) {
        return NextResponse.json({
          error: "Conflict",
          conflict: true,
          serverMarkdown: doc.markdown || "",
          serverUpdatedAt: doc.updated_at,
        }, { status: 409 });
      }
    }

    // Anti-template guard — if the client somehow tries to overwrite
    // a non-template body with the welcome template, refuse. Belt
    // and suspenders against the SAMPLE_WELCOME race that corrupted
    // a dozen production docs before the client-side fix landed.
    if (markdown !== undefined) {
      const guard = evaluateAntiTemplateGuard({
        incomingMarkdown: markdown,
        existingMarkdown: doc.markdown,
      });
      if (guard.refuse) {
        console.warn(`[anti-template-guard] refused PATCH on ${id}`, {
          incomingBytes: markdown.length,
          existingBytes: (doc.markdown || "").length,
        });
        return NextResponse.json({ error: guard.message, code: guard.reason }, { status: 409 });
      }
    }

    // Update without creating version history
    const updatedAt = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: updatedAt };
    // Title invariant — title column = H1 of the body. NEVER mutate
    // the body during a save (autosave or otherwise). The only path
    // that intentionally rewrites the body is the title-only rename:
    // there the user explicitly asked us to change the heading.
    if (markdown !== undefined) {
      updates.markdown = markdown;
      updates.title = extractTitleFromMd(markdown);
    } else if (title !== undefined) {
      const splicedMd = spliceH1(doc.markdown || "", title);
      updates.markdown = splicedMd;
      updates.title = extractTitleFromMd(splicedMd);
    }
    if (body.source) updates.source = body.source;
    if (body.folderId !== undefined) updates.folder_id = body.folderId || null;
    // Doc intent (note / definition / comparison / decision / question /
    // reference). Null clears it. Anything else is silently ignored —
    // the DB CHECK constraint also enforces this.
    if (body.intent !== undefined) {
      const allowed = new Set(["note", "definition", "comparison", "decision", "question", "reference"]);
      if (body.intent === null) updates.intent = null;
      else if (typeof body.intent === "string" && allowed.has(body.intent)) updates.intent = body.intent;
    }
    // Track last editor
    if (resolvedUserId) updates.last_editor_id = resolvedUserId;
    if (resolvedEmail) updates.last_editor_email = resolvedEmail;

    const { error } = await supabase.from("documents").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });

    // Re-sync backlinks if the body changed (markdown was rewritten).
    // Title-only updates also splice the body, so updates.markdown is
    // always set when we got here.
    if (typeof updates.markdown === "string") {
      void syncBacklinks(supabase, "document", id, updates.markdown);
    }

    // If the title changed, every bundle that has this doc as a member
    // is now stale on the embedding side — bundle vectors are hashed on
    // (bundle title + description + member titles). Refresh those bundle
    // embeddings in the background. /api/embed/bundle is idempotent
    // (hash short-circuit) so calling it on every title change is safe.
    // We don't await — embedding refresh shouldn't block the save reply.
    if (title !== undefined && title !== doc.title) {
      after(async () => {
        try {
          const { data: members } = await supabase
            .from("bundle_documents")
            .select("bundle_id")
            .eq("document_id", id);
          const bundleIds = [...new Set((members || []).map((m) => m.bundle_id))];
          for (const bundleId of bundleIds) {
            try {
              await fetch(`${req.nextUrl.origin}/api/embed/bundle/${bundleId}`, {
                method: "POST",
                headers: req.headers.get("authorization")
                  ? { Authorization: req.headers.get("authorization")! }
                  : { "x-user-id": doc.user_id || "" },
              });
            } catch { /* one bundle's failure shouldn't block others */ }
          }
        } catch { /* best-effort */ }
      });
    }

    // Send notification to document owner when updated from external source (CLI, MCP, Desktop)
    // Skip if the editor IS the owner (no self-notification) or if source is web auto-save
    const externalSource = body.source && body.source !== "web";
    if (externalSource && doc.user_id && userId !== doc.user_id) {
      try {
        const { data: ownerUser } = await supabase.auth.admin.getUserById(doc.user_id);
        if (ownerUser?.user?.email) {
          const editorName = resolvedEmail || "Someone";
          await supabase.from("notifications").insert({
            recipient_email: ownerUser.user.email,
            type: "document_updated",
            document_id: id,
            document_title: title || doc.title || "Untitled",
            from_user_name: editorName,
            message: `${editorName} updated "${title || doc.title || "Untitled"}" via ${body.source}`,
          });
        }
      } catch { /* notification is best-effort */ }
    }

    // Fold the updated doc into the user's hub ontology. Per-doc 30-min
    // cooldown inside enqueueOntologyRefresh keeps autosave bursts cheap.
    if (markdown !== undefined && doc.user_id) {
      const ownerId = doc.user_id;
      const newTitle = title !== undefined ? title : doc.title;
      const newMarkdown = markdown;
      after(async () => {
        try {
          const { enqueueOntologyRefresh } = await import("@/lib/ontology-refresh");
          await enqueueOntologyRefresh({
            supabase,
            userId: ownerId,
            docId: id,
            title: newTitle,
            markdown: newMarkdown,
          });
        } catch (err) {
          console.warn("Ontology refresh failed (auto-save):", err);
        }
      });
    }

    return NextResponse.json({ ok: true, updated_at: updatedAt });
  }

  // ─── Action: move-to-folder ───
  if (body.action === "move-to-folder") {
    const requesterId = verified?.userId || req.headers.get("x-user-id");
    if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Verify ownership
    const { data: doc } = await supabase.from("documents").select("user_id").eq("id", id).single();
    if (!doc || doc.user_id !== requesterId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updates: { folder_id: string | null; updated_at: string; sort_order?: number } = {
      folder_id: body.folderId || null,
      updated_at: new Date().toISOString(),
    };
    if (typeof body.sortOrder === "number") updates.sort_order = body.sortOrder;
    const { error } = await supabase.from("documents").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to move" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ─── Action: set-expiry ───
  // Sets or clears expires_at. Owner-only. Used by the MCP set_expiry tool.
  // expiresInHours: positive number (hours from now) or null (clear expiry).
  if (body.action === "set-expiry") {
    const requesterId = verified?.userId || req.headers.get("x-user-id");
    if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: doc } = await supabase.from("documents").select("user_id").eq("id", id).single();
    if (!doc || doc.user_id !== requesterId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const hrs = body.expiresInHours;
    const expiresAt = hrs == null
      ? null
      : (typeof hrs === "number" && hrs > 0)
        ? new Date(Date.now() + hrs * 3600 * 1000).toISOString()
        : undefined;
    if (expiresAt === undefined) {
      return NextResponse.json({ error: "expiresInHours must be a positive number or null" }, { status: 400 });
    }
    const { error } = await supabase.from("documents").update({ expires_at: expiresAt }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to set expiry" }, { status: 500 });
    return NextResponse.json({ ok: true, expires_at: expiresAt });
  }

  // ─── Action: set-sort-order ───
  if (body.action === "set-sort-order") {
    const requesterId = verified?.userId || req.headers.get("x-user-id");
    if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: doc } = await supabase.from("documents").select("user_id").eq("id", id).single();
    if (!doc || doc.user_id !== requesterId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (typeof body.sortOrder !== "number") return NextResponse.json({ error: "sortOrder required" }, { status: 400 });
    const { error } = await supabase.from("documents").update({ sort_order: body.sortOrder }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to update sort_order" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ─── Action: unpublish (make private — flip is_draft to true, clear sharing) ───
  if (body.action === "unpublish") {
    const { userId, anonymousId, editToken } = body;

    const { data: doc } = await supabase
      .from("documents")
      .select("edit_token, user_id, anonymous_id")
      .eq("id", id)
      .single();

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner =
      !!(userId && doc.user_id && userId === doc.user_id) ||
      !!(anonymousId && doc.anonymous_id && anonymousId === doc.anonymous_id);
    const hasToken = !!(editToken && doc.edit_token === editToken);

    if (!isOwner && !hasToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { error } = await supabase.from("documents").update({
      is_draft: true,
      edit_mode: "owner",
      allowed_emails: [],
      allowed_editors: [],
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to unpublish" }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  // ─── Action: publish (flip is_draft to false) ───
  if (body.action === "clear-source") {
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const { error } = await supabase.from("documents").update({ source: null }).eq("id", id).eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "publish") {
    const { userId, anonymousId, editToken } = body;

    const { data: doc } = await supabase
      .from("documents")
      .select("edit_token, user_id, anonymous_id")
      .eq("id", id)
      .single();

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner =
      !!(userId && doc.user_id && userId === doc.user_id) ||
      !!(anonymousId && doc.anonymous_id && anonymousId === doc.anonymous_id);
    const hasToken = !!(editToken && doc.edit_token === editToken);

    if (!isOwner && !hasToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { error } = await supabase.from("documents").update({ is_draft: false }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to publish" }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  // ─── Default: update with version history ───
  const { editToken, markdown, title, userId, anonymousId, changeSummary: rawChangeSummary } = body;
  const changeSummary = rawChangeSummary ? rawChangeSummary.slice(0, 500) : null;

  const { data: doc } = await supabase
    .from("documents")
    .select("edit_token, markdown, title, user_id, anonymous_id, edit_mode, expires_at, allowed_editors")
    .eq("id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check expiry
  if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
    return NextResponse.json({ error: "Document expired" }, { status: 410 });
  }

  // Permission check: owner, editToken holder, OR allowed_editors
  // member. Mirrors the auto-save branch so an Editor promoted via
  // ShareModal can actually commit changes here too.
  const isDocOwner =
    !!(userId && doc.user_id && userId === doc.user_id) ||
    !!(anonymousId && doc.anonymous_id && anonymousId === doc.anonymous_id);
  const hasEditToken = !!(editToken && doc.edit_token === editToken);
  const userEmailDefault = body.userEmail || verified?.email || "";
  const allowedEditorsDefault = (doc.allowed_editors || []) as string[];
  const isAllowedEditorDefault = !!userEmailDefault && allowedEditorsDefault.some((e: string) => e.toLowerCase() === userEmailDefault.toLowerCase());

  if (!isDocOwner && !hasEditToken && !isAllowedEditorDefault) {
    return NextResponse.json({ error: "Only the owner can edit this document" }, { status: 403 });
  }

  // Save current version to history
  const { data: latestVersion } = await supabase
    .from("document_versions")
    .select("version_number")
    .eq("document_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  let nextVersion = (latestVersion?.version_number || 0) + 1;

  const { error: versionError } = await supabase.from("document_versions").insert({
    document_id: id,
    markdown: doc.markdown,
    title: doc.title,
    version_number: nextVersion,
    created_by: userId || null,
    change_summary: changeSummary || null,
  });

  // Handle unique constraint violation (race condition) — retry once
  if (versionError?.code === "23505") {
    const { data: retryVersion } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("document_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    nextVersion = (retryVersion?.version_number || nextVersion) + 1;
    await supabase.from("document_versions").insert({
      document_id: id,
      markdown: doc.markdown,
      title: doc.title,
      version_number: nextVersion,
      created_by: userId || null,
      change_summary: changeSummary || null,
    });
  }

  // Anti-template guard — same defense-in-depth as the auto-save branch.
  if (markdown !== undefined) {
    const guard = evaluateAntiTemplateGuard({
      incomingMarkdown: markdown,
      existingMarkdown: doc.markdown,
    });
    if (guard.refuse) {
      console.warn(`[anti-template-guard] refused commit PATCH on ${id}`, {
        incomingBytes: markdown.length,
        existingBytes: (doc.markdown || "").length,
      });
      return NextResponse.json({ error: guard.message, code: guard.reason }, { status: 409 });
    }
  }

  // Update — same non-mutating rule as the auto-save branch.
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (markdown !== undefined) {
    updates.markdown = markdown;
    updates.title = extractTitleFromMd(markdown);
  } else if (title !== undefined) {
    const splicedMd = spliceH1(doc.markdown || "", title);
    updates.markdown = splicedMd;
    updates.title = extractTitleFromMd(splicedMd);
  }
  // Doc intent — same allow-list + null-clears as the auto-save path.
  if (body.intent !== undefined) {
    const allowed = new Set(["note", "definition", "comparison", "decision", "question", "reference"]);
    if (body.intent === null) updates.intent = null;
    else if (typeof body.intent === "string" && allowed.has(body.intent)) updates.intent = body.intent;
  }

  const { error } = await supabase.from("documents").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });

  // Fold the committed update into the user's hub ontology. Same
  // cooldown / delta gates as the auto-save path.
  if (markdown !== undefined && doc.user_id) {
    const ownerId = doc.user_id;
    const newTitle = title !== undefined ? title : doc.title;
    const newMarkdown = markdown;
    after(async () => {
      try {
        const { enqueueOntologyRefresh } = await import("@/lib/ontology-refresh");
        await enqueueOntologyRefresh({
          supabase,
          userId: ownerId,
          docId: id,
          title: newTitle,
          markdown: newMarkdown,
        });
      } catch (err) {
        console.warn("Ontology refresh failed (commit):", err);
      }
    });
  }

  return NextResponse.json({ ok: true, version: nextVersion });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!isValidDocId(id)) {
    return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: { editToken?: string; userId?: string; userEmail?: string; anonymousId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify JWT — use verified identity over body values
  const verifiedDel = await verifyAuthToken(req.headers.get("authorization"));
  if (verifiedDel) {
    body.userId = verifiedDel.userId;
    body.userEmail = verifiedDel.email;
  } else if (!body.userId && body.userEmail) {
    try {
      const { data } = await supabase.auth.admin.listUsers();
      const user = data?.users?.find(u => u.email?.toLowerCase() === body.userEmail!.toLowerCase());
      if (user) body.userId = user.id;
    } catch { /* ignore */ }
  }

  const { editToken, userId, anonymousId } = body;

  const { data: doc } = await supabase
    .from("documents")
    .select("edit_token, user_id, anonymous_id")
    .eq("id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Permission: owner by user_id, anonymous_id, or edit_token
  const isOwner =
    !!(userId && doc.user_id && userId === doc.user_id) ||
    !!(anonymousId && doc.anonymous_id && anonymousId === doc.anonymous_id);
  const hasToken = !!(editToken && doc.edit_token === editToken);

  if (!isOwner && !hasToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Delete visit history for this document (cleanup)
  await supabase.from("visit_history").delete().eq("document_id", id);

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function HEAD(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!isValidDocId(id)) {
    return new Response(null, { status: 400 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return new Response(null, { status: 503 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("updated_at, expires_at, deleted_at, view_count")
    .eq("id", id)
    .single();

  if (error || !data) {
    return new Response(null, { status: 404 });
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return new Response(null, { status: 410 });
  }

  if (data.deleted_at) {
    return new Response(null, { status: 410 }); // Gone (trashed)
  }

  return new Response(null, {
    status: 200,
    headers: { "x-updated-at": data.updated_at || "", "x-view-count": String(data.view_count || 0) },
  });
}
