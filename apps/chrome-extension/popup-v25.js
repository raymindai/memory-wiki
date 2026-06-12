// popup-v25.html companion: headline rotation + free-form AI submit wiring.
// Inline scripts are blocked by Manifest V3 CSP, so this lives in its own file.

// ─── Debug: popup auto-fit diagnostic (Cmd+Shift+D inside popup) ──
// Press Cmd+Shift+D (Mac) or Ctrl+Shift+D (Win) to log current
// document / body / window dimensions. Helps identify what's making
// chrome allocate a popup viewport larger than visible content.
(function () {
  document.addEventListener("keydown", (e) => {
    const cmdOrCtrl = e.metaKey || e.ctrlKey;
    if (!cmdOrCtrl || !e.shiftKey || e.key.toLowerCase() !== "d") return;
    e.preventDefault();
    const b = document.body;
    const h = document.documentElement;
    const data = {
      "body.scrollHeight":    b.scrollHeight,
      "body.offsetHeight":    b.offsetHeight,
      "body.clientHeight":    b.clientHeight,
      "html.scrollHeight":    h.scrollHeight,
      "html.offsetHeight":    h.offsetHeight,
      "window.innerHeight":   window.innerHeight,
      "window.outerHeight":   window.outerHeight,
      tallestChild: (() => {
        let maxH = 0, maxEl = null;
        for (const el of b.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.bottom > maxH) { maxH = r.bottom; maxEl = el; }
        }
        return maxEl ? `${maxEl.tagName}.${(maxEl.className||"").toString().slice(0,40)} bottom=${maxH}` : "none";
      })(),
      // EVERY element whose bottom edge sits past body.scrollHeight
      // — the one(s) inflating html.scrollHeight past body.
      overflowingElements: (() => {
        const bsh = b.scrollHeight;
        const out = [];
        for (const el of document.documentElement.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.bottom > bsh + 1) {
            const cs = window.getComputedStyle(el);
            out.push(`${el.tagName}.${(el.className||"").toString().slice(0,30)} ` +
              `bottom=${Math.round(r.bottom)} pos=${cs.position} ` +
              `display=${cs.display} parent=${el.parentElement?.tagName || "?"}`);
          }
        }
        return out.length ? out : ["(none)"];
      })(),
    };
    console.table(data);
    alert(JSON.stringify(data, null, 2));
  });
})();

(function () {
  const HEADLINES = [
    ["Hold this",   "thought."],
    ["Pin it to",   "memory."],
    ["Save this",   "for later."],
    ["Tuck this",   "away."],
    ["Don't lose",  "this one."],
    ["Keep this",   "handy."],
    ["Make it",     "yours."],
    ["Catch it",    "in time."],
    ["Worth",       "remembering."],
    ["A thought,",  "preserved."],
  ];
  const p = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
  const l1 = document.getElementById("hero-l1");
  const l2 = document.getElementById("hero-l2");
  if (l1) l1.textContent = p[0];
  if (l2) l2.textContent = p[1];
})();

(function () {
  const ta  = document.getElementById("ask-input");
  const sub = document.getElementById("ask-submit");
  if (!ta || !sub) return;
  ta.addEventListener("input", () => { sub.disabled = !ta.value.trim(); });
  sub.addEventListener("click", () => {
    // Gate on Capture being usable — on memory.wiki / chrome:// tabs
    // the btn-capture is disabled, intent path must respect that.
    const btn = document.getElementById("btn-capture");
    if (!btn || btn.disabled || sub.disabled) return;
    const v = ta.value.trim();
    if (!v) return;
    window.__captureIntent = v;
    window.__intentCaptureActive = true;
    document.body.classList.add("intent-active");
    document.body.classList.add("capturing");
    btn.click();
    setTimeout(() => document.body.classList.remove("intent-active"), 60000);
  });
})();

// Detect the active tab and surface a "ChatGPT / Claude / Gemini /
// GitHub markdown" line between the hero and the Capture button.
(function () {
  const ctx = document.getElementById("page-context");
  if (!ctx) return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = (tab && tab.url) || "";
    let name = null;
    if (/chatgpt\.com|chat\.openai\.com/.test(url))   name = "ChatGPT";
    else if (/claude\.ai/.test(url))                  name = "Claude";
    else if (/gemini\.google\.com/.test(url))         name = "Gemini";
    else if (/perplexity\.ai/.test(url))              name = "Perplexity";
    else if (/grok\.x\.ai|x\.com\/i\/grok/.test(url)) name = "Grok";
    else if (/github\.com\/.*\/blob\/.*\.(md|markdown|mdx)$/i.test(url)) name = "GitHub markdown";
    if (!name) return;
    ctx.innerHTML =
      '<span class="dot"></span>' +
      '<span>Capturing from <span class="src">' + name + '</span></span>';
    ctx.classList.add("visible");
  });
})();

// popup.js sets the CTA title in lowercase ("capture this page",
// "capture full conversation", "capture selection"). Brand voice for
// the popup wants those starting with a capital "C". Observe text
// changes on #btn-capture-title and re-capitalize the first letter.
(function () {
  const titleEl = document.getElementById("btn-capture-title");
  if (!titleEl) return;
  function capitalize() {
    if (titleEl.dataset.locked === "1") {
      // Locked label (e.g. "Cannot capture this page" on chrome:// tabs).
      if (titleEl.textContent !== "Cannot capture this page") {
        titleEl.textContent = "Cannot capture this page";
      }
      return;
    }
    const t = titleEl.textContent || "";
    if (!t) return;
    const fixed = t.charAt(0).toUpperCase() + t.slice(1);
    if (t !== fixed) titleEl.textContent = fixed;
  }
  capitalize();
  new MutationObserver(capitalize).observe(titleEl, {
    childList: true, characterData: true, subtree: true,
  });
})();

