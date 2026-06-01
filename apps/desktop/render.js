// Markdown → HTML renderer for the Electron main process.
//
// v3.0+: this file is now a thin shim that re-exports the
// @mdcore/editor renderer (vendored into ./vendor-editor at build
// time via scripts/vendor-editor.sh). The actual implementation
// lives at packages/editor/src/render.ts and is byte-shared with
// apps/web — same parser, same post-processing, same DOM output
// across every memory.wiki channel.
//
// To refresh after pulling a render.ts change in web:
//   1. cd packages/editor && npm run build
//   2. cd apps/desktop && ./scripts/vendor-editor.sh
// (Both run automatically as part of `npm run build:dmg`.)

module.exports = require("./vendor-editor/render.cjs");
