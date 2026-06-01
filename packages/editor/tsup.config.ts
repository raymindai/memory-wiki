// tsup config for @mdcore/editor.
//
// Three build targets so every memory.wiki channel can consume the
// same renderer:
//   - ESM     → apps/web (Next.js), apps/vscode-extension (modern webview)
//   - CJS     → apps/desktop main.js (Electron preload + render IPC)
//   - UMD/IIFE → QuickLook .appex (inlined as base64 in Swift template
//                literal), iOS WKWebView, Android WebView. Single file,
//                no module loader required.

import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// onSuccess shell command — emit the shared editor.css alongside the
// other dist artifacts. Channels copy this verbatim through their
// vendor-editor.sh scripts so Desktop and the VS Code webview render
// at full web parity (border, gutter, mermaid frame, math widgets,
// task-list checkboxes, etc.).
const copyEditorCss = (): void => {
  const src = resolve(__dirname, "src/editor.css");
  const dest = resolve(__dirname, "dist/editor.css");
  mkdirSync(resolve(__dirname, "dist"), { recursive: true });
  copyFileSync(src, dest);
  // eslint-disable-next-line no-console
  console.log("[tsup] copied src/editor.css → dist/editor.css");
};

export default defineConfig([
  // Library builds: ESM + CJS + dts for render, tiptap-config, and
  // the standalone mermaid-init helper (so Next.js / web can import
  // `@mdcore/editor/mermaid-init` directly without dragging in the
  // whole tiptap-config bundle).
  {
    entry: [
      "src/render.ts",
      "src/tiptap-config.ts",
      "src/mermaid-init.ts",
    ],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    target: "es2020",
    splitting: false,
    onSuccess: async () => {
      copyEditorCss();
    },
    // Mark heavy deps as external for Node consumers (Electron main,
    // vscode webview, web bundle). The UMD build below bundles
    // everything for the browser-only surfaces (QuickLook, iOS
    // WebView, Android WebView).
    external: [
      "@tiptap/core",
      "@tiptap/extension-code-block-lowlight",
      "@tiptap/extension-image",
      "@tiptap/extension-link",
      "@tiptap/extension-placeholder",
      "@tiptap/extension-table",
      "@tiptap/extension-table-cell",
      "@tiptap/extension-table-header",
      "@tiptap/extension-table-row",
      "@tiptap/extension-task-item",
      "@tiptap/extension-task-list",
      "@tiptap/pm",
      "@tiptap/starter-kit",
      "highlight.js",
      "katex",
      "lowlight",
      "markdown-it",
      "markdown-it-footnote",
      "tiptap-markdown",
    ],
  },
  // Browser-ready single-file UMD bundle, deps inlined.
  {
    entry: { "render.umd": "src/render.ts" },
    format: ["iife"],
    globalName: "MemoryWikiRender",
    sourcemap: false,
    clean: false,
    outDir: "dist",
    target: "es2020",
    noExternal: [/.*/],
    dts: false,
  },
  // Browser-ready TipTap config bundle for Desktop renderer +
  // VSCode webview. Includes the full TipTap + ProseMirror stack
  // inline (~5MB) so consumers just <script> it and call
  // window.MemoryWikiEditor.buildExtensions(...).
  {
    entry: { "tiptap-config.umd": "src/tiptap-config.ts" },
    format: ["iife"],
    globalName: "MemoryWikiEditor",
    sourcemap: false,
    clean: false,
    outDir: "dist",
    target: "es2020",
    noExternal: [/.*/],
    dts: false,
  },
]);