// Range dropdown — when popup.js's paintRangesVisible flips the
// #range-selector style (display:flex on AI pages), reveal the inline
// "All ▾" scope chip inside the CTA and wire it as a popover trigger.
(function () {
  const cta = document.getElementById("btn-capture");
  const trigger = document.getElementById("range-trigger");
  const triggerLabel = document.getElementById("range-trigger-label");
  const pop = document.getElementById("range-selector");
  if (!cta || !trigger || !pop) return;

  // Move popover to body root so its position:fixed and z-index work
  // free of any ancestor stacking context (otherwise it gets stuck
  // behind sibling cards like the AI textarea).
  if (pop.parentElement !== document.body) document.body.appendChild(pop);

  // Track "AI page active" via popup.js's inline style change. Once
  // popup.js sets display!=none (paintRangesVisible(true)), we keep
  // the trigger chip visible forever, regardless of later .open class
  // toggles. We DON'T watch class — the user clicking the chip flips
  // .open and we don't want that to hide the chip.
  let aiActive = false;
  function syncScope() {
    const wantsVisible = pop.style.display && pop.style.display !== "none";
    if (wantsVisible) {
      aiActive = true;
      pop.style.display = "";    // wipe so .open governs visibility
    }
    cta.classList.toggle("has-scope", aiActive);
    trigger.style.display = aiActive ? "inline-flex" : "none";
  }
  syncScope();
  new MutationObserver(syncScope).observe(pop, {
    attributes: true, attributeFilter: ["style"],
  });

  // Click on the scope chip toggles the popover, stops the click from
  // also triggering the parent CTA capture. Position the popover with
  // fixed coords aligned to the chip's bounding rect so body's
  // overflow:hidden + parent stacking contexts can't clip or hide it.
  function positionPop() {
    const r = trigger.getBoundingClientRect();
    pop.style.top  = (r.bottom + 4) + "px";
    pop.style.left = (r.right - pop.offsetWidth) + "px";  // align right edges
  }
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const willOpen = !pop.classList.contains("open");
    pop.classList.toggle("open");
    if (willOpen) requestAnimationFrame(positionPop);
  });

  // Clicking a .range-opt updates the chip label, syncs the hidden
  // radio popup.js reads, dispatches change, and closes the popover.
  function labelFor(value) { return value === "0" ? "All" : value; }
  pop.querySelectorAll(".range-opt").forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = opt.dataset.value;
      // Visual state
      pop.querySelectorAll(".range-opt").forEach((o) => o.classList.toggle("is-checked", o === opt));
      triggerLabel.textContent = labelFor(value);
      // Hard-reset hidden radio state so popup.js's getRangeValue()
      // returns exactly the value the user picked. (The radios live
      // outside a <form>, so the browser's auto-uncheck-others
      // behavior isn't guaranteed when checked is set via JS.)
      document.querySelectorAll('input[name="range"]').forEach((r) => {
        r.checked = (r.value === value);
      });
      const radio = document.querySelector('input[name="range"][value="' + value + '"]');
      if (radio) radio.dispatchEvent(new Event("change", { bubbles: true }));
      pop.classList.remove("open");
    });
  });

  // Click outside closes the popover.
  document.addEventListener("click", (e) => {
    if (!pop.classList.contains("open")) return;
    if (pop.contains(e.target) || trigger.contains(e.target)) return;
    pop.classList.remove("open");
  });
})();

// Mirror popup.js's setStatus into the visible CTA so the user sees
// "Capturing...", "publishing...", "success", etc. live in the button
// while the action runs. The hidden #status element holds the source
// text; we copy it onto #btn-capture-title and restore the original
// label when status clears (~3s after the action completes).
(function () {
  const statusEl  = document.getElementById("status");
  const titleEl   = document.getElementById("btn-capture-title");
  if (!statusEl || !titleEl) return;
  let savedLabel = null;
  let clearTimer = null;

  // Track which button started the current capture so status shows
  // on the right surface. ask-submit click sets sourceIsIntent=true.
  function getSourceEl() {
    if (window.__intentCaptureActive) return document.getElementById("ask-submit");
    return titleEl;
  }
  let savedSubLabel = null;

  function applyStatus() {
    if (titleEl.dataset.locked === "1") return;   // chrome:// tab
    const txt = (statusEl.textContent || "").trim();
    const targetEl = getSourceEl();
    if (!txt) {
      if (savedLabel != null) { titleEl.textContent = savedLabel; savedLabel = null; }
      if (savedSubLabel != null) { const s = document.getElementById("ask-submit"); if (s) s.textContent = savedSubLabel; savedSubLabel = null; }
      return;
    }
    const isError = /fail|error|cannot|expired|too large|no content|no conversation|no text/i.test(txt);
    const pretty = isError ? "Couldn't capture"
                 : (txt.charAt(0).toUpperCase() + txt.slice(1)).slice(0, 28);

    if (targetEl && targetEl.id === "ask-submit") {
      if (savedSubLabel == null) savedSubLabel = targetEl.textContent;
      // Show full stage text on the intent submit button so the user
      // can see AI cascade progress ("thinking with AI…", etc.).
      // Strip trailing ellipsis to fit the narrow pill cleanly.
      const subPretty = isError ? "failed" : pretty.replace(/[…\.]+$/, "");
      targetEl.textContent = subPretty || "working";
    } else {
      if (savedLabel == null) savedLabel = titleEl.textContent;
      titleEl.textContent = pretty;
    }

    if (clearTimer) clearTimeout(clearTimer);
    if (isError || /success|published|opened|copied/i.test(txt)) {
      // Wait briefly so the user can see the error/success message,
      // then wipe ALL transient state. On error this also unlocks the
      // popup (removes `capturing` which dims controls) and clears the
      // one-shot intent flag so the next capture isn't accidentally
      // routed through /transform.
      clearTimer = setTimeout(() => {
        if (savedLabel != null) { titleEl.textContent = savedLabel; savedLabel = null; }
        const s = document.getElementById("ask-submit");
        if (savedSubLabel != null && s) { s.textContent = savedSubLabel; savedSubLabel = null; }
        statusEl.textContent = "";
        window.__intentCaptureActive = false;
        if (isError) {
          // Success path already runs markFresh() which wipes these,
          // but error paths need their own cleanup or the popup stays
          // dimmed until the 60s safety timeout.
          document.body.classList.remove("capturing");
          document.body.classList.remove("intent-active");
          window.__captureIntent = null;
          window.__lastPageType = null;
        }
      }, 2200);
    }
  }
  new MutationObserver(applyStatus).observe(statusEl, {
    childList: true, characterData: true, subtree: true,
  });

  // popup.js's showResult() paints the result card but doesn't touch
  // #status — so on auth failure / "too large" / generic publish-error
  // paths, the status mirror's cleanup never fires and `body.capturing`
  // sticks for the full 60s safety timeout. Mirror result-card
  // transitions into #status so the existing cleanup runs.
  const resultEl = document.getElementById("result");
  if (resultEl) {
    new MutationObserver(() => {
      if (!resultEl.classList.contains("visible")) return;
      const isErr = resultEl.classList.contains("error");
      const cur = (statusEl.textContent || "").trim();
      const next = isErr ? "publish failed" : "published";
      if (cur !== next) statusEl.textContent = next;
    }).observe(resultEl, { attributes: true, attributeFilter: ["class"] });
  }
})();

