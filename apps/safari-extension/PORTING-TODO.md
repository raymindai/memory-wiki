# Safari extension — pending port from Chrome (auto-capture)

The Chrome extension shipped ambient **auto-capture** (v2.8.x) that this Safari
copy does NOT have yet. Port it here for channel parity.

> Note: the earlier "auto-inject" pill (the "✦ memory" composer pill →
> `/api/search?deep=1` → insert URL) was **cut on 2026-06-18** — it competed on
> retrieval accuracy (off-strategy) and felt random. Do NOT port it. Auto-capture
> is the only memory-loop feature to bring over.

Source: `apps/chrome-extension/`. Target: `memory.wiki Clipper/Shared (Extension)/Resources/`.

## What to port

### content.js
- **Ambient auto-capture** block: `threadKey`, `cheapHash`, `getThreadMap`,
  `setThreadEntry`, `syncThreadIncremental`, `onConversationActivity` — syncs each
  AI thread to ONE doc (keyed by `chrome.storage.local["mw-thread-map"]`; POST to
  create, then `action:"append"` for deltas). Event-driven (content-stable settle
  timer), no polling.
- **Gating + controls** (GLOBAL only — no per-thread override): the gating state
  (`mwPaused`, `disabledSites`) + `extActive()` / `shouldCaptureThread()`; the
  on-page capture STATUS pill (`initCapturePill` / `updateCapturePill` /
  `removeCapturePill`, "● capturing" / "capture", with the recording-pulse dot,
  draggable, click-to-stop), styled in `injectPillStyles` as `#mw-capture-pill`
  (also defines the JetBrains Mono `@font-face`); the `extActive()` guards in
  `addMiniButtons` + `createFloatingButton`; `refreshExtUI()`. Precedence:
  paused > site-disabled > global autoCapture.
- The MutationObserver hook calls `measureContentRight()` + `refreshExtUI()`.
- The storage-init block loads sync (`autoCapture` / `mw-disabled-sites`) + local
  (`mw-paused` / `mw-thread-map` / `mw-pill-pos`) with a unified
  `storage.onChanged` (sync + local) → `refreshExtUI()`.

**Before porting, confirm the Safari content.js has the helpers these depend
on**: `getUserId`, `proxyFetch`, `extractConversation`, `formatMessages`,
`showToast`, `platform`. Safari's background/auth plumbing may differ from
Chrome's `proxy-fetch` / `get-user-id` messages — adapt the network + userId
resolution if so.

### web_accessible_resources
- `fonts/JetBrainsMono-Regular.woff2` must be web-accessible on the AI sites
  (the capture pill uses it). Mirror the Chrome manifest entry.

### options.html / options.js
- One toggle row: `#chk-autocapture` + its `chkAutoCapture` const, load, and
  `change` → `chrome.storage.sync.set({ autoCapture })`.
- Toggle CSS: the checked-state knob must be `background: var(--bg)` (dark), NOT
  `--accent` (it's ~white here, so ON looked like a solid white blob).

### popup (founder wants control here, status on page)
- Header master on/off (`#sw-master` → `mw-paused`), per-site row (`#sw-site` →
  `mw-disabled-sites`), and the single Auto-capture toggle (`#sw-capture`).
- The quick-controls IIFE at the end of popup-v25.js: reads/writes the same
  storage keys + resolves the active-tab host for the per-site toggle. (Safari
  popup is a different file set — adapt to whatever the Safari popup uses.)

### manifest
- Bump version; mirror the description (capture-only, no inject).

## Keep identical across both extensions
- `storage.sync` keys: `autoCapture`, `mw-disabled-sites`
- `storage.local` keys: `mw-thread-map`, `mw-paused`, `mw-pill-pos`
- Default OFF; popup = toggles; page = status. Precedence: paused >
  site-disabled > global autoCapture.

## Then
- Test load-on-device on ChatGPT / Claude / Gemini while signed in.
- Submit the Safari update (App Store / Safari extension flow).

(Full context: memory `memory_loop_2026_06`.)
