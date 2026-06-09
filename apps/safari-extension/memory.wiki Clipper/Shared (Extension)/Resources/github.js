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
    btn.innerHTML = '<svg class="mw-gh-icon" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="16" height="16" rx="3.5" ry="3.5" fill="#09090b"/><g fill="#fff"><path d="M13.38,8.01c-.5,0-.9.4-.9.9s.4.9.9.9.9-.4.9-.9-.4-.9-.9-.9Z"/><circle cx="8.2" cy="2.65" r="1.41"/><path d="M3.69,11.39c-.44.17-.56.66-.38,1.02.17.35.58.5.96.35.39-.15.54-.54.38-.97-.13-.34-.54-.57-.96-.41h0Z"/><path d="M12,7.3c.8-.66.78-1.8.15-2.51-.62-.7-1.75-.8-2.48-.1-.69.66-1.79.92-2.61.25-.41-.33-.83-.62-1.41-.45-.45.13-.83.49-1,1.01-.14.42-.62.57-1.04.58-.67,0-1.25.44-1.55.91-.39.61-.44,1.29-.18,1.92.35.84,1.17,1.35,2.09,1.21.6-.09,1.23.05,1.6.61.25.39.35.95.21,1.37-.22.66-.23,1.36.21,1.91.51.64,1.3.9,2.1.68.71-.19,1.14-.8,1.36-1.54.16-.53.82-.73,1.31-.76.61-.03,1.05-.53,1.2-1,.22-.64-.09-1.14-.46-1.59-.68-.82-.24-1.9.49-2.5h.01ZM9.8,9.84c-.33.21-.65-.27-1.22-.48-.18.57.15,1.1-.15,1.29-.15.09-.38.1-.5,0-.31-.23.07-.74-.14-1.3-.62.22-.98.84-1.31.37-.14-.2-.1-.47.15-.58.31-.13.54-.24.87-.44l-.92-.55c-.15-.09-.17-.31-.1-.44.08-.17.32-.28.49-.16l.84.56c.18-.5-.11-1.05.12-1.26.1-.09.33-.1.49-.04.32.13.03.75.16,1.29l.8-.53c.17-.11.4-.05.51.11.12.17.11.42-.11.52-.3.14-.55.28-.86.5.44.37,1.05.4,1.09.75.01.14-.09.33-.2.4h-.01Z"/></g></svg><span class="mw-gh-label">Open in memory.wiki</span>';
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
    btn.innerHTML = '<svg class="mw-gh-icon" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="16" height="16" rx="3.5" ry="3.5" fill="#09090b"/><g fill="#fff"><path d="M13.38,8.01c-.5,0-.9.4-.9.9s.4.9.9.9.9-.4.9-.9-.4-.9-.9-.9Z"/><circle cx="8.2" cy="2.65" r="1.41"/><path d="M3.69,11.39c-.44.17-.56.66-.38,1.02.17.35.58.5.96.35.39-.15.54-.54.38-.97-.13-.34-.54-.57-.96-.41h0Z"/><path d="M12,7.3c.8-.66.78-1.8.15-2.51-.62-.7-1.75-.8-2.48-.1-.69.66-1.79.92-2.61.25-.41-.33-.83-.62-1.41-.45-.45.13-.83.49-1,1.01-.14.42-.62.57-1.04.58-.67,0-1.25.44-1.55.91-.39.61-.44,1.29-.18,1.92.35.84,1.17,1.35,2.09,1.21.6-.09,1.23.05,1.6.61.25.39.35.95.21,1.37-.22.66-.23,1.36.21,1.91.51.64,1.3.9,2.1.68.71-.19,1.14-.8,1.36-1.54.16-.53.82-.73,1.31-.76.61-.03,1.05-.53,1.2-1,.22-.64-.09-1.14-.46-1.59-.68-.82-.24-1.9.49-2.5h.01ZM9.8,9.84c-.33.21-.65-.27-1.22-.48-.18.57.15,1.1-.15,1.29-.15.09-.38.1-.5,0-.31-.23.07-.74-.14-1.3-.62.22-.98.84-1.31.37-.14-.2-.1-.47.15-.58.31-.13.54-.24.87-.44l-.92-.55c-.15-.09-.17-.31-.1-.44.08-.17.32-.28.49-.16l.84.56c.18-.5-.11-1.05.12-1.26.1-.09.33-.1.49-.04.32.13.03.75.16,1.29l.8-.53c.17-.11.4-.05.51.11.12.17.11.42-.11.52-.3.14-.55.28-.86.5.44.37,1.05.4,1.09.75.01.14-.09.33-.2.4h-.01Z"/></g></svg><span class="mw-gh-label">Open in memory.wiki</span>';
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
