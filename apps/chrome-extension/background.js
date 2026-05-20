/**
 * Memory.Wiki Chrome Extension — Background Service Worker
 *
 * Handles context menu and message passing.
 * Works on AI chat pages (full conversation capture) and any page (selection/page capture).
 */

const MDFY_URL = "https://memory.wiki";
const MDFY_COOKIE_URL = "https://memory.wiki";
const MAX_URL_BYTES = 8000;

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
  } catch (err) {
    console.warn("[Memory.Wiki] Compression failed, using plain base64:", err);
    return btoa(unescape(encodeURIComponent(text)));
  }
}

async function sendToMdfy(text) {
  if (!text) return;
  const compressed = await compressToBase64Url(text);
  const url = MDFY_URL + "/#md=" + compressed;
  if (url.length <= MAX_URL_BYTES) {
    chrome.tabs.create({ url });
  } else {
    chrome.tabs.create({ url: MDFY_URL });
  }
}

// ─── Context Menus ───

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "mw-send-selection",
      title: "Send selection to Memory.Wiki",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "mw-capture-page",
      title: "Send this page to Memory.Wiki",
      contexts: ["page"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "mw-send-selection") {
    // Try rich extraction from content script first
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "capture-selection",
      });
      if (response && response.markdown) {
        await sendToMdfy(response.markdown);
        return;
      }
    } catch (err) {
      console.warn("[Memory.Wiki] Content script not available for selection capture:", err);
    }

    // Fallback: use plain selection text
    if (info.selectionText) {
      await sendToMdfy(info.selectionText);
    }
  }

  if (info.menuItemId === "mw-capture-page") {
    try {
      // Try content script first (for AI pages, gets conversation)
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "capture-page",
      });
      if (response && response.markdown) {
        await sendToMdfy(response.markdown);
        return;
      }
    } catch (err) {
      console.warn("[Memory.Wiki] Content script not available for page capture:", err);
    }

    // Fallback: inject a script to extract page content
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Lightweight page-to-markdown extraction
          const title = document.title;
          const url = window.location.href;

          // Try to find main content area
          const main = document.querySelector("main, article, [role='main'], .content, .post-content, .entry-content")
            || document.body;

          // Clone and clean
          const clone = main.cloneNode(true);

          // Remove noise elements
          clone.querySelectorAll("nav, footer, header, aside, script, style, noscript, iframe, .sidebar, .nav, .menu, .ad, .advertisement, [role='navigation'], [role='banner'], [role='complementary']").forEach(el => el.remove());

          // Extract text with basic structure
          let md = "";
          if (title) md += "# " + title + "\n\n";
          md += "> Source: " + url + "\n\n---\n\n";

          // Process headings
          clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(h => {
            const level = parseInt(h.tagName[1]);
            h.textContent = "\n" + "#".repeat(level) + " " + h.textContent.trim() + "\n";
          });

          // Process code blocks
          clone.querySelectorAll("pre").forEach(pre => {
            const code = pre.querySelector("code");
            const text = code ? code.textContent : pre.textContent;
            let lang = "";
            const langClass = (code || pre).className.match(/language-(\w+)|lang-(\w+)/);
            if (langClass) lang = langClass[1] || langClass[2];
            pre.textContent = "\n```" + lang + "\n" + text.trim() + "\n```\n";
          });

          // Process inline code
          clone.querySelectorAll("code").forEach(code => {
            if (code.closest("pre")) return;
            code.textContent = "`" + code.textContent + "`";
          });

          // Process bold/italic
          clone.querySelectorAll("strong, b").forEach(el => { el.textContent = "**" + el.textContent + "**"; });
          clone.querySelectorAll("em, i").forEach(el => { el.textContent = "*" + el.textContent + "*"; });

          // Process links (convert relative URLs to absolute)
          clone.querySelectorAll("a").forEach(a => {
            let href = a.getAttribute("href");
            const text = a.textContent;
            if (href && text) {
              try { href = new URL(href, document.baseURI).href; } catch { /* keep original */ }
              a.textContent = "[" + text + "](" + href + ")";
            }
          });

          // Process lists
          clone.querySelectorAll("ul > li").forEach(li => { li.textContent = "- " + li.textContent.trim(); });
          clone.querySelectorAll("ol > li").forEach((li, i) => { li.textContent = (i + 1) + ". " + li.textContent.trim(); });

          // Process tables
          clone.querySelectorAll("table").forEach(table => {
            let tableMd = "\n";
            const rows = table.querySelectorAll("tr");
            rows.forEach((row, rowIndex) => {
              const cells = row.querySelectorAll("th, td");
              const cellTexts = Array.from(cells).map(c => c.textContent.trim());
              tableMd += "| " + cellTexts.join(" | ") + " |\n";
              if (rowIndex === 0) {
                tableMd += "| " + cellTexts.map(() => "---").join(" | ") + " |\n";
              }
            });
            table.textContent = tableMd;
          });

          // Process blockquotes
          clone.querySelectorAll("blockquote").forEach(bq => {
            const lines = bq.textContent.trim().split("\n");
            bq.textContent = lines.map(l => "> " + l).join("\n");
          });

          // Get text
          let text = clone.innerText || clone.textContent || "";
          text = text.replace(/\n{3,}/g, "\n\n").trim();
          md += text;

          return md;
        },
      });
      if (result?.result) {
        await sendToMdfy(result.result);
      }
    } catch (err) {
      console.warn("[Memory.Wiki] Page extraction failed:", err);
      // Last resort: just open Memory.Wiki
      chrome.tabs.create({ url: MDFY_URL });
    }
  }
});

// ─── Message Handling ───

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Capture visible tab as screenshot
  if (request.action === "capture-tab") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // async
  }

  // Upload image data URL to Memory.Wiki (bypasses CORS)
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

  // Proxy fetch requests from content script (bypasses CORS)
  if (request.action === "proxy-fetch") {
    const { url, options } = request;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== "https://memory.wiki") {
        sendResponse({ ok: false, error: "Only requests to Memory.Wiki are allowed" });
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
    // Get user ID from Supabase auth cookies on Memory.Wiki
    // Supabase stores auth as base64-encoded JSON split across multiple cookies:
    //   sb-{ref}-auth-token.0, sb-{ref}-auth-token.1, etc.
    // Value format: "base64-" prefix + base64(JSON with {access_token, user: {id}})
    const cookiePromise = new Promise((resolve) => {
      try {
        chrome.cookies.getAll({ url: MDFY_COOKIE_URL }, (cookies) => {
          if (!cookies) { resolve({ userId: null }); return; }

          // Find all auth token cookie parts
          const authParts = cookies
            .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
            .sort((a, b) => a.name.localeCompare(b.name));

          if (authParts.length === 0) { resolve({ userId: null }); return; }

          try {
            // Combine cookie values and strip "base64-" prefix
            const combined = authParts.map((c) => c.value).join("").replace(/^base64-/, "");
            const json = JSON.parse(atob(combined));
            resolve({ userId: json.user?.id || null });
          } catch {
            console.warn("[Memory.Wiki] Failed to parse auth cookies");
            resolve({ userId: null });
          }
        });
      } catch (err) {
        console.warn("[Memory.Wiki] Cookie access error:", err);
        resolve({ userId: null });
      }
    });
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
});
