/*
 * memory.wiki chrome extension — popup script.
 */

const MDFY_URL = "https://memory.wiki";
const MAX_URL_BYTES = 8000;

const statusEl = document.getElementById("status");
const platformDot = document.getElementById("platform-dot");
const platformNameEl = document.getElementById("platform-name");
const btnCapture = document.getElementById("btn-capture");
const btnSelection = document.getElementById("btn-selection");
const rangeSelector = document.getElementById("range-selector");

// Range: radio buttons instead of select
function getRangeValue() {
  const checked = document.querySelector('input[name="range"]:checked');
  return checked ? parseInt(checked.value) : 0;
}
// Compatibility shim so existing code using rangeSelect.value still works
const rangeSelect = { get value() { return String(getRangeValue()); } };

// ─── Compression (same as content.js / share.ts) ───

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function compressToBase64Url(text) {
  try {
    const stream = new Blob([text])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const compressed = await new Response(stream).arrayBuffer();
    return arrayBufferToBase64Url(compressed);
  } catch {
    return btoa(unescape(encodeURIComponent(text)));
  }
}

// ─── Proxy Fetch & Auth (via background service worker) ───

function proxyFetch(url, options = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "proxy-fetch", url, options },
      (r) => resolve(r || { ok: false, error: "no response" })
    );
  });
}

function getUserId() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "get-user-id" }, (response) => {
      resolve(response?.userId || null);
    });
  });
}

// ─── Status ───

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = "status " + type;
}

// ─── Send to memory.wiki ───

async function openInMemoryWiki(markdown) {
  if (!markdown || markdown.trim().length === 0) {
    setStatus("no content found", "error");
    return;
  }

  // Try authenticated sharing first
  const userId = await getUserId();
  if (userId) {
    try {
      const titleMatch = markdown.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1].trim().slice(0, 100) : "Captured content";

      const res = await proxyFetch(MDFY_URL + "/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, userId, title, editMode: "account", source: "chrome" }),
      });

      if (res.ok) {
        let parsed; try { parsed = JSON.parse(res.body); } catch { throw new Error("invalid response"); }
        const { id, editToken } = parsed;
        const tokenParam = editToken ? "&token=" + encodeURIComponent(editToken) : "";
        chrome.tabs.create({ url: MDFY_URL + "/?from=" + id + tokenParam });
        // Brand spec section 14 (canonical "for AI" paste sentence).
        // Drop the short URL on the clipboard so the user can paste it
        // straight into the next AI tool (Cursor / ChatGPT / Claude).
        // The browser tab still opens so the user sees the doc.
        const aiSentence = "Use " + MDFY_URL + "/" + id + " as my context.";
        try { await navigator.clipboard.writeText(aiSentence); } catch { /* ignore */ }
        setStatus("published. URL copied for AI.", "success");
        return;
      }
      // Check for auth failure.
      if (res.status === 401 || res.status === 403) {
        setStatus("session expired. sign in at memory.wiki to sync.", "error");
        chrome.storage.local.remove("mw-was-logged-in");
      }
    } catch (err) {
      console.warn("[memory.wiki] authenticated share failed, falling back to hash URL:", err);
    }
  }

  // Fallback: hash-based URL (anon).
  const compressed = await compressToBase64Url(markdown);
  const url = MDFY_URL + "/#md=" + compressed;

  if (url.length <= MAX_URL_BYTES) {
    chrome.tabs.create({ url });
    // Copy the hash URL as a context sentence too — same paste-target pattern.
    try { await navigator.clipboard.writeText("Use " + url + " as my context."); } catch { /* ignore */ }
    setStatus("opened. URL copied for AI.", "success");
  } else {
    let copied = false;
    try {
      await navigator.clipboard.writeText(markdown);
      copied = true;
    } catch { /* ignore */ }
    chrome.tabs.create({ url: MDFY_URL });
    if (copied) {
      setStatus("content copied. paste into memory.wiki.", "success");
    } else {
      setStatus("content too large for URL. copy manually.", "error");
    }
  }
}

// ─── Platform Detection ───

const PLATFORM_NAMES = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
};

async function detectPlatform() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showNotOnAiPage();
      return null;
    }

    const url = tab.url;
    let platform = null;

    if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
      platform = "chatgpt";
    } else if (url.includes("claude.ai")) {
      platform = "claude";
    } else if (url.includes("gemini.google.com")) {
      platform = "gemini";
    }

    // Check if on memory.wiki itself.
    if (url.includes("memory.wiki")) {
      showOnMdfy();
      return null;
    }

    // Check if on a GitHub .md file.
    if (url.includes("github.com") && /\/blob\/.*\.(md|markdown|mdx)$/i.test(url)) {
      platformDot.classList.remove("inactive");
      platformDot.classList.add("active");
      platformNameEl.classList.add("active");
      platformNameEl.textContent = "github markdown detected";
      btnCapture.disabled = true;
      setStatus("use the 'open in memory.wiki' button on the page", "");
      return null;
    }

    if (platform) {
      platformDot.classList.remove("inactive");
      platformDot.classList.add("active");
      platformNameEl.classList.add("active");
      platformNameEl.textContent = PLATFORM_NAMES[platform] + " detected";
      btnCapture.disabled = false;
      rangeSelector.style.display = "flex";
      return { tab, platform };
    } else {
      showNotOnAiPage();
      return null;
    }
  } catch {
    showNotOnAiPage();
    return null;
  }
}

