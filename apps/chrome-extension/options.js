/*
 * memory.wiki — options page script.
 *
 * Wires:
 *   - account chip (reads memory.wiki Supabase cookies via background)
 *   - keyboard shortcut display (queries chrome.commands.getAll)
 *   - floating button toggle (storage.sync.showFloatingButton)
 *   - version pill
 */

const MDFY_URL = "https://memory.wiki";

const accountTitle = document.getElementById("account-title");
const accountDesc = document.getElementById("account-desc");
const accountAction = document.getElementById("account-action");
const kbdPage = document.getElementById("kbd-page");
const kbdSel = document.getElementById("kbd-sel");
const shortcutsLink = document.getElementById("shortcuts-link");
const chkFloat = document.getElementById("chk-float");
const versionPill = document.getElementById("version-pill");

// ─── Account chip ───

function getUserInfo() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "get-user-info" }, (response) => {
      resolve(response || { userId: null });
    });
  });
}

async function renderAccount() {
  const { userId, email } = await getUserInfo();
  if (userId) {
    accountTitle.textContent = "signed in";
    accountDesc.textContent = email || "memory.wiki account active";
    accountAction.textContent = "sign out";
    accountAction.onclick = () => {
      // Open the memory.wiki sign-out page; the cookie clears there.
      chrome.tabs.create({ url: MDFY_URL + "/auth/signout" });
    };
  } else {
    accountTitle.textContent = "not signed in";
    accountDesc.textContent = "sign in at memory.wiki to keep captures in your account, get permanent URLs, and search across your docs.";
    accountAction.textContent = "sign in";
    accountAction.classList.add("primary");
    accountAction.onclick = () => {
      chrome.tabs.create({ url: MDFY_URL });
    };
  }
}

// ─── Shortcuts ───

function formatShortcut(s) {
  if (!s) return "not bound";
  // Chrome returns e.g. "⌘⇧E" on mac, "Ctrl+Shift+E" on others.
  return s;
}

function loadShortcuts() {
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

shortcutsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// ─── Floating button toggle ───

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

// ─── Version ───

if (chrome.runtime && chrome.runtime.getManifest) {
  const m = chrome.runtime.getManifest();
  versionPill.textContent = m.version || "?";
}

// ─── Init ───

renderAccount();
loadShortcuts();
