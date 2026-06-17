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
- **Gating + controls**: the gating state (`mwPaused`, `disabledSites`,
  `threadOverrides`) + `currentHost`/`extActive`/`shouldCaptureThread`; the
  on-page capture STATUS pill (`initCapturePill`/`updateCapturePill`/
  `removeCapturePill`, "● capturing" / "○ capture", also styled in
  `injectInjectStyles` as `#mw-capture-pill`); the `extActive()` guards in
  `addMiniButtons` + `createFloatingButton`; `refreshExtUI()`. Precedence:
  paused > site-disabled > per-thread override > global autoCapture.
- The MutationObserver hook now calls `measureContentRight()` + `refreshExtUI()`.
- The storage-init block loads sync (`autoCapture` / `autoInject` /
  `mw-disabled-sites`) + local (`mw-paused` / `mw-thread-capture`) with a
  unified `storage.onChanged` (sync + local) → `refreshExtUI()`.

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

### popup (the convenient toggles — founder wants control here, status on page)
- The quick-controls bar `#mw-ctl-bar` (`#ctl-capture` / `#ctl-inject` /
  `#ctl-site` / `#ctl-pause`) + its `.mw-ctl` CSS, inserted after
  `#page-context`. Signed-in only (`body.signed-out .mw-ctl-bar` hidden).
- The controls IIFE at the end of popup-v25.js: reads/writes the same storage
  keys + resolves the active-tab host for the per-site toggle. (Safari popup
  is a different file set — adapt to whatever the Safari popup uses.)

### manifest
- Bump version; mirror the description.

## Keep identical across both extensions
- `storage.sync` keys: `autoCapture`, `autoInject`, `mw-disabled-sites`
- `storage.local` keys: `mw-thread-map`, `mw-thread-capture`, `mw-paused`
- Default OFF; popup = toggles; page = status. Precedence: paused >
  site-disabled > per-thread override > global autoCapture.

## Then
- Test load-on-device on ChatGPT / Claude / Gemini while signed in.
- Submit the Safari update (App Store / Safari extension flow).

(Full context: memory `memory_loop_2026_06`.)