function showOnMdfy() {
  if (platformDot) {
    platformDot.classList.remove("inactive");
    platformDot.classList.add("active");
    platformDot.style.background = "#B5FF1A";
  }
  if (platformNameEl) {
    platformNameEl.classList.add("active");
    platformNameEl.textContent = "memory.wiki";
  }
  btnCapture.disabled = true;
  const labelEl = btnCapture.querySelector(".label");
  if (labelEl) labelEl.innerHTML = 'you\'re on memory.wiki<span class="desc">create and edit documents directly here</span>';
  rangeSelector.style.display = "none";
}

function showNotOnAiPage() {
  platformDot.classList.remove("active");
  platformDot.classList.add("inactive");
  platformDot.style.background = "#60a5fa";
  platformNameEl.classList.add("active");
  platformNameEl.textContent = "any webpage";
  document.getElementById("platform-hint").textContent = "capture this page as markdown";
  btnCapture.disabled = false;
  const labelEl = btnCapture.querySelector(".label");
  if (labelEl) labelEl.innerHTML = 'capture this page<span class="desc">page content as a clean markdown document</span>';
  btnCapture.dataset.mode = "page";
  rangeSelector.style.display = "none";
}

// ─── Actions ───

async function ensureContentScript(tabId, kind /* "page" | "ai" */) {
  // Try a no-op ping; if no response, inject the appropriate files.
  try {
    const pingAction = kind === "ai" ? "get-platform" : "ping-page";
    const reply = await chrome.tabs.sendMessage(tabId, { action: pingAction });
    if (reply) return true;
  } catch { /* not injected */ }
  const files = kind === "ai"
    ? ["content.js"]
    : ["lib/readability.js", "lib/html-to-markdown.js", "content-page.js"];
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files });
    await new Promise((r) => setTimeout(r, 150));
    return true;
  } catch (err) {
    console.warn("[memory.wiki] inject failed:", err);
    return false;
  }
}

btnCapture.addEventListener("click", async () => {
  const isPageMode = btnCapture.dataset.mode === "page";
  const lastN = parseInt(rangeSelect.value) || 0;
  setStatus("capturing...");
  btnCapture.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (isPageMode) {
      // General web page — route through the content-page.js script
      // (manifest already injects it; we still ensure for first-load safety).
      await ensureContentScript(tab.id, "page");
      const response = await chrome.tabs.sendMessage(tab.id, { action: "capture-page" });
      if (response && response.markdown) {
        await openInMemoryWiki(response.markdown);
      } else {
        setStatus("no content found", "error");
      }
    } else {
      // AI conversation — existing path.
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "capture-conversation",
        lastN,
      });
      if (response && response.markdown) {
        await openInMemoryWiki(response.markdown);
      } else {
        setStatus("no conversation found", "error");
      }
    }
  } catch (err) {
    setStatus("retrying...");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const kind = btnCapture.dataset.mode === "page" ? "page" : "ai";
      const injected = await ensureContentScript(tab.id, kind);
      if (!injected) {
        setStatus("cannot capture this page (chrome:// or restricted)", "error");
        return;
      }
      const action = kind === "page" ? "capture-page" : "capture-conversation";
      const payload = kind === "page" ? { action } : { action, lastN };
      const response = await chrome.tabs.sendMessage(tab.id, payload);
      if (response && response.markdown) {
        await openInMemoryWiki(response.markdown);
      } else {
        setStatus(kind === "page" ? "no content found" : "no conversation found", "error");
      }
    } catch (retryErr) {
      setStatus("failed: " + retryErr.message, "error");
    }
  } finally {
    btnCapture.disabled = false;
  }
});

btnSelection.addEventListener("click", async () => {
  setStatus("getting selection...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isAiPage = /chatgpt\.com|claude\.ai|gemini\.google\.com|chat\.openai\.com/.test(tab.url || "");
    const kind = isAiPage ? "ai" : "page";

    let markdown = null;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "capture-selection",
      });
      markdown = response?.markdown;
    } catch {
      // Content script not loaded — inject the right pair and retry.
      const injected = await ensureContentScript(tab.id, kind);
      if (!injected) {
        setStatus("cannot capture this page (chrome:// or restricted)", "error");
        return;
      }
      const response = await chrome.tabs.sendMessage(tab.id, { action: "capture-selection" });
      markdown = response?.markdown;
    }

    if (!markdown) {
      setStatus("no text selected", "error");
      return;
    }

    await openInMemoryWiki(markdown);
  } catch (err) {
    setStatus("failed: " + err.message, "error");
  }
});

