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
      // Architecture explainers. The /mw-* slugs are the memory.wiki
      // canonical form; the underlying docs still live under their
      // historical mdfy-* ids in the documents table (id renames
      // would cost link redirects across the wider web).
      { source: "/how-memorywiki-works", destination: "/d/how-mdfy-works" },
      { source: "/mw-memory", destination: "/d/mdfy-memory" },
      { source: "/how-memorywiki-stays-fresh", destination: "/d/RUMdz2fQ" },
      { source: "/how-memorywiki-rag-works", destination: "/d/how-mdfy-rag-works" },
      { source: "/what-is-memorywiki", destination: "/d/what-is-mdfy" },
      { source: "/mw-three-primitives", destination: "/d/mdfy-three-primitives" },
      { source: "/mw-vs-vendor-memory", destination: "/d/mdfy-vs-vendor-memory" },
      { source: "/mw-skills-overview", destination: "/d/mdfy-skills-overview" },
      { source: "/mw-bundle-spec", destination: "/d/mdfy-bundle-spec" },
      { source: "/mw-faq", destination: "/d/mdfy-faq" },
      { source: "/mw-roadmap-2026", destination: "/d/mdfy-roadmap-2026" },
      // Case studies — short Pain → Action → Result stories
      { source: "/case-cross-tool-handoff", destination: "/d/case-cross-tool-handoff" },
      { source: "/case-claude-md-personal-context", destination: "/d/case-claude-md-personal-context" },
      { source: "/case-share-with-team", destination: "/d/case-share-with-team" },
      { source: "/case-personal-llm-wiki", destination: "/d/case-personal-llm-wiki" },
      // Legacy mdfy-* slugs still resolve. These map 1:1 to their
      // underlying documents.id values (long slugs that exceed the
      // 12-char nanoid pattern the top-level rewrite assumes).
      { source: "/how-mdfy-works", destination: "/d/how-mdfy-works" },
      { source: "/how-mdfy-stays-fresh", destination: "/d/RUMdz2fQ" },
      { source: "/how-mdfy-rag-works", destination: "/d/how-mdfy-rag-works" },
      { source: "/what-is-mdfy", destination: "/d/what-is-mdfy" },
      { source: "/mdfy-memory", destination: "/d/mdfy-memory" },
      { source: "/mdfy-three-primitives", destination: "/d/mdfy-three-primitives" },
      { source: "/mdfy-vs-vendor-memory", destination: "/d/mdfy-vs-vendor-memory" },
      { source: "/mdfy-skills-overview", destination: "/d/mdfy-skills-overview" },
      { source: "/mdfy-bundle-spec", destination: "/d/mdfy-bundle-spec" },
      { source: "/mdfy-faq", destination: "/d/mdfy-faq" },
      { source: "/mdfy-roadmap-2026", destination: "/d/mdfy-roadmap-2026" },
    ];
  },
  // Desktop DMG download — redirect a stable internal path to the
  // current GitHub Release. Keeps the link in PluginsPure.tsx stable
  // (`/downloads/memory-wiki-desktop.dmg`) and lets us point at a new
  // release just by editing this one line per ship. 308 lets the user
  // resume downloads against GitHub's CDN instead of streaming a
  // ~110MB asset through Vercel.
  async redirects() {
    return [
      {
        source: "/downloads/memory-wiki-desktop.dmg",
        destination: "https://github.com/raymindai/memory-wiki/releases/download/desktop-v2.7.4/memory.wiki-2.7.4-arm64.dmg",
        permanent: false,
      },
      // Bare alias — short URL we can share in tweets / docs.
      {
        source: "/download/mac",
        destination: "https://github.com/raymindai/memory-wiki/releases/download/desktop-v2.7.4/memory.wiki-2.7.4-arm64.dmg",
        permanent: false,
      },
      // Chrome extension zip — same pattern; Web Store link is the
      // primary install path but power users want the raw zip too.
      {
        source: "/downloads/memory-wiki-chrome.zip",
        destination: "https://github.com/raymindai/memory-wiki/releases/download/chrome-ext-v2.7.0/memory-wiki-clipper-2.7.0.zip",
        permanent: false,
      },
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
  // lucide-react 1.x ships ESM under .mjs only. Next.js' default
  // modularizeImports rule maps to .js → resolve fails. Override.
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{kebabCase member}}.mjs",
      skipDefaultConversion: true,
    },
  },
};

export default nextConfig;
