// Markdown → HTML renderer for the VS Code extension preview.
//
// v3.0+: thin shim that re-exports the @mdcore/editor renderer
// (vendored into ../vendor-editor/ by scripts/vendor-editor.sh).
// The actual implementation lives at packages/editor/src/render.ts
// and is byte-shared with apps/web so a doc previewed in the VS
// Code panel paints identically to opening it on memory.wiki.
//
// To refresh after a render.ts change in web:
//   1. cd packages/editor && npm run build
//   2. cd apps/vscode-extension && ./scripts/vendor-editor.sh
// Both run automatically as part of `npm run compile`.

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const shared = require("../vendor-editor/render.cjs");

export interface FlavorInfo {
  primary: "gfm" | "obsidian" | "mdx" | "pandoc" | "commonmark";
  math: boolean;
  mermaid: boolean;
  wikilinks: boolean;
  jsx: boolean;
  frontmatter: "yaml" | "toml" | "json" | null;
  confidence: number;
}

export interface RenderResult {
  html: string;
  title: string | undefined;
  flavor: FlavorInfo;
}

export const render: (markdown: string) => RenderResult = shared.render;
export const extractTitle: (markdown: string) => string | undefined = shared.extractTitle;
export const detectFlavor: (markdown: string) => FlavorInfo = shared.detectFlavor;