// When popup.js's renderRecent updates #recent-list, mark the FIRST
// child as .is-fresh so the entry animation fires once. We re-mark on
// every list mutation (popup.js re-renders the whole list after each
// new capture), then strip the class after the animation length so it
// doesn't replay on hover.
(function () {
  const list = document.getElementById("recent-list");
  if (!list) return;
  function markFresh() {
    const first = list.firstElementChild;
    if (!first || !first.classList.contains("recent-item")) return;
    if (first.dataset.markedFresh) return;        // already animated
    first.dataset.markedFresh = "1";
    first.classList.add("is-fresh");
    // A new Recent item = capture succeeded. popup.js's success path
    // (showResult) doesn't clear #status, so "Capturing..." gets stuck
    // on the CTA. Wipe status here to trigger the restore.
    const status = document.getElementById("status");
    if (status && status.textContent) status.textContent = "";
    window.__intentCaptureActive = false;
    document.body.classList.remove("intent-active");
    document.body.classList.remove("capturing");
    document.body.classList.add("just-captured");
    setTimeout(() => {
      first.classList.remove("is-fresh");
      document.body.classList.remove("just-captured");
    }, 1900);
  }

  // For any Recent row whose underlying mw-recent entry carries an
  // `intent`, inject a small "reuse" pill that re-populates the intent
  // textarea on click. The row's primary click still opens the doc;
  // the reuse button intercepts via stopPropagation so the two
  // affordances don't fight.
  async function attachIntentReuse() {
    let entries = [];
    try {
      entries = await new Promise((r) =>
        chrome.storage.local.get(["mw-recent"], (d) => r(Array.isArray(d["mw-recent"]) ? d["mw-recent"] : []))
      );
    } catch { return; }
    const byUrl = new Map(entries.map((e) => [e.url, e]));
    list.querySelectorAll(".recent-item").forEach((row) => {
      if (row.dataset.mwReuseAttached) return;
      const url = row.getAttribute("data-url") || row.getAttribute("href");
      const entry = url && byUrl.get(url);
      if (!entry || !entry.intent) return;
      row.dataset.mwReuseAttached = "1";

      const reuse = document.createElement("button");
      reuse.type = "button";
      reuse.className = "recent-reuse";
      reuse.title = `Reuse prompt: ${entry.intent}`;
      reuse.setAttribute("aria-label", "Reuse this prompt");
      reuse.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>';
      reuse.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const ta = document.getElementById("ask-input");
        if (!ta) return;
        ta.value = entry.intent;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
        try { ta.setSelectionRange(entry.intent.length, entry.intent.length); } catch {}
        ta.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      // Place before the open-arrow.
      const arrow = row.querySelector(".open-arrow");
      if (arrow) row.insertBefore(reuse, arrow);
      else row.appendChild(reuse);
    });
  }

  // Inject the styles once (placed near body so any re-render keeps them).
  (function injectReuseStyle() {
    if (document.getElementById("mw-reuse-style")) return;
    const s = document.createElement("style");
    s.id = "mw-reuse-style";
    s.textContent = `
      .recent-item .recent-reuse{
        display:inline-flex;align-items:center;justify-content:center;
        width:18px;height:18px;padding:0;margin:0 6px 0 0;
        border:0;background:transparent;color:var(--faint,#a1a1aa);
        cursor:pointer;border-radius:5px;flex-shrink:0;
        transition:color 120ms, background 120ms;
      }
      .recent-item .recent-reuse:hover{color:var(--ink,#fafafa);background:rgba(255,255,255,0.06)}
      .recent-item .recent-reuse svg{display:block}
    `;
    document.head.appendChild(s);
  })();

  new MutationObserver(() => { markFresh(); attachIntentReuse(); }).observe(list, { childList: true });
  // Run once on initial render too.
  attachIntentReuse();
})();

// Block capture on protected URLs (chrome://, chrome-extension://, etc.)
// where chrome.scripting.executeScript will reject. Without this guard
// popup.js's ensureContentScript surfaces a warning into the extension's
// Errors panel every time the user clicks Capture on a chrome:// tab.
(function () {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = (tab && tab.url) || "";
    if (!/^(chrome|chrome-extension|edge|about|view-source|file):/.test(url)) return;

    const btn = document.getElementById("btn-capture");
    const sel = document.getElementById("btn-selection");
    const titleEl = document.getElementById("btn-capture-title");
    const ta  = document.getElementById("ask-input");
    const sub = document.getElementById("ask-submit");

    if (btn) btn.disabled = true;
    if (sel) sel.disabled = true;
    if (ta)  ta.disabled  = true;
    if (sub) sub.disabled = true;
    if (titleEl) {
      titleEl.textContent = "Cannot capture this page";
      // Stop popup.js from re-overwriting it.
      titleEl.dataset.locked = "1";
    }
  });
})();

