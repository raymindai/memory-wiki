# Safari extension — pending port from Chrome (auto-capture + auto-inject)

The Chrome extension shipped two memory-loop features on 2026-06-17 (v2.8.0)
that this Safari copy does NOT have yet. Port them here for channel parity.

Source: `apps/chrome-extension/`. Target: `memory.wiki Clipper/Shared (Extension)/Resources/`.

## What to port

### content.js
- **#2 ambient auto-capture** block: `threadKey`, `cheapHash`, `getThreadMap`,
  `setThreadEntry`, `autoSyncThread`, `scheduleAutoSync` — syncs each AI thread
  to ONE doc (keyed by `chrome.storage.local["mw-thread-map"]`; POST then PATCH).
- **#1 auto-inject** block: `getInputEl`, `readInput`, `insertIntoInput`,
  `injectInjectStyles`, `openInjectPanel`, `positionPanel`, `initAutoInject`,
  `removeAutoInject` — the "✦ memory" pill → `/api/search?deep=1` → insert URL.
- The MutationObserver hook: `scheduleAutoSync()` + `if (autoInjectEnabled) initAutoInject()`.
- The storage-init block: flags `autoCapture` / `autoInject` + `storage.onChanged`.

**Before porting, confirm the Safari content.js has the helpers these depend
on**: `getUserId`, `proxyFetch`, `extractConversation`, `formatConversation`,
`showToast`, `platform`. Safari's background/auth plumbing may differ from
Chrome's `proxy-fetch` / `get-user-id` messages — adapt the network + userId
resolution if so.

### options.html
- Two toggle rows: `#chk-autocapture`, `#chk-autoinject`.
- Toggle CSS fix: the checked-state knob must be `background: var(--bg)` (dark),
  NOT `--accent` (it's ~white here, so ON looked like a solid white blob).

### options.js
- `chkAutoCapture` / `chkAutoInject` consts + their load + `change` →
  `chrome.storage.sync.set` blocks.

### manifest
- Bump version; mirror the description.

## Keep identical across both extensions
- `storage.sync` keys: `autoCapture`, `autoInject`
- `storage.local` key: `mw-thread-map`

## Then
- Test load-on-device on ChatGPT / Claude / Gemini while signed in.
- Submit the Safari update (App Store / Safari extension flow).

(Full context: memory `memory_loop_2026_06`.)
