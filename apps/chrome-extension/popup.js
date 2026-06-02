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

// New popup-redesign helpers — write to the visible IDs the new
// HTML uses (#context-text, #context-dot, #btn-capture-title,
// #btn-capture-sub). The legacy #platform-* + .label/.desc writes
// elsewhere in this file land on invisible stub spans, so this
// helper is the one that actually paints. Brand voice: lowercase
// sentence fragments, no Title Case, no middle-dot.
function paintContext(text, live, emphasized) {
  const t = document.getElementById("context-text");
  const d = document.getElementById("context-dot");
  if (t) {
    if (emphasized) {
      // Conversational sentence with the detected term highlighted in
      // ink. Browsers escape attribute-set text already; we only inject
      // the emphasized fragment, which we control.
      t.innerHTML = "you're on <em></em>";
      const em = t.querySelector("em");
      if (em) em.textContent = emphasized;
    } else {
      t.textContent = text;
    }
  }
  if (d) d.classList.toggle("live", !!live);
}
function paintCaptureBtn(title, sub, mode) {
  const titleEl = document.getElementById("btn-capture-title");
  const subEl = document.getElementById("btn-capture-sub");
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
  if (mode) btnCapture.dataset.mode = mode;
}
function paintRangesVisible(on) {
  if (!rangeSelector) return;
  rangeSelector.classList.toggle("visible", !!on);
  // legacy display:flex too in case some CSS depends on inline style
  rangeSelector.style.display = on ? "flex" : "none";
}

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

// ─── Status (legacy element kept; new result card replaces it) ───

function setStatus(text, type = "") {
  if (statusEl) { statusEl.textContent = text; statusEl.className = "status " + type; }
}

// ─── Result card (after-capture state) ───
function showResult({ url, source, title, isError, errorText }) {
  const card = document.getElementById("result");
  const head = document.getElementById("result-head-text");
  const urlText = document.getElementById("result-url-text");
  const errorEl = document.getElementById("result-error-text");
  if (!card) return;

  if (isError) {
    card.classList.add("visible", "error");
    if (head) head.textContent = "couldn't publish";
    if (errorEl) { errorEl.style.display = ""; errorEl.textContent = errorText || "try again"; }
    return;
  }
  card.classList.remove("error");
  card.classList.add("visible");
  if (errorEl) { errorEl.style.display = "none"; errorEl.textContent = ""; }
  if (head) head.textContent = (source === "auth" ? "published" : "ready") + " · copied for AI";
  if (urlText) urlText.textContent = url.replace(/^https?:\/\//, "");
  card.dataset.url = url;

  // Copy button
  const copyBtn = document.getElementById("result-url-copy");
  if (copyBtn) {
    copyBtn.textContent = "copy";
    copyBtn.classList.remove("copied");
    copyBtn.onclick = async () => {
      const sentence = "Use " + url + " as my context.";
      try { await navigator.clipboard.writeText(sentence); copyBtn.textContent = "copied"; copyBtn.classList.add("copied"); }
      catch { copyBtn.textContent = "copy failed"; }
      setTimeout(() => { copyBtn.textContent = "copy"; copyBtn.classList.remove("copied"); }, 1500);
    };
  }

  // AI pill click handlers — copy URL+sentence then open the AI in a
  // new tab so user can paste with cmd+v.
  document.querySelectorAll(".ai-pill").forEach((pill) => {
    pill.onclick = async (e) => {
      e.preventDefault();
      const aiUrl = pill.getAttribute("href");
      const sentence = "Use " + url + " as my context.";
      try { await navigator.clipboard.writeText(sentence); } catch { /* ignore */ }
      chrome.tabs.create({ url: aiUrl });
    };
  });

  // Save to recent — resolve active tab hostname now so the row shows where it came from
  resolveActiveSource().then((source) => {
    rememberCapture({ url, title: title || "Untitled capture", source, ts: Date.now() })
      .then(renderRecent);
  });
}

function resolveActiveSource() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const t = (tabs || [])[0];
        if (!t || !t.url) { resolve("chrome"); return; }
        try { resolve(new URL(t.url).hostname || "chrome"); }
        catch { resolve("chrome"); }
      });
    } catch { resolve("chrome"); }
  });
}

