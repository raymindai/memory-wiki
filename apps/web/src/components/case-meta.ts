import type { Metadata } from "next";

/** Server-side metadata helper for /case-* pages. Lives in its own
 *  file (no "use client") so server-component page.tsx can call it
 *  without dragging the CasePure client bundle into RSC scope. */
export function caseMetadata(slug: string, title: string, sub: string): Metadata {
  return {
    title: `${title} — memory.wiki`,
    description: sub,
    alternates: { canonical: `https://memory.wiki/case-${slug}` },
    openGraph: {
      title: `${title} — memory.wiki`,
      description: sub,
      url: `https://memory.wiki/case-${slug}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(title)}`, width: 1200, height: 630 }],
    },
  };
}
