// v8 W4-6 Citation rot — find broken external links in user docs.
//
// Flow:
//   1. On doc save: extractExternalUrls(markdown) writes the doc's
//      URL list into document_external_links (replace-pattern).
//   2. Daily cron picks N=50 oldest-checked URLs from
//      external_link_health (or never-checked candidates from the
//      doc index), HEADs each with a short timeout, writes back
//      status_code + last_checked_at + consecutive_fail_count.
//   3. Lint joins document_external_links → external_link_health
//      and surfaces (docId, url, status) tuples for docs the
//      current user owns where the URL is dead.
//
// We treat a URL as "dead" only when it has failed at least
// CONSECUTIVE_FAIL_THRESHOLD checks in a row. Transient 5xx from
// rate limits or cold CDNs shouldn't push a still-live link into
// Citation rot on the very first failed probe.

import type { SupabaseClient } from "@supabase/supabase-js";

const CONSECUTIVE_FAIL_THRESHOLD = 2;
const RECHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly
const HEAD_TIMEOUT_MS = 7000;

/** Extract http(s) URLs from a markdown blob. Includes both
 *  `[label](url)` and bare URLs; drops anchors / mailto / our own
 *  memory.wiki + mdfy.app + mdfy.cc URLs since "internal" links
 *  shouldn't count as citation rot. */
export function extractExternalUrls(md: string | null | undefined): string[] {
  if (!md) return [];
  const out = new Set<string>();
  // Markdown links: [text](url)
  const mdRe = /\[[^\]]*\]\(([^)\s]+)\)/g;
  // Bare URL form
  const bareRe = /\bhttps?:\/\/[^\s<>"'`)\]]+/g;
  const push = (raw: string) => {
    const trimmed = raw.replace(/[.,;:!?)]+$/, "").trim();
    if (!/^https?:\/\//i.test(trimmed)) return;
    try {
      const u = new URL(trimmed);
      const host = u.hostname.toLowerCase();
      if (host === "memory.wiki" || host.endsWith(".memory.wiki")) return;
      if (host === "mdfy.app" || host.endsWith(".mdfy.app")) return;
      if (host === "mdfy.cc" || host.endsWith(".mdfy.cc")) return;
      // Strip the fragment for de-dupe — same page, two anchors,
      // one health check.
      u.hash = "";
      out.add(u.toString());
    } catch { /* malformed URL, skip */ }
  };
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(md)) !== null) push(m[1]);
  while ((m = bareRe.exec(md)) !== null) push(m[0]);
  return Array.from(out);
}

/** Replace the per-doc URL index. Called from the doc save path
 *  so the lint surface always reflects the current markdown. */
export async function refreshDocExternalLinks(
  supabase: SupabaseClient,
  docId: string,
  markdown: string,
): Promise<void> {
  const urls = extractExternalUrls(markdown);
  // Wipe + bulk insert. Tiny tables; the round trip cost is what we
  // pay either way.
  await supabase.from("document_external_links").delete().eq("document_id", docId);
  if (urls.length === 0) return;
  await supabase.from("document_external_links").insert(
    urls.map((url) => ({ document_id: docId, url })),
  );
  // Seed health rows for any new URLs so the cron sees them in its
  // recheck queue. UPSERT no-op when the row already exists.
  await supabase.from("external_link_health").upsert(
    urls.map((url) => ({ url, last_checked_at: new Date(0).toISOString() })),
    { onConflict: "url", ignoreDuplicates: true },
  );
}

/** HEAD-check one URL with a hard timeout. Returns the status code,
 *  or null on network error / abort. Sites that 403 HEAD but 200 GET
 *  (common on Cloudflare-fronted endpoints) get a fallback GET probe
 *  for the auth-style codes 401/403/405 only — we don't want to
 *  thunder every endpoint with a GET. */
