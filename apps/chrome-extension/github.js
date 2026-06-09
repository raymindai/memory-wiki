/*
 * memory.wiki chrome extension — github integration.
 *
 * Detects .md files on GitHub and adds an "open in memory.wiki" button.
 * Fetches raw markdown and opens it in memory.wiki for beautiful rendering
 * and editing.
 */

(function () {
  "use strict";

  if (document.documentElement.dataset.mwGithub) return;
  document.documentElement.dataset.mwGithub = "1";

  const MDFY_URL = "https://memory.wiki";

  function isMarkdownPage() {
    // GitHub .md file view: URL like /owner/repo/blob/branch/path/file.md
    const path = window.location.pathname;
    if (!/\/blob\//.test(path)) return false;
    // Check file extension
    if (!/\.(md|markdown|mdx|mdown|mkd)$/i.test(path)) return false;
    return true;
  }

  function getRawUrl() {
    // Convert /owner/repo/blob/branch/path/file.md
    // to     /owner/repo/raw/branch/path/file.md
    return window.location.pathname.replace("/blob/", "/raw/");
  }

  function getFileName() {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1];
  }

  function createButton() {
    // Prevent duplicates — remove ALL existing Memory.Wiki buttons first
    document.querySelectorAll("#mw-github-btn, .mw-github-btn").forEach(el => el.remove());
    if (!isMarkdownPage()) return;

    const btn = document.createElement("button");
    btn.id = "mw-github-btn";
    btn.className = "mw-github-btn";
    btn.innerHTML = '<svg class="mw-gh-icon" width="14" height="14" viewBox="0 0 182.32 188.54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor"><path d="M112.16,161.09c3.81,8.85-.88,18.9-7.78,23.53-8,5.37-17.59,5.24-25.48-.57-6.69-4.92-10.82-14.51-7.05-23.4,4.02-9.5,2.56-21.01-7.28-26.09l-1.71-.88c-3.81-1.96-7.1-4.74-9.94-7.95-5.12-5.78-13.21-7.68-20.68-4.4-7.39,3.25-14.86,3.57-22.01-.91C4.45,116.81.07,110.03,0,102.14c-.06-7.37,2.57-13.88,8.03-18.09s12.51-6.7,19.22-4.24c6.18,2.26,11.88,2.17,17.36-1.17,5.47-3.34,6.58-8.71,8.7-15.41,2.49-7.87,12.05-14.43,20.22-16.12,8.74-1.8,18.21-6.12,19.42-15.86.87-7,1.48-13.84,7.19-18.45s12.57-6.67,20.01-5.07,13.26,6.29,15.66,12.16c2.89,7.07,2.31,15.51-3.26,20.84-5.97,5.72-9.01,14.82-3.15,21.95,3.45,4.2,5.18,8.98,6.38,14.22,2.67,11.64,14.8,15.19,25.3,13.52,7.92-1.26,15.22,5.05,18.35,10.57,4.09,7.22,3.72,15.41-.37,22.26-7.13,11.92-22.06,12.9-32.34,4.93-7.63-5.92-16.62-1.86-23.6,2.07-11.37,6.4-16.49,18-10.96,30.86Z"/><circle cx="62.57" cy="14.69" r="14.69"/><circle cx="24.47" cy="48" r="13.95"/><circle cx="143.12" cy="161.01" r="13.96"/><circle cx="41.25" cy="159.57" r="13.73"/><circle cx="163.42" cy="61.57" r="12.99"/></svg><span class="mw-gh-label">Open in memory.wiki</span>';
    btn.title = "Open this Markdown file in memory.wiki for rendering and editing";

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.classList.add("mw-gh-loading");
      btn.querySelector(".mw-gh-label").textContent = "loading...";

      try {
        const rawUrl = getRawUrl();
        const res = await fetch(rawUrl);
        if (!res.ok) throw new Error("Failed to fetch: " + res.status);
        const markdown = await res.text();

        if (!markdown.trim()) {
          btn.querySelector(".mw-gh-label").textContent = "empty file";
          setTimeout(() => resetButton(btn), 2000);
          return;
        }

        // Try authenticated upload if user is logged in to Memory.Wiki
        try {
          const userId = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "get-user-id" }, (r) => resolve(r?.userId));
          });

          if (userId) {
            const title = getFileName().replace(/\.(md|markdown|mdx|mdown|mkd)$/i, "");
            const uploadRes = await new Promise((resolve) => {
              chrome.runtime.sendMessage({
                action: "proxy-fetch",
                url: MDFY_URL + "/api/docs",
                options: {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    markdown,
                    userId,
                    title,
                    editMode: "account",
                    source: "github",
                  }),
                },
              }, resolve);
            });

            if (uploadRes.ok) {
              let parsed;
              try { parsed = JSON.parse(uploadRes.body); } catch { throw new Error("Invalid response"); }
              const { id, editToken } = parsed;
              const tokenParam = editToken ? "&token=" + encodeURIComponent(editToken) : "";
              window.open(MDFY_URL + "/?from=" + id + tokenParam, "_blank");
              btn.classList.remove("mw-gh-loading");
              btn.classList.add("mw-gh-done");
              btn.querySelector(".mw-gh-label").textContent = "opened!";
              setTimeout(() => resetButton(btn), 3000);
              return;
            }
          }
        } catch {
          // Fall through to hash URL
        }

        // Fallback: hash URL (no login needed)
        const compressed = await compressToBase64Url(markdown);
        const url = MDFY_URL + "/#md=" + compressed;

        if (url.length <= 8000) {
          window.open(url, "_blank");
        } else {
          // Too large for URL — copy to clipboard and open empty editor
          try { await navigator.clipboard.writeText(markdown); } catch {}
          window.open(MDFY_URL, "_blank");
        }

        btn.classList.remove("mw-gh-loading");
        btn.classList.add("mw-gh-done");
        btn.querySelector(".mw-gh-label").textContent = "opened!";
        setTimeout(() => resetButton(btn), 3000);
      } catch (err) {
        console.error("[memory.wiki] github integration error:", err);
        btn.classList.remove("mw-gh-loading");
        btn.classList.add("mw-gh-error");
        btn.querySelector(".mw-gh-label").textContent = "failed";
        setTimeout(() => resetButton(btn), 3000);
      }
    });

    // Insert into GitHub's file header actions
    // GitHub's DOM changes frequently — try multiple strategies
    const inserted = tryInsertButton(btn);
    if (!inserted) {
      // Ultimate fallback: fixed-position floating button
      btn.style.position = "fixed";
      btn.style.top = "70px";
      btn.style.right = "24px";
      btn.style.zIndex = "9999";
      btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      document.body.appendChild(btn);
    }
  }

  function tryInsertButton(btn) {
    // Strategy 1: Find the "Raw" button and insert next to it
    const rawBtn = document.querySelector('[data-testid="raw-button"], a[href*="/raw/"], button[aria-label*="raw" i]');
    if (rawBtn) {
      const parent = rawBtn.closest('[class*="actions"], [class*="header"], .d-flex, div') || rawBtn.parentElement;
      if (parent) {
        parent.insertBefore(btn, parent.firstChild);
        return true;
      }
    }

    // Strategy 2: React blob header area (new GitHub UI)
    const selectors = [
      '[class*="react-blob-header"] [class*="actions"]',
      '[class*="react-blob-header"] .d-flex',
      '[class*="BlobToolbar"]',
      '[class*="blob-header"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { el.prepend(btn); return true; }
    }

    // Strategy 3: Find by text content — locate "Raw" or "Copy" button text
    const allButtons = document.querySelectorAll('button, a[role="button"]');
    for (const b of allButtons) {
      const text = (b.textContent || '').trim().toLowerCase();
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      if (text === 'raw' || label.includes('raw') || label.includes('copy raw')) {
        const parent = b.closest('.d-flex, [class*="actions"], [class*="header"]') || b.parentElement;
        if (parent && !parent.querySelector('#mw-github-btn')) {
          parent.insertBefore(btn, parent.firstChild);
          return true;
        }
      }
    }

    // Strategy 4: File info bar (contains filename + size)
    const fileInfo = document.querySelector('[class*="file-info"], [class*="blob-num"], .Box-header');
    if (fileInfo) {
      const container = fileInfo.closest('.Box-header, [class*="header"]') || fileInfo.parentElement;
      if (container) {
        btn.style.float = "right";
        btn.style.marginLeft = "8px";
        container.appendChild(btn);
        return true;
      }
    }

    // Strategy 5: Look for the rendered markdown container and place above it
    const readme = document.querySelector('[data-testid="readme"], article.markdown-body, #readme, .Box-body .markdown-body');
    if (readme) {
      const wrapper = readme.closest('.Box, [class*="react-blob"]') || readme.parentElement;
      if (wrapper) {
        wrapper.style.position = "relative";
        btn.style.position = "absolute";
        btn.style.top = "8px";
        btn.style.right = "8px";
        btn.style.zIndex = "10";
        wrapper.prepend(btn);
        return true;
      }
    }

    return false;
  }

  function resetButton(btn) {
    btn.classList.remove("mw-gh-loading", "mw-gh-done", "mw-gh-error");
    btn.innerHTML = '<svg class="mw-gh-icon" width="14" height="14" viewBox="0 0 182.32 188.54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor"><path d="M112.16,161.09c3.81,8.85-.88,18.9-7.78,23.53-8,5.37-17.59,5.24-25.48-.57-6.69-4.92-10.82-14.51-7.05-23.4,4.02-9.5,2.56-21.01-7.28-26.09l-1.71-.88c-3.81-1.96-7.1-4.74-9.94-7.95-5.12-5.78-13.21-7.68-20.68-4.4-7.39,3.25-14.86,3.57-22.01-.91C4.45,116.81.07,110.03,0,102.14c-.06-7.37,2.57-13.88,8.03-18.09s12.51-6.7,19.22-4.24c6.18,2.26,11.88,2.17,17.36-1.17,5.47-3.34,6.58-8.71,8.7-15.41,2.49-7.87,12.05-14.43,20.22-16.12,8.74-1.8,18.21-6.12,19.42-15.86.87-7,1.48-13.84,7.19-18.45s12.57-6.67,20.01-5.07,13.26,6.29,15.66,12.16c2.89,7.07,2.31,15.51-3.26,20.84-5.97,5.72-9.01,14.82-3.15,21.95,3.45,4.2,5.18,8.98,6.38,14.22,2.67,11.64,14.8,15.19,25.3,13.52,7.92-1.26,15.22,5.05,18.35,10.57,4.09,7.22,3.72,15.41-.37,22.26-7.13,11.92-22.06,12.9-32.34,4.93-7.63-5.92-16.62-1.86-23.6,2.07-11.37,6.4-16.49,18-10.96,30.86Z"/><circle cx="62.57" cy="14.69" r="14.69"/><circle cx="24.47" cy="48" r="13.95"/><circle cx="143.12" cy="161.01" r="13.96"/><circle cx="41.25" cy="159.57" r="13.73"/><circle cx="163.42" cy="61.57" r="12.99"/></svg><span class="mw-gh-label">Open in memory.wiki</span>';
  }

  // Compression (same as content.js)
  async function compressToBase64Url(text) {
    const encoder = new TextEncoder();
    const input = encoder.encode(text);
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(input);
    writer.close();
    const reader = cs.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }
    let binary = "";
    for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // Run on page load and on navigation (GitHub SPA)
  function init() {
    if (isMarkdownPage()) {
      // Try multiple times — GitHub React renders progressively
      setTimeout(createButton, 300);
      setTimeout(createButton, 1000);
      setTimeout(createButton, 2500);
    }
  }

  init();

  // GitHub uses SPA navigation — watch for URL changes
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Remove old button
      const old = document.getElementById("mw-github-btn");
      if (old) old.remove();
      // Check new page
      setTimeout(init, 500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