// ─── Intent prompt chips + cycling placeholder + favorites/recent ─────
//
// Renders 6-8 selectable prompt presets below the AI textarea. Click
// a chip → populates textarea + focuses. Curated defaults sit at the
// bottom; the user's most-clicked + starred prompts get hoisted to
// the top. Star icon on hover lets the user pin / unpin.
//
// Cycling placeholder: a span overlays the textarea (CSS), fading
// through example prompts every 3.5s. Stops on focus + when textarea
// has content.
(function () {
  const CURATED = [
    "Extract code blocks only",
    "Action items as checklist",
    "TL;DR in 2 sentences",
    "Key facts as a table",
    "Q&A flashcards",
    "Cursor-ready reference",
    "Steelman the opposing view",
    "Plain English, 8th grade",
  ];

  // Per-site intent suggestions. Match on hostname (longest match wins
  // so subdomains like `mobile.twitter.com` fall back to the bare
  // `twitter.com` entry). The values are intents the user is most
  // likely to want on THAT kind of page — picked to match how people
  // actually use those sites (skim YouTube transcripts, pull arXiv
  // abstracts, distill HN threads, etc.). When the user lands on a
  // matching site these surface at the FRONT of the chip rail so
  // they're the first thing the user sees, before the generic
  // CURATED defaults.
  //
  // Adding a new site: drop in a hostname → string[] entry. Keep each
  // intent short enough to read in a chip (≤ ~32 chars feels right).
  const SITE_SUGGESTIONS = {
    "youtube.com": [
      "Summarize from transcript",
      "Key moments + timestamps",
      "Action items only",
    ],
    "arxiv.org": [
      "Abstract + contributions",
      "Methodology in plain English",
      "What makes this novel",
    ],
    "github.com": [
      "README in 5 bullets",
      "Setup steps only",
      "API usage examples",
    ],
    "stackoverflow.com": [
      "Accepted answer + code",
      "Why this approach works",
    ],
    "reddit.com": [
      "Top comments distilled",
      "Consensus + dissent",
      "Best advice from thread",
    ],
    "news.ycombinator.com": [
      "Top arguments distilled",
      "Strongest counterpoints",
      "What experts in the thread say",
    ],
    "medium.com": [
      "Main argument + evidence",
      "Pull quotes worth keeping",
      "TL;DR in 3 sentences",
    ],
    "substack.com": [
      "Main thesis + supporting points",
      "Quotable lines",
      "Action items only",
    ],
    "x.com": [
      "This thread distilled",
      "Strongest argument only",
      "Action items only",
    ],
    "twitter.com": [
      "This thread distilled",
      "Strongest argument only",
      "Action items only",
    ],
    "threads.com": [
      "Post + replies summary",
      "Key arguments only",
    ],
    "threads.net": [
      "Post + replies summary",
      "Key arguments only",
    ],
    "linkedin.com": [
      "Profile highlights",
      "Career trajectory",
      "Key skills + impact",
    ],
    "nytimes.com": [
      "Article in 3 bullets",
      "Quotes from sources",
      "What's actually new here",
    ],
    "bbc.com": [
      "Article in 3 bullets",
      "Quotes from sources",
    ],
    "theverge.com": [
      "Article in 3 bullets",
      "What's actually new here",
    ],
    "wired.com": [
      "Article in 3 bullets",
      "What's actually new here",
    ],
    "wikipedia.org": [
      "Overview + key dates",
      "Most-cited sources",
      "Plain English, 8th grade",
    ],
    "notion.so": [
      "Action items as checklist",
      "Key decisions + owners",
    ],
    "docs.google.com": [
      "Action items as checklist",
      "Key decisions + owners",
    ],
    "openai.com": [
      "Strip UI, keep my conversation",
      "Just the model's final answer",
    ],
    "chatgpt.com": [
      "Strip UI, keep my conversation",
      "Just the model's final answer",
    ],
    "claude.ai": [
      "Strip UI, keep my conversation",
      "Just the model's final answer",
    ],
    "gemini.google.com": [
      "Strip UI, keep my conversation",
      "Just the model's final answer",
    ],
    "perplexity.ai": [
      "Answer + cited sources only",
    ],
    "amazon.com": [
      "Product specs + key reviews",
      "Pros and cons",
    ],
    "yelp.com": [
      "Top dishes + must-knows",
    ],
    "imdb.com": [
      "Plot in 2 sentences (no spoilers)",
      "Top reviews distilled",
    ],
  };

  // Resolve the current tab's hostname to a SITE_SUGGESTIONS key.
  // Strips leading `www.`/`m.`/`mobile.` and falls back through
  // subdomain layers (so `mobile.twitter.com` → `twitter.com`).
  function pickSiteKey(hostname) {
    if (!hostname) return null;
    const h = hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, "");
    if (SITE_SUGGESTIONS[h]) return h;
    // Try progressively shorter parent domains: a.b.c.com → b.c.com → c.com
    const parts = h.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (SITE_SUGGESTIONS[parent]) return parent;
    }
    return null;
  }

  // Returns Promise<{ key: string | null, intents: string[] }>.
  // Resolves to empty intents when there's no current tab access
  // (popup opened in a context where chrome.tabs is unavailable) or
  // no match — render() then falls back to favorites + curated.
  function getSiteSuggestions() {
    return new Promise((resolve) => {
      try {
        if (!chrome?.tabs?.query) return resolve({ key: null, intents: [] });
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          const url = tab?.url || "";
          let host = "";
          try { host = new URL(url).hostname; } catch { /* not a real URL — chrome://, about:, etc. */ }
          const key = pickSiteKey(host);
          resolve({ key, intents: key ? SITE_SUGGESTIONS[key].slice() : [] });
        });
      } catch { resolve({ key: null, intents: [] }); }
    });
  }

  const STORAGE_KEY = "mw-intent-prefs";   // { recents: [{text, count, lastUsed, favorite}] }

  function loadPrefs() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (data) => {
        const v = data[STORAGE_KEY] || { recents: [] };
        if (!Array.isArray(v.recents)) v.recents = [];
        // Dedupe defensively on load: bumpIntent / toggleFavorite use
        // .find(by text) so they can't produce dupes on the happy
        // path, but corrupted state (interrupted writes, manual edits
        // to chrome.storage, future refactors) could. Keep the FIRST
        // entry per text — that's the favorited-or-most-recent one
        // once you pair this with the dedupe done in render().
        const seen = new Set();
        v.recents = v.recents.filter((r) => {
          if (!r || typeof r.text !== "string") return false;
          const t = r.text.trim();
          if (!t || seen.has(t)) return false;
          seen.add(t);
          return true;
        });
        resolve(v);
      });
    });
  }
  function savePrefs(prefs) {
    chrome.storage.local.set({ [STORAGE_KEY]: prefs });
  }
  function bumpIntent(prefs, text) {
    text = (text || "").trim();
    if (!text) return prefs;
    const existing = prefs.recents.find((r) => r.text === text);
    if (existing) { existing.count++; existing.lastUsed = Date.now(); }
    else { prefs.recents.push({ text, count: 1, lastUsed: Date.now(), favorite: false }); }
    // Cap to 30 most recent (favorites always kept regardless)
    const favs = prefs.recents.filter((r) => r.favorite);
    const others = prefs.recents.filter((r) => !r.favorite)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, 30);
    prefs.recents = [...favs, ...others];
    return prefs;
  }
  function toggleFavorite(prefs, text) {
    let r = prefs.recents.find((x) => x.text === text);
    if (!r) {
      r = { text, count: 0, lastUsed: Date.now(), favorite: true };
      prefs.recents.push(r);
    } else {
      r.favorite = !r.favorite;
    }
    return prefs;
  }

  const STAR_SVG = '<svg viewBox="0 0 16 16"><path d="M8 1l2.2 4.5 5 .7-3.6 3.5.9 4.9L8 12.3 3.5 14.6l.9-4.9L.8 6.2l5-.7L8 1z"/></svg>';
  const X_SVG    = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4 4 8 8M12 4 4 12"/></svg>';
  // Lucide-style sparkles glyph — universally read as "AI / smart" by
  // users who have spent any time around Notion, Linear, Slack, etc.
  // Single main spark + two corner accents. Stroked, not filled, so
  // it inherits chip text color cleanly via currentColor.
  const SPARKLE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>';

  function makeChip({ text, favorite, isCurated, siteKey }) {
    const el = document.createElement("div");
    el.className = "intent-chip"
      + (favorite ? " is-favorite" : "")
      + (siteKey ? " is-site" : "");
    // Tooltip hints WHY this chip showed up — for site suggestions
    // we surface the host so it's clear it's contextual to the
    // current tab, not a generic preset.
    el.title = siteKey ? `${text}  ·  suggested for ${siteKey}` : text;
    el.dataset.text = text;
    if (siteKey) el.dataset.site = siteKey;

    // Text container (clipped, marquee on hover when overflowing).
    // Site-suggestion chips get an AI sparkle prefix INSIDE the wrap
    // so the icon scrolls with marquee text rather than sitting in a
    // separate fixed slot.
    const labelWrap = document.createElement("span");
    labelWrap.className = "chip-label-wrap";
    if (siteKey) {
      const icon = document.createElement("span");
      icon.className = "chip-site-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = SPARKLE_SVG;
      labelWrap.appendChild(icon);
    }
    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = text;
    labelWrap.appendChild(label);
    el.appendChild(labelWrap);

    // Right-side actions: favorite + delete
    const actions = document.createElement("span");
    actions.className = "chip-actions";

    const fav = document.createElement("span");
    fav.className = "chip-btn fav";
    fav.title = favorite ? "Unpin" : "Pin to favorites";
    fav.innerHTML = STAR_SVG;
    fav.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      const prefs = await loadPrefs();
      toggleFavorite(prefs, text);
      savePrefs(prefs);
      render();
    });
    actions.appendChild(fav);

    const del = document.createElement("span");
    del.className = "chip-btn del";
    del.title = siteKey
      ? "Don't suggest this on this site"
      : isCurated ? "Hide this preset" : "Remove from history";
    del.innerHTML = X_SVG;
    del.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      const prefs = await loadPrefs();
      // Remove from recents/favorites
      prefs.recents = prefs.recents.filter((r) => r.text !== text);
      // Curated default OR site suggestion: add to dismissed so it
      // doesn't bubble back on the next render. Without this, clicking
      // the X on a site chip did NOTHING — site chips aren't stored in
      // recents (they come from the static SITE_SUGGESTIONS table), so
      // the recents filter above was a no-op and render() kept
      // re-adding the chip. dismissed is global (not per-site) by
      // design: if the user disliked the prompt text once, surfacing it
      // again on a different site would feel just as wrong.
      if (isCurated || siteKey) {
        prefs.dismissed = prefs.dismissed || [];
        if (!prefs.dismissed.includes(text)) prefs.dismissed.push(text);
      }
      savePrefs(prefs);
      el.style.transition = "opacity 140ms, transform 140ms";
      el.style.opacity = "0";
      el.style.transform = "scale(0.85)";
      setTimeout(render, 160);
    });
    actions.appendChild(del);
    el.appendChild(actions);

    // Click chip body → populate textarea
    el.addEventListener("click", (e) => {
      if (e.target.closest(".chip-btn")) return;   // ignore clicks on buttons
      const ta = document.getElementById("ask-input");
      const captureBtn = document.getElementById("btn-capture");
      if (!ta || (captureBtn && captureBtn.disabled)) return;
      ta.value = text;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.focus();
      try { ta.setSelectionRange(text.length, text.length); } catch {}
    });

    // Marquee on hover when text overflows the clipped wrap
    function startMarquee() {
      const overflow = label.scrollWidth - labelWrap.clientWidth;
      if (overflow <= 4) return;
      el.style.setProperty("--marquee-shift", `-${overflow + 6}px`);
      el.classList.add("marqueeing");
    }
    function stopMarquee() {
      el.classList.remove("marqueeing");
      el.style.setProperty("--marquee-shift", `0px`);
    }
    el.addEventListener("mouseenter", () => setTimeout(startMarquee, 250));
    el.addEventListener("mouseleave", stopMarquee);

    return el;
  }

  function syncScrollEdges() {
    const rail = document.getElementById("intent-chips-rail");
    const wrap = document.getElementById("intent-chips");
    if (!rail || !wrap) return;
    const max = wrap.scrollWidth - wrap.clientWidth;
    const x = wrap.scrollLeft;
    rail.classList.toggle("can-scroll-left", x > 2);
    rail.classList.toggle("can-scroll-right", x < max - 2);
  }

  async function render() {
    const wrap = document.getElementById("intent-chips");
    if (!wrap) return;
    const [prefs, site] = await Promise.all([loadPrefs(), getSiteSuggestions()]);
    wrap.innerHTML = "";

    // Order:
    //   1. starred favorites         (user-pinned, highest signal)
    //   2. per-site suggestions      (contextual: "on this page you
    //                                 probably want…") — surfaces
    //                                 BEFORE recents/curated so the
    //                                 site-specific intent is the
    //                                 first thing the user sees.
    //   3. top 3 most-used recents
    //   4. curated defaults to fill
    // Skip anything the user has dismissed.
    const dismissed = new Set(prefs.dismissed || []);
    const favs = prefs.recents
      .filter((r) => r.favorite && !dismissed.has(r.text))
      .sort((a, b) => b.lastUsed - a.lastUsed);
    const favTexts = new Set(favs.map((f) => f.text));
    // Site suggestions: filter out anything the user has already
    // starred (no duplicate chips) or dismissed.
    const siteChips = (site.intents || [])
      .filter((t) => !favTexts.has(t) && !dismissed.has(t));
    const siteSet = new Set(siteChips);
    const nonFav = prefs.recents
      .filter((r) => !r.favorite && !dismissed.has(r.text) && !siteSet.has(r.text))
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
    const recentsTop = nonFav.slice(0, 3);
    const usedTexts = new Set([...favs.map((f) => f.text), ...siteChips, ...recentsTop.map((r) => r.text)]);
    const curatedToShow = CURATED.filter((t) => !usedTexts.has(t) && !dismissed.has(t));

    const all = [
      ...favs.map((r) => ({ text: r.text, favorite: true, isCurated: false, siteKey: null })),
      ...siteChips.map((t) => ({ text: t, favorite: false, isCurated: false, siteKey: site.key })),
      ...recentsTop.map((r) => ({ text: r.text, favorite: false, isCurated: false, siteKey: null })),
      ...curatedToShow.map((t) => ({ text: t, favorite: false, isCurated: true, siteKey: null })),
    ];

    // Final-stage dedupe — the earlier filters use exact text match,
    // but visually-identical chips (different casing, extra/trailing
    // whitespace, smart quotes vs straight quotes) would still slip
    // through and produce a duplicate-looking rail. Normalize each
    // text (trim + lowercase + collapse whitespace + unify quote
    // characters) and keep the FIRST occurrence — which preserves the
    // priority order: favorites → site → recents → curated.
    const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    const seenNorm = new Set();
    const deduped = [];
    for (const item of all) {
      const key = norm(item.text);
      if (!key || seenNorm.has(key)) continue;
      seenNorm.add(key);
      deduped.push(item);
    }

    for (const item of deduped) wrap.appendChild(makeChip(item));
    // Sync edge fade indicators after render.
    requestAnimationFrame(syncScrollEdges);
  }

  // Re-evaluate scroll edges on user scroll + on window resize.
  (function attachScrollSync() {
    const wrap = document.getElementById("intent-chips");
    if (!wrap) return;
    wrap.addEventListener("scroll", syncScrollEdges, { passive: true });
    window.addEventListener("resize", syncScrollEdges);
  })();

  // Chevron scroll buttons — one chip-width per click, with wrap-
  // around at the ends: clicking right when already at the rightmost
  // position snaps the rail back to the start (and the inverse on
  // left). Without this the chevron was a dead click once you hit
  // either edge, which surprised users who'd kept clicking expecting
  // the carousel to loop.
  (function attachChevrons() {
    const wrap = document.getElementById("intent-chips");
    const L = document.getElementById("chip-nav-left");
    const R = document.getElementById("chip-nav-right");
    if (!wrap || !L || !R) return;
    const STEP = 170; // ≈ one chip width + gap
    const EDGE = 2;   // tolerance for fractional scroll positions
    L.addEventListener("click", () => {
      const atStart = wrap.scrollLeft <= EDGE;
      if (atStart) {
        // Already at the left edge → jump to the far right.
        wrap.scrollTo({ left: wrap.scrollWidth - wrap.clientWidth, behavior: "smooth" });
      } else {
        wrap.scrollBy({ left: -STEP, behavior: "smooth" });
      }
    });
    R.addEventListener("click", () => {
      const max = wrap.scrollWidth - wrap.clientWidth;
      const atEnd = wrap.scrollLeft >= max - EDGE;
      if (atEnd) {
        // Already at the right edge → snap back to the start.
        wrap.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        wrap.scrollBy({ left: STEP, behavior: "smooth" });
      }
    });
  })();

  // Drag-to-scroll on the chip rail. Click events on chips are
  // suppressed if the pointer actually moved (so dragging across a
  // chip doesn't accidentally pick it).
  (function attachDragScroll() {
    const wrap = document.getElementById("intent-chips");
    if (!wrap) return;
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let moved = 0;

    function onDown(e) {
      // Don't start drag on the action buttons inside chips.
      if (e.target.closest(".chip-btn")) return;
      isDown = true;
      moved = 0;
      startX = e.pageX;
      scrollStart = wrap.scrollLeft;
      // Don't add .dragging yet — CSS sets `.dragging .intent-chip {
      // pointer-events:none }`, which kills the chip click for the
      // pure (no-movement) case. Only flip into drag mode once the
      // pointer has actually moved past the threshold.
    }
    function onMove(e) {
      if (!isDown) return;
      const dx = e.pageX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 4 && !wrap.classList.contains("dragging")) {
        wrap.classList.add("dragging");
      }
      if (wrap.classList.contains("dragging")) wrap.scrollLeft = scrollStart - dx;
    }
    function onUp() {
      if (!isDown) return;
      isDown = false;
      // Defer removing .dragging so any synthesized click after mouseup
      // is still suppressed by the pointer-events:none rule (only matters
      // when we actually dragged, since we no longer add .dragging on
      // pure clicks).
      setTimeout(() => wrap.classList.remove("dragging"), 0);
    }
    wrap.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    // Capture-phase click suppressor — if we dragged >5px, swallow
    // the click so the chip doesn't fire its populate-textarea logic.
    wrap.addEventListener("click", (e) => {
      if (moved > 5) {
        e.preventDefault();
        e.stopPropagation();
        moved = 0;
      }
    }, true);
  })();

  // Cycling placeholder
  function startPlaceholderCycle() {
    const span = document.getElementById("placeholder-cycle");
    const ta = document.getElementById("ask-input");
    const wrap = document.getElementById("ask-input-wrap");
    if (!span || !ta || !wrap) return;
    let i = 0;
    span.textContent = CURATED[0];
    function step() {
      if (ta.value.trim() || document.activeElement === ta) return;
      span.classList.add("fading");
      setTimeout(() => {
        i = (i + 1) % CURATED.length;
        span.textContent = CURATED[i];
        span.classList.remove("fading");
      }, 320);
    }
    setInterval(step, 3500);
    // Toggle visibility classes
    function sync() {
      if (ta.value.trim()) wrap.classList.add("has-content"); else wrap.classList.remove("has-content");
    }
    ta.addEventListener("input", sync);
    ta.addEventListener("focus", () => wrap.classList.add("is-focused"));
    ta.addEventListener("blur", () => wrap.classList.remove("is-focused"));
    sync();
  }

  // Track intent usage on submit
  (function attachSubmitTracker() {
    const sub = document.getElementById("ask-submit");
    if (!sub) return;
    sub.addEventListener("click", async () => {
      const ta = document.getElementById("ask-input");
      const v = (ta && ta.value || "").trim();
      if (!v) return;
      const prefs = await loadPrefs();
      bumpIntent(prefs, v);
      savePrefs(prefs);
      // Re-render after a beat so the popup shows the freshly-used chip
      setTimeout(render, 500);
    });
  })();

  // Init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { render(); startPlaceholderCycle(); });
  } else {
    render();
    startPlaceholderCycle();
  }
})();

