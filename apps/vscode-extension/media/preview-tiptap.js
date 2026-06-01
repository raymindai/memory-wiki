/* =========================================================
   memory.wiki VS Code Preview — TipTap editor wiring (v1.7.0)

   v1.7.0 — pulls in the @mdcore/editor v0.3.0 toolbar parity
   helpers (attachToolbarState / attachHoverPreviews /
   mountTableMenu / mountSelectionToolbar / buildInlineLinkInput
   / buildTableGridPicker / buildAiMenu). The Desktop renderer
   wires the exact same helpers — both surfaces now match web's
   WysiwygToolbar + floating selection toolbar 1:1 without
   forking React.

   Load order (set in preview.ts):
     1. render.umd.js          — markdown-it renderer (shared)
     2. tiptap-config.umd.js   — TipTap + helpers on
                                  window.MemoryWikiEditor
     3. tiptap-mount.js        — defines window.MemoryWikiTipTap
     4. preview-tiptap.js      — this file
     5. preview.js             — legacy chrome (outline, AI panel)
                                  guarded behind __mwTipTapActive
   ========================================================= */

(function () {
  "use strict";

  // Flag the legacy preview.js script that TipTap owns the editor
  // surface now. preview.js reads this guard and skips its old
  // toolbar.click + content.input + content.keydown + the legacy
  // table context menu handlers so they don't double-fire on top
  // of TipTap commands.
  window.__mwTipTapActive = true;

  // Acquire the VS Code API exactly once. preview.js also calls
  // acquireVsCodeApi(); the second call returns the cached handle.
  var vscode = (function () {
    try { return acquireVsCodeApi(); } catch (e) { return null; }
  })();
  if (vscode) window.__mwVscode = vscode;

  var contentEl = document.getElementById("content");
  if (!contentEl) {
    console.error("[preview-tiptap] #content element missing — aborting mount");
    return;
  }

  var initialMarkdown = typeof window.__initialMarkdown === "string"
    ? window.__initialMarkdown
    : "";
  var readOnly = document.body.getAttribute("data-read-only") === "true";

  contentEl.innerHTML = "";
  contentEl.removeAttribute("contenteditable");
  contentEl.classList.add("tiptap-host");

  // Debounce edit -> postMessage. The extension treats every
  // `edit` as the source of truth; debouncing avoids hammering it
  // on every keystroke.
  var editTimer = null;
  var lastSentMarkdown = initialMarkdown;
  var isApplyingExternalUpdate = false;

  function pushEdit(markdown) {
    if (isApplyingExternalUpdate) return;
    if (markdown === lastSentMarkdown) return;
    lastSentMarkdown = markdown;
    if (!vscode) return;
    vscode.postMessage({ type: "edit", markdown: markdown });
  }

  function scheduleEdit(markdown) {
    if (editTimer) clearTimeout(editTimer);
    editTimer = setTimeout(function () { pushEdit(markdown); }, 200);
  }

  if (!window.MemoryWikiTipTap || !window.MemoryWikiTipTap.mountEditor) {
    console.error(
      "[preview-tiptap] MemoryWikiTipTap.mountEditor missing — " +
      "vendor-editor UMDs failed to load. Falling back to plain text."
    );
    contentEl.textContent = initialMarkdown;
    return;
  }

  var mounted;
  try {
    mounted = window.MemoryWikiTipTap.mountEditor(contentEl, {
      markdown: initialMarkdown,
      canEdit: !readOnly,
      placeholder: "Start writing...",
      onChange: function (md) { scheduleEdit(md); },
      onDoubleClickMermaid: function (code) {
        if (vscode) vscode.postMessage({ type: "editMermaid", code: code, index: 0 });
      },
    });
  } catch (err) {
    console.error("[preview-tiptap] mountEditor failed:", err);
    contentEl.textContent = initialMarkdown;
    return;
  }

  window.__mwEditor = mounted;
  var editor = mounted.raw;

  // ─── v1.7.0 selection AI bridge ───
  // The selection toolbar's AI menu (buildAiMenu) calls runAi(action,
  // {markdown, language?, instruction?}) and expects a Promise that
  // resolves to {result} or {error}. We forward to the extension
  // host via postMessage and correlate the response with a per-
  // request id. The extension's handleSelectionAi() posts back a
  // `selectionAiResult` message with the same requestId.
  var aiRequestSeq = 0;
  var pendingAi = Object.create(null);
  function runSelectionAi(action, payload) {
    return new Promise(function (resolve) {
      if (readOnly) { resolve({ error: "Document is read-only" }); return; }
      if (!vscode) { resolve({ error: "VS Code API unavailable" }); return; }
      var requestId = String(++aiRequestSeq) + ":" + Date.now();
      pendingAi[requestId] = resolve;
      // 30s safety timeout — if the host never replies (offline,
      // crashed handler, …) we still un-stick the menu.
      setTimeout(function () {
        if (pendingAi[requestId]) {
          delete pendingAi[requestId];
          resolve({ error: "AI timed out" });
        }
      }, 30000);
      vscode.postMessage({
        type: "selectionAi",
        requestId: requestId,
        action: action,
        markdown: (payload && payload.markdown) || "",
        language: (payload && payload.language) || undefined,
        instruction: (payload && payload.instruction) || undefined,
      });
    });
  }

  // ─── v1.7.0 toolbar parity helpers ───
  // attachToolbarState   → aria-pressed/data-active on permanent
  //                        toolbar buttons (bold/italic/headings/...)
  // attachHoverPreviews  → data-preview popover on hover
  // mountTableMenu       → floating row/col/header/delete menu above
  //                        the active table
  // mountSelectionToolbar→ floating B/I/S/H1-3/lists/quote/link/AI bar
  //                        above the selection
  // Built lazily inside the toolbarAction dispatcher:
  //   buildInlineLinkInput   → inline URL popover (replaces prompt)
  //   buildTableGridPicker   → 6×6 hover grid (replaces fixed 3×3)
  var H = window.MemoryWikiEditor || {};
  var permanentToolbar =
    document.getElementById("live-formatting-toolbar") ||
    document.getElementById("toolbar");
  try { if (H.attachToolbarState && permanentToolbar) H.attachToolbarState(editor, permanentToolbar); }
  catch (e) { console.warn("[preview-tiptap] attachToolbarState failed:", e); }
  try { if (H.attachHoverPreviews && permanentToolbar) H.attachHoverPreviews(permanentToolbar); }
  catch (e) { console.warn("[preview-tiptap] attachHoverPreviews failed:", e); }
  try { if (H.mountTableMenu) H.mountTableMenu(editor); }
  catch (e) { console.warn("[preview-tiptap] mountTableMenu failed:", e); }
  try {
    if (H.mountSelectionToolbar) {
      H.mountSelectionToolbar(editor, { runAi: runSelectionAi });
    }
  } catch (e) { console.warn("[preview-tiptap] mountSelectionToolbar failed:", e); }

  // ─── Toolbar handler — TipTap commands ───
  // Permanent toolbar (#live-formatting-toolbar). The floating
  // selection toolbar is owned by mountSelectionToolbar above so
  // we no longer listen for its clicks here.
  var permanentLinkInput = null;
  var permanentTablePicker = null;

  function runAction(action, button) {
    if (!editor) return;
    var chain = editor.chain().focus();
    switch (action) {
      case "undo":            chain.undo().run(); break;
      case "redo":            chain.redo().run(); break;
      case "bold":            chain.toggleBold().run(); break;
      case "italic":          chain.toggleItalic().run(); break;
      case "strikethrough":   chain.toggleStrike().run(); break;
      case "code":            chain.toggleCode().run(); break;
      case "h1":              chain.toggleHeading({ level: 1 }).run(); break;
      case "h2":              chain.toggleHeading({ level: 2 }).run(); break;
      case "h3":              chain.toggleHeading({ level: 3 }).run(); break;
      case "h4":              chain.toggleHeading({ level: 4 }).run(); break;
      case "h5":              chain.toggleHeading({ level: 5 }).run(); break;
      case "h6":              chain.toggleHeading({ level: 6 }).run(); break;
      case "p":               chain.setParagraph().run(); break;
      case "ul":              chain.toggleBulletList().run(); break;
      case "ol":              chain.toggleOrderedList().run(); break;
      case "task":            chain.toggleTaskList().run(); break;
      case "blockquote":      chain.toggleBlockquote().run(); break;
      case "codeblock":       chain.toggleCodeBlock().run(); break;
      case "hr":              chain.setHorizontalRule().run(); break;
      case "indent":
        try {
          if (editor.isActive("taskList")) editor.chain().focus().sinkListItem("taskItem").run();
          else editor.chain().focus().sinkListItem("listItem").run();
        } catch (e) { /* not in list */ }
        break;
      case "outdent":
        try {
          if (editor.isActive("taskList")) editor.chain().focus().liftListItem("taskItem").run();
          else editor.chain().focus().liftListItem("listItem").run();
        } catch (e) { /* not in list */ }
        break;
      case "link": {
        // v1.7.0 — replace prompt() with the inline link input
        // popover. If we can't build it (UMD missing), fall back
        // to prompt() so the button isn't dead.
        if (H.buildInlineLinkInput && permanentToolbar) {
          if (!permanentLinkInput) {
            try { permanentLinkInput = H.buildInlineLinkInput(editor, permanentToolbar); }
            catch (err) { permanentLinkInput = null; }
          }
          if (permanentLinkInput) { permanentLinkInput.open(button || null); break; }
        }
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
        } else {
          var existing = (editor.getAttributes("link") || {}).href || "";
          var url = window.prompt("Link URL", existing || "https://");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }
        break;
      }
      case "image": {
        if (vscode) vscode.postMessage({ type: "requestImageUrl" });
        break;
      }
      case "table": {
        // v1.7.0 — replace fixed 3×3 with the 6×6 grid picker.
        if (H.buildTableGridPicker && permanentToolbar) {
          if (!permanentTablePicker) {
            try { permanentTablePicker = H.buildTableGridPicker(editor, permanentToolbar); }
            catch (err) { permanentTablePicker = null; }
          }
          if (permanentTablePicker) { permanentTablePicker.toggle(button || null); break; }
        }
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      }
      case "math": {
        chain.insertContent("$E = mc^2$").run();
        break;
      }
      case "mermaid":
        chain.setCodeBlock({ language: "mermaid" }).run();
        break;
      case "removeFormat":
        chain.clearNodes().unsetAllMarks().run();
        break;
      default: break;
    }
  }

  // Bind the permanent formatting toolbar — selection toolbar is
  // now owned by mountSelectionToolbar so we skip it here. Capture
  // listener beats preview.js's bubbled handler (still guarded by
  // __mwTipTapActive but defense-in-depth).
  ["live-formatting-toolbar", "toolbar"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      if (btn.classList.contains("view-btn")) return;
      e.preventDefault();
      e.stopPropagation();
      runAction(action, btn);
    }, true);
  });

  // VS Code-style keyboard shortcuts. TipTap StarterKit binds
  // cmd-b / cmd-i / cmd-z internally so we only need the link
  // shortcut on top.
  document.addEventListener("keydown", function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.shiftKey) return;
    if (e.key === "k") {
      e.preventDefault();
      runAction("link", null);
    }
  }, true);

  // ─── Incoming messages from the extension ───
  window.addEventListener("message", function (event) {
    var msg = event.data || {};
    switch (msg.type) {
      case "update": {
        if (typeof msg.markdown === "string") {
          isApplyingExternalUpdate = true;
          try {
            mounted.setMarkdown(msg.markdown);
            lastSentMarkdown = msg.markdown;
          } finally {
            setTimeout(function () { isApplyingExternalUpdate = false; }, 50);
          }
        }
        break;
      }
      case "insertImage":
      case "imageUploaded": {
        if (!msg.url) break;
        editor.chain().focus()
          .setImage({ src: msg.url, alt: msg.alt || "image" })
          .run();
        break;
      }
      case "selectionAiResult": {
        // v1.7.0 — resolve the pending runSelectionAi promise.
        var rid = msg.requestId;
        if (rid && pendingAi[rid]) {
          var resolve = pendingAi[rid];
          delete pendingAi[rid];
          if (msg.error) resolve({ error: String(msg.error) });
          else resolve({ result: String(msg.result || "") });
        }
        break;
      }
      default: break;
    }
  });

  // Bind 'Save' (cmd-s) to flush any pending debounce + post the
  // current markdown immediately, so cmd-s feels instant rather
  // than waiting 200ms for the debounce.
  document.addEventListener("keydown", function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key !== "s") return;
    try {
      var md = mounted.getMarkdown();
      if (editTimer) { clearTimeout(editTimer); editTimer = null; }
      pushEdit(md);
    } catch (err) { /* noop */ }
  }, true);
})();
