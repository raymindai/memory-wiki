import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getServerUserId } from "@/lib/supabase-server";
import { readHubLog } from "@/lib/hub-log";

/**
 * v6 — Hub URL API.
 *
 * GET /api/hub/[slug] — JSON view of a public hub.
 *
 * Public callers see a paginated list of PUBLIC docs + bundles
 * (published, non-passworded, non-email-restricted). When the caller
 * is the hub OWNER (Bearer / x-user-id / Supabase session cookie that
 * resolves to profile.id), the response also carries an `ownerView`
 * with all of the owner's content grouped by access level — used by
 * the in-editor Hub tab to render Public / Shared / Private sections.
 *
 * Privacy: only profiles with hub_public = true are exposed for
 * public reads. Drafts, password-protected, and email-restricted
 * content NEVER leaks to non-owners; ownerView is gated on the
 * authentication match.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9_-]{3,32}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  // Resolve the caller. Falls through Bearer → x-user-id → cookie so
  // the in-editor fetch (credentials: include only) authenticates via
  // the same path the hub graph used to.
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const callerUserId = verified?.userId || req.headers.get("x-user-id") || (await getServerUserId());

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, hub_slug, hub_public, hub_description, plan")
    .eq("hub_slug", slug)
    .single();

  if (!profile || !profile.hub_public) {
    return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  }

  // Avatar resolution must match the editor sidebar's `resolveAvatar`:
  // profile.avatar_url → OAuth user_metadata.avatar_url → dicebear
  // identicon seeded by EMAIL (not slug). Without this fall-through
  // the in-editor hub page showed a slug-seeded dicebear identicon
  // while the sidebar showed the user's Google/GitHub OAuth photo —
  // same person, two different faces.
  let resolvedAvatar = profile.avatar_url || null;
  let ownerEmail: string | null = null;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    ownerEmail = authUser?.user?.email || null;
    if (!resolvedAvatar) {
      const meta = (authUser?.user?.user_metadata as { avatar_url?: string } | undefined) || {};
      if (meta.avatar_url) resolvedAvatar = meta.avatar_url;
    }
  } catch { /* admin lookup unavailable — fall through to dicebear */ }
  if (!resolvedAvatar) {
    const seed = encodeURIComponent(ownerEmail || profile.hub_slug || "user");
    resolvedAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
  }

  // Public docs from this user — non-draft, non-deleted, no password,
  // no email restrictions. Order by most-recently-updated.
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, markdown, updated_at, source, allowed_emails")
    .eq("user_id", profile.id)
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  // Drop docs with allowed_emails restrictions — they're not "public"
  // even though the SQL filter let them through (allowed_emails is an
  // array column; PostgREST has no clean nullable-or-empty filter
  // syntax, so we filter in JS).
  const filteredDocs = (docs || []).filter((d) => {
    const ae = (d as { allowed_emails?: string[] | null }).allowed_emails;
    return !(Array.isArray(ae) && ae.length > 0);
  });

  // Public bundles — non-draft, no password, no allowed_emails. Bundles
  // table doesn't have deleted_at; rely on is_draft + listing absence.
  const { data: bundles } = await supabase
    .from("bundles")
    .select("id, title, description, updated_at, password_hash, allowed_emails")
    .eq("user_id", profile.id)
    .eq("is_draft", false)
    .order("updated_at", { ascending: false })
    .limit(50);

  const publicBundles = (bundles || [])
    .filter(b => !b.password_hash && !(Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0))
    .map(b => ({ id: b.id, title: b.title || "Untitled Bundle", description: b.description, updated_at: b.updated_at }));

  // Top concepts for the in-editor hub view. Uses the per-user
  // concept_index (built by bundle Analyze passes) to surface the
  // most-mentioned topics as pill chips. Best-effort — empty array
  // when the table is missing or the user hasn't run Analyze yet.
  let topConcepts: Array<{ id: number; label: string; occurrence: number; docCount: number }> = [];
  let totalConceptCount = 0;
  try {
    const { count } = await supabase
      .from("concept_index")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id);
    totalConceptCount = count ?? 0;
    const { data: concepts } = await supabase
      .from("concept_index")
      .select("id, label, occurrence_count, doc_ids")
      .eq("user_id", profile.id)
      .order("occurrence_count", { ascending: false })
      .limit(12);
    topConcepts = (concepts || []).map((c) => ({
      id: c.id,
      label: c.label,
      occurrence: c.occurrence_count,
      docCount: (c.doc_ids || []).length,
    }));
  } catch { /* table may not exist yet — return empty */ }

  // Aggregate stats — total words across published docs, last update.
  let totalWords = 0;
  let lastUpdated: string | null = null;
  for (const d of filteredDocs) {
    totalWords += (d.markdown || "").trim().split(/\s+/).filter(Boolean).length;
    if (!lastUpdated || d.updated_at > lastUpdated) lastUpdated = d.updated_at;
  }

  // Owner view — all of the user's content, grouped by access level.
  // Public:  on /hub/<slug>  (is_draft=false, no pw, no email allow-list)
  // Shared:  password OR email-restricted (or other share semantics)
  // Private: only the owner can read
  type DocRow = { id: string; title: string | null; markdown: string; updated_at: string; source: string | null; is_draft: boolean; password_hash: string | null; allowed_emails: string[] | null; edit_mode: string | null };
  type BundleRow = { id: string; title: string | null; description: string | null; updated_at: string; is_draft: boolean; password_hash: string | null; allowed_emails: string[] | null };
  // Carry the share-state fields through to the client so DocStatusIcon
  // can resolve the correct icon (Cloud / Users / Globe / Eye). Without
  // these, every doc rendered in the Hub view would fall through to
  // the default Public/Globe branch — including the ones in the Shared
  // tier, which is what the founder spotted.
  type DocCard = { id: string; title: string; snippet: string; updated_at: string; isDraft: boolean; editMode: string | null; cloudId: string; hasPassword: boolean; sharedWithCount: number };
  type BundleCard = { id: string; title: string; description: string | null; updated_at: string; isDraft: boolean; hasPassword: boolean; sharedWithCount: number };

  const isOwner = !!callerUserId && callerUserId === profile.id;
  let ownerView: {
    bundles: { public: BundleCard[]; shared: BundleCard[]; private: BundleCard[] };
    documents: { public: DocCard[]; shared: DocCard[]; private: DocCard[] };
  } | null = null;

  if (isOwner) {
    const [{ data: allDocs }, { data: allBundles }] = await Promise.all([
      supabase
        .from("documents")
        .select("id, title, markdown, updated_at, source, is_draft, password_hash, allowed_emails, edit_mode")
        .eq("user_id", profile.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      supabase
        .from("bundles")
        .select("id, title, description, updated_at, is_draft, password_hash, allowed_emails")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false }),
    ]);

    const classifyDoc = (d: DocRow): "public" | "shared" | "private" => {
      if (d.is_draft) return "private";
      const hasPw = !!d.password_hash;
      const hasEmails = Array.isArray(d.allowed_emails) && d.allowed_emails.length > 0;
      if (hasPw || hasEmails) return "shared";
      return "public";
    };
    const classifyBundle = (b: BundleRow): "public" | "shared" | "private" => {
      if (b.is_draft) return "private";
      const hasPw = !!b.password_hash;
      const hasEmails = Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0;
      if (hasPw || hasEmails) return "shared";
      return "public";
    };

    // Owner email — used to exclude the owner from sharedWithCount so
    // a doc that's only shared with yourself reads as Private, not
    // Shared. Mirrors the sidebar's hydration logic in MdEditor.
    let ownerEmailLower: string | null = null;
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
      ownerEmailLower = authUser?.user?.email?.toLowerCase() || null;
    } catch { /* ignore */ }
    const computeSharedCount = (allowed: string[] | null | undefined): number => {
      if (!allowed) return 0;
      return allowed.filter(e => e.toLowerCase() !== (ownerEmailLower || "")).length;
    };

    const docCards: { public: DocCard[]; shared: DocCard[]; private: DocCard[] } = { public: [], shared: [], private: [] };
    for (const d of (allDocs as DocRow[] | null) ?? []) {
      const card: DocCard = {
        id: d.id,
        title: d.title || "Untitled",
        snippet: (d.markdown || "").slice(0, 200),
        updated_at: d.updated_at,
        isDraft: d.is_draft,
        editMode: d.edit_mode,
        cloudId: d.id,
        hasPassword: !!d.password_hash,
        sharedWithCount: computeSharedCount(d.allowed_emails),
      };
      docCards[classifyDoc(d)].push(card);
    }
    const bundleCards: { public: BundleCard[]; shared: BundleCard[]; private: BundleCard[] } = { public: [], shared: [], private: [] };
    for (const b of (allBundles as BundleRow[] | null) ?? []) {
      const card: BundleCard = {
        id: b.id,
        title: b.title || "Untitled Bundle",
        description: b.description,
        updated_at: b.updated_at,
        isDraft: b.is_draft,
        hasPassword: !!b.password_hash,
        sharedWithCount: computeSharedCount(b.allowed_emails),
      };
      bundleCards[classifyBundle(b)].push(card);
    }
    ownerView = { bundles: bundleCards, documents: docCards };
  }

  // Recent activity feed — last 12 hub_log events for the owner. Same
  // owner-only gate as ownerView. Public visitors get no activity.
  let recentActivity: Array<{ id: number; event: string; targetType: string | null; targetId: string | null; summary: string | null; ts: string }> | null = null;
  if (isOwner) {
    try {
      const rows = await readHubLog(profile.id, 12);
      recentActivity = rows.map((r) => ({
        id: r.id,
        event: r.event_type,
        targetType: r.target_type,
        targetId: r.target_id,
        summary: r.summary,
        ts: r.created_at,
      }));
    } catch { /* ignore — table may not be populated yet */ }
  }

  return NextResponse.json({
    hub: {
      slug: profile.hub_slug,
      display_name: profile.display_name,
      avatar_url: resolvedAvatar,
      description: profile.hub_description,
      plan: profile.plan,
      url: `https://memory.wiki/hub/${profile.hub_slug}`,
    },
    documents: filteredDocs.map(d => ({
      id: d.id,
      title: d.title || "Untitled",
      snippet: (d.markdown || "").slice(0, 240),
      updated_at: d.updated_at,
      source: d.source,
    })),
    bundles: publicBundles,
    topConcepts,
    counts: {
      documents: filteredDocs.length,
      bundles: publicBundles.length,
      concepts: totalConceptCount,
      totalWords,
    },
    lastUpdated,
    ownerView,
    isOwner,
    recentActivity,
  });
}
