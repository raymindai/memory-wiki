/**
 * Query backlinks pointing AT a given target entity, and enrich each
 * row with the source's display title.
 *
 * Server-side only — caller must pass a service-role Supabase client.
 *
 * Returns up to `limit` references, grouped by source_type:
 *   { documents: [{id, title}, ...], bundles: [...], hubs: [...] }
 *
 * Dead references (source row was deleted) are filtered out by the
 * JOIN being inner-style — if the source no longer exists, we drop it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BacklinkEntityType } from "./backlinks";

export interface BacklinkSource {
  id: string;
  title: string | null;
  context: string | null;
}

export interface ReferencedBy {
  documents: BacklinkSource[];
  bundles: BacklinkSource[];
  hubs: BacklinkSource[];
  total: number;
}

const EMPTY: ReferencedBy = { documents: [], bundles: [], hubs: [], total: 0 };

export async function getReferencedBy(
  supabase: SupabaseClient,
  target_type: BacklinkEntityType,
  target_id: string,
  limit = 25,
): Promise<ReferencedBy> {
  const { data: rows, error } = await supabase
    .from("backlinks")
    .select("source_type, source_id, context")
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .order("created_at", { ascending: false })
    .limit(limit * 3); // overfetch — three source kinds share the limit
  if (error || !rows || rows.length === 0) return EMPTY;

  const docIds: string[] = [];
  const bundleIds: string[] = [];
  const hubSlugs: string[] = [];
  const ctxByKey = new Map<string, string | null>();
  for (const r of rows) {
    const key = `${r.source_type}:${r.source_id}`;
    ctxByKey.set(key, r.context ?? null);
    if (r.source_type === "document") docIds.push(r.source_id);
    else if (r.source_type === "bundle") bundleIds.push(r.source_id);
    else if (r.source_type === "hub") hubSlugs.push(r.source_id);
  }

  // Three parallel fetches. We pull only the public, non-deleted rows
  // so a hub viewer never sees private docs leaked through backlinks.
  const [docsRes, bundlesRes, hubsRes] = await Promise.all([
    docIds.length
      ? supabase
          .from("documents")
          .select("id, title, is_draft, deleted_at, password_hash")
          .in("id", docIds)
      : Promise.resolve({ data: [], error: null }),
    bundleIds.length
      ? supabase
          .from("bundles")
          .select("id, title, is_draft, password_hash, allowed_emails")
          .in("id", bundleIds)
      : Promise.resolve({ data: [], error: null }),
    hubSlugs.length
      ? supabase
          .from("profiles")
          .select("hub_slug, display_name, hub_public")
          .in("hub_slug", hubSlugs)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const documents: BacklinkSource[] = ((docsRes.data || []) as Array<{
    id: string;
    title: string | null;
    is_draft: boolean | null;
    deleted_at: string | null;
    password_hash: string | null;
  }>)
    .filter((d) => d.is_draft === false && !d.deleted_at && !d.password_hash)
    .map((d) => ({
      id: d.id,
      title: d.title,
      context: ctxByKey.get(`document:${d.id}`) ?? null,
    }));

  const bundles: BacklinkSource[] = ((bundlesRes.data || []) as Array<{
    id: string;
    title: string | null;
    is_draft: boolean | null;
    password_hash: string | null;
    allowed_emails: string[] | null;
  }>)
    .filter(
      (b) =>
        b.is_draft === false &&
        !b.password_hash &&
        !(Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0),
    )
    .map((b) => ({
      id: b.id,
      title: b.title,
      context: ctxByKey.get(`bundle:${b.id}`) ?? null,
    }));

  const hubs: BacklinkSource[] = ((hubsRes.data || []) as Array<{
    hub_slug: string;
    display_name: string | null;
    hub_public: boolean | null;
  }>)
    .filter((h) => h.hub_public === true)
    .map((h) => ({
      id: h.hub_slug,
      title: h.display_name ?? h.hub_slug,
      context: ctxByKey.get(`hub:${h.hub_slug}`) ?? null,
    }));

  return {
    documents: documents.slice(0, limit),
    bundles: bundles.slice(0, limit),
    hubs: hubs.slice(0, limit),
    total: documents.length + bundles.length + hubs.length,
  };
}

/**
 * Owner-side version: returns every backlink whose SOURCE belongs to
 * `ownerUserId`, regardless of draft / private / password status. Used
 * by the in-editor backlink panel where the owner is managing their
 * own library and needs to see "which of MY docs reference this one"
 * even when those sources are drafts or restricted.
 */
export async function getOwnerBacklinks(
  supabase: SupabaseClient,
  target_type: BacklinkEntityType,
  target_id: string,
  ownerUserId: string,
  limit = 50,
): Promise<ReferencedBy> {
  const { data: rows, error } = await supabase
    .from("backlinks")
    .select("source_type, source_id, context")
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .order("created_at", { ascending: false })
    .limit(limit * 3);
  if (error || !rows || rows.length === 0) return EMPTY;

  const docIds: string[] = [];
  const bundleIds: string[] = [];
  const hubSlugs: string[] = [];
  const ctxByKey = new Map<string, string | null>();
  for (const r of rows) {
    const key = `${r.source_type}:${r.source_id}`;
    ctxByKey.set(key, r.context ?? null);
    if (r.source_type === "document") docIds.push(r.source_id);
    else if (r.source_type === "bundle") bundleIds.push(r.source_id);
    else if (r.source_type === "hub") hubSlugs.push(r.source_id);
  }

  const [docsRes, bundlesRes, hubsRes] = await Promise.all([
    docIds.length
      ? supabase.from("documents").select("id, title, user_id, deleted_at").in("id", docIds).eq("user_id", ownerUserId)
      : Promise.resolve({ data: [], error: null }),
    bundleIds.length
      ? supabase.from("bundles").select("id, title, user_id").in("id", bundleIds).eq("user_id", ownerUserId)
      : Promise.resolve({ data: [], error: null }),
    hubSlugs.length
      ? supabase.from("profiles").select("hub_slug, display_name, id").in("hub_slug", hubSlugs).eq("id", ownerUserId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const documents: BacklinkSource[] = ((docsRes.data || []) as Array<{ id: string; title: string | null; deleted_at: string | null }>)
    .filter((d) => !d.deleted_at)
    .map((d) => ({ id: d.id, title: d.title, context: ctxByKey.get(`document:${d.id}`) ?? null }));

  const bundles: BacklinkSource[] = ((bundlesRes.data || []) as Array<{ id: string; title: string | null }>)
    .map((b) => ({ id: b.id, title: b.title, context: ctxByKey.get(`bundle:${b.id}`) ?? null }));

  const hubs: BacklinkSource[] = ((hubsRes.data || []) as Array<{ hub_slug: string; display_name: string | null }>)
    .map((h) => ({ id: h.hub_slug, title: h.display_name ?? h.hub_slug, context: ctxByKey.get(`hub:${h.hub_slug}`) ?? null }));

  return {
    documents: documents.slice(0, limit),
    bundles: bundles.slice(0, limit),
    hubs: hubs.slice(0, limit),
    total: documents.length + bundles.length + hubs.length,
  };
}
