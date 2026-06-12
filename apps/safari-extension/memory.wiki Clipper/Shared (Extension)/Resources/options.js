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

// Sign in lives in the popup chip only — the container app and this
// Settings panel intentionally don't carry their own account section.
// One canonical login surface = one source of truth.
const kbdPage = document.getElementById("kbd-page");
const kbdSel = document.getElementById("kbd-sel");
const shortcutsLink = document.getElementById("shortcuts-link");
const chkFloat = document.getElementById("chk-float");
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
  shortcutsLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (IS_IOS) return;
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
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
