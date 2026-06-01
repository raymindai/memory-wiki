/* =========================================================
   memory.wiki VS Code Preview — TipTap editor wiring (v1.6.0)

   Replaces the old contentEditable + execCommand surface with
   the @mdcore/editor TipTap mount so the VSCode preview matches
   the web app's WYSIWYG editor 1:1.

   Loads AFTER tiptap-mount.js (which wraps the UMD bundle) and
   BEFORE preview.js (which we partially defang via the global
   flag below — preview.js still owns outline, image panel, AI
   panel, source view, etc. but its toolbar + contentEditable
   wiring sit behind a `window.__mwTipTapActive` guard).
   ========================================================= */

(function () {
  "use strict";

  // Flag the legacy preview.js script that TipTap owns the editor
  // surface now. preview.js reads this guard and skips its old
  // toolbar.click + content.input + content.keydown handlers so
  // they don't double-fire on top of TipTap commands.
  window.__mwTipTapActive = true;

  // Acquire the VS Code API exactly once. preview.js also calls
  // acquireVsCodeApi(); the second call returns the cached handle.
  var vscode = (function () {
    try { return acquireVsCodeApi(); } catch (e) { return null; }
  })();
  // Stash it so preview.js (which runs after us) gets the same
  // instance via the cached call.
  if (vscode) window.__mwVscode = vscode;

  var contentEl = document.getElementById("content");
  if (!contentEl) {
    console.error("[preview-tiptap] #content element missing — aborting mount");
    return;
  }

  // Pull initial markdown straight from the HTML template (set in
  // preview.ts as `window.__initialMarkdown`). This is the
  // canonical source — the HTML inside #content was the legacy
  // markdown-it preview that we're about to throw out.
  var initialMarkdown = typeof window.__initialMarkdown === "string"
    ? window.__initialMarkdown
    : "";

  // body[data-read-only="true"] is set in preview.ts for cloud-only
  // documents. Honour it so the preview surface stays view-only.
  var readOnly = document.body.getAttribute("data-read-only") === "true";

  // Wipe the legacy rendered HTML and let TipTap take ownership of
  // #content. TipTap mounts its ProseMirror editor view INTO the
  // container element, so the rest of preview.js (outline,
  // selection toolbar) keeps reading from #content unchanged.
  contentEl.innerHTML = "";
  contentEl.removeAttribute("contenteditable"); // ProseMirror manages this
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

  window.__mwEditor = mounted; // expose for debugging + preview.js
  var editor = mounted.raw;

  // ─── Toolbar handler — TipTap commands ───
  // Mirrors the web TipTap toolbar wiring in
  // apps/web/src/components/TiptapLiveEditor.tsx (around L903-L926).
  function runAction(action) {
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
        // TipTap StarterKit ships nested lists via Enter/Tab. The
        // toolbar buttons map to sinkListItem / liftListItem so
        // they only work inside a list — outside a list they are
        // no-ops, matching VSCode's expected behaviour.
        try { chain.sinkListItem("listItem").run(); }
        catch (e) { /* not in list */ }
        break;
      case "outdent":
        try { chain.liftListItem("listItem").run(); }
        catch (e) { /* not in list */ }
        break;
      case "link": {
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
        // Reuse the extension-side image flow — it pops a VS Code
        // input box, then sends back an `insertImage` message we
        // catch below. Keeps API token handling + URL validation
        // in the extension host where it belongs.
        if (vscode) vscode.postMessage({ type: "requestImageUrl" });
        break;
      }
      case "table":
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case "math": {
        // The math extension is a decoration plugin — it watches
        // text nodes for $..$ / $$..$$ and renders them as KaTeX
        // widgets. Inserting raw LaTeX text and letting the plugin
        // pick it up matches the web flow (web's toolbar inserts
        // `$E = mc^2$` and the user edits in place).
        chain.insertContent("$E = mc^2$").run();
        break;
      }
      case "mermaid":
        chain.setCodeBlock({ language: "mermaid" }).run();
        break;
      case "removeFormat":
        chain.clearNodes().unsetAllMarks().run();
        break;
      // Source view + outline + AI handled by preview.js; ignore here.
      default: break;
    }
  }

  // Bind ALL toolbar buttons (formatting toolbar + selection toolbar)
  // to the TipTap command dispatch. preview.js's listener for these
  // is guarded by __mwTipTapActive so it short-circuits.
  ["live-formatting-toolbar", "selection-toolbar", "toolbar"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      // Skip view-mode buttons (live/split/source) — handled by preview.js
      if (btn.classList.contains("view-btn")) return;
      e.preventDefault();
      e.stopPropagation();
      runAction(action);
    }, true); // capture so we beat preview.js's bubbled listener
  });

  // VS Code-style keyboard shortcuts. TipTap StarterKit binds
  // cmd-b / cmd-i / cmd-z internally so we only need the link
  // shortcut on top.
  document.addEventListener("keydown", function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.shiftKey) return;
    if (e.key === "k") {
      e.preventDefault();
      runAction("link");
    }
  }, true);

  // ─── Incoming messages from the extension ───
  window.addEventListener("message", function (event) {
    var msg = event.data || {};
    switch (msg.type) {
      case "update": {
        // The extension sent fresh markdown (file changed on disk or
        // an AI action rewrote it). Replay into TipTap WITHOUT
        // re-emitting it as an edit.
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
      case "insertImage": {
        if (!msg.url) break;
        editor.chain().focus()
          .setImage({ src: msg.url, alt: msg.alt || "image" })
          .run();
        break;
      }
      case "imageUploaded": {
        // Old contentEditable flow inserted a `![Uploading...]()`
        // placeholder and swapped it out on success. With TipTap we
        // just insert the final image node now.
        if (!msg.url) break;
        editor.chain().focus()
          .setImage({ src: msg.url, alt: msg.alt || "image" })
          .run();
        break;
      }
      // syncStatus, publishedState, image-data, flavorConvertResult,
      // asciiRender* are handled by preview.js (panel chrome that
      // doesn't touch the editor surface).
      default: break;
    }
  });

  // Bind 'Save' (cmd-s) to flush any pending debounce + post the
  // current markdown immediately, so cmd-s feels instant rather
  // than waiting 200ms for the debounce.
  document.addEventListener("keydown", function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key !== "s") return;
    // Don't preventDefault — let VS Code handle the actual file
    // save. We only need to make sure the latest markdown reached
    // the extension first.
    try {
      var md = mounted.getMarkdown();
      if (editTimer) { clearTimeout(editTimer); editTimer = null; }
      pushEdit(md);
    } catch (err) { /* noop */ }
  }, true);
})();
