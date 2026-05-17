import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Text extraction now goes through unpdf, which bundles its own
  // serverless build and doesn't need pdf.worker.mjs at runtime.
  // pdfjs-dist stays in the list because extractPdfImages still uses
  // it (best-effort, image extraction is non-critical and silently
  // skips if the worker setup fails on Vercel).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "officeparser"],
  // Long-slug explainer docs (mdfy.app/how-mdfy-works, etc.) live in the
  // documents table the same as any other doc, but their ids exceed the
  // 12-char nanoid pattern Vercel's top-level rewrite assumes. Map each
  // human-readable slug explicitly to /d/<id> so the public viewer
  // renders. Each slug here MUST match a documents.id in the founder hub.
  async rewrites() {
    // Long-slug content lives in the documents/bundles tables but the
    // top-level Vercel rewrite expects 6-12-char nanoids. Each branded
    // slug needs an explicit rewrite to /d/<id> or /b/<id> so the
    // public viewer renders. New mdfy explainer/foundation content all
    // ships with long slugs; add new entries here as they are published.
    return [
      // Architecture explainers
      { source: "/how-mdfy-works", destination: "/d/how-mdfy-works" },
      { source: "/mdfy-memory", destination: "/d/mdfy-memory" },
      // Legacy alias (now a redirect stub doc)
      { source: "/how-mdfy-rag-works", destination: "/d/how-mdfy-rag-works" },
      // mdfy-about-mdfy content set
      { source: "/what-is-mdfy", destination: "/d/what-is-mdfy" },
      { source: "/mdfy-three-primitives", destination: "/d/mdfy-three-primitives" },
      { source: "/mdfy-vs-vendor-memory", destination: "/d/mdfy-vs-vendor-memory" },
      { source: "/mdfy-skills-overview", destination: "/d/mdfy-skills-overview" },
      { source: "/mdfy-bundle-spec", destination: "/d/mdfy-bundle-spec" },
      { source: "/mdfy-faq", destination: "/d/mdfy-faq" },
      { source: "/mdfy-roadmap-2026", destination: "/d/mdfy-roadmap-2026" },
      // Case studies — short Pain → Action → Result stories
      { source: "/case-cross-tool-handoff", destination: "/d/case-cross-tool-handoff" },
      { source: "/case-claude-md-personal-context", destination: "/d/case-claude-md-personal-context" },
      { source: "/case-share-with-team", destination: "/d/case-share-with-team" },
      { source: "/case-personal-llm-wiki", destination: "/d/case-personal-llm-wiki" },
    ];
  },
  webpack(config) {
    // Mermaid: exclude from webpack bundle — loaded via CDN script tag.
    // Avoids dynamic-import chunk resolution issues with mermaid v11.
    if (!config.externals) config.externals = [];
    if (Array.isArray(config.externals)) {
      config.externals.push({ mermaid: "mermaid" });
    }
    return config;
  },
};

export default nextConfig;
