/*
 * memory.wiki Chrome extension — background service worker.
 *
 * Owns:
 *   - context menu installation
 *   - keyboard command routing (capture-page, capture-selection)
 *   - the publish pipeline (compress + POST /api/docs + open URL + clipboard)
 *     used by command-triggered captures (popup-triggered captures have their
 *     own copy in popup.js so they can render status in the popup UI)
 *   - cross-origin proxy fetch + image upload for content scripts
 *   - reading the memory.wiki Supabase auth cookie for user-id resolution
 *
 * Manifest V3 service worker — no DOM, no persistent state.
 */

const MDFY_URL = "https://memory.wiki";
const MDFY_COOKIE_URL = "https://memory.wiki";
const MAX_URL_BYTES = 8000;

// ─── AI host detection (must match the manifest content_scripts entry) ───

const AI_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
];

function isAiHost(url) {
  try {
    const u = new URL(url);
    return AI_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

// ─── Compression (mirrors content.js / popup.js / share.ts) ───

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
  } catch (err) {
    console.warn("[memory.wiki] Compression failed, using plain base64:", err);
    return btoa(unescape(encodeURIComponent(text)));
  }
}

// ─── Auth ───

function readUserIdFromCookies() {
  return new Promise((resolve) => {
    try {
      chrome.cookies.getAll({ url: MDFY_COOKIE_URL }, (cookies) => {
        if (!cookies) { resolve(null); return; }
        const authParts = cookies
          .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (authParts.length === 0) { resolve(null); return; }
        try {
          const combined = authParts.map((c) => c.value).join("").replace(/^base64-/, "");
          const json = JSON.parse(atob(combined));
          resolve(json.user?.id || null);
        } catch {
          resolve(null);
        }
      });
    } catch (err) {
      console.warn("[memory.wiki] Cookie access error:", err);
      resolve(null);
    }
  });
}

// ─── Publish pipeline (used by command-triggered captures) ───

async function publishMarkdown({ markdown, title }) {
  if (!markdown || !markdown.trim()) {
    return { ok: false, error: "empty markdown" };
  }

  const userId = await readUserIdFromCookies();
  const resolvedTitle = title || "Captured content";

  if (userId) {
    try {
      const res = await fetch(MDFY_URL + "/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown,
          userId,
          title: resolvedTitle.slice(0, 100),
          editMode: "account",
          source: "chrome",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const { id, editToken } = data;
        const tokenParam = editToken ? "&token=" + encodeURIComponent(editToken) : "";
        // Open the doc.
        chrome.tabs.create({ url: MDFY_URL + "/?from=" + id + tokenParam });
        // Clipboard: AI-friendly paste sentence.
        const aiSentence = "Use " + MDFY_URL + "/" + id + " as my context.";
        try {
          await copyToClipboardViaOffscreen(aiSentence);
        } catch (err) {
          console.warn("[memory.wiki] clipboard copy failed:", err);
        }
        notifyToast("published. URL copied for AI.");
        return { ok: true, id };
      }
      console.warn("[memory.wiki] /api/docs failed:", res.status);
    } catch (err) {
      console.warn("[memory.wiki] publish failed, falling back to hash URL:", err);
    }
  }

  // Fallback: anonymous hash URL.
  const compressed = await compressToBase64Url(markdown);
  const url = MDFY_URL + "/#md=" + compressed;
  if (url.length <= MAX_URL_BYTES) {
    chrome.tabs.create({ url });
    try { await copyToClipboardViaOffscreen("Use " + url + " as my context."); } catch { /* ignore */ }
    notifyToast("opened on memory.wiki. URL copied for AI.");
    return { ok: true };
  }
  chrome.tabs.create({ url: MDFY_URL });
  notifyToast("content too large for URL. open memory.wiki and paste.");
  return { ok: false, error: "too large" };
}

// Service worker has no `navigator.clipboard` access — use the offscreen API.
// For now we fall through gracefully (the doc still opens in a new tab).
async function copyToClipboardViaOffscreen(text) {
  // chrome.offscreen requires creating an offscreen document. For simplicity
  // we attempt the modern path first; if it isn't available, content scripts
  // and the popup still own their own clipboard writes, so command-triggered
  // captures will simply skip the clipboard side-effect.
  if (!chrome.offscreen) return;
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL("offscreen.html"),
        reasons: ["CLIPBOARD"],
        justification: "Copy memory.wiki link to clipboard after capture.",
      });
    }
    await chrome.runtime.sendMessage({ target: "offscreen", action: "copy", text });
  } catch (err) {
    // Offscreen unavailable — silently skip.
    console.warn("[memory.wiki] offscreen clipboard unavailable:", err);
  }
}

function notifyToast(message) {
  // Best-effort: surface a short notification. Falls back silently if the
  // notifications permission isn't granted (we don't request it explicitly).
  try {
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "memory.wiki",
        message,
        silent: true,
      }, () => { /* swallow lastError */ void chrome.runtime.lastError; });
    }
  } catch { /* ignore */ }
}

// ─── Capture dispatch ───