async function probeUrl(url: string): Promise<number | null> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ac.signal, redirect: "follow" });
    clearTimeout(timeout);
    if (res.status === 401 || res.status === 403 || res.status === 405) {
      // Some hosts disallow HEAD. Try GET (no body read) to confirm.
      const ac2 = new AbortController();
      const t2 = setTimeout(() => ac2.abort(), HEAD_TIMEOUT_MS);
      try {
        const res2 = await fetch(url, { method: "GET", signal: ac2.signal, redirect: "follow" });
        clearTimeout(t2);
        return res2.status;
      } catch { clearTimeout(t2); return res.status; }
    }
    return res.status;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/** Drain N oldest-checked URLs from external_link_health. Used by
 *  the daily cron. Returns counts for telemetry. */
export async function runCitationCheckSweep(
  supabase: SupabaseClient,
  maxPerTick = 50,
): Promise<{ checked: number; ok: number; failed: number; dead: number }> {
  const cutoff = new Date(Date.now() - RECHECK_INTERVAL_MS).toISOString();
  const { data: rows } = await supabase
    .from("external_link_health")
    .select("url, consecutive_fail_count")
    .or(`last_checked_at.lte.${cutoff},status_code.is.null`)
    .order("last_checked_at", { ascending: true })
    .limit(maxPerTick);
  let checked = 0, ok = 0, failed = 0, dead = 0;
  for (const r of (rows as Array<{ url: string; consecutive_fail_count: number }> | null) ?? []) {
    checked++;
    const status = await probeUrl(r.url);
    const isFailure = status === null || status >= 400;
    const nextFails = isFailure ? r.consecutive_fail_count + 1 : 0;
    if (isFailure) failed++; else ok++;
    if (nextFails >= CONSECUTIVE_FAIL_THRESHOLD) dead++;
    await supabase.from("external_link_health").update({
      status_code: status,
      last_checked_at: new Date().toISOString(),
      consecutive_fail_count: nextFails,
      first_failed_at: nextFails === 1 ? new Date().toISOString() : (isFailure ? undefined : null),
    }).eq("url", r.url);
  }
  return { checked, ok, failed, dead };
}

/** Pull rotten citations for one user. Returns up to `limit` items;
 *  grouped at the call site for display. */
export interface CitationRotItem {
  docId: string;
  docTitle: string | null;
  url: string;
  statusCode: number | null;
  firstFailedAt: string | null;
}

export async function findCitationRot(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<CitationRotItem[]> {
  // Two-step because PostgREST joins across tables are awkward.
  // 1) Pull all doc ids owned by the user.
  // 2) Pull their external link index, joined to dead URLs.
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title")
    .eq("user_id", userId)
    .is("deleted_at", null);
  const docList = (docs as Array<{ id: string; title: string | null }> | null) ?? [];
  if (docList.length === 0) return [];
  const titleByDoc = new Map(docList.map((d) => [d.id, d.title]));
  const docIds = docList.map((d) => d.id);

  const { data: links } = await supabase
    .from("document_external_links")
    .select("document_id, url")
    .in("document_id", docIds);
  const linkRows = (links as Array<{ document_id: string; url: string }> | null) ?? [];
  if (linkRows.length === 0) return [];
  const uniqUrls = Array.from(new Set(linkRows.map((r) => r.url)));

  const { data: health } = await supabase
    .from("external_link_health")
    .select("url, status_code, consecutive_fail_count, first_failed_at")
    .in("url", uniqUrls);
  const dead = new Map<string, { status_code: number | null; first_failed_at: string | null }>();
  for (const h of (health as Array<{ url: string; status_code: number | null; consecutive_fail_count: number; first_failed_at: string | null }> | null) ?? []) {
    if (h.consecutive_fail_count >= CONSECUTIVE_FAIL_THRESHOLD) {
      dead.set(h.url, { status_code: h.status_code, first_failed_at: h.first_failed_at });
    }
  }
  if (dead.size === 0) return [];

  const out: CitationRotItem[] = [];
  for (const row of linkRows) {
    const d = dead.get(row.url);
    if (!d) continue;
    out.push({
      docId: row.document_id,
      docTitle: titleByDoc.get(row.document_id) ?? null,
      url: row.url,
      statusCode: d.status_code,
      firstFailedAt: d.first_failed_at,
    });
    if (out.length >= limit) break;
  }
  return out;
}
