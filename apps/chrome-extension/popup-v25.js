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
    const btn = document.getElementById("btn-capture");
    if (btn) btn.click();
  });
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
