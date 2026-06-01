# @mdcore/editor

Shared markdown render + TipTap editor configuration for memory.wiki.

**Web (`apps/web`) is the source of truth.** This package vendors
`apps/web/src/lib/render.ts` and (eventually) the TipTap config from
`apps/web/src/components/TiptapLiveEditor.tsx` so every channel —
Desktop (Electron), VSCode extension, QuickLook, iOS WKWebView,
Android WebView — renders identical output.

## Exports

| Entry | Use case |
|---|---|
| `import { render } from "@mdcore/editor/render"` | ESM — web, vscode webview |
| `const { render } = require("@mdcore/editor")` | CJS — desktop main.js IPC handlers |
| `<script src="render.umd.global.js"></script>` then `MemoryWikiRender.render(...)` | UMD — QuickLook .appex, iOS WKWebView, Android WebView |
| `import { buildExtensions } from "@mdcore/editor/tiptap-config"` | TipTap extension array for editor surfaces *(stub — extraction in progress)* |

## Build

```bash
cd packages/editor
npm run build
```

Produces three artifacts in `dist/`:

- `render.mjs` (~11KB, deps external) — ESM
- `render.js` (~13KB, deps external) — CJS
- `render.umd.global.js` (~2.5MB, deps inlined) — IIFE under `window.MemoryWikiRender`

## How to update

When `apps/web/src/lib/render.ts` changes:

1. Copy the file: `cp apps/web/src/lib/render.ts packages/editor/src/render.ts`
2. `npm run build --workspace=packages/editor`
3. Re-vendor into channels that bundle their own copy (QuickLook,
   iOS/Android WebView). Channels that npm-link (`apps/web`,
   `apps/desktop`, `apps/vscode-extension`) pick up the change
   automatically on next rebuild.

This manual copy step exists because web's `lib/render.ts` is also
imported by web code directly. Once Phase B finishes we may invert
that and have `apps/web/src/lib/render.ts` re-export from
`@mdcore/editor/render` to remove the duplication.
