# Chrome extension — auto-capture archive

Ambient **auto-capture** (the on-page capture pill that armed a thread and then
incrementally synced the AI conversation to a single memory.wiki doc) was
**removed on 2026-06-27** (extension v2.9.0).

**Why removed:** auto-inject was already cut (off-strategy / felt random), so the
"ambient loop" had only half left — auto-capture alone was silent accumulation,
not a loop. It inverts curation (save-everything → noise) against the product's
deliberate "thought → shared document" vision, and the manual popup already
captures conversations fully (`Capture this page` → `capture-conversation` →
`extractConversation()`), so nothing was lost. The arming / incremental-PATCH /
OFF-gating surface was also a recurring source of bugs.

This file is the restore guide. **The exact pre-removal code is preserved in git.**

## Restore point

- **Tag:** `archive/chrome-autocapture-v2.8.1` (full working extension at v2.8.1, just before removal)
- Implementing commits: `f8b04351` (event-driven incremental), `b221f1a9` (pill = start/stop control), `2f520346` (this is the auto-INJECT removal — different), `b43caf77` + `5a708fbc` (OFF-gating)
- To see the removed code: `git show archive/chrome-autocapture-v2.8.1:apps/chrome-extension/content.js`
- To diff what the removal changed: `git diff archive/chrome-autocapture-v2.8.1 HEAD -- apps/chrome-extension/`

## What was removed (to re-add, restore these from the tag)

### `content.js`
Removed (all auto-capture-only):
- State: `autoCaptureEnabled`, `AUTO_SYNC_SETTLE_MS`, `threadOverrides`, `pillPos`, `MW_GRIP`, `lastActivityHash`, `doneTimer`
- Gating: `shouldShowPill()`, `threadArmed()`, `shouldCaptureThread()`, `threadKey()`
- Thread→doc map: `cheapHash()`, `getThreadMap()`, `setThreadEntry()` (storage key `mw-thread-map`)
- Sync engine: `syncThreadIncremental()` (POST create → PATCH append delta), `onConversationActivity()` (settle-timer trigger)
- Pill UI: `updateCapturePill()`, `toggleThreadCapture()`, `initCapturePill()`, `removeCapturePill()`, `injectPillStyles()` (`#mw-capture-pill`), and the pill drag helpers `applySavedPillPos()` + `makeDraggable()` (only the capture pill used them once the memory pill was gone)

KEPT (shared — do NOT remove): `extActive()`, `currentHost()`, `mwPaused`,
`disabledSites`, `showFloat`, `stateLoaded`, `refreshExtUI()`,
`extractConversation()`/`formatConversation()`/`formatMessages()`,
`getUserId()`, `proxyFetch()`, `showToast()`, `platformName()`, the float dock
(`createFloatingButton`), mini buttons (`addMiniButtons`), and all
`chrome.runtime.onMessage` handlers (`capture-conversation`, `capture-selection`,
`capture-page`, `get-platform`) — these are the MANUAL capture path the popup uses.

Wiring points to re-add inside KEPT code:
- `refreshExtUI()`: re-add `initCapturePill()` (active branch), `removeCapturePill()` (dormant branch), and `onConversationActivity()` (end of active branch).
- storage `sync.get`: re-add the `autoCapture: false` default + `autoCaptureEnabled = ...`.
- storage `local.get`: re-add `"mw-thread-capture": {}` + `"mw-pill-pos": {}` defaults + `threadOverrides = ...` + `pillPos = ...`.
- storage `onChanged`: re-add the `changes.autoCapture` (sync) and `changes["mw-thread-capture"]` (local) branches.

### `popup-v25.html` / `popup-v25.js`
- Removed the **Auto-capture** toggle row + the "currently capturing → doc" link.
- The popup's global on/off + per-site disable stay (they gate the float dock / image-hover / social pills).

### Storage keys no longer used (were `chrome.storage`)
- `autoCapture` (sync) — global on/off for the pill
- `mw-thread-capture` (local) — per-thread armed map
- `mw-thread-map` (local) — thread → {id, editToken, hash, syncedCount}
- `mw-pill-pos` (local) — dragged pill position

## If re-adding later
Restore from the tag, then re-confirm the wiring points above still exist in the
(possibly-changed) `refreshExtUI` + storage loader. The incremental sync hit
`POST /api/docs` then `PATCH /api/docs/:id {action:"append"}` with
`source:"chrome-auto"` — that API contract is the integration surface to verify.
