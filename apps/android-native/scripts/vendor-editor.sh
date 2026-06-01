#!/bin/bash
# Copies the built @mdcore/editor renderer + supporting CSS into the
# Android app's assets/ so a WebView-based MarkdownBody can load them
# via file:///android_asset/. Same source of truth as web / desktop /
# vscode / quicklook / ios.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EDITOR_DIST="$ROOT/packages/editor/dist"
ASSETS="$ROOT/apps/android-native/app/src/main/assets/memorywiki"

if [ ! -d "$EDITOR_DIST" ]; then
  echo "▶ Building @mdcore/editor first"
  (cd "$ROOT/packages/editor" && npm run build)
fi

mkdir -p "$ASSETS"
cp "$EDITOR_DIST/render.umd.global.js" "$ASSETS/render.umd.js"

# KaTeX CSS for server-rendered math widget styling
cp "$ROOT/node_modules/katex/dist/katex.min.css" "$ASSETS/katex.min.css" 2>/dev/null \
  || echo "  (katex.min.css not found at root node_modules)"

# highlight.js github-dark theme for code blocks
cp "$ROOT/node_modules/highlight.js/styles/github-dark.min.css" "$ASSETS/github-dark.min.css" 2>/dev/null \
  || echo "  (hljs CSS not found at root node_modules)"

echo "✓ Vendored @mdcore/editor → apps/android-native/app/src/main/assets/memorywiki/"
ls -la "$ASSETS/"