// Recent — clear-all button with two-tap confirm (no window.confirm
// dialog, since Safari extension popups don't host system dialogs).
(function () {
  const btn = document.getElementById("recent-clear");
  if (!btn) return;
  let armed = false;
  let armTimer = null;
  const labelEl = btn.querySelector("span") || btn;
  const originalText = labelEl.textContent;
  function disarm() {
    armed = false;
    labelEl.textContent = originalText;
    btn.classList.remove("is-armed");
    if (armTimer) { clearTimeout(armTimer); armTimer = null; }
  }
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!armed) {
      armed = true;
      labelEl.textContent = "tap to confirm";
      btn.classList.add("is-armed");
      armTimer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    chrome.storage.local.remove(["mw-recent"], () => {
      const list = document.getElementById("recent-list");
      const wrap = document.getElementById("recent-wrap");
      if (list) list.innerHTML = "";
      if (wrap) wrap.classList.remove("visible");
    });
  });
})();

// Mark body as .capturing when the primary CTA is pressed (covers
// both basic capture and intent capture which triggers the same
// click). The class disables every interactive surface and renders
// the animated barber-pole stripes on the CTA.
(function () {
  const btn = document.getElementById("btn-capture");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    document.body.classList.add("capturing");
    // Safety net — if capture hangs we still un-stick after 60s.
    setTimeout(() => document.body.classList.remove("capturing"), 60000);
  }, true);
})();

