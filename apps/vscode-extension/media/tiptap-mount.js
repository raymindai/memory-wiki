// memory.wiki VS Code preview — TipTap mount script for the webview.
//
// Mirrors apps/desktop/renderer/tiptap-mount.js so the two channels
// converge on the same shape:
//
//   window.MemoryWikiTipTap.mountEditor(container, opts)
//     → { raw, setMarkdown, getMarkdown, focus, destroy }
//
// Consumes the UMD bundles vendored by scripts/vendor-editor.sh:
//   - window.MemoryWikiEditor.buildExtensions(...)
//   - window.MemoryWikiEditor.Editor (the @tiptap/core Editor class,
//     re-exported by tiptap-config.ts and attached on the global by
//     tsup's iife format)
//
// opts:
//   markdown:    string                 // initial doc
//   canEdit:     boolean
//   placeholder: string                 // empty-paragraph hint
//   onChange:    (md: string) => void   // fires on every edit
//   onDoubleClickMermaid: (code) => void

(function () {
  "use strict";

  function ensureDeps() {
    if (!window.MemoryWikiEditor) {
      throw new Error(
        "[tiptap-mount] window.MemoryWikiEditor not loaded — " +
        "media/vendor-editor/tiptap-config.umd.js must run before tiptap-mount.js"
      );
    }
  }

  function mountEditor(container, opts) {
    ensureDeps();
    opts = opts || {};

    var extensions = window.MemoryWikiEditor.buildExtensions({
      placeholder: opts.placeholder || "Start writing...",
      onDoubleClickMermaid: opts.onDoubleClickMermaid,
    });

    // Editor + Extension re-exported by tiptap-config.ts so UMD
    // consumers don't need to bundle @tiptap/core separately.
    var Editor = window.MemoryWikiEditor.Editor
      || (window.MemoryWikiEditor.tiptap && window.MemoryWikiEditor.tiptap.Editor)
      || (window.MemoryWikiEditor.default && window.MemoryWikiEditor.default.Editor);
    if (!Editor) {
      throw new Error(
        "[tiptap-mount] @tiptap/core Editor class not exposed on " +
        "window.MemoryWikiEditor — check tiptap-config.umd.js build"
      );
    }

    var editor = new Editor({
      element: container,
      extensions: extensions,
      content: opts.markdown || "",
      editable: opts.canEdit !== false,
      editorProps: {
        attributes: {
          class: "mdcore-rendered tiptap-content",
          style: "min-height: 100%; outline: none;",
        },
      },
      onUpdate: function () {
        if (!opts.onChange) return;
        var md = "";
        try {
          // tiptap-markdown attaches storage.markdown.getMarkdown()
          md = editor.storage.markdown.getMarkdown();
        } catch (e) {
          md = editor.getHTML();
        }
        opts.onChange(md);
      },
    });

    return {
      raw: editor,
      setMarkdown: function (md) {
        try {
          // emitUpdate=false so we don't bounce the new content back
          // out as a synthetic edit — the caller already has it.
          editor.commands.setContent(md || "", false);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[tiptap-mount] setMarkdown failed:", e);
        }
      },
      getMarkdown: function () {
        try {
          return editor.storage.markdown.getMarkdown();
        } catch (e) {
          return editor.getHTML();
        }
      },
      focus: function () {
        try { editor.commands.focus(); } catch (e) { /* noop */ }
      },
      destroy: function () {
        try { editor.destroy(); } catch (e) { /* noop */ }
      },
    };
  }

  window.MemoryWikiTipTap = {
    mountEditor: mountEditor,
  };
})();
