// v3.0 unified editor — TipTap mount for the Desktop renderer.
//
// Consumes window.MemoryWikiEditor (the @mdcore/editor tiptap-config
// UMD vendored via scripts/vendor-editor.sh) and produces an editor
// that uses the SAME extension set web's TiptapLiveEditor mounts.
//
// As of desktop v2.6.0 (Phase B full migration) this is the ONLY
// editor surface — editor.js always calls mountEditor() now, no flag.
//
// Window API:
//   window.MemoryWikiTipTap = {
//     mountEditor(container, opts) → Editor handle
//   }
//
//   opts: {
//     markdown:    string                       // initial doc
//     canEdit:     boolean                      // false = read-only
//     placeholder: string                       // empty-paragraph hint
//     onChange:    (md: string) => void         // every edit (debounce upstream)
//     onDoubleClickMermaid: (code: string) => void
//     onPasteImage: (file: File) => Promise<string | null> // upload + return url
//   }
//
// The returned handle exposes:
//   handle.raw                — the underlying TipTap Editor (for chain commands)
//   handle.setMarkdown(md)    — replace content + emit onUpdate
//   handle.setMarkdownSilent(md) — replace content WITHOUT firing onChange
//   handle.getMarkdown()      — serialize via tiptap-markdown storage
//   handle.isActive(name, attrs?) — proxy to editor.isActive
//   handle.setEditable(bool)  — toggle read-only at runtime
//   handle.focus()
//   handle.destroy()

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

    var Editor = window.MemoryWikiEditor.Editor
      || (window.MemoryWikiEditor.tiptap && window.MemoryWikiEditor.tiptap.Editor)
      || ((window.MemoryWikiEditor.default || {}).Editor);
    if (!Editor) {
      throw new Error(
        "[tiptap-mount] @tiptap/core Editor class not exposed on " +
        "window.MemoryWikiEditor — check tiptap-config.umd.js build"
      );
    }

    // suppressNextUpdate skips the onChange that fires when WE
    // dispatched the setContent (e.g. loading a new doc, applying a
    // remote collab patch). Without this every load would race with
    // autosave + push a phantom version back to the server.
    var suppressNextUpdate = false;

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
        handleDoubleClickOn: function (_view, _pos, node) {
          if (node.type.name === "codeBlock"
              && (node.attrs.language || "").toLowerCase() === "mermaid"
              && opts.onDoubleClickMermaid) {
            var code = node.textContent || "";
            if (code) { opts.onDoubleClickMermaid(code); return true; }
          }
          return false;
        },
        handlePaste: function (view, event) {
          var items = (event.clipboardData && event.clipboardData.items) || [];
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it.type && it.type.indexOf("image/") === 0 && opts.onPasteImage) {
              event.preventDefault();
              var file = it.getAsFile();
              if (!file) return true;
              Promise.resolve(opts.onPasteImage(file)).then(function (url) {
                if (!url) return;
                var schema = view.state.schema;
                if (!schema.nodes.image) return;
                view.dispatch(view.state.tr.replaceSelectionWith(
                  schema.nodes.image.create({ src: url })
                ));
              });
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: function () {
        if (suppressNextUpdate) {
          suppressNextUpdate = false;
          return;
        }
        if (!opts.onChange) return;
        var md = "";
        try {
          md = editor.storage.markdown.getMarkdown();
        } catch (e) {
          md = editor.getHTML();
        }
        opts.onChange(md);
      },
    });

    function setMarkdown(md, silent) {
      try {
        if (silent) suppressNextUpdate = true;
        // emitUpdate false avoids the onUpdate for normal loads too,
        // but we still flip suppressNextUpdate for safety because
        // tiptap-markdown sometimes runs a fix-up transaction that
        // re-fires onUpdate even after setContent's `false` flag.
        editor.commands.setContent(md == null ? "" : md, !silent);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[tiptap-mount] setMarkdown failed:", e);
        suppressNextUpdate = false;
      }
    }

    return {
      raw: editor,
      setMarkdown: function (md) { setMarkdown(md, false); },
      setMarkdownSilent: function (md) { setMarkdown(md, true); },
      getMarkdown: function () {
        try { return editor.storage.markdown.getMarkdown(); }
        catch (e) { return editor.getHTML(); }
      },
      isActive: function (name, attrs) {
        try { return attrs ? editor.isActive(name, attrs) : editor.isActive(name); }
        catch (e) { return false; }
      },
      setEditable: function (canEdit) {
        try { editor.setEditable(!!canEdit); } catch (e) { /* noop */ }
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
