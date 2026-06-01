// v3.0 unified editor — TipTap mount for the Desktop renderer.
//
// Consumes window.MemoryWikiEditor (the @mdcore/editor tiptap-config
// UMD vendored via scripts/vendor-editor.sh) and produces an editor
// that uses the SAME extension set web's TiptapLiveEditor mounts.
//
// Opt-in for now: editor.js calls mountTipTapEditor() only when the
// MW_TIPTAP_EDITOR flag is set (localStorage or window.location
// hash #tiptap). Default path stays contentEditable so we can land
// the foundation without breaking the live app.
//
// Window API:
//   window.MemoryWikiTipTap = {
//     mountEditor(container, opts) → Editor
//   }
//
//   opts: {
//     markdown:    string                 // initial doc
//     canEdit:     boolean
//     placeholder: string                 // empty-paragraph hint
//     onChange:    (md: string) => void   // fires on every edit
//     onDoubleClickMermaid: (code) => void
//   }
//
// The returned Editor exposes:
//   editor.setMarkdown(md)
//   editor.getMarkdown()       // for save / publish
//   editor.focus()
//   editor.destroy()

(function () {
  "use strict";

  function ensureDeps() {
    if (!window.MemoryWikiEditor) {
      throw new Error(
        "[tiptap-mount] window.MemoryWikiEditor not loaded — " +
        "vendor-editor/tiptap-config.umd.js must run before tiptap-mount.js"
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

    // Lazy require @tiptap/core via the same UMD's exported globals.
    // tsup's iife bundle attaches all module exports onto the
    // globalName object, so Editor + Extension are accessible there.
    var Editor = window.MemoryWikiEditor.Editor
      || window.MemoryWikiEditor.tiptap?.Editor
      || (window.MemoryWikiEditor.default || {}).Editor;
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
      onUpdate: function (_ref) {
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
          editor.commands.setContent(md);
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

  function tipTapEnabled() {
    try {
      if (window.location.hash === "#tiptap") return true;
      return localStorage.getItem("MW_TIPTAP_EDITOR") === "1";
    } catch (e) {
      return false;
    }
  }

  window.MemoryWikiTipTap = {
    mountEditor: mountEditor,
    enabled: tipTapEnabled,
  };
})();
