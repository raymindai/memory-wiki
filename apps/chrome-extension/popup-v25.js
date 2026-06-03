// popup-v25.html companion: headline rotation + free-form AI submit wiring.
// Inline scripts are blocked by Manifest V3 CSP, so this lives in its own file.

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
    const v = ta.value.trim();
    if (!v) return;
    window.__captureIntent = v;
    window.__intentCaptureActive = true;
    document.body.classList.add("intent-active");
    document.body.classList.add("capturing");
    const btn = document.getElementById("btn-capture");
    if (btn) btn.click();
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
      targetEl.textContent = isError ? "failed" : (/capturing|publishing/i.test(txt) ? "capturing" : "ok");
    } else {
      if (savedLabel == null) savedLabel = titleEl.textContent;
      titleEl.textContent = pretty;
    }

    if (clearTimer) clearTimeout(clearTimer);
    if (isError || /success|published|opened|copied/i.test(txt)) {
      clearTimer = setTimeout(() => {
        if (savedLabel != null) { titleEl.textContent = savedLabel; savedLabel = null; }
        const s = document.getElementById("ask-submit");
        if (savedSubLabel != null && s) { s.textContent = savedSubLabel; savedSubLabel = null; }
        statusEl.textContent = "";
        window.__intentCaptureActive = false;
      }, 2200);
    }
  }
  new MutationObserver(applyStatus).observe(statusEl, {
    childList: true, characterData: true, subtree: true,
  });
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
  new MutationObserver(markFresh).observe(list, { childList: true });
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

  const STORAGE_KEY = "mw-intent-prefs";   // { recents: [{text, count, lastUsed, favorite}] }

  function loadPrefs() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (data) => {
        const v = data[STORAGE_KEY] || { recents: [] };
        if (!Array.isArray(v.recents)) v.recents = [];
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

  function makeChip({ text, favorite, isCurated }) {
    const el = document.createElement("div");
    el.className = "intent-chip" + (favorite ? " is-favorite" : "");
    el.title = text;
    el.dataset.text = text;

    // Text container (clipped, marquee on hover when overflowing)
    const labelWrap = document.createElement("span");
    labelWrap.className = "chip-label-wrap";
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
    del.title = isCurated ? "Hide this preset" : "Remove from history";
    del.innerHTML = X_SVG;
    del.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      const prefs = await loadPrefs();
      // Remove from recents/favorites
      prefs.recents = prefs.recents.filter((r) => r.text !== text);
      // If curated, also add to the dismissed set so it doesn't come back
      if (isCurated) {
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
      if (!ta) return;
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
    const prefs = await loadPrefs();
    wrap.innerHTML = "";

    // Order: starred favorites → top 3 most-used recents → curated
    // defaults to fill. Skip anything the user has dismissed.
    const dismissed = new Set(prefs.dismissed || []);
    const favs = prefs.recents
      .filter((r) => r.favorite && !dismissed.has(r.text))
      .sort((a, b) => b.lastUsed - a.lastUsed);
    const nonFav = prefs.recents
      .filter((r) => !r.favorite && !dismissed.has(r.text))
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
    const recentsTop = nonFav.slice(0, 3);
    const usedTexts = new Set([...favs, ...recentsTop].map((r) => r.text));
    const curatedToShow = CURATED.filter((t) => !usedTexts.has(t) && !dismissed.has(t));

    const all = [
      ...favs.map((r) => ({ text: r.text, favorite: true, isCurated: false })),
      ...recentsTop.map((r) => ({ text: r.text, favorite: false, isCurated: false })),
      ...curatedToShow.map((t) => ({ text: t, favorite: false, isCurated: true })),
    ];

    for (const item of all) wrap.appendChild(makeChip(item));
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

  // Chevron scroll buttons — one chip-width per click.
  (function attachChevrons() {
    const wrap = document.getElementById("intent-chips");
    const L = document.getElementById("chip-nav-left");
    const R = document.getElementById("chip-nav-right");
    if (!wrap || !L || !R) return;
    const STEP = 170; // ≈ one chip width + gap
    L.addEventListener("click", () => wrap.scrollBy({ left: -STEP, behavior: "smooth" }));
    R.addEventListener("click", () => wrap.scrollBy({ left: STEP, behavior: "smooth" }));
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
      wrap.classList.add("dragging");
    }
    function onMove(e) {
      if (!isDown) return;
      const dx = e.pageX - startX;
      moved = Math.max(moved, Math.abs(dx));
      wrap.scrollLeft = scrollStart - dx;
    }
    function onUp() {
      if (!isDown) return;
      isDown = false;
      // Defer removing .dragging so any synthesized click after mouseup
      // is still suppressed by the pointer-events:none rule.
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

// Server-backed Recent. When the user is signed in, the Recent list
// is populated from /api/docs/recent (their actual chrome-sourced
// captures across all browsers / profiles / devices) instead of the
// chrome.storage.local fallback. popup.js's renderRecent already
// renders from a list shape we control, so we replace the source by
// asking background to fetch + then rebuilding the list DOM.
(function () {
  let lastSyncTs = 0;
  async function syncRecentFromServer() {
    const now = Date.now();
    if (now - lastSyncTs < 2000) return; // throttle re-renders
    lastSyncTs = now;
    try {
      const resp = await chrome.runtime.sendMessage({
        action: "fetch-recent-docs",
        limit: 10,
        source: "chrome",
      });
      if (!resp || !resp.ok) return;          // signed out / network — keep local fallback
      const items = resp.items || [];
      // Mirror into mw-recent so any existing render path / persistence
      // sees the same data. popup.js's renderRecent reads this key.
      chrome.storage.local.set({ "mw-recent": items.slice(0, 7) }, () => {
        try {
          // popup.js exposes renderRecent on window; if not, fall back
          // to triggering its existing storage observer by calling it
          // here if exposed.
          if (typeof window.renderRecent === "function") window.renderRecent();
        } catch { /* noop */ }
      });
    } catch { /* noop */ }
  }
  // Run once on popup open + once shortly after a fresh capture lands.
  syncRecentFromServer();
  // Re-sync when a new Recent item is added by the local code path
  // (so the just-captured doc replaces its local placeholder with the
  // server-canonical row, with title etc.).
  const list = document.getElementById("recent-list");
  if (list) {
    new MutationObserver(() => { setTimeout(syncRecentFromServer, 1200); }).observe(list, { childList: true });
  }
})();

// Recent — clear-all button
(function () {
  const btn = document.getElementById("recent-clear");
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Clear recent captures from this list?")) return;
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
