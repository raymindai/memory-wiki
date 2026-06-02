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
    const btn = document.getElementById("btn-capture");
    if (btn) btn.click();
    setTimeout(() => document.body.classList.remove("intent-active"), 5000);
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
    setTimeout(() => first.classList.remove("is-fresh"), 1900);
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

// Intent injection — intercept the FINAL publish step instead of the
// tab capture step. popup.js publishes via chrome.runtime.sendMessage
// {action:"proxy-fetch", url:"/api/docs", options:{body:JSON{markdown,...}}}.
// When __captureIntent is set, prepend the user's prompt to the
// markdown field of that body before forwarding to the background.
(function () {
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
  const origSend = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = function patchedRuntimeSend(...args) {
    try {
      const msg = args[0];
      const intent = window.__captureIntent;
      // When intent is queued AND popup.js is about to POST to /api/docs,
      // re-route to /api/docs/transform with the user's intent. The
      // server runs the markdown through Claude with the intent as the
      // instruction and saves the transformed output as the new doc.
      if (
        intent && msg && msg.action === "proxy-fetch" &&
        typeof msg.url === "string" && /\/api\/docs(?:[?#].*)?$/.test(msg.url) &&
        msg.options && typeof msg.options.body === "string"
      ) {
        const body = JSON.parse(msg.options.body);
        if (body && body.markdown) {
          msg.url = msg.url.replace(/\/api\/docs(?:[?#].*)?$/, "/api/docs/transform");
          msg.options.body = JSON.stringify({
            markdown: body.markdown,
            intent,
            userId: body.userId,
            source: body.source || "chrome-intent",
          });
          window.__captureIntent = null;
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