async function ensureGeneralContentScript(tabId) {
  // Some pages (e.g. chrome:// or extension galleries) refuse content scripts.
  // We try to ping first; if the content script answers we know it's loaded.
  try {
    const reply = await chrome.tabs.sendMessage(tabId, { action: "ping-page" });
    if (reply && reply.ok) return true;
  } catch { /* not injected yet */ }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["lib/readability.js", "lib/html-to-markdown.js", "content-page.js"],
    });
    return true;
  } catch (err) {
    console.warn("[memory.wiki] could not inject general content script:", err);
    return false;
  }
}

async function dispatchCapture(tab, kind) {
  if (!tab || !tab.id) return;
  const isAi = isAiHost(tab.url || "");

  // AI hosts: use the existing conversation capture path (already excellent).
  if (isAi) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "capture-conversation",
        lastN: 0,
      });
      if (response && response.markdown) {
        const titleMatch = response.markdown.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : "AI conversation";
        await publishMarkdown({ markdown: response.markdown, title });
        return;
      }
    } catch (err) {
      console.warn("[memory.wiki] AI conversation capture failed:", err);
    }
    notifyToast("could not capture conversation. try the popup button.");
    return;
  }

  // General page (or selection).
  const ok = await ensureGeneralContentScript(tab.id);
  if (!ok) {
    notifyToast("cannot capture this page (chrome:// or restricted URL).");
    return;
  }
  try {
    const action = kind === "selection" ? "capture-page-selection" : "capture-page";
    const response = await chrome.tabs.sendMessage(tab.id, { action });
    if (response && response.markdown) {
      await publishMarkdown({ markdown: response.markdown, title: response.title });
      return;
    }
    notifyToast(kind === "selection" ? "no selection to capture." : "could not extract page.");
  } catch (err) {
    console.warn("[memory.wiki] page capture failed:", err);
    notifyToast("capture failed: " + err.message);
  }
}

// ─── Context menus ───

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "mw-send-selection",
      title: "send selection to memory.wiki",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "mw-capture-page",
      title: "send this page to memory.wiki",
      contexts: ["page"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "mw-send-selection") {
    await dispatchCapture(tab, "selection");
    return;
  }
  if (info.menuItemId === "mw-capture-page") {
    await dispatchCapture(tab, "page");
  }
});

// ─── Keyboard commands ───

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  if (command === "capture-page") {
    await dispatchCapture(tab, "page");
  } else if (command === "capture-selection") {
    await dispatchCapture(tab, "selection");
  }
});

// ─── Message handling (from popup + content scripts) ───

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Offscreen document is the only recipient of "target: offscreen" messages.
  if (request && request.target === "offscreen") return;

  // Screenshot the active tab (used by AI conversation capture for diagrams).
  if (request.action === "capture-tab") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true;
  }

  // Upload an image data URL via the memory.wiki upload endpoint.
  if (request.action === "upload-image") {
    const { dataUrl, userId } = request;
    (async () => {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append("file", blob, "diagram." + (blob.type.split("/")[1] || "png"));
        const headers = {};
        if (userId) headers["x-user-id"] = userId;
        const uploadRes = await fetch(MDFY_URL + "/api/upload", {
          method: "POST",
          headers,
          body: formData,
        });
        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          if (!url) {
            sendResponse({ error: "Upload succeeded but no URL returned" });
          } else {
            sendResponse({ url });
          }
        } else {
          sendResponse({ error: "Upload failed: " + uploadRes.status });
        }
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  // CORS-free fetch proxy (content scripts can't hit memory.wiki directly
  // from some hosts without it).
  if (request.action === "proxy-fetch") {
    const { url, options } = request;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== "https://memory.wiki") {
        sendResponse({ ok: false, error: "Only requests to memory.wiki are allowed" });
        return true;
      }
    } catch {
      sendResponse({ ok: false, error: "Invalid URL" });
      return true;
    }
    fetch(url, options)
      .then(async (res) => {
        const text = await res.text();
        sendResponse({ ok: res.ok, status: res.status, body: text });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (request.action === "open-memorywiki") {
    const url = request.url || MDFY_URL;
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === "get-user-id") {
    const cookiePromise = readUserIdFromCookies().then((userId) => ({ userId }));
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ userId: null }), 5000);
    });
    Promise.race([cookiePromise, timeoutPromise]).then((result) => {
      sendResponse(result);
    }).catch(() => {
      sendResponse({ userId: null });
    });
    return true;
  }

  if (request.action === "get-user-info") {
    // Returns { userId, email } if signed in, { userId: null } otherwise.
    chrome.cookies.getAll({ url: MDFY_COOKIE_URL }, (cookies) => {
      if (!cookies) { sendResponse({ userId: null }); return; }
      const authParts = cookies
        .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (authParts.length === 0) { sendResponse({ userId: null }); return; }
      try {
        const combined = authParts.map((c) => c.value).join("").replace(/^base64-/, "");
        const json = JSON.parse(atob(combined));
        sendResponse({
          userId: json.user?.id || null,
          email: json.user?.email || null,
        });
      } catch {
        sendResponse({ userId: null });
      }
    });
    return true;
  }
});