// ─── Range label sync (radio buttons) ───

document.querySelectorAll('input[name="range"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const val = parseInt(radio.value);
    const labelEl = btnCapture.querySelector(".label");
    const descEl = labelEl.querySelector(".desc");
    // Remove old text, keep .desc span
    const newText = val === 0 ? "capture full conversation" : "capture last " + val + " exchanges";
    const newDesc = val === 0 ? "all messages as a markdown document" : "recent " + val + " Q&A pairs as a markdown document";
    labelEl.innerHTML = newText + '<span class="desc">' + newDesc + '</span>';
  });
});

// ─── Shortcuts (read-only display in popup) ───

const kbdPage = document.getElementById("kbd-page");
const kbdSel = document.getElementById("kbd-sel");
if (chrome.commands && chrome.commands.getAll) {
  chrome.commands.getAll((commands) => {
    const byName = Object.fromEntries(commands.map((c) => [c.name, c.shortcut]));
    if (kbdPage) kbdPage.textContent = byName["capture-page"] || "Cmd+Shift+E";
    if (kbdSel) kbdSel.textContent = byName["capture-selection"] || "Cmd+Shift+X";
  });
}

// ─── Settings link ───

const linkSettings = document.getElementById("link-settings");
if (linkSettings) {
  linkSettings.addEventListener("click", (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    }
  });
}

// ─── Auth state + account chip ───

function getUserInfo() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "get-user-info" }, (response) => {
      resolve(response || { userId: null });
    });
  });
}

function renderAccountChip({ userId, email }) {
  const avatar = document.getElementById("account-avatar");
  const info = document.getElementById("account-info");
  const action = document.getElementById("account-action");
  if (!avatar || !info || !action) return;

  if (userId) {
    const initial = (email || "?").trim().charAt(0).toUpperCase() || "?";
    avatar.textContent = initial;
    avatar.classList.add("active");
    if (email) {
      info.innerHTML = '<span class="email"></span>';
      info.querySelector(".email").textContent = email;
    } else {
      info.innerHTML = '<span class="label">signed in</span>';
    }
    action.textContent = "sign out";
    action.classList.remove("cta");
    action.onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: MDFY_URL + "/auth/signout" });
    };
  } else {
    avatar.textContent = "?";
    avatar.classList.remove("active");
    info.innerHTML = '<span class="label">sign in for permanent URLs</span>';
    action.textContent = "sign in";
    action.classList.add("cta");
    action.onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: MDFY_URL });
    };
  }
}

(async function checkAuthState() {
  const info = await getUserInfo();
  renderAccountChip(info);
  chrome.storage.local.get(["mw-was-logged-in"], (data) => {
    if (!info.userId && data["mw-was-logged-in"]) {
      // Session expired — flag once, don't keep nagging.
      setStatus("session expired. sign in at memory.wiki to sync.", "error");
      chrome.storage.local.remove("mw-was-logged-in");
    } else if (info.userId) {
      chrome.storage.local.set({ "mw-was-logged-in": "1" });
    }
  });
})();

// ─── Document Search ───

function escHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const searchInput = document.getElementById("search-input");
const searchResultsEl = document.getElementById("search-results");
let searchTimer = null;

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length < 3) {
      searchResultsEl.innerHTML = "";
      return;
    }
    searchTimer = setTimeout(async () => {
      const userId = await getUserId();
      if (!userId) {
        searchResultsEl.innerHTML = '<div style="font-size:10px;color:#52525b;padding:4px 0">sign in to search</div>';
        return;
      }
      try {
        const res = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: "proxy-fetch",
            url: `${MDFY_URL}/api/search?q=${encodeURIComponent(q)}`,
            options: { headers: { "x-user-id": userId } },
          }, resolve);
        });
        if (!res || !res.ok) { searchResultsEl.innerHTML = ""; return; }
        const data = JSON.parse(res.body);
        const results = data.results || [];
        if (results.length === 0) {
          searchResultsEl.innerHTML = '<div style="font-size:10px;color:#52525b;padding:4px 0">no results</div>';
          return;
        }
        searchResultsEl.innerHTML = results.slice(0, 5).map(r =>
          `<a href="${MDFY_URL}/${escHtml(r.id)}" target="_blank" style="display:block;padding:5px 8px;border-radius:4px;text-decoration:none;margin-bottom:2px;transition:background 0.1s" onmouseover="this.style.background='#1c1c24'" onmouseout="this.style.background='none'">
            <div style="font-size:11px;font-weight:600;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.title)}</div>
            <div style="font-size:9px;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml((r.snippet || "").slice(0, 60))}</div>
          </a>`
        ).join("");
      } catch { searchResultsEl.innerHTML = ""; }
    }, 400);
  });
}

// ─── Init ───

detectPlatform();
