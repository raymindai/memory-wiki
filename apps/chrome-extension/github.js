/**
 * Memory.Wiki Chrome Extension — GitHub Integration
 *
 * Detects .md files on GitHub and adds an "Open in Memory.Wiki" button.
 * Fetches raw markdown and opens it in Memory.Wiki for beautiful rendering + editing.
 */

(function () {
  "use strict";

  if (document.documentElement.dataset.mdfyGithub) return;
  document.documentElement.dataset.mdfyGithub = "1";

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
    document.querySelectorAll("#mdfy-github-btn, .mdfy-github-btn").forEach(el => el.remove());
    if (!isMarkdownPage()) return;

    const btn = document.createElement("button");
    btn.id = "mdfy-github-btn";
    btn.className = "mdfy-github-btn";
    btn.innerHTML = '<span class="mdfy-gh-label">Open in Memory.Wiki</span>';
    btn.title = "Open this Markdown file in Memory.Wiki for beautiful rendering and editing";

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.classList.add("mdfy-gh-loading");
      btn.querySelector(".mdfy-gh-label").textContent = "Loading...";

      try {
        const rawUrl = getRawUrl();
        const res = await fetch(rawUrl);
        if (!res.ok) throw new Error("Failed to fetch: " + res.status);
        const markdown = await res.text();

        if (!markdown.trim()) {
          btn.querySelector(".mdfy-gh-label").textContent = "Empty file";
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
              btn.classList.remove("mdfy-gh-loading");
              btn.classList.add("mdfy-gh-done");
              btn.querySelector(".mdfy-gh-label").textContent = "Opened!";
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

        btn.classList.remove("mdfy-gh-loading");
        btn.classList.add("mdfy-gh-done");
        btn.querySelector(".mdfy-gh-label").textContent = "Opened!";
        setTimeout(() => resetButton(btn), 3000);
      } catch (err) {
        console.error("[Memory.Wiki] GitHub integration error:", err);
        btn.classList.remove("mdfy-gh-loading");
        btn.classList.add("mdfy-gh-error");
        btn.querySelector(".mdfy-gh-label").textContent = "Failed";
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
        if (parent && !parent.querySelector('#mdfy-github-btn')) {
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
    btn.classList.remove("mdfy-gh-loading", "mdfy-gh-done", "mdfy-gh-error");
    btn.innerHTML = '<span class="mdfy-gh-label">Open in Memory.Wiki</span>';
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
      const old = document.getElementById("mdfy-github-btn");
      if (old) old.remove();
      // Check new page
      setTimeout(init, 500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
