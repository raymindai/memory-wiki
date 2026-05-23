import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { syncBacklinks } from "@/lib/backlinks";
import { verifyAuthToken } from "@/lib/verify-auth";
import { rateLimit } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

function isValidId(id: string): boolean {
  return /^[\w-]+$/.test(id);
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid bundle ID" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const verified = await verifyAuthToken(_req.headers.get("authorization"));
  const requesterId = verified?.userId || _req.headers.get("x-user-id");
  const requesterAnonId = _req.headers.get("x-anonymous-id");
  const requesterEmail = (verified?.email || _req.headers.get("x-user-email") || "").toLowerCase();

  // Fetch bundle
  const { data: bundle, error } = await supabase
    .from("bundles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !bundle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ownership check
  const isOwner =
    !!(requesterId && bundle.user_id && requesterId === bundle.user_id) ||
    !!(requesterAnonId && bundle.anonymous_id && requesterAnonId === bundle.anonymous_id);

  // Draft: only owner can access
  if (bundle.is_draft && !isOwner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Allowed-emails gate (W7 shared bundles MVP). When the bundle has a
  // non-empty allowed_emails list, only the owner or someone in the list
  // can read it. Email comes from the verified JWT or, for legacy
  // callers, the x-user-email header.
  const allowedEmails = Array.isArray(bundle.allowed_emails)
    ? (bundle.allowed_emails as string[]).map((e) => e.toLowerCase())
    : [];
  if (allowedEmails.length > 0 && !isOwner) {
    const isAllowed = !!requesterEmail && allowedEmails.includes(requesterEmail);
    if (!isAllowed) {
      return NextResponse.json(
        { error: "This bundle is shared with specific people.", restricted: true },
        { status: 403 }
      );
    }
  }

  // Password check
  const hasPassword = !!bundle.password_hash;
  if (hasPassword && !isOwner) {
    const providedPassword = _req.headers.get("x-document-password") || "";
    if (!providedPassword) {
      return NextResponse.json({ error: "Password required", passwordRequired: true }, { status: 401 });
    }
    const ip = _req.headers.get("x-real-ip") || _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`pwd:${ip}:${id}`);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    const encoder = new TextEncoder();
    let passwordMatch = false;
    if (bundle.password_hash.includes(":")) {
      const [salt, storedHash] = bundle.password_hash.split(":", 2);
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(salt + providedPassword));
      const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      passwordMatch = hash === storedHash;
    } else {
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(providedPassword));
      const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      passwordMatch = hash === bundle.password_hash;
    }
    if (!passwordMatch) {
      return NextResponse.json({ error: "Wrong password", passwordRequired: true }, { status: 403 });
    }
  }

  // Increment view count (fire-and-forget) — skip for owner
  const skipViewCount = _req.headers.get("x-no-view-count") === "1";
  if (!isOwner && !skipViewCount) {
    supabase
      .from("bundles")
      .update({ view_count: (bundle.view_count || 0) + 1 })
      .eq("id", id)
      .then(() => {});
  }

  // Fetch bundle documents (with document content + per-doc annotation)
  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id, sort_order, annotation")
    .eq("bundle_id", id)
    .order("sort_order", { ascending: true });

  const docIds = (bundleDocs || []).map(d => d.document_id);
  const annotationByDocId = new Map<string, string | null>(
    (bundleDocs || []).map(d => [d.document_id, (d as { annotation?: string | null }).annotation ?? null])
  );

  let documents: Array<{ id: string; title: string | null; markdown: string; created_at: string; updated_at: string; embedding_updated_at: string | null; is_draft: boolean; edit_mode: string; allowed_emails_count: number; annotation: string | null }> = [];
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, title, markdown, created_at, updated_at, embedding_updated_at, is_draft, edit_mode, allowed_emails")
      .in("id", docIds)
      .is("deleted_at", null);

    // Maintain sort order from bundle_documents; expose only owner-relevant share metadata
    const docsMap = new Map(
      (docs || []).map(d => [d.id, {
        id: d.id,
        title: d.title,
        markdown: d.markdown,
        created_at: d.created_at,
        updated_at: d.updated_at,
        embedding_updated_at: d.embedding_updated_at || null,
        is_draft: d.is_draft !== false,
        edit_mode: d.edit_mode || "owner",
        allowed_emails_count: Array.isArray(d.allowed_emails) ? d.allowed_emails.length : 0,
        annotation: annotationByDocId.get(d.id) ?? null,
      }])
    );
    documents = docIds.map(docId => docsMap.get(docId)).filter(Boolean) as typeof documents;
  }

  // Strip sensitive fields + drop the raw 1536-dim embedding vector
  // (we expose it only as a boolean readiness flag).
  const { password_hash: _ph, user_id: _uid, anonymous_id: _aid, edit_token: _et, embedding: _emb, ...safeBundle } = bundle;
  // True when the bundle has had its title / description / member-set
  // run through the embedding pipeline at least once. Drives the
  // "Ready for AI" indicator in the canvas + Share modal.
  const hasEmbedding = !!bundle.embedding;
  const hasGraph = !!bundle.graph_data;

  // Analysis staleness: the graph was generated at graph_generated_at
  // from the docs at that time. If a member doc's *content* has changed
  // since then, the graph reflects a stale snapshot.
  //
  // We previously compared graph_generated_at against documents.updated_at,
  // but updated_at gets bumped on every permission cascade
  // (set-allowed-emails / change-edit-mode / publish) — opening the
  // Share modal and toggling "Anyone with the link" was enough to flip
  // the stale flag even though no content changed.
  //
  // Prefer embedding_updated_at — that timestamp is only refreshed by
  // the embedding pipeline when the markdown's content hash actually
  // changes (see /api/embed/[id]). When embedding hasn't run yet
  // (NULL), fall back to created_at, not updated_at: a doc that's
  // been created but never re-embedded has, by definition, only had
  // its original content. Permission cascades bump updated_at but
  // not created_at, so the fallback is safe against the same bug.
  let isAnalysisStale = false;
  let latestMemberUpdatedAt: string | null = null;
  if (bundle.graph_generated_at && documents.length > 0) {
    const latestMs = documents.reduce((max, d) => {
      const stamp = d.embedding_updated_at || d.created_at;
      const t = stamp ? new Date(stamp).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    if (latestMs > 0) {
      latestMemberUpdatedAt = new Date(latestMs).toISOString();
      if (latestMs > new Date(bundle.graph_generated_at).getTime()) {
        isAnalysisStale = true;
      }
    }
  }

  return NextResponse.json({
    ...safeBundle,
    hasPassword,
    isOwner,
    documents,
    isAnalysisStale,
    latestMemberUpdatedAt,
    hasEmbedding,
    hasGraph,
    ...(isOwner ? { editToken: bundle.edit_token } : {}),
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid bundle ID" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: {
    action?: string;
    editToken?: string;
    title?: string;
    description?: string;
    layout?: string;
    userId?: string;
    anonymousId?: string;
    documentIds?: string[];
    isDraft?: boolean;
    graphData?: unknown;
    folderId?: string | null;
    allowedEmails?: string[];
    allowedEditors?: string[];
    editMode?: string;
    intent?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  if (verified) body.userId = verified.userId;

  // Fetch bundle for permission check
  const { data: bundle } = await supabase
    .from("bundles")
    .select("user_id, anonymous_id, edit_token")
    .eq("id", id)
    .single();

  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Permission: owner or token holder
  const isOwner =
    !!(body.userId && bundle.user_id && body.userId === bundle.user_id) ||
    !!(body.anonymousId && bundle.anonymous_id && body.anonymousId === bundle.anonymous_id);
  const hasToken = !!(body.editToken && bundle.edit_token === body.editToken);
  if (!isOwner && !hasToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // ─── Action: save-graph ───
  if (body.action === "save-graph") {
    if (!body.graphData) return NextResponse.json({ error: "graphData required" }, { status: 400 });
    const now = new Date().toISOString();
    const { error } = await supabase.from("bundles").update({ graph_data: body.graphData, graph_generated_at: now, updated_at: now }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to save graph" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ─── Action: publish ───
  if (body.action === "publish") {
    const { error } = await supabase.from("bundles").update({ is_draft: false, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
    // Cascade: publishing a bundle implies publishing every member doc.
    // Without this the bundle is visible publicly but its member docs
    // 404 for non-owner viewers (is_draft=true gates the doc fetch),
    // which was the source of the stale-doc 404 storm on staging.
    const { data: members } = await supabase
      .from("bundle_documents")
      .select("document_id")
      .eq("bundle_id", id);
    const memberIds = (members || []).map((m) => m.document_id);
    if (memberIds.length > 0) {
      await supabase
        .from("documents")
        .update({ is_draft: false, updated_at: new Date().toISOString() })
        .in("id", memberIds)
        .eq("is_draft", true)
        .is("deleted_at", null);
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Action: unpublish ───
  if (body.action === "unpublish") {
    const { error } = await supabase.from("bundles").update({
      is_draft: true,
      allowed_emails: [],
      allowed_editors: [],
      edit_mode: "owner",
      is_discoverable: false,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to unpublish" }, { status: 500 });
    // Cascade: a member doc reverts to draft only if it has NO OTHER
    // published bundle keeping it visible. Otherwise unpublishing one
    // bundle would yank its members out from under another bundle that
    // is still public.
    const { data: members } = await supabase
      .from("bundle_documents")
      .select("document_id")
      .eq("bundle_id", id);
    const memberIds = (members || []).map((m) => m.document_id);
    if (memberIds.length > 0) {
      // For each member, count published bundles (not this one) it still belongs to
      const { data: otherMemberships } = await supabase
        .from("bundle_documents")
        .select("document_id, bundles!inner(id, is_draft)")
        .in("document_id", memberIds)
        .neq("bundle_id", id);
      const stillPublishedElsewhere = new Set<string>();
      type MembershipRow = { document_id: string; bundles: { is_draft: boolean } | { is_draft: boolean }[] | null };
      for (const r of (otherMemberships || []) as MembershipRow[]) {
        const b = Array.isArray(r.bundles) ? r.bundles[0] : r.bundles;
        if (b && !b.is_draft) stillPublishedElsewhere.add(r.document_id);
      }
      const idsToUnpublish = memberIds.filter((id) => !stillPublishedElsewhere.has(id));
      if (idsToUnpublish.length > 0) {
        await supabase
          .from("documents")
          .update({ is_draft: true, updated_at: new Date().toISOString() })
          .in("id", idsToUnpublish)
          .is("deleted_at", null);
      }
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Action: set-allowed-emails ───
  if (body.action === "set-allowed-emails") {
    const allowedEmails = Array.isArray(body.allowedEmails) ? body.allowedEmails : [];
    const allowedEditors = Array.isArray(body.allowedEditors) ? body.allowedEditors : [];
    // If the bundle was on /shared and we're locking it down, drop the
    // discovery flag — discoverability requires fully public.
    const updates: Record<string, unknown> = {
      allowed_emails: allowedEmails,
      allowed_editors: allowedEditors,
      updated_at: new Date().toISOString(),
    };
    if (allowedEmails.length > 0) updates.is_discoverable = false;
    const { error } = await supabase.from("bundles").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to update sharing" }, { status: 500 });
    // Cascade member-level access: every doc that's a member of THIS
    // bundle gets the same allowed_emails / allowed_editors. Otherwise
    // the bundle says "shared with X" but X clicking through to a
    // member doc gets 403/404 because the doc still has its own
    // (different / empty) allow-list. Replaces rather than merges —
    // bundle-level sharing wins for its members.
    const { data: members } = await supabase
      .from("bundle_documents")
      .select("document_id")
      .eq("bundle_id", id);
    const memberIds = (members || []).map((m) => m.document_id);
    if (memberIds.length > 0) {
      await supabase
        .from("documents")
        .update({
          allowed_emails: allowedEmails,
          allowed_editors: allowedEditors,
          updated_at: new Date().toISOString(),
        })
        .in("id", memberIds)
        .is("deleted_at", null);
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Action: set-discoverable ───
  // Owner-only opt-in for the public /shared discovery feed. Only valid
  // on bundles that are already public (no allowed_emails, no password).
  if (body.action === "set-discoverable") {
    const next = !!(body as { discoverable?: boolean }).discoverable;
    if (next) {
      const { data: current } = await supabase
        .from("bundles")
        .select("password_hash, allowed_emails, is_draft")
        .eq("id", id)
        .single();
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (current.is_draft) return NextResponse.json({ error: "Publish the bundle before listing it on /shared." }, { status: 400 });
      if (current.password_hash) return NextResponse.json({ error: "Password-protected bundles can't be listed on /shared." }, { status: 400 });
      if (Array.isArray(current.allowed_emails) && current.allowed_emails.length > 0) {
        return NextResponse.json({ error: "Email-restricted bundles can't be listed on /shared." }, { status: 400 });
      }
    }
    const { error } = await supabase.from("bundles").update({
      is_discoverable: next,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to update discoverability" }, { status: 500 });
    return NextResponse.json({ ok: true, isDiscoverable: next });
  }

  // ─── Action: change-edit-mode ───
  if (body.action === "change-edit-mode") {
    if (!body.editMode) return NextResponse.json({ error: "editMode required" }, { status: 400 });
    const { error } = await supabase.from("bundles").update({
      edit_mode: body.editMode,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to change edit mode" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ─── Action: set-intent ───
  // Bundle intent is the North Star for AI analysis. Stored as plain text;
  // empty string / null clears it (bundle reverts to whole-bundle analysis).
  if (body.action === "set-intent") {
    const next = (body.intent ?? "").toString().trim();
    const { error } = await supabase.from("bundles").update({
      intent: next || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to update intent" }, { status: 500 });
    return NextResponse.json({ ok: true, intent: next || null });
  }

  // ─── Action: add-documents ───
  if (body.action === "add-documents") {
    if (!Array.isArray(body.documentIds) || body.documentIds.length === 0) {
      return NextResponse.json({ error: "documentIds required" }, { status: 400 });
    }
    // Get current max sort_order
    const { data: existing } = await supabase
      .from("bundle_documents")
      .select("sort_order")
      .eq("bundle_id", id)
      .order("sort_order", { ascending: false })
      .limit(1);
    const maxOrder = existing?.[0]?.sort_order ?? -1;

    const newDocs = body.documentIds.map((docId, i) => ({
      bundle_id: id,
      document_id: docId,
      sort_order: maxOrder + 1 + i,
    }));
    const { error } = await supabase.from("bundle_documents").upsert(newDocs, { onConflict: "bundle_id,document_id" });
    if (error) return NextResponse.json({ error: "Failed to add documents" }, { status: 500 });
    await supabase.from("bundles").update({ updated_at: new Date().toISOString() }).eq("id", id);
    // Inherit the bundle's current visibility on the newly-added members.
    // If the bundle is published or has an allow-list, the docs we just
    // added must mirror that — otherwise viewers see them in the bundle's
    // member list but get 403/404 fetching them individually.
    const { data: bundleRow } = await supabase
      .from("bundles")
      .select("is_draft, allowed_emails, allowed_editors")
      .eq("id", id)
      .single();
    if (bundleRow) {
      const docUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (bundleRow.is_draft === false) docUpdates.is_draft = false;
      if (Array.isArray(bundleRow.allowed_emails) && bundleRow.allowed_emails.length > 0) {
        docUpdates.allowed_emails = bundleRow.allowed_emails;
      }
      if (Array.isArray(bundleRow.allowed_editors) && bundleRow.allowed_editors.length > 0) {
        docUpdates.allowed_editors = bundleRow.allowed_editors;
      }
      // Only run when there's something beyond updated_at to set.
      if (Object.keys(docUpdates).length > 1) {
        await supabase
          .from("documents")
          .update(docUpdates)
          .in("id", body.documentIds)
          .is("deleted_at", null);
      }
    }
    // Re-run analysis + embedding in the background. Membership
    // changed, so both are now provably stale. Same pattern as
    // bundle creation (POST /api/bundles).
    if (body.userId) scheduleBundleRefresh(req, id, body.userId);
    return NextResponse.json({ ok: true });
  }

  // ─── Action: set-annotations ───
  // Body: { annotations: { [documentId]: string } }
  // Updates the per-doc annotation column on bundle_documents. Used by
  // AI Bundle Generation to attach the model's "why this doc belongs"
  // line to each picked doc, and by future inline editing UX.
  if (body.action === "set-annotations") {
    const annotations = (body as { annotations?: Record<string, unknown> }).annotations;
    if (!annotations || typeof annotations !== "object") {
      return NextResponse.json({ error: "annotations object required" }, { status: 400 });
    }
    const entries = Object.entries(annotations).filter(([, v]) => typeof v === "string");
    if (entries.length === 0) return NextResponse.json({ ok: true });
    // Update each row individually — Supabase doesn't support bulk
    // conditional updates without an RPC, and the typical AI suggestion
    // is ≤10 docs per bundle so the loop cost is negligible.
    const errors: string[] = [];
    for (const [docId, annotation] of entries) {
      const { error: updErr } = await supabase
        .from("bundle_documents")
        .update({ annotation: (annotation as string).slice(0, 500) })
        .eq("bundle_id", id)
        .eq("document_id", docId);
      if (updErr) errors.push(`${docId}: ${updErr.message}`);
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: `partial failure: ${errors.join("; ")}` }, { status: 500 });
    }
    await supabase.from("bundles").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // ─── Action: remove-documents ───
  if (body.action === "remove-documents") {
    if (!Array.isArray(body.documentIds) || body.documentIds.length === 0) {
      return NextResponse.json({ error: "documentIds required" }, { status: 400 });
    }
    const { error } = await supabase
      .from("bundle_documents")
      .delete()
      .eq("bundle_id", id)
      .in("document_id", body.documentIds);
    if (error) return NextResponse.json({ error: "Failed to remove documents" }, { status: 500 });
    await supabase.from("bundles").update({ updated_at: new Date().toISOString() }).eq("id", id);
    if (body.userId) scheduleBundleRefresh(req, id, body.userId);
    return NextResponse.json({ ok: true });
  }

  // ─── Action: reorder ───
  if (body.action === "reorder") {
    if (!Array.isArray(body.documentIds)) {
      return NextResponse.json({ error: "documentIds required" }, { status: 400 });
    }
    // Update sort_order based on array position
    for (let i = 0; i < body.documentIds.length; i++) {
      await supabase
        .from("bundle_documents")
        .update({ sort_order: i })
        .eq("bundle_id", id)
        .eq("document_id", body.documentIds[i]);
    }
    await supabase.from("bundles").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // ─── Action: move-to-folder (mirrors documents API) ───
  if (body.action === "move-to-folder") {
    const folderId: string | null = (body as { folderId?: string | null }).folderId ?? null;
    const { error } = await supabase
      .from("bundles")
      .update({ folder_id: folderId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to move bundle" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ─── Default: update metadata ───
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.layout !== undefined) updates.layout = body.layout;
  if (body.isDraft !== undefined) updates.is_draft = body.isDraft;
  if ((body as { folderId?: string | null }).folderId !== undefined) {
    updates.folder_id = (body as { folderId?: string | null }).folderId || null;
  }

  const { error } = await supabase.from("bundles").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });

  // Re-sync backlinks when the description body changed.
  if (body.description !== undefined) {
    void syncBacklinks(supabase, "bundle", id, body.description as string);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid bundle ID" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: { editToken?: string; userId?: string; anonymousId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  if (verified) body.userId = verified.userId;

  const { data: bundle } = await supabase
    .from("bundles")
    .select("user_id, anonymous_id, edit_token")
    .eq("id", id)
    .single();

  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner =
    !!(body.userId && bundle.user_id && body.userId === bundle.user_id) ||
    !!(body.anonymousId && bundle.anonymous_id && body.anonymousId === bundle.anonymous_id);
  const hasToken = !!(body.editToken && bundle.edit_token === body.editToken);
  if (!isOwner && !hasToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // CASCADE deletes bundle_documents automatically
  const { error } = await supabase.from("bundles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * Fire-and-forget background refresh of a bundle's graph + embedding
 * after a membership change. Both endpoints are idempotent (graph
 * uses graph_generated_at, embed uses embedding_source_hash) so a
 * burst of edits will collapse to a single recomputation.
 *
 * Lives outside the request handler so a slow LLM call doesn't keep
 * the user waiting for their add/remove ACK. Auto-graph only fires
 * when the bundle has ≥2 docs; auto-embed always fires (it only
 * needs title + description + member titles).
 */
function scheduleBundleRefresh(req: NextRequest, bundleId: string, ownerId: string) {
  after(async () => {
    const origin = req.nextUrl.origin;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    // Count current members to decide whether graph analyse is meaningful.
    let memberCount = 0;
    try {
      const { count } = await supabase
        .from("bundle_documents")
        .select("document_id", { count: "exact", head: true })
        .eq("bundle_id", bundleId);
      memberCount = count || 0;
    } catch { /* best-effort */ }

    const tasks: Promise<unknown>[] = [];
    tasks.push(
      fetch(`${origin}/api/embed/bundle/${bundleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": ownerId },
      }).catch((err) => { console.warn("Auto-embed failed for bundle", bundleId, err); }),
    );
    if (memberCount >= 2) {
      tasks.push(
        fetch(`${origin}/api/bundles/${bundleId}/graph`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": ownerId },
          body: JSON.stringify({}),
        }).catch((err) => { console.warn("Auto-graph failed for bundle", bundleId, err); }),
      );
    }
    await Promise.all(tasks);
  });
}
