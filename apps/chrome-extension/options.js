/*
 * memory.wiki — options page script.
 *
 * Wires:
 *   - keyboard shortcut display (queries chrome.commands.getAll, chrome only)
 *   - floating button toggle (storage.sync.showFloatingButton, chrome only)
 *   - version pill
 *
 * Sign in is intentionally NOT here — it lives in the popup chip so
 * the user has exactly one login entry point.
 */

// Detect Safari iOS — chrome.commands is undefined on iOS Safari
// extensions, and the UA contains iPhone / iPad / iPod. We use both
// signals (UA primarily, API absence as backup) so the page hides
// chrome-only sections before they flash visible.
const IS_IOS = (() => {
  try {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent || "")) return true;
    if (typeof chrome === "undefined" || !chrome.commands) return true;
  } catch {}
  return false;
})();
if (IS_IOS) document.body.classList.add("is-ios");

// Detect macOS Safari separately. chrome.commands DOES exist in macOS
// Safari extensions (so we can't reuse the IS_IOS heuristic), but
// chrome://extensions/shortcuts is a Chrome-only URL — Safari just
// shows "Safari cannot open the page" if we try to navigate to it.
// Standard Safari/WebKit UA check: contains "Safari", does NOT contain
// any Chrome / Chromium / Edge / Opera markers.
const IS_SAFARI = (() => {
  try {
    if (IS_IOS) return true;
    const ua = navigator.userAgent || "";
    return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR\//i.test(ua);
  } catch {}
  return false;
})();
if (IS_SAFARI) document.body.classList.add("is-safari");

// Sign in lives in the popup chip only — the container app and this
// Settings panel intentionally don't carry their own account section.
// One canonical login surface = one source of truth.
const kbdPage = document.getElementById("kbd-page");
const kbdSel = document.getElementById("kbd-sel");
const shortcutsLink = document.getElementById("shortcuts-link");
const chkFloat = document.getElementById("chk-float");
const chkAutoCapture = document.getElementById("chk-autocapture");
const versionPill = document.getElementById("version-pill");
const versionDesc = document.getElementById("version-desc");

// ─── Shortcuts ───

function formatShortcut(s) {
  if (!s) return "not bound";
  // Chrome returns e.g. "⌘⇧E" on mac, "Ctrl+Shift+E" on others.
  return s;
}

function loadShortcuts() {
  // Skip on iOS — Safari iOS extensions have no concept of user-
  // editable keyboard shortcuts, and chrome.commands is undefined.
  if (IS_IOS) return;
  if (!chrome.commands || !chrome.commands.getAll) {
    kbdPage.textContent = "Cmd+Shift+E";
    kbdSel.textContent = "Cmd+Shift+X";
    return;
  }
  chrome.commands.getAll((commands) => {
    const byName = Object.fromEntries(commands.map((c) => [c.name, c.shortcut]));
    kbdPage.textContent = formatShortcut(byName["capture-page"]);
    kbdSel.textContent = formatShortcut(byName["capture-selection"]);
  });
}

if (shortcutsLink) {
  // On Safari, swap the entire descriptor line out — there is no
  // shortcuts-shortcuts page reachable from the extension, and Safari's
  // own shortcut customization is a different surface (System Settings
  // > Keyboard > Keyboard Shortcuts > App Shortcuts > Safari). Telling
  // the user to click a link that 404's looks broken; telling them
  // where the real surface is keeps the trust intact.
  if (IS_SAFARI) {
    const row = shortcutsLink.closest(".desc");
    if (row) {
      row.textContent =
        "These bindings are fixed by the extension. To remap them, " +
        "open System Settings > Keyboard > Keyboard Shortcuts > " +
        "App Shortcuts > Safari and add a Menu Title that matches " +
        "either capture command.";
    }
  } else {
    shortcutsLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (IS_IOS) return;
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    });
  }
}

// ─── Floating button toggle (chrome only) ───

if (!IS_IOS && chkFloat && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get({ showFloatingButton: false }, (data) => {
    chkFloat.checked = !!data.showFloatingButton;
  });

  chkFloat.addEventListener("change", () => {
    const value = chkFloat.checked;
    chrome.storage.sync.set({ showFloatingButton: value });
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (!tab.id) return;
        chrome.tabs.sendMessage(tab.id, {
          action: "toggle-float-button",
          show: value,
        }).catch(() => { /* tab has no content script — fine */ });
      });
    });
  });
}

// ─── Auto-capture toggle (chrome only) ───
// The content script reads storage.sync.autoCapture + listens for changes,
// so just persisting the flag flips behavior live on open AI tabs.
if (!IS_IOS && chkAutoCapture && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get({ autoCapture: false }, (data) => {
    chkAutoCapture.checked = !!data.autoCapture;
  });
  chkAutoCapture.addEventListener("change", () => {
    chrome.storage.sync.set({ autoCapture: chkAutoCapture.checked });
  });
}

// ─── Version ───

if (chrome.runtime && chrome.runtime.getManifest) {
  const m = chrome.runtime.getManifest();
  versionPill.textContent = m.version || "?";
}
if (IS_IOS && versionDesc) {
  versionDesc.textContent = "memory.wiki Safari extension";
}

// ─── Init ───

loadShortcuts();
