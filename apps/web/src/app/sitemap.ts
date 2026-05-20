import type { MetadataRoute } from "next";
import { getSupabaseClient } from "@/lib/supabase";

export const revalidate = 3600; // regenerate hourly — public content shifts daily

async function getDynamicEntries(base: string): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const out: MetadataRoute.Sitemap = [];

  // Public hubs — opt-in. /hub/<slug> + /hub/<slug>.md alternate.
  const { data: hubs } = await supabase
    .from("profiles")
    .select("hub_slug, updated_at")
    .eq("hub_public", true)
    .not("hub_slug", "is", null)
    .limit(1000);
  for (const row of hubs || []) {
    if (!row.hub_slug) continue;
    out.push({
      url: `${base}/hub/${row.hub_slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Public published bundles — non-draft, no password, no allowed_emails.
  const { data: bundles } = await supabase
    .from("bundles")
    .select("id, updated_at, password_hash, allowed_emails")
    .eq("is_draft", false)
    .order("updated_at", { ascending: false })
    .limit(1000);
  for (const b of bundles || []) {
    if (b.password_hash) continue;
    if (Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0) continue;
    out.push({
      url: `${base}/b/${b.id}`,
      lastModified: b.updated_at ? new Date(b.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Public published docs — non-draft, no password, no allowed_emails,
  // not soft-deleted. Cap at 5000 so the sitemap stays under the 50k
  // single-file limit even as the catalog grows.
  const { data: docs } = await supabase
    .from("documents")
    .select("id, updated_at, password_hash, allowed_emails")
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null)
    .order("updated_at", { ascending: false })
    .limit(5000);
  for (const d of docs || []) {
    if (Array.isArray(d.allowed_emails) && d.allowed_emails.length > 0) continue;
    out.push({
      url: `${base}/d/${d.id}`,
      lastModified: d.updated_at ? new Date(d.updated_at) : undefined,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://memory.wiki";
  const now = new Date();
  const dynamic = await getDynamicEntries(base);

  const staticPages: MetadataRoute.Sitemap = [
    // English pages
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/plugins`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/docs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/docs/api`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/docs/cli`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/docs/sdk`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/docs/mcp`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/manifesto`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/discover`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      url: `${base}/hubs`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // Korean pages
    {
      url: `${base}/ko/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/ko/manifesto`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/ko/plugins`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/ko/docs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/ko/docs/api`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/ko/docs/cli`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/ko/docs/sdk`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/ko/docs/mcp`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  return [...staticPages, ...dynamic];
}