// "Capture the selection" button stays disabled until the active tab
// actually has a text selection. Polls on popup open + on focus.
(function () {
  const btn = document.getElementById("btn-selection");
  if (!btn) return;

  async function hasSelection() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return false;
      // chrome:// and a few protected origins reject scripting.executeScript;
      // treat those as "no selection".
      const url = tab.url || "";
      if (/^(chrome|chrome-extension|edge|about|view-source):/.test(url)) return false;
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => (window.getSelection() || "").toString().trim().length > 0,
      });
      return !!result;
    } catch { return false; }
  }

  async function syncSelectionState() {
    const ok = await hasSelection();
    if (ok) btn.removeAttribute("disabled");
    else btn.setAttribute("disabled", "");
  }

  syncSelectionState();
  window.addEventListener("focus", syncSelectionState);
})();

// Page-type sniffer — capture the pageType field the content script
// now returns alongside the markdown. We store it on window so the
// runtime.sendMessage wrapper below can use it to route structured
// pages (recipe / movie / paper / product) through AI auto-extract
// even when the user didn't type an instruction.
(function () {
  if (!chrome || !chrome.tabs || !chrome.tabs.sendMessage) return;
  const origTabSend = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = function patchedTabSend(tabId, msg, ...rest) {
    const cb = typeof rest[rest.length - 1] === "function" ? rest.pop() : null;
    function intercept(response) {
      try {
        if (response && response.pageType) {
          window.__lastPageType = response.pageType;
          window.__lastMetadata = response.metadata || null;
        }
      } catch { /* noop */ }
      if (cb) cb(response);
    }
    if (cb) return origTabSend.call(this, tabId, msg, ...rest, intercept);
    // Promise form (no callback)
    const p = origTabSend.call(this, tabId, msg, ...rest);
    if (p && typeof p.then === "function") {
      return p.then((response) => { intercept(response); return response; });
    }
    return p;
  };
})();