// ─── Recent captures (chrome.storage.local, last 5) ───
async function rememberCapture(entry) {
  const data = await chromeStorageGet(["mw-recent"]);
  const prev = Array.isArray(data["mw-recent"]) ? data["mw-recent"] : [];
  const next = [entry, ...prev.filter((p) => p.url !== entry.url)].slice(0, 5);
  await chromeStorageSet({ "mw-recent": next });
}
function chromeStorageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, (data) => resolve(data || {})));
}
function chromeStorageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}
async function renderRecent() {
  const wrap = document.getElementById("recent-wrap");
  const list = document.getElementById("recent-list");
  if (!wrap || !list) return;
  const data = await chromeStorageGet(["mw-recent"]);
  const recent = Array.isArray(data["mw-recent"]) ? data["mw-recent"] : [];
  if (recent.length === 0) { wrap.classList.remove("visible"); return; }
  wrap.classList.add("visible");
  list.innerHTML = recent.map((r) => {
    const ago = formatAgo(r.ts);
    const title = escHtml(r.title || r.url.replace(/^https?:\/\//, ""));
    const src = r.source ? '<span class="src-dot" title="' + escHtml(r.source) + '"></span>' : '<span class="src-dot"></span>';
    return '<a class="recent-item" href="' + escHtml(r.url) + '" target="_blank" rel="noopener" data-url="' + escHtml(r.url) + '">'
      + src
      + '<span class="title">' + title + '</span>'
      + '<span class="ago">' + ago + '</span>'
      + '<span class="open-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg></span>'
      + '</a>';
  }).join("");
  // Re-bind: copy URL+sentence on click + open
  list.querySelectorAll(".recent-item").forEach((row) => {
    row.addEventListener("click", async (e) => {
      e.preventDefault();
      const url = row.getAttribute("data-url");
      try { await navigator.clipboard.writeText("Use " + url + " as my context."); } catch { /* ignore */ }
      chrome.tabs.create({ url });
    });
  });
}
function formatAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  return d + "d";
}
// ─── Send to memory.wiki ───

async function openInMemoryWiki(markdown) {
  if (!markdown || markdown.trim().length === 0) {
    showResult({ isError: true, errorText: "no content found" });
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
        const { id } = parsed;
        const docUrl = MDFY_URL + "/" + id;
        const aiSentence = "Use " + docUrl + " as my context.";
        try { await navigator.clipboard.writeText(aiSentence); } catch { /* ignore */ }
        // Paint result card; user can click URL to open or pick an AI pill.
        showResult({ url: docUrl, source: "auth", title });
        return;
      }
      // Check for auth failure.
      if (res.status === 401 || res.status === 403) {
        showResult({ isError: true, errorText: "session expired. sign in at memory.wiki to sync." });
        chrome.storage.local.remove("mw-was-logged-in");
        return;
      }
    } catch (err) {
      console.warn("[memory.wiki] authenticated share failed, falling back to hash URL:", err);
    }
  }

  // Fallback: hash-based URL (anon).
  const compressed = await compressToBase64Url(markdown);
  const url = MDFY_URL + "/#md=" + compressed;

  if (url.length <= MAX_URL_BYTES) {
    try { await navigator.clipboard.writeText("Use " + url + " as my context."); } catch { /* ignore */ }
    showResult({ url, source: "anon", title: "Captured (sign in for short URL)" });
  } else {
    let copied = false;
    try { await navigator.clipboard.writeText(markdown); copied = true; } catch { /* ignore */ }
    if (copied) {
      showResult({ isError: true, errorText: "too large for a URL — content copied. paste into memory.wiki." });
    } else {
      showResult({ isError: true, errorText: "content too large for a URL. copy manually." });
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
      paintContext(null, true, "a github markdown file");
      paintCaptureBtn("capture this readme", "use the open-in-memory.wiki button on the page", "github");
      btnCapture.disabled = true;
      setStatus("use the open-in-memory.wiki button on the page", "info");
      return null;
    }

    if (platform) {
      paintContext(null, true, PLATFORM_NAMES[platform]);
      paintCaptureBtn("capture full conversation", "all messages as a markdown document", "ai");
      btnCapture.disabled = false;
      paintRangesVisible(true);
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
  paintContext(null, false, "memory.wiki");
  paintCaptureBtn("you're already here", "create and edit documents in the app", "mdfy");
  btnCapture.disabled = true;
  paintRangesVisible(false);
}

function showNotOnAiPage() {
  paintContext("any webpage", false);
  paintCaptureBtn("capture this page", "clean markdown, shareable URL", "page");
  btnCapture.disabled = false;
  paintRangesVisible(false);
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
    const title = val === 0 ? "capture full conversation" : "capture last " + val + " exchanges";
    const sub = val === 0 ? "all messages as a markdown document" : "recent " + val + " Q&A pairs";
    paintCaptureBtn(title, sub);
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

// Paint profile data (avatar_url + display_name) onto the chip.
// Falls back to the seeded initial silently if avatar fetch fails.
function applyProfile(p) {
  if (!p) return;
  const chip = document.getElementById("account-chip");
  const avatar = document.getElementById("account-avatar");
  const info = document.getElementById("account-info");
  if (info && p.display_name) info.textContent = p.display_name;
  // Refresh tooltip with the real display name + email if available
  if (chip) {
    const parts = [];
    if (p.display_name) parts.push(p.display_name);
    if (p.email && p.email !== p.display_name) parts.push("<" + p.email + ">");
    parts.push("click to sign out");
    chip.title = parts.join("  ·  ");
  }
  if (avatar && p.avatar_url) {
    const img = document.createElement("img");
    img.src = p.avatar_url;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      // OAuth pic unreachable — restore initial.
      avatar.innerHTML = (p.display_name || p.email || "?").trim().charAt(0).toUpperCase() || "?";
    };
    avatar.innerHTML = "";
    avatar.appendChild(img);
  }
}

async function fetchProfileAndApply(userId) {
  try {
    const res = await proxyFetch(MDFY_URL + "/api/user/profile", {
      method: "GET",
      headers: { "x-user-id": userId },
    });
    if (!res || !res.ok) return;
    const body = JSON.parse(res.body || "{}");
    const profile = body.profile || body;
    if (profile && (profile.avatar_url || profile.display_name)) {
      chrome.storage.local.set({ "mw-profile": { userId, avatar_url: profile.avatar_url, display_name: profile.display_name } });
      applyProfile({ userId, ...profile });
    }
  } catch {
    /* network / unauthorized — silently keep initial */
  }
}

// In-extension sign-out: clear the Supabase cookies for memory.wiki
// directly via chrome.cookies. Avoids a web round-trip (the prior
// `/auth/signout` URL 404'd) and gives instant feedback.
async function inExtensionSignOut() {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: "memory.wiki" }, (cookies) => {
      const sb = (cookies || []).filter((c) => c.name.startsWith("sb-"));
      if (sb.length === 0) { resolve(); return; }
      let pending = sb.length;
      sb.forEach((c) => {
        const url = "https://" + c.domain.replace(/^\./, "") + (c.path || "/");
        chrome.cookies.remove({ url, name: c.name }, () => {
          if (--pending === 0) resolve();
        });
      });
    });
  });
}

