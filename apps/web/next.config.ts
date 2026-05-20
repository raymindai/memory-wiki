import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Text extraction goes through unpdf (self-contained serverless
  // build, no worker needed). Image extraction still uses
  // pdfjs-dist directly via extractPdfImages, and pdfjs-dist loads
  // pdf.worker.mjs lazily through its fake-worker path. Vercel's
  // output file tracer doesn't see the worker file because the
  // import is `webpackIgnore: true`, so we explicitly include the
  // worker for the PDF route — without this, image extraction
  // throws "Setting up fake worker failed" and the PDF saves as
  // text-only even for signed-in users.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "officeparser"],
  outputFileTracingIncludes: {
    "/api/import/pdf": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  // Long-slug explainer docs live in the documents table the same as
  // any other doc, but their ids exceed the 12-char nanoid pattern
  // Vercel's top-level rewrite assumes. Map each human-readable slug
  // explicitly to /d/<id> so the public viewer renders. Each slug
  // here MUST match a documents.id in the founder hub.
  async rewrites() {
    return [
      // Architecture explainers
      { source: "/how-memorywiki-works", destination: "/d/how-mdfy-works" },
      { source: "/mw-memory", destination: "/d/mw-memory" },
      // Freshness explainer
      { source: "/how-memorywiki-stays-fresh", destination: "/d/RUMdz2fQ" },
      // Legacy alias (now a redirect stub doc)
      { source: "/how-memorywiki-rag-works", destination: "/d/how-mdfy-rag-works" },
      // About content set
      { source: "/what-is-memorywiki", destination: "/d/what-is-mdfy" },
      { source: "/mw-three-primitives", destination: "/d/mw-three-primitives" },
      { source: "/mw-vs-vendor-memory", destination: "/d/mw-vs-vendor-memory" },
      { source: "/mw-skills-overview", destination: "/d/mw-skills-overview" },
      { source: "/mw-bundle-spec", destination: "/d/mw-bundle-spec" },
      { source: "/mw-faq", destination: "/d/mw-faq" },
      { source: "/mw-roadmap-2026", destination: "/d/mw-roadmap-2026" },
      // Case studies — short Pain → Action → Result stories
      { source: "/case-cross-tool-handoff", destination: "/d/case-cross-tool-handoff" },
      { source: "/case-claude-md-personal-context", destination: "/d/case-claude-md-personal-context" },
      { source: "/case-share-with-team", destination: "/d/case-share-with-team" },
      { source: "/case-personal-llm-wiki", destination: "/d/case-personal-llm-wiki" },
      // Legacy mdfy-* slugs still redirect during transition
      { source: "/how-mdfy-works", destination: "/d/how-mdfy-works" },
      { source: "/how-mdfy-stays-fresh", destination: "/d/RUMdz2fQ" },
      { source: "/how-mdfy-rag-works", destination: "/d/how-mdfy-rag-works" },
      { source: "/what-is-mdfy", destination: "/d/what-is-mdfy" },
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