// Publish-step interceptor. popup.js publishes via runtime.sendMessage
// {action:"proxy-fetch", url:"/api/docs", body:JSON{markdown,...}}.
// We re-route to /api/docs/transform in two cases:
//   1. User typed an intent in the textarea → AI runs with that intent.
//   2. No intent but the page is a structured type (recipe / movie /
//      paper / product) → AI runs with a server-side template prompt.
// Plain articles / discussions / generic pages stay on /api/docs (no AI).
const STRUCTURED_TYPES = new Set(["recipe", "movie", "paper", "product"]);

// Drive #status through a sequence so the CTA reads
// "thinking with AI" → "rewriting your page" → "almost there"
// while /api/docs/transform's LLM cascade runs (5-15s).
// Stops when popup.js (or the markFresh observer) clears #status,
// because that means the response landed.
function startTransformProgress(mode) {
  const status = document.getElementById("status");
  if (!status) return;
  const stages = mode === "intent"
    ? ["thinking with AI…", "rewriting your page…", "almost there…"]
    : ["reading your page…", "extracting structure…", "almost there…"];
  let i = 0;
  const apply = () => {
    if (!document.body.classList.contains("capturing")) { stop(); return; }
    status.textContent = stages[i];
    i = Math.min(i + 1, stages.length - 1);
  };
  apply();
  const t = setInterval(apply, 2800);
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(t);
    obs.disconnect();
  }
  // If popup.js / markFresh clears or replaces #status text (response
  // landed, success or failure), stop driving stages.
  const obs = new MutationObserver(() => {
    const txt = (status.textContent || "").trim().toLowerCase();
    if (!txt || /success|published|fail|error|copied|opened/.test(txt)) stop();
  });
  obs.observe(status, { childList: true, characterData: true, subtree: true });
  // Hard cap so we never leak the interval if something weird happens.
  setTimeout(stop, 45000);
}

