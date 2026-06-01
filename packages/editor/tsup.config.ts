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

export default defineConfig([
  // Library builds: ESM + CJS + dts for BOTH render and tiptap-config
  {
    entry: ["src/render.ts", "src/tiptap-config.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    target: "es2020",
    splitting: false,
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
]);