function renderAccountChip({ userId, email }) {
  const chip = document.getElementById("account-chip");
  const avatar = document.getElementById("account-avatar");
  const info = document.getElementById("account-info");
  if (!chip || !avatar || !info) return;

  // Update the "sign out / sign in" hint in the footer row, if the
  // new account-row layout is present.
  const actionLabel = document.getElementById("account-action-label");

  if (userId) {
    const initial = (email || "?").trim().charAt(0).toUpperCase() || "?";
    avatar.textContent = initial;
    avatar.innerHTML = initial;
    avatar.classList.add("active");
    info.textContent = email || "signed in";
    chip.classList.remove("signin");
    chip.title = (email || "signed in") + " — click to sign out";
    if (actionLabel) actionLabel.textContent = "sign out";
    chip.onclick = async (e) => {
      e.preventDefault();
      const prevText = info.textContent;
      info.textContent = "signing out…";
      chip.style.pointerEvents = "none";
      await inExtensionSignOut();
      chrome.storage.local.remove(["mw-was-logged-in", "mw-profile"]);
      // Re-render as signed-out state
      renderAccountChip({ userId: null, email: null });
      chip.style.pointerEvents = "";
      setStatus("signed out", "info");
      // Re-detect platform so the capture button picks up the new state
      try { detectPlatform(); } catch {}
    };

    // Async-fetch profile and swap in the OAuth avatar + display
    // name when they arrive. Cached in chrome.storage.local so the
    // next popup open paints instantly. Same shape as Desktop's
    // sidebar (apps/desktop/renderer/editor.js L1054+).
    chrome.storage.local.get(["mw-profile"], (data) => {
      const cached = data["mw-profile"];
      if (cached && cached.userId === userId) applyProfile(cached);
    });
    fetchProfileAndApply(userId);
  } else {
    avatar.textContent = "?";
    avatar.innerHTML = "?";
    avatar.classList.remove("active");
    info.textContent = "sign in for permanent URLs";
    chip.classList.add("signin");
    chip.title = "sign in to memory.wiki";
    if (actionLabel) actionLabel.textContent = "sign in";
    chip.onclick = (e) => {
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
renderRecent();