(function () {
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
  const origSend = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = function patchedRuntimeSend(...args) {
    try {
      const msg = args[0];
      const intent = window.__captureIntent;
      const pageType = window.__lastPageType;
      const autoEligible = !intent && pageType && STRUCTURED_TYPES.has(pageType);
      if (
        (intent || autoEligible) && msg && msg.action === "proxy-fetch" &&
        typeof msg.url === "string" && /\/api\/docs(?:[?#].*)?$/.test(msg.url) &&
        msg.options && typeof msg.options.body === "string"
      ) {
        const body = JSON.parse(msg.options.body);
        if (body && body.markdown) {
          msg.url = msg.url.replace(/\/api\/docs(?:[?#].*)?$/, "/api/docs/transform");
          const next = {
            markdown: body.markdown,
            userId: body.userId,
            source: body.source || (intent ? "chrome-intent" : "chrome-auto"),
          };
          if (intent) {
            next.intent = intent;
          } else {
            next.auto = true;
            next.pageType = pageType;
          }
          msg.options.body = JSON.stringify(next);
          window.__captureIntent = null;
          window.__lastPageType = null; // one-shot
          const ta = document.getElementById("ask-input");
          if (ta) ta.value = "";

          // Transform takes 5-15s (gpt-5-nano → gemini → claude
          // cascade) and popup.js's status freezes at "publishing".
          // Show meaningful stages so the user knows we're still
          // working and doesn't close the popup mid-request.
          startTransformProgress(intent ? "intent" : "auto");
        }
      }
    } catch (e) { /* never block the send */ }
    return origSend.apply(this, args);
  };
})();


// Open the dedicated /auth/chrome handoff page instead of the bare home
// URL popup.js defaults to (popup.js sets chip.onclick = open MDFY_URL).
// Override after popup.js binds, and re-bind whenever the .signin class
// flips (which is when popup.js re-renders the chip).
(function () {
  const AUTH_URL = "https://memory.wiki/auth/chrome";
  const chip = document.getElementById("account-chip");
  if (!chip) return;
  function bindSignInClick() {
    if (!chip.classList.contains("signin")) return;
    chip.onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: AUTH_URL });
    };
  }
  // Initial + watch for class flips.
  setTimeout(bindSignInClick, 60);
  new MutationObserver(bindSignInClick).observe(chip, {
    attributes: true, attributeFilter: ["class"],
  });
})();

// Signed-out: clicks on any capture control route to sign-in (the chip).
(function () {
  function isSignedOut() { return document.body.classList.contains("signed-out"); }
  function goSignIn(e) {
    if (!isSignedOut()) return;
    e.preventDefault();
    e.stopPropagation();
    const chip = document.getElementById("account-chip");
    if (chip) chip.click();
  }
  ["btn-capture", "btn-selection", "ask-submit"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", goSignIn, true);
  });
  const wrap = document.querySelector(".ask-input-wrap");
  if (wrap) wrap.addEventListener("click", goSignIn, true);
})();

// popup.js overwrites footer text + toggles .signin class.
// We piggyback on that to (1) brand-align the copy and (2) mirror the
// signed state onto <body> so the capture controls can be dimmed via CSS.
(function () {
  const info = document.getElementById("account-info");
  const plan = document.getElementById("account-plan");
  const act  = document.getElementById("account-action-label");
  const chip = document.getElementById("account-chip");
  if (!chip || !info) return;

  function applySignedOutCopy() {
    if (!chip.classList.contains("signin")) return;
    if (info.textContent !== "Sign in to memory.wiki") {
      info.textContent = "Sign in to memory.wiki";
    }
    if (plan && plan.textContent !== "free during beta") {
      plan.textContent = "free during beta";
    }
    if (act && act.textContent !== "Sign in to memory.wiki") {
      act.textContent = "Sign in to memory.wiki";
    }
  }

  function syncBodyState() {
    const out = chip.classList.contains("signin");
    document.body.classList.toggle("signed-out", out);
    if (out) applySignedOutCopy();
  }

  // Watch text mutations (popup.js setting new strings) and class swaps.
  new MutationObserver(syncBodyState).observe(chip, {
    attributes: true, attributeFilter: ["class"],
    childList: true, characterData: true, subtree: true,
  });

  // Initial sync.
  setTimeout(syncBodyState, 50);
})();
