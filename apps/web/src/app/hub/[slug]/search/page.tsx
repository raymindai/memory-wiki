import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import HubSearchClient from "./HubSearchClient";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

interface HubProfile {
  display_name: string | null;
  hub_slug: string;
  hub_description: string | null;
}

async function getHubProfile(slug: string): Promise<HubProfile | null> {
  if (!/^[a-z0-9_-]{3,32}$/.test(slug)) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, hub_slug, hub_public, hub_description")
    .eq("hub_slug", slug)
    .single();
  if (!profile || !profile.hub_public) return null;
  return profile;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { q } = await searchParams;
  const profile = await getHubProfile(slug);
  if (!profile) return { robots: { index: false, follow: false } };

  const author = profile.display_name || slug;
  const title = q
    ? `Search "${q}" — ${author}'s hub`
    : `Search ${author}'s hub`;
  return {
    title,
    description: `Search ${author}'s knowledge hub for "${q || "anything"}". Hybrid semantic + keyword retrieval across every public document.`,
    // Search result pages aren't useful to index — the user's query
    // is unique per visit and the canonical content lives at each
    // result doc's own URL.
    robots: { index: false, follow: true },
    alternates: { canonical: `https://memory.wiki/hub/${slug}/search` },
  };
}

export default async function HubSearchPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { q } = await searchParams;
  const profile = await getHubProfile(slug);
  if (!profile) notFound();

  const author = profile.display_name || slug;

  return (
    <HubSearchClient
      slug={slug}
      author={author}
      hubDescription={profile.hub_description}
      initialQuery={q || ""}
    />
  );
}
