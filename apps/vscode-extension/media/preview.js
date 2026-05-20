/* =========================================================
   Memory.Wiki VS Code Preview — Webview Client Script
   WYSIWYG editing via contentEditable + message passing
   ========================================================= */

(function () {
  "use strict";

  /** @type {ReturnType<typeof acquireVsCodeApi>} */
  const vscode = acquireVsCodeApi();

  /** @type {HTMLElement} */
  const content = document.getElementById("content");
  /** @type {HTMLElement} */
  const syncStatus = document.getElementById("sync-status");
  /** @type {HTMLElement} */
  const toolbar = document.getElementById("toolbar");

  // Rich tooltips for toolbar buttons with data-tip + data-preview
  (function initRichTooltips() {
    var tipEl = document.createElement("div");
    tipEl.className = "toolbar-rich-tip";
    document.body.appendChild(tipEl);
    var hideTimer;
    document.addEventListener("mouseover", function(e) {
      var btn = e.target.closest("[data-tip]");
      if (!btn) { tipEl.classList.remove("show"); return; }
      clearTimeout(hideTimer);
      var tip = btn.getAttribute("data-tip");
      var preview = btn.getAttribute("data-preview");
      tipEl.innerHTML = '<div class="tip-label">' + (tip || "") + '</div>' + (preview ? '<div class="tip-preview">' + preview + '</div>' : '');
      tipEl.classList.add("show");
      var r = btn.getBoundingClientRect();
      tipEl.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 210)) + "px";
      tipEl.style.top = (r.bottom + 6) + "px";
    });
    document.addEventListener("mouseout", function(e) {
      if (e.target.closest("[data-tip]")) {
        hideTimer = setTimeout(function() { tipEl.classList.remove("show"); }, 100);
      }
    });
  })();

  // Live pane header buttons
  (function initPaneButtons() {
    var toolbarToggle = document.getElementById('btn-toggle-toolbar');
    var formattingBar = document.getElementById('live-formatting-toolbar');
    if (toolbarToggle && formattingBar) {
      toolbarToggle.addEventListener('click', function() {
        formattingBar.classList.toggle('hidden');
        toolbarToggle.classList.toggle('active');
      });
    }
    var narrowToggle = document.getElementById('btn-toggle-narrow');
    if (narrowToggle) {
      narrowToggle.addEventListener('click', function() {
        content.classList.toggle('narrow');
        narrowToggle.classList.toggle('active');
      });
    }
    var exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'export' });
      });
    }
    // Image panel toggle
    var imgToggle = document.getElementById('btn-toggle-images');
    var imgPanel = document.getElementById('image-panel');
    var imgClose = document.getElementById('btn-close-images');
    var imgContent = document.getElementById('image-panel-content');
    var imgLoaded = false;
    function toggleImagePanel() {
      if (!imgPanel) return;
      var showing = imgPanel.style.display !== 'none';
      imgPanel.style.display = showing ? 'none' : 'block';
      if (imgToggle) imgToggle.classList.toggle('active', !showing);
      if (!showing && !imgLoaded) {
        imgLoaded = true;
        vscode.postMessage({ type: 'load-images' });
      }
      // Close outline and AI panels when opening images
      if (!showing && outlinePanel && outlinePanelOpen) {
        outlinePanelOpen = false;
        outlinePanel.classList.add('hidden');
        if (outlineToggle) outlineToggle.classList.remove('active');
      }
      if (!showing && aiPanelOpen) {
        aiPanelOpen = false;
        if (aiPanel) aiPanel.classList.add('hidden');
        if (aiToggle) aiToggle.classList.remove('active');
      }
    }
    if (imgToggle) imgToggle.addEventListener('click', toggleImagePanel);
    if (imgClose) imgClose.addEventListener('click', toggleImagePanel);
    // Handle image data from extension
    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (msg.type === 'image-data' && imgContent) {
        var images = msg.images || [];
        var quota = msg.quota;
        if (!msg.authenticated) {
          imgContent.innerHTML = '<div style="text-align:center;padding:24px 8px"><p style="font-size:11px;color:var(--fg-muted);margin-bottom:12px">Sign in to manage images</p><button onclick="vscode.postMessage({type:\'login\'})" style="padding:6px 16px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;background:var(--accent-dim);color:var(--accent)">Sign in</button></div>';
          return;
        }
        var html = '';
        if (quota) {
          var usedMB = Math.round(quota.used / 1024 / 1024);
          var totalMB = Math.round(quota.total / 1024 / 1024);
          var pct = Math.min(100, (quota.used / quota.total) * 100);
          html += '<div style="font-size:9px;color:var(--fg-muted);margin-bottom:4px;display:flex;justify-content:space-between"><span>' + usedMB + 'MB</span><span>' + totalMB + 'MB</span></div>';
          html += '<div style="height:3px;background:var(--surface-hover);border-radius:2px;margin-bottom:8px"><div style="height:100%;border-radius:2px;background:var(--accent);width:' + pct + '%"></div></div>';
        }
        if (images.length === 0) {
          html += '<div style="text-align:center;padding:20px 8px;font-size:11px;color:var(--fg-muted)">No images yet</div>';
        } else {
          html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px">';
          images.forEach(function(img) {
            html += '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;cursor:pointer" data-img-url="' + img.url + '" data-img-name="' + (img.name || '').replace(/"/g, '') + '">';
            html += '<img src="' + img.url + '" loading="lazy" style="width:100%;max-height:80px;object-fit:contain;background:var(--bg)">';
            html += '<div style="padding:4px 6px;background:var(--surface);display:flex;gap:4px;align-items:center">';
            html += '<button class="img-insert-btn" style="flex:1;padding:3px;border-radius:4px;border:none;cursor:pointer;font-size:9px;font-weight:600;background:var(--accent);color:#000">Insert</button>';
            html += '<button class="img-copy-btn" style="padding:3px 5px;border-radius:4px;border:none;cursor:pointer;font-size:9px;color:var(--fg-muted);background:var(--surface-hover)">URL</button>';
            html += '</div></div>';
          });
          html += '</div>';
        }
        imgContent.innerHTML = html;
        // Bind insert/copy
        imgContent.querySelectorAll('[data-img-url]').forEach(function(el) {
          var url = el.getAttribute('data-img-url');
          var name = (el.getAttribute('data-img-name') || 'image').replace(/\.\w+$/, '');
          el.querySelector('.img-insert-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            vscode.postMessage({ type: 'insert-image', url: url, name: name });
          });
          el.querySelector('.img-copy-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            navigator.clipboard.writeText(url);
          });
        });
      }
    });

    var copyMdBtn = document.getElementById('btn-copy-md');
    if (copyMdBtn) {
      copyMdBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(currentMarkdown).then(function() {
          copyMdBtn.style.color = '#4ade80';
          setTimeout(function() { copyMdBtn.style.color = ''; }, 1500);
        });
      });
    }
  })();

  // Flavor dropdown toggle
  (function initFlavorDropdown() {
    var badge = document.getElementById('flavor-badge');
    var dropdown = document.getElementById('flavor-dropdown');
    if (!badge || !dropdown) return;
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', function() {
      dropdown.classList.add('hidden');
    });
    dropdown.querySelectorAll('.flavor-option').forEach(function(btn) {
      btn.addEventListener('mouseover', function() { btn.style.background = 'var(--surface-hover)'; });
      btn.addEventListener('mouseout', function() { btn.style.background = 'none'; });
      btn.addEventListener('click', function() {
        var flavor = btn.getAttribute('data-flavor');
        dropdown.classList.add('hidden');
        vscode.postMessage({ type: 'convertFlavor', target: flavor });
      });
    });
  })();

  // Split divider drag (only active in split mode)
  (function initSplitDivider() {
    var divider = document.getElementById('split-divider');
    if (!divider) return;
    var livePane = document.getElementById('live-pane');
    var isDragging = false;
    divider.addEventListener('mousedown', function(e) {
      if (!document.body.classList.contains('split-mode')) return;
      isDragging = true;
      divider.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging || !livePane) return;
      var wrapper = document.getElementById('editor-wrapper');
      if (!wrapper) return;
      var rect = wrapper.getBoundingClientRect();
      var pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(20, Math.min(80, pct));
      livePane.style.width = pct + '%';
      var sv = document.getElementById('source-view');
      if (sv) sv.style.width = (100 - pct) + '%';
      if (cmEditor) cmEditor.refresh();
    });
    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (cmEditor) cmEditor.refresh();
    });
  })();

  // Current markdown source (kept in sync with extension)
  let currentMarkdown = window.__initialMarkdown || "";
  let currentFlavor = (window.__initialFlavor && window.__initialFlavor.primary) || "gfm";
  /** @type {number | null} */
  let editDebounceTimer = null;
  let isUpdatingFromExtension = false;
  let isUpdatingFromWebview = false;

  /** @type {HTMLElement} */
  var flavorBadge = document.getElementById("flavor-badge");
  /** @type {HTMLElement} */
  var flavorDropdown = document.getElementById("flavor-dropdown");
  /** @type {HTMLElement | null} */
  var tableContextMenu = null;

  // ─── Message Handling (Extension <-> Webview) ───

  window.addEventListener("message", function (event) {
    const message = event.data;

    switch (message.type) {
      case "update":
        // Skip if we're the ones who triggered the change
        if (isUpdatingFromWebview) break;
        // Extension sent new rendered HTML (from .md file change)
        isUpdatingFromExtension = true;
        if (message.markdown !== undefined) {
          currentMarkdown = message.markdown;
        }
        if (message.flavor !== undefined) {
          currentFlavor = message.flavor.primary || currentFlavor;
          updateFlavorBadge(currentFlavor);
        }
        if (message.html !== undefined) {
          // Preserve cursor position approximately
          const sel = window.getSelection();
          const hadFocus = document.activeElement === content;
          let caretOffset = 0;

          if (hadFocus && sel && sel.rangeCount > 0) {
            caretOffset = getCaretCharacterOffset(content);
          }

          content.innerHTML = message.html;

          // Post-process: syntax highlighting — copy lang from <pre lang="X"> to <code class="language-X">
          content.querySelectorAll('pre[lang] code').forEach(function(block) {
            var lang = block.parentElement.getAttribute('lang');
            if (lang && lang !== 'mermaid') {
              block.className = 'language-' + lang;
            }
          });
          content.querySelectorAll('pre code').forEach(function(block) {
            if (typeof hljs !== 'undefined') hljs.highlightElement(block);
          });

          // Post-process: KaTeX math
          content.querySelectorAll('[data-math-style]').forEach(function(el) {
            if (typeof katex !== 'undefined') {
              try {
                katex.render(el.textContent || '', el, {
                  displayMode: el.getAttribute('data-math-style') === 'display',
                  throwOnError: false
                });
              } catch(e) {}
            }
          });

          // Post-process: code block headers (lang tag + copy button)
          postProcessCodeBlocks(content);

          // Post-process: Mermaid diagrams
          postProcessMermaid();

          // Post-process: ASCII art render buttons
          postProcessAsciiBlocks(content);

          // Post-process: non-editable islands + spacers
          setupNonEditableIslands(content);

          if (hadFocus && caretOffset > 0) {
            restoreCaretPosition(content, caretOffset);
          }
        }
        isUpdatingFromExtension = false;
        break;

      case "flavorConvertResult":
        if (message.changed === false) {
          // Nothing changed — flash the badge to indicate "already compatible"
          if (flavorBadge) {
            flavorBadge.classList.add("flavor-badge-flash");
            setTimeout(function() { flavorBadge.classList.remove("flavor-badge-flash"); }, 1200);
          }
        }
        break;

      case "syncStatus":
        setSyncStatusDisplay(message.status);
        break;

      case "publishedState": {
        var badge = document.getElementById('mdfy-badge');
        var viewLink = document.getElementById('badge-view-link');
        if (badge) {
          if (message.docId && message.url) {
            badge.classList.remove('hidden');
            if (viewLink) {
              viewLink.href = message.url;
              viewLink.textContent = 'View document →';
            }
          } else {
            badge.classList.add('hidden');
          }
        }
        break;
      }

      case "imageUploaded": {
        // Replace "![Uploading...]()" placeholder with actual URL
        var html = content.innerHTML;
        var placeholder = '![Uploading...]()';
        // The placeholder was inserted as text via execCommand, so it appears as text nodes
        // Walk through and replace first occurrence
        replacePlaceholderText(content, placeholder, '![' + (message.alt || 'image') + '](' + message.url + ')');
        triggerEditDebounce();
        break;
      }

      case "imageUploadFailed": {
        // Replace placeholder with error message
        replacePlaceholderText(content, '![Uploading...]()', '![Upload failed]()');
        triggerEditDebounce();
        break;
      }

      case "asciiRenderStart": {
        content.querySelectorAll('.ascii-render-btn').forEach(function(btn) {
          btn.textContent = 'Converting...';
          btn.disabled = true;
          btn.style.opacity = '0.7';
        });
        break;
      }

      case "asciiRenderComplete": {
        // Document was edited by extension — re-render will happen automatically
        break;
      }

      case "asciiRenderFailed": {
        content.querySelectorAll('.ascii-render-btn').forEach(function(btn) {
          btn.textContent = 'Convert to Mermaid';
          btn.disabled = false;
          btn.style.opacity = '1';
        });
        break;
      }

      case "insertImage": {
        // Extension is sending an image URL to insert (from toolbar image button)
        if (message.url) {
          insertImageElement(message.url, message.alt || 'image');
        }
        break;
      }
    }
  });

  // ─── WYSIWYG Editing ───

  content.addEventListener("input", function () {
    if (isUpdatingFromExtension) return;

    // Debounce: wait 500ms after last edit before sending to extension
    if (editDebounceTimer) {
      clearTimeout(editDebounceTimer);
    }

    editDebounceTimer = setTimeout(function () {
      var markdown = htmlToMarkdown(content);
      if (markdown !== currentMarkdown) {
        currentMarkdown = markdown;
        isUpdatingFromWebview = true;
        vscode.postMessage({ type: "edit", markdown: markdown });
        // Reset flag after a short delay to allow extension to process
        setTimeout(function() { isUpdatingFromWebview = false; }, 600);
      }
    }, 150);
  });

  // Keyboard shortcuts inside contentEditable
  content.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      switch (e.key) {
        case "b":
          e.preventDefault();
          applyInlineFormat("bold");
          break;
        case "i":
          e.preventDefault();
          applyInlineFormat("italic");
          break;
        case "k":
          e.preventDefault();
          insertLink();
          break;
      }
    }
  });

  // ─── Toolbar Handling ───

  toolbar.addEventListener("click", function (e) {
    const button = e.target.closest("button");
    if (!button) return;

    const action = button.getAttribute("data-action");
    if (!action) return;

    e.preventDefault();
    content.focus();

    switch (action) {
      case "undo":
        document.execCommand("undo", false, null);
        triggerEditDebounce();
        break;
      case "redo":
        document.execCommand("redo", false, null);
        triggerEditDebounce();
        break;
      case "bold":
        applyInlineFormat("bold");
        break;
      case "italic":
        applyInlineFormat("italic");
        break;
      case "strikethrough":
        applyInlineFormat("strikethrough");
        break;
      case "h1":
        applyBlockFormat("h1");
        break;
      case "h2":
        applyBlockFormat("h2");
        break;
      case "h3":
        applyBlockFormat("h3");
        break;
      case "h4":
        applyBlockFormat("h4");
        break;
      case "h5":
        applyBlockFormat("h5");
        break;
      case "h6":
        applyBlockFormat("h6");
        break;
      case "p":
        applyBlockFormat("p");
        break;
      case "ul":
        applyBlockFormat("ul");
        break;
      case "ol":
        applyBlockFormat("ol");
        break;
      case "task":
        applyBlockFormat("task");
        break;
      case "indent":
        applyIndent();
        break;
      case "outdent":
        applyOutdent();
        break;
      case "link":
        insertLink();
        break;
      case "image":
        // Post message to extension to show VS Code input box for image URL
        vscode.postMessage({ type: "requestImageUrl" });
        break;
      case "table":
        showTableGridSelector(button);
        break;
      case "code":
        applyInlineFormat("code");
        break;
      case "codeblock":
        insertCodeBlock();
        break;
      case "blockquote":
        applyBlockFormat("blockquote");
        break;
      case "hr":
        insertHorizontalRule();
        break;
      case "removeFormat":
        removeFormatting();
        break;
      case "toggleSource":
        toggleSourceView();
        break;
    }
  });

  // ─── Toggle Pill Buttons (Bottom Bar) ───

  var isNarrow = true; // default ON
  var isToolbarVisible = true; // default ON
  var narrowToggle = document.getElementById('narrow-toggle');
  var toolbarToggle = document.getElementById('toolbar-toggle');

  function setupTogglePill(btn, onToggle) {
    if (!btn) return;
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var active = btn.getAttribute('data-active') === 'true';
      var newState = !active;
      btn.setAttribute('data-active', String(newState));
      var sw = btn.querySelector('.toggle-switch');
      if (sw) sw.classList.toggle('on', newState);
      onToggle(newState);
    });
  }

  setupTogglePill(narrowToggle, function(on) {
    isNarrow = on;
    content.classList.toggle('narrow', on);
  });

  setupTogglePill(toolbarToggle, function(on) {
    isToolbarVisible = on;
    toolbar.style.display = on ? '' : 'none';
    var wrapper = document.getElementById('editor-wrapper');
    if (wrapper) wrapper.style.top = on ? '34px' : '0';
  });

  // ─── View Mode Switcher (Live / Source) ───

  var sourceVisible = false;
  var sourceEditor = document.getElementById("source-editor");
  var editorWrapper = document.getElementById("editor-wrapper");
  var sourceView = document.getElementById("source-view");
  var sourceEditorContainer = document.getElementById("source-editor-container");
  var sourceDebounce = null;
  var cmEditor = null;

  function initCodeMirror() {
    if (cmEditor || typeof CodeMirror === 'undefined') return;
    cmEditor = CodeMirror(sourceEditorContainer, {
      value: currentMarkdown,
      mode: 'gfm',
      theme: 'material-darker',
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      autofocus: true,
      viewportMargin: Infinity,
      extraKeys: {
        'Tab': function(cm) { cm.replaceSelection('  ', 'end'); }
      }
    });

    cmEditor.on('change', function() {
      currentMarkdown = cmEditor.getValue();
      if (sourceDebounce) clearTimeout(sourceDebounce);
      sourceDebounce = setTimeout(function() {
        isUpdatingFromWebview = true;
        vscode.postMessage({ type: 'edit', markdown: currentMarkdown });
        setTimeout(function() { isUpdatingFromWebview = false; }, 600);
      }, 300);
    });
  }

  function setViewMode(mode) {
    sourceVisible = (mode === 'source' || mode === 'split');
    document.querySelectorAll('.view-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === mode);
    });
    document.body.classList.toggle('source-mode', mode === 'source');
    document.body.classList.toggle('split-mode', mode === 'split');
    document.body.classList.toggle('live-mode', mode === 'live');

    var livePane = document.getElementById('live-pane');

    // Reset split sizes when leaving split mode
    if (mode !== 'split' && livePane) {
      livePane.style.width = '';
      sourceView.style.width = '';
    }

    if (mode === 'source' || mode === 'split') {
      sourceView.classList.remove("hidden");
      if (!cmEditor) {
        initCodeMirror();
      } else {
        cmEditor.setValue(currentMarkdown);
      }
      if (cmEditor) setTimeout(function() { cmEditor.refresh(); }, 50);
      if (mode === 'source' && cmEditor) cmEditor.focus();
    } else {
      sourceView.classList.add("hidden");
      content.focus();
    }
  }

  function toggleSourceView() {
    setViewMode(sourceVisible ? 'live' : 'source');
  }

  // Use event delegation on toolbar for view buttons
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.view-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    setViewMode(btn.getAttribute('data-view'));
  });

  // Update source editor when content updates from extension
  window.addEventListener("message", function (event) {
    if (event.data.type === "update" && sourceVisible && cmEditor) {
      var newMd = event.data.markdown || currentMarkdown;
      if (cmEditor.getValue() !== newMd) {
        var cursor = cmEditor.getCursor();
        cmEditor.setValue(newMd);
        cmEditor.setCursor(cursor);
      }
    }
  });

  // ─── Formatting Functions ───

  function applyInlineFormat(format) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);
    var text = range.toString();
    if (!text) return;

    var wrapper;
    switch (format) {
      case "bold":
        wrapper = document.createElement("strong");
        break;
      case "italic":
        wrapper = document.createElement("em");
        break;
      case "strikethrough":
        wrapper = document.createElement("del");
        break;
      case "code":
        wrapper = document.createElement("code");
        break;
      default:
        return;
    }

    // Check if already wrapped in same tag
    var parentTag = range.commonAncestorContainer.parentElement;
    if (
      parentTag &&
      parentTag.tagName === wrapper.tagName &&
      parentTag !== content
    ) {
      // Unwrap: replace the parent with its text content
      var textNode = document.createTextNode(parentTag.textContent || "");
      parentTag.parentNode.replaceChild(textNode, parentTag);
    } else {
      // Wrap selection
      range.surroundContents(wrapper);
    }

    triggerEditDebounce();
  }

  function applyBlockFormat(format) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);

    // Find the block-level parent
    var blockNode = findBlockParent(range.startContainer);
    if (!blockNode || blockNode === content) return;

    var newNode;
    switch (format) {
      case "h1":
        newNode = document.createElement("h1");
        newNode.textContent = blockNode.textContent;
        break;
      case "h2":
        newNode = document.createElement("h2");
        newNode.textContent = blockNode.textContent;
        break;
      case "h3":
        newNode = document.createElement("h3");
        newNode.textContent = blockNode.textContent;
        break;
      case "h4":
        newNode = document.createElement("h4");
        newNode.textContent = blockNode.textContent;
        break;
      case "h5":
        newNode = document.createElement("h5");
        newNode.textContent = blockNode.textContent;
        break;
      case "h6":
        newNode = document.createElement("h6");
        newNode.textContent = blockNode.textContent;
        break;
      case "p":
        newNode = document.createElement("p");
        newNode.textContent = blockNode.textContent;
        break;
      case "blockquote":
        newNode = document.createElement("blockquote");
        var p = document.createElement("p");
        p.textContent = blockNode.textContent;
        newNode.appendChild(p);
        break;
      case "ul": {
        newNode = document.createElement("ul");
        var li = document.createElement("li");
        li.textContent = blockNode.textContent;
        newNode.appendChild(li);
        break;
      }
      case "ol": {
        newNode = document.createElement("ol");
        var li2 = document.createElement("li");
        li2.textContent = blockNode.textContent;
        newNode.appendChild(li2);
        break;
      }
      case "task": {
        newNode = document.createElement("ul");
        newNode.className = "contains-task-list";
        var tli = document.createElement("li");
        tli.className = "task-list-item";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.disabled = false;
        tli.appendChild(cb);
        tli.appendChild(document.createTextNode(" " + blockNode.textContent));
        newNode.appendChild(tli);
        break;
      }
      default:
        return;
    }

    blockNode.parentNode.replaceChild(newNode, blockNode);
    triggerEditDebounce();
  }

  function insertLink() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);
    var text = range.toString() || "link text";

    var link = document.createElement("a");
    link.href = "https://";
    link.textContent = text;

    range.deleteContents();
    range.insertNode(link);

    // Select the href for easy editing
    sel.selectAllChildren(link);
    triggerEditDebounce();
  }

  function insertCodeBlock() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);
    var blockNode = findBlockParent(range.startContainer);

    var pre = document.createElement("pre");
    var code = document.createElement("code");
    code.textContent = range.toString() || "code here";
    pre.appendChild(code);

    if (blockNode && blockNode !== content) {
      blockNode.parentNode.insertBefore(pre, blockNode.nextSibling);
    } else {
      content.appendChild(pre);
    }

    triggerEditDebounce();
  }

  function insertHorizontalRule() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);
    var blockNode = findBlockParent(range.startContainer);

    var hr = document.createElement("hr");

    if (blockNode && blockNode !== content) {
      blockNode.parentNode.insertBefore(hr, blockNode.nextSibling);
    } else {
      content.appendChild(hr);
    }

    triggerEditDebounce();
  }

  function insertTable(cols, rows) {
    cols = cols || 3;
    rows = rows || 2;

    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);
    var blockNode = findBlockParent(range.startContainer);

    var table = document.createElement("table");
    var thead = document.createElement("thead");
    var headerRow = document.createElement("tr");
    for (var h = 0; h < cols; h++) {
      var th = document.createElement("th");
      th.textContent = "Header " + (h + 1);
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    for (var r = 0; r < rows; r++) {
      var row = document.createElement("tr");
      for (var c = 0; c < cols; c++) {
        var td = document.createElement("td");
        td.textContent = "";
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    if (blockNode && blockNode !== content) {
      blockNode.parentNode.insertBefore(table, blockNode.nextSibling);
    } else {
      content.appendChild(table);
    }

    triggerEditDebounce();
  }

  // ─── Table Grid Selector ───

  var activeGridSelector = null;

  function showTableGridSelector(button) {
    hideTableGridSelector();

    var rect = button.getBoundingClientRect();
    var grid = document.createElement('div');
    grid.className = 'table-grid-selector';
    grid.style.left = rect.left + 'px';
    grid.style.top = (rect.bottom + 4) + 'px';

    var label = document.createElement('div');
    label.className = 'grid-label';
    label.textContent = 'Select size';
    grid.appendChild(label);

    var gridContainer = document.createElement('div');
    gridContainer.className = 'grid-cells';

    var maxCols = 6, maxRows = 5;
    for (var r = 0; r < maxRows; r++) {
      for (var c = 0; c < maxCols; c++) {
        var cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.setAttribute('data-row', String(r));
        cell.setAttribute('data-col', String(c));
        gridContainer.appendChild(cell);
      }
    }
    grid.appendChild(gridContainer);

    gridContainer.addEventListener('mouseover', function(e) {
      var cell = e.target.closest('.grid-cell');
      if (!cell) return;
      var hoverRow = parseInt(cell.getAttribute('data-row'));
      var hoverCol = parseInt(cell.getAttribute('data-col'));
      label.textContent = (hoverCol + 1) + ' × ' + (hoverRow + 1);
      gridContainer.querySelectorAll('.grid-cell').forEach(function(c) {
        var cr = parseInt(c.getAttribute('data-row'));
        var cc = parseInt(c.getAttribute('data-col'));
        c.classList.toggle('active', cr <= hoverRow && cc <= hoverCol);
      });
    });

    gridContainer.addEventListener('click', function(e) {
      var cell = e.target.closest('.grid-cell');
      if (!cell) return;
      var selRow = parseInt(cell.getAttribute('data-row')) + 1;
      var selCol = parseInt(cell.getAttribute('data-col')) + 1;
      hideTableGridSelector();
      content.focus();
      insertTable(selCol, selRow);
    });

    document.body.appendChild(grid);
    activeGridSelector = grid;

    setTimeout(function() {
      document.addEventListener('click', hideTableGridSelector, { once: true });
    }, 0);
  }

  function hideTableGridSelector() {
    if (activeGridSelector) {
      activeGridSelector.remove();
      activeGridSelector = null;
    }
  }

  function applyIndent() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);
    var li = findParentByTag(range.startContainer, "LI");
    if (!li) return;

    // Find the previous sibling LI
    var prevLi = li.previousElementSibling;
    if (!prevLi || prevLi.tagName !== "LI") return;

    // Create or find a nested list inside the previous LI
    var parentList = li.parentNode;
    var listTag = parentList.tagName.toLowerCase(); // ul or ol
    var nestedList = prevLi.querySelector(listTag);
    if (!nestedList) {
      nestedList = document.createElement(listTag);
      prevLi.appendChild(nestedList);
    }

    // Move the current LI into the nested list
    nestedList.appendChild(li);

    triggerEditDebounce();
  }

  function applyOutdent() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);
    var li = findParentByTag(range.startContainer, "LI");
    if (!li) return;

    var parentList = li.parentNode;
    if (!parentList) return;

    var grandparentLi = parentList.parentNode;
    if (!grandparentLi || grandparentLi.tagName !== "LI") return;

    var outerList = grandparentLi.parentNode;
    if (!outerList) return;

    // Insert the LI after the grandparent LI in the outer list
    outerList.insertBefore(li, grandparentLi.nextSibling);

    // If the nested list is now empty, remove it
    if (parentList.children.length === 0) {
      parentList.parentNode.removeChild(parentList);
    }

    triggerEditDebounce();
  }

  function removeFormatting() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    var range = sel.getRangeAt(0);
    var text = range.toString();
    if (!text) return;

    // Replace the selection with plain text
    range.deleteContents();
    var textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // Place cursor after the text
    sel.collapseToEnd();

    triggerEditDebounce();
  }

  function insertImageElement(url, alt) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      // No selection — append to end
      var img = document.createElement("img");
      img.src = url;
      img.alt = alt || "image";
      var p = document.createElement("p");
      p.appendChild(img);
      content.appendChild(p);
    } else {
      var range = sel.getRangeAt(0);
      var img2 = document.createElement("img");
      img2.src = url;
      img2.alt = alt || "image";
      range.deleteContents();
      range.insertNode(img2);
      sel.collapseToEnd();
    }
    triggerEditDebounce();
  }

  function findParentByTag(node, tagName) {
    var current = node;
    while (current && current !== content) {
      if (current.nodeType === Node.ELEMENT_NODE && current.tagName === tagName) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  // ─── Image Paste Support ───

  content.addEventListener("paste", function (e) {
    var clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check for images first
    var items = clipboardData.items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (!file) break;
        var reader = new FileReader();
        var fileName = file.name || "image.png";
        reader.onload = function (ev) {
          vscode.postMessage({
            type: "uploadImage",
            data: ev.target.result,
            name: fileName,
          });
        };
        reader.readAsDataURL(file);
        document.execCommand("insertText", false, "![Uploading...]()");
        return;
      }
    }

    // Check for HTML paste — convert to clean Markdown insertion
    var htmlData = clipboardData.getData('text/html');
    var plainText = clipboardData.getData('text/plain');
    if (htmlData && htmlData.trim()) {
      // Only convert if it looks like rich content (has actual HTML tags)
      var hasRichContent = /<(h[1-6]|p|ul|ol|li|table|tr|td|th|blockquote|pre|code|a|strong|em|b|i|img)\b/i.test(htmlData);
      if (hasRichContent) {
        e.preventDefault();
        // Create temp container to convert HTML to markdown
        var temp = document.createElement('div');
        temp.innerHTML = htmlData;
        // Remove style, script, meta tags
        temp.querySelectorAll('style, script, meta, link').forEach(function(el) { el.remove(); });
        var md = htmlToMarkdown(temp);
        document.execCommand("insertText", false, md.trim());
        triggerEditDebounce();
        return;
      }
    }
  });

  // ─── Image Drop Support ───

  content.addEventListener("dragover", function (e) {
    e.preventDefault();
  });

  content.addEventListener("drop", function (e) {
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files) return;

    for (var i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        e.preventDefault();
        var file = files[i];
        var reader = new FileReader();
        var fileName = file.name;
        reader.onload = function (ev) {
          vscode.postMessage({
            type: "uploadImage",
            data: ev.target.result,
            name: fileName,
          });
        };
        reader.readAsDataURL(file);
        // Insert placeholder
        document.execCommand("insertText", false, "![Uploading...]()");
        break;
      }
    }
  });

  // ─── HTML to Markdown Conversion ───

  function htmlToMarkdown(root) {
    var result = "";
    var children = root.childNodes;

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      // Skip spacer elements
      if (child.nodeType === 1 && child.classList && child.classList.contains('ce-spacer')) continue;
      // Skip UI elements (code headers, mermaid buttons)
      if (child.nodeType === 1 && child.classList && (
        child.classList.contains('code-header') ||
        child.classList.contains('mermaid-edit-btn')
      )) continue;
      result += nodeToMarkdown(child, 0);
    }

    // Clean up excessive blank lines
    result = result.replace(/\n{3,}/g, "\n\n");
    return result.trim() + "\n";
  }

  function nodeToMarkdown(node, depth) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    var tag = node.tagName.toLowerCase();
    var innerText = node.textContent || "";
    var childMd = "";

    switch (tag) {
      case "h1":
        return "# " + innerText.trim() + "\n\n";
      case "h2":
        return "## " + innerText.trim() + "\n\n";
      case "h3":
        return "### " + innerText.trim() + "\n\n";
      case "h4":
        return "#### " + innerText.trim() + "\n\n";
      case "h5":
        return "##### " + innerText.trim() + "\n\n";
      case "h6":
        return "###### " + innerText.trim() + "\n\n";

      case "p":
        return inlineChildrenToMd(node) + "\n\n";

      case "br":
        return "\n";

      case "strong":
      case "b":
        return "**" + inlineChildrenToMd(node) + "**";

      case "em":
      case "i":
        return "*" + inlineChildrenToMd(node) + "*";

      case "del":
      case "s":
        return "~~" + inlineChildrenToMd(node) + "~~";

      case "code":
        // If parent is <pre>, skip (handled by pre)
        if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") {
          return innerText;
        }
        var escapedCode = innerText.replace(/`/g, "\\`");
        return "`" + escapedCode + "`";

      case "pre": {
        var lang = node.getAttribute("lang") || "";
        var codeEl = node.querySelector("code");
        var codeText = codeEl ? codeEl.textContent : innerText;
        return "```" + lang + "\n" + codeText + "\n```\n\n";
      }

      case "a": {
        var href = node.getAttribute("href") || "";
        var linkText = inlineChildrenToMd(node);
        return "[" + linkText + "](" + href + ")";
      }

      case "img": {
        var src = node.getAttribute("src") || "";
        var alt = node.getAttribute("alt") || "";
        return "![" + alt + "](" + src + ")\n\n";
      }

      case "blockquote":
        childMd = blockChildrenToMd(node);
        return childMd
          .split("\n")
          .map(function (line) {
            return "> " + line;
          })
          .join("\n") + "\n\n";

      case "ul":
        return listToMarkdown(node, "ul", depth) + "\n";

      case "ol":
        return listToMarkdown(node, "ol", depth) + "\n";

      case "li": {
        // Handled by listToMarkdown
        return inlineChildrenToMd(node);
      }

      case "hr":
        return "---\n\n";

      case "table":
        return tableToMarkdown(node) + "\n\n";

      case "input": {
        if (node.type === "checkbox") {
          return node.checked ? "[x] " : "[ ] ";
        }
        return "";
      }

      case "details": {
        var summary = node.querySelector("summary");
        var summaryText = summary ? summary.textContent.trim() : "Details";
        childMd = "";
        for (var c = 0; c < node.childNodes.length; c++) {
          if (node.childNodes[c] !== summary) {
            childMd += nodeToMarkdown(node.childNodes[c], depth);
          }
        }
        return "<details>\n<summary>" + summaryText + "</summary>\n\n" + childMd.trim() + "\n</details>\n\n";
      }

      case "div":
      case "section":
      case "article":
      case "main":
      case "aside":
      case "header":
      case "footer":
      case "nav":
        // Generic containers: process children
        for (var j = 0; j < node.childNodes.length; j++) {
          childMd += nodeToMarkdown(node.childNodes[j], depth);
        }
        return childMd;

      case "span": {
        return inlineChildrenToMd(node);
      }

      default:
        // Fallback: return text content
        return innerText;
    }
  }

  function inlineChildrenToMd(node) {
    var result = "";
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent || "";
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        result += nodeToMarkdown(child, 0);
      }
    }
    return result;
  }

  function blockChildrenToMd(node) {
    var result = "";
    for (var i = 0; i < node.childNodes.length; i++) {
      result += nodeToMarkdown(node.childNodes[i], 0);
    }
    return result.trim();
  }

  function listToMarkdown(listNode, type, depth) {
    var result = "";
    var items = listNode.children;
    var indent = "  ".repeat(depth);

    for (var i = 0; i < items.length; i++) {
      var li = items[i];
      if (li.tagName.toLowerCase() !== "li") continue;

      var prefix;
      if (type === "ol") {
        prefix = (i + 1) + ". ";
      } else {
        // Check for task list item
        var checkbox = li.querySelector("input[type='checkbox']");
        if (checkbox) {
          prefix = checkbox.checked ? "- [x] " : "- [ ] ";
        } else {
          prefix = "- ";
        }
      }

      // Get text content (excluding nested lists)
      var textContent = "";
      var nestedList = "";

      for (var j = 0; j < li.childNodes.length; j++) {
        var child = li.childNodes[j];
        if (child.nodeType === Node.ELEMENT_NODE) {
          var childTag = child.tagName.toLowerCase();
          if (childTag === "ul" || childTag === "ol") {
            nestedList += listToMarkdown(child, childTag, depth + 1);
          } else if (childTag === "input" && child.type === "checkbox") {
            // Skip, already handled by prefix
          } else {
            textContent += nodeToMarkdown(child, depth);
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          textContent += child.textContent || "";
        }
      }

      result += indent + prefix + textContent.trim() + "\n";
      if (nestedList) {
        result += nestedList;
      }
    }

    return result;
  }

  function tableToMarkdown(tableNode) {
    var rows = tableNode.querySelectorAll("tr");
    if (rows.length === 0) return "";

    var result = "";
    var colCount = 0;

    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].querySelectorAll("th, td");
      if (i === 0) colCount = cells.length;

      var row = "|";
      for (var j = 0; j < cells.length; j++) {
        row += " " + (cells[j].textContent || "").trim() + " |";
      }
      result += row + "\n";

      // Add separator after header row
      if (i === 0) {
        var sep = "|";
        for (var k = 0; k < colCount; k++) {
          sep += " --- |";
        }
        result += sep + "\n";
      }
    }

    return result;
  }

  // ─── Helper Functions ───

  function findBlockParent(node) {
    var blockTags = [
      "P", "H1", "H2", "H3", "H4", "H5", "H6",
      "LI", "BLOCKQUOTE", "PRE", "DIV", "TABLE",
      "UL", "OL", "HR", "DETAILS",
    ];

    var current = node;
    while (current && current !== content) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        blockTags.indexOf(current.tagName) !== -1
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function triggerEditDebounce() {
    if (editDebounceTimer) {
      clearTimeout(editDebounceTimer);
    }
    editDebounceTimer = setTimeout(function () {
      var markdown = htmlToMarkdown(content);
      if (markdown !== currentMarkdown) {
        currentMarkdown = markdown;
        isUpdatingFromWebview = true;
        vscode.postMessage({ type: "edit", markdown: markdown });
        setTimeout(function() { isUpdatingFromWebview = false; }, 600);
      }
    }, 150);
  }

  function getCaretCharacterOffset(element) {
    var caretOffset = 0;
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      var range = sel.getRangeAt(0);
      var preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
  }

  function restoreCaretPosition(element, offset) {
    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    var currentOffset = 0;
    var node;

    while ((node = walker.nextNode())) {
      var nodeLen = (node.textContent || "").length;
      if (currentOffset + nodeLen >= offset) {
        var sel = window.getSelection();
        if (sel) {
          var range = document.createRange();
          range.setStart(node, Math.min(offset - currentOffset, nodeLen));
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        return;
      }
      currentOffset += nodeLen;
    }
  }

  function replacePlaceholderText(root, placeholder, replacement) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var idx = (node.textContent || "").indexOf(placeholder);
      if (idx !== -1) {
        var text = node.textContent || "";
        node.textContent = text.substring(0, idx) + replacement + text.substring(idx + placeholder.length);
        return true;
      }
    }
    return false;
  }

  function setSyncStatusDisplay(status) {
    syncStatus.className = status;
    switch (status) {
      case "synced":
        syncStatus.textContent = "Synced";
        break;
      case "syncing":
        syncStatus.textContent = "Syncing...";
        break;
      case "conflict":
        syncStatus.textContent = "Conflict";
        break;
      case "error":
        syncStatus.textContent = "Sync Error";
        break;
      default:
        syncStatus.textContent = "Ready";
        syncStatus.className = "";
    }
  }

  // ─── Non-Editable Islands + Spacers ───

  function setupNonEditableIslands(root) {
    // Mark special blocks as non-editable
    var nonEditableSelectors = 'pre, .mermaid, table, img, .katex-display, .ascii-diagram';
    root.querySelectorAll(nonEditableSelectors).forEach(function(el) {
      // Don't mark if it's inside another non-editable or is a spacer
      if (el.closest('[contenteditable="false"]') && el.closest('[contenteditable="false"]') !== el) return;
      el.setAttribute('contenteditable', 'false');
    });

    // Insert spacers before/after non-editable blocks for cursor placement
    root.querySelectorAll(nonEditableSelectors).forEach(function(el) {
      // Only add spacers for top-level non-editable blocks (direct children of content)
      var parent = el.parentNode;
      // For img inside p, skip (the p is editable)
      if (el.tagName === 'IMG' && parent && parent.tagName === 'P') return;

      // Spacer before
      var prev = el.previousElementSibling;
      if (!prev || !prev.classList.contains('ce-spacer')) {
        var spacerBefore = document.createElement('p');
        spacerBefore.className = 'ce-spacer';
        spacerBefore.innerHTML = '<br>';
        spacerBefore.setAttribute('contenteditable', 'true');
        parent.insertBefore(spacerBefore, el);
      }

      // Spacer after
      var next = el.nextElementSibling;
      if (!next || !next.classList.contains('ce-spacer')) {
        var spacerAfter = document.createElement('p');
        spacerAfter.className = 'ce-spacer';
        spacerAfter.innerHTML = '<br>';
        spacerAfter.setAttribute('contenteditable', 'true');
        if (el.nextSibling) {
          parent.insertBefore(spacerAfter, el.nextSibling);
        } else {
          parent.appendChild(spacerAfter);
        }
      }
    });

    // Suppress browser controls
    try {
      document.execCommand('enableObjectResizing', false, 'false');
      document.execCommand('enableInlineTableEditing', false, 'false');
    } catch(e) {}

    // MutationObserver to remove Chrome's injected table/image controls
    if (!root._ceObserver) {
      root._ceObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
          m.addedNodes.forEach(function(node) {
            if (node.nodeType === 1 && node.id && (
              node.id.startsWith('_moz_') ||
              node.dataset && node.dataset.mceObject
            )) {
              node.remove();
            }
          });
        });
      });
      root._ceObserver.observe(root, { childList: true, subtree: true });
    }
  }

  // Run on initial content
  setupNonEditableIslands(content);

  // ─── Floating Selection Toolbar ───

  var selToolbar = document.getElementById('selection-toolbar');

  function showSelectionToolbar() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      hideSelectionToolbar();
      return;
    }

    var text = sel.toString().trim();
    if (!text || text.length < 1) {
      hideSelectionToolbar();
      return;
    }

    // Don't show if selection is inside source editor or non-editable block
    var range = sel.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) {
      hideSelectionToolbar();
      return;
    }
    // Don't show inside code blocks, mermaid, math
    var ancestor = range.commonAncestorContainer;
    var node = ancestor.nodeType === 3 ? ancestor.parentElement : ancestor;
    if (node && (node.closest('pre') || node.closest('.mermaid') || node.closest('.katex-display'))) {
      hideSelectionToolbar();
      return;
    }

    var rect = range.getBoundingClientRect();
    if (!selToolbar) return;

    // Update active formatting state
    updateSelToolbarState();

    selToolbar.classList.add('visible');
    var tbRect = selToolbar.getBoundingClientRect();
    var left = rect.left + (rect.width / 2) - (tbRect.width / 2);
    var top = rect.top - tbRect.height - 8;

    // Keep within viewport
    if (left < 8) left = 8;
    if (left + tbRect.width > window.innerWidth - 8) left = window.innerWidth - tbRect.width - 8;
    if (top < 8) top = rect.bottom + 8;

    selToolbar.style.left = left + 'px';
    selToolbar.style.top = top + 'px';
  }

  function updateSelToolbarState() {
    if (!selToolbar) return;

    // Detect current block type and inline state
    var sel = window.getSelection();
    var blockType = '';
    var inCode = false;
    var inUl = false;
    var inOl = false;

    if (sel && sel.rangeCount) {
      var node = sel.getRangeAt(0).commonAncestorContainer;
      var el = node.nodeType === 3 ? node.parentElement : node;
      if (el) {
        inCode = !!el.closest('code');
        inUl = !!el.closest('ul:not(.contains-task-list)');
        inOl = !!el.closest('ol');
        // Find nearest block parent
        var block = el.closest('h1,h2,h3,h4,h5,h6,p,blockquote,li');
        if (block) blockType = block.tagName.toLowerCase();
        if (block && block.tagName === 'LI') {
          // Check parent list type
          var parentList = block.closest('ul,ol');
          if (parentList) blockType = parentList.tagName.toLowerCase() === 'ul' ? 'ul' : 'ol';
        }
      }
    }

    selToolbar.querySelectorAll('button[data-action]').forEach(function(btn) {
      var isActive = false;
      var fmtAttr = btn.getAttribute('data-fmt');
      var blockAttr = btn.getAttribute('data-block');

      if (blockAttr) {
        isActive = blockType === blockAttr;
      } else if (fmtAttr) {
        try {
          switch (fmtAttr) {
            case 'bold': isActive = document.queryCommandState('bold'); break;
            case 'italic': isActive = document.queryCommandState('italic'); break;
            case 'strikethrough': isActive = document.queryCommandState('strikeThrough'); break;
            case 'code': isActive = inCode; break;
            case 'ul': isActive = inUl; break;
            case 'ol': isActive = inOl; break;
          }
        } catch(e) {}
      }

      btn.classList.toggle('sel-active', isActive);
    });
  }

  function hideSelectionToolbar() {
    if (selToolbar) selToolbar.classList.remove('visible');
  }

  document.addEventListener('selectionchange', function() {
    showSelectionToolbar();
  });

  if (selToolbar) {
    selToolbar.addEventListener('mousedown', function(e) {
      e.preventDefault(); // prevent losing selection
    });

    selToolbar.addEventListener('click', function(e) {
      var button = e.target.closest('button');
      if (!button) return;
      var action = button.getAttribute('data-action');
      if (!action) return;
      e.preventDefault();

      // Route to same handlers as the main toolbar
      switch (action) {
        case 'undo': document.execCommand('undo', false, null); triggerEditDebounce(); break;
        case 'redo': document.execCommand('redo', false, null); triggerEditDebounce(); break;
        case 'bold': applyInlineFormat('bold'); break;
        case 'italic': applyInlineFormat('italic'); break;
        case 'strikethrough': applyInlineFormat('strikethrough'); break;
        case 'code': applyInlineFormat('code'); break;
        case 'h1': applyBlockFormat('h1'); break;
        case 'h2': applyBlockFormat('h2'); break;
        case 'h3': applyBlockFormat('h3'); break;
        case 'h4': applyBlockFormat('h4'); break;
        case 'p': applyBlockFormat('p'); break;
        case 'ul': applyBlockFormat('ul'); break;
        case 'ol': applyBlockFormat('ol'); break;
        case 'indent': applyIndent(); break;
        case 'outdent': applyOutdent(); break;
        case 'blockquote': applyBlockFormat('blockquote'); break;
        case 'hr': insertHorizontalRule(); break;
        case 'link': insertLink(); break;
        case 'image': vscode.postMessage({ type: 'requestImageUrl' }); break;
        case 'table': showTableGridSelector(e.target.closest('button')); break;
        case 'removeFormat': removeFormatting(); break;
      }
      hideSelectionToolbar();
    });
  }

  // ─── Code Block Language Tag + Copy Button ───

  function postProcessCodeBlocks(root) {
    root.querySelectorAll('pre[lang]').forEach(function(pre) {
      if (pre.querySelector('.code-header')) return; // already processed
      var lang = pre.getAttribute('lang');
      if (lang === 'mermaid') return; // handled separately

      var header = document.createElement('div');
      header.className = 'code-header';

      var langLabel = document.createElement('span');
      langLabel.className = 'code-lang';
      langLabel.textContent = lang;
      header.appendChild(langLabel);

      var copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M6 10H4.5A1.5 1.5 0 013 8.5v-5A1.5 1.5 0 014.5 2h5A1.5 1.5 0 0111 3.5V6"/></svg> Copy';
      copyBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var code = pre.querySelector('code');
        var text = code ? code.textContent : pre.textContent;
        navigator.clipboard.writeText(text || '').then(function() {
          copyBtn.innerHTML = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(function() {
            copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M6 10H4.5A1.5 1.5 0 013 8.5v-5A1.5 1.5 0 014.5 2h5A1.5 1.5 0 0111 3.5V6"/></svg> Copy';
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
      header.appendChild(copyBtn);

      pre.insertBefore(header, pre.firstChild);
    });
  }

  // Run on initial content
  postProcessCodeBlocks(content);

  // ─── Mermaid Edit Buttons ───

  function postProcessMermaid() {
    if (typeof mermaid === 'undefined') return;

    // Convert pre[lang="mermaid"] to .mermaid divs, preserving original code
    content.querySelectorAll('pre[lang="mermaid"] code, code.language-mermaid').forEach(function(el) {
      var container = document.createElement('div');
      container.className = 'mermaid';
      var originalCode = el.textContent || '';
      container.setAttribute('data-original-code', originalCode);
      container.textContent = originalCode;
      var pre = el.closest('pre');
      if (pre) pre.replaceWith(container);
    });

    mermaid.run().then(function() {
      addMermaidEditButtons();
    }).catch(function() {
      // Even if mermaid fails, still try to add buttons
      addMermaidEditButtons();
    });
  }

  function addMermaidEditButtons() {
    content.querySelectorAll('.mermaid').forEach(function(el, idx) {
      // Skip if already has edit button
      if (el.querySelector('.mermaid-edit-btn')) return;

      var editBtn = document.createElement('button');
      editBtn.className = 'mermaid-edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('data-mermaid-idx', String(idx));
      editBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        vscode.postMessage({
          type: 'editMermaid',
          code: el.getAttribute('data-original-code') || '',
          index: idx
        });
      });
      el.style.position = 'relative';
      el.appendChild(editBtn);
    });
  }

  // Add edit buttons on initial load (inline script already ran mermaid.run())
  setTimeout(function() {
    addMermaidEditButtons();
  }, 500);

  // ─── ASCII Art Detection + AI Render Button ───

  function isAsciiArt(text) {
    // Box-drawing characters or mermaid-like syntax
    var boxChars = /[┌┐└┘├┤┬┴┼─│╔╗╚╝║═╟╢╤╧╪▼▶◀▲►◄●○■□]/;
    var mermaidKw = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|gitGraph)\b/m;
    if (mermaidKw.test(text)) return false; // mermaid handled separately
    if (boxChars.test(text)) return true;
    // Arrow patterns like --> or -> with multiple lines
    var lines = text.split('\n').filter(function(l) { return l.trim(); });
    if (lines.length < 3) return false;
    var arrowLines = lines.filter(function(l) { return /[─\-=]{2,}|[│|]{1}|[+*].*[+*]/.test(l); });
    return arrowLines.length >= 2;
  }

  function postProcessAsciiBlocks(root) {
    root.querySelectorAll('pre[lang]').forEach(function(pre) {
      if (pre.querySelector('.ascii-render-btn')) return;
      var lang = pre.getAttribute('lang');
      if (lang === 'mermaid') return;
      var code = pre.querySelector('code');
      if (!code) return;
      var text = code.textContent || '';
      if (!isAsciiArt(text)) return;

      var btn = document.createElement('button');
      btn.className = 'ascii-render-btn';
      btn.textContent = 'Convert to Mermaid';
      btn.title = 'Convert this ASCII diagram to Mermaid using AI';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        vscode.postMessage({ type: 'asciiRender', code: text });
      });
      var header = pre.querySelector('.code-header');
      if (header) {
        // Insert before copy button (rightmost), so render is left of copy
        var copyBtn = header.querySelector('.code-copy-btn');
        if (copyBtn) {
          header.insertBefore(btn, copyBtn);
        } else {
          header.appendChild(btn);
        }
      } else {
        pre.style.position = 'relative';
        btn.style.position = 'absolute';
        btn.style.top = '6px';
        btn.style.right = '6px';
        pre.appendChild(btn);
      }
    });
  }

  // Run on initial + updates
  postProcessAsciiBlocks(content);

  // ─── Code Block Inline Editing (double-click) ───

  content.addEventListener('dblclick', function(e) {
    var pre = e.target.closest('pre[lang]');
    if (!pre) return;
    var lang = pre.getAttribute('lang');
    if (lang === 'mermaid') return; // mermaid has its own handler

    var codeEl = pre.querySelector('code');
    if (!codeEl) return;

    // Find the index of this code block among non-mermaid code blocks
    // (must match preview.ts handleCodeBlockEdit which skips mermaid)
    var allPres = content.querySelectorAll('pre[lang]');
    var blockIndex = -1;
    var nonMermaidCount = 0;
    for (var i = 0; i < allPres.length; i++) {
      if (allPres[i].getAttribute('lang') === 'mermaid') continue;
      if (allPres[i] === pre) { blockIndex = nonMermaidCount; break; }
      nonMermaidCount++;
    }

    e.stopPropagation();
    e.preventDefault();

    vscode.postMessage({
      type: 'editCodeBlock',
      code: codeEl.textContent || '',
      lang: lang,
      index: blockIndex
    });
  });

  // ─── Table Inline Editing ───

  content.addEventListener('dblclick', function(e) {
    var td = e.target.closest('td, th');
    if (!td) return;
    if (td.getAttribute('contenteditable') === 'true') return;

    e.stopPropagation();
    td.setAttribute('contenteditable', 'true');
    td.classList.add('table-cell-editing');
    td.focus();

    // Select all text in the cell
    var range = document.createRange();
    range.selectNodeContents(td);
    var sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    td.addEventListener('blur', function onBlur() {
      td.removeAttribute('contenteditable');
      td.classList.remove('table-cell-editing');
      td.removeEventListener('blur', onBlur);
      triggerEditDebounce();
    });

    td.addEventListener('keydown', function onKey(ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        td.blur();
      }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        td.blur();
      }
      if (ev.key === 'Tab') {
        ev.preventDefault();
        td.blur();
        var next = ev.shiftKey ? td.previousElementSibling : td.nextElementSibling;
        if (next && (next.tagName === 'TD' || next.tagName === 'TH')) {
          next.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      }
    });
  });

  // ─── Table Context Menu ───

  content.addEventListener('contextmenu', function(e) {
    var td = e.target.closest('td, th');
    if (!td) {
      hideTableContextMenu();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    showTableContextMenu(e.clientX, e.clientY, td);
  });

  function showTableContextMenu(x, y, td) {
    hideTableContextMenu();

    var menu = document.createElement('div');
    menu.id = 'table-context-menu';
    menu.className = 'table-context-menu';

    var items = [
      { label: 'Add Row Above', action: 'addRowAbove' },
      { label: 'Add Row Below', action: 'addRowBelow' },
      { label: 'Add Column Left', action: 'addColLeft' },
      { label: 'Add Column Right', action: 'addColRight' },
      { label: '---' },
      { label: 'Delete Row', action: 'deleteRow' },
      { label: 'Delete Column', action: 'deleteCol' },
    ];

    items.forEach(function(item) {
      if (item.label === '---') {
        var sep = document.createElement('div');
        sep.className = 'table-ctx-separator';
        menu.appendChild(sep);
        return;
      }

      var btn = document.createElement('button');
      btn.className = 'table-ctx-item';
      btn.textContent = item.label;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        handleTableAction(item.action, td);
        hideTableContextMenu();
      });
      menu.appendChild(btn);
    });

    // Position the menu
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);
    tableContextMenu = menu;

    // Adjust if off-screen
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (y - rect.height) + 'px';
    }

    // Close on click outside
    setTimeout(function() {
      document.addEventListener('click', hideTableContextMenu, { once: true });
    }, 0);
  }

  function hideTableContextMenu() {
    if (tableContextMenu) {
      tableContextMenu.remove();
      tableContextMenu = null;
    }
  }

  function handleTableAction(action, td) {
    var tr = td.closest('tr');
    var table = td.closest('table');
    if (!tr || !table) return;

    var cellIndex = Array.prototype.indexOf.call(tr.children, td);
    var allRows = table.querySelectorAll('tr');
    var colCount = allRows.length > 0 ? allRows[0].children.length : 0;

    switch (action) {
      case 'addRowAbove':
      case 'addRowBelow': {
        var newRow = document.createElement('tr');
        for (var c = 0; c < colCount; c++) {
          var newTd = document.createElement('td');
          newTd.textContent = '';
          newRow.appendChild(newTd);
        }
        if (action === 'addRowAbove') {
          tr.parentNode.insertBefore(newRow, tr);
        } else {
          tr.parentNode.insertBefore(newRow, tr.nextSibling);
        }
        break;
      }
      case 'addColLeft':
      case 'addColRight': {
        allRows.forEach(function(row) {
          var isHeader = row.children[0] && row.children[0].tagName === 'TH';
          var newCell = document.createElement(isHeader ? 'th' : 'td');
          newCell.textContent = isHeader ? 'Header' : '';
          var refCell = row.children[cellIndex];
          if (action === 'addColLeft' && refCell) {
            row.insertBefore(newCell, refCell);
          } else if (refCell) {
            row.insertBefore(newCell, refCell.nextSibling);
          } else {
            row.appendChild(newCell);
          }
        });
        break;
      }
      case 'deleteRow': {
        // Don't delete the header row (first row)
        var rowIndex = Array.prototype.indexOf.call(allRows, tr);
        if (rowIndex === 0) {
          // Can't delete header
          return;
        }
        if (allRows.length <= 2) {
          // Need at least header + 1 row
          return;
        }
        tr.remove();
        break;
      }
      case 'deleteCol': {
        if (colCount <= 1) return; // Need at least 1 column
        allRows.forEach(function(row) {
          var cell = row.children[cellIndex];
          if (cell) cell.remove();
        });
        break;
      }
    }

    triggerEditDebounce();
  }

  // ─── Flavor Badge & Dropdown ───

  function updateFlavorBadge(flavor) {
    if (!flavorBadge) return;
    var names = {
      gfm: 'GFM',
      commonmark: 'CommonMark',
      obsidian: 'Obsidian',
      mdx: 'MDX',
      pandoc: 'Pandoc'
    };
    flavorBadge.textContent = (names[flavor] || flavor.toUpperCase()) + ' \u25BE';

    // Hide the current flavor from dropdown options
    if (flavorDropdown) {
      flavorDropdown.querySelectorAll('.flavor-option').forEach(function(opt) {
        if (opt.getAttribute('data-flavor') === flavor) {
          opt.style.display = 'none';
        } else {
          opt.style.display = '';
        }
      });
    }
  }

  if (flavorBadge) {
    flavorBadge.addEventListener('click', function(e) {
      e.stopPropagation();
      if (flavorDropdown) {
        flavorDropdown.classList.toggle('hidden');
      }
    });
  }

  if (flavorDropdown) {
    flavorDropdown.querySelectorAll('.flavor-option').forEach(function(opt) {
      opt.addEventListener('click', function(e) {
        e.stopPropagation();
        var target = opt.getAttribute('data-flavor');
        if (target) {
          vscode.postMessage({ type: 'convertFlavor', target: target });
        }
        flavorDropdown.classList.add('hidden');
      });
    });
  }

  // Close flavor dropdown on click outside
  document.addEventListener('click', function() {
    if (flavorDropdown) {
      flavorDropdown.classList.add('hidden');
    }
    hideTableContextMenu();
  });

  // Initialize flavor badge with detected flavor
  updateFlavorBadge(currentFlavor);

  // ─── Custom Tooltips (instant, like Memory.Wiki) ───

  var tooltipEl = null;
  var tooltipTimer = null;

  function createTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'mdfy-tooltip';
    document.body.appendChild(tooltipEl);
  }

  function showTooltip(target) {
    var text = target.getAttribute('title') || target.getAttribute('data-tooltip');
    if (!text) return;
    // Store and remove native title to prevent double tooltip
    if (target.getAttribute('title')) {
      target.setAttribute('data-tooltip', text);
      target.removeAttribute('title');
    }
    createTooltip();
    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');

    var rect = target.getBoundingClientRect();
    var tipRect = tooltipEl.getBoundingClientRect();
    var left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    var top = rect.top - tipRect.height - 6;

    // If tooltip would go above viewport, show below
    if (top < 4) top = rect.bottom + 6;
    // Keep within viewport horizontally
    if (left < 4) left = 4;
    if (left + tipRect.width > window.innerWidth - 4) left = window.innerWidth - tipRect.width - 4;

    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  // Attach to all buttons with title attributes
  document.addEventListener('mouseover', function(e) {
    var btn = e.target.closest('button[title], button[data-tooltip]');
    if (btn) {
      if (tooltipTimer) clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(function() { showTooltip(btn); }, 50);
    }
  });

  document.addEventListener('mouseout', function(e) {
    var btn = e.target.closest('button[title], button[data-tooltip]');
    if (btn) {
      if (tooltipTimer) clearTimeout(tooltipTimer);
      hideTooltip();
    }
  });

  document.addEventListener('mousedown', function() {
    hideTooltip();
  });

  // ─── AI Panel ───

  var aiPanel = document.getElementById('ai-panel');
  var aiToggle = document.getElementById('btn-toggle-ai');
  var aiPanelClose = document.getElementById('ai-panel-close');
  var aiChatHistory = document.getElementById('ai-chat-history');
  var aiChatInput = document.getElementById('ai-chat-input');
  var aiChatSend = document.getElementById('ai-chat-send');
  var aiUndoBtn = document.getElementById('ai-undo-btn');
  var aiPanelOpen = false;
  var aiPrevMarkdown = null;

  function toggleAiPanel() {
    if (aiPanelOpen) {
      aiPanelOpen = false;
      if (aiPanel) aiPanel.classList.add('hidden');
      if (aiToggle) aiToggle.classList.remove('active');
    } else {
      // Close other panels first
      if (outlinePanelOpen) {
        outlinePanelOpen = false;
        if (outlinePanel) outlinePanel.classList.add('hidden');
        if (outlineToggle) outlineToggle.classList.remove('active');
      }
      var _imgPanel = document.getElementById('image-panel');
      var _imgToggle = document.getElementById('btn-toggle-images');
      if (_imgPanel && _imgPanel.style.display !== 'none') {
        _imgPanel.style.display = 'none';
        if (_imgToggle) _imgToggle.classList.remove('active');
      }
      aiPanelOpen = true;
      if (aiPanel) aiPanel.classList.remove('hidden');
      if (aiToggle) aiToggle.classList.add('active');
    }
  }

  if (aiToggle) aiToggle.addEventListener('click', toggleAiPanel);
  if (aiPanelClose) aiPanelClose.addEventListener('click', toggleAiPanel);

  // AI action buttons
  if (aiPanel) {
    aiPanel.querySelectorAll('.ai-action-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = btn.getAttribute('data-ai-action');
        if (!action) return;

        if (action === 'translate') {
          showAiTranslateMenu(btn);
          return;
        }

        aiPrevMarkdown = currentMarkdown;
        if (aiUndoBtn) aiUndoBtn.style.display = '';
        addAiChatMessage('user', action.charAt(0).toUpperCase() + action.slice(1));
        vscode.postMessage({ type: 'aiAction', action: action, markdown: currentMarkdown });
      });
    });
  }

  function showAiTranslateMenu(anchorBtn) {
    var existing = document.getElementById('ai-translate-dropdown');
    if (existing) { existing.remove(); return; }

    var languages = [
      { code: 'en', label: 'English' }, { code: 'ko', label: 'Korean' },
      { code: 'ja', label: 'Japanese' }, { code: 'zh', label: 'Chinese' },
      { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
      { code: 'de', label: 'German' }, { code: 'pt', label: 'Portuguese' }
    ];

    var rect = anchorBtn.getBoundingClientRect();
    var menu = document.createElement('div');
    menu.id = 'ai-translate-dropdown';
    menu.className = 'ai-translate-dropdown';
    menu.style.position = 'fixed';
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = rect.left + 'px';

    languages.forEach(function(lang) {
      var item = document.createElement('button');
      item.className = 'ai-translate-item';
      item.textContent = lang.label;
      item.addEventListener('click', function() {
        menu.remove();
        aiPrevMarkdown = currentMarkdown;
        if (aiUndoBtn) aiUndoBtn.style.display = '';
        addAiChatMessage('user', 'Translate to ' + lang.label);
        vscode.postMessage({ type: 'aiAction', action: 'translate', language: lang.code, markdown: currentMarkdown });
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    setTimeout(function() {
      document.addEventListener('click', function dismiss() {
        var m = document.getElementById('ai-translate-dropdown');
        if (m) m.remove();
        document.removeEventListener('click', dismiss);
      });
    }, 0);
  }

  // AI chat input
  function sendAiChat() {
    if (!aiChatInput) return;
    var instruction = aiChatInput.value.trim();
    if (!instruction) return;
    aiChatInput.value = '';
    aiPrevMarkdown = currentMarkdown;
    if (aiUndoBtn) aiUndoBtn.style.display = '';
    addAiChatMessage('user', instruction);
    vscode.postMessage({ type: 'aiAction', action: 'chat', instruction: instruction, markdown: currentMarkdown });
  }

  if (aiChatSend) aiChatSend.addEventListener('click', sendAiChat);
  if (aiChatInput) {
    aiChatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendAiChat();
      }
    });
  }

  // AI undo
  if (aiUndoBtn) {
    aiUndoBtn.addEventListener('click', function() {
      if (aiPrevMarkdown !== null) {
        vscode.postMessage({ type: 'edit', markdown: aiPrevMarkdown });
        currentMarkdown = aiPrevMarkdown;
        aiPrevMarkdown = null;
        aiUndoBtn.style.display = 'none';
        addAiChatMessage('system', 'Reverted to previous version.');
      }
    });
  }

  function addAiChatMessage(role, text) {
    if (!aiChatHistory) return;
    var msg = document.createElement('div');
    msg.className = 'ai-chat-msg ai-chat-' + role;
    msg.textContent = text;
    aiChatHistory.appendChild(msg);
    aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
  }

  // Listen for AI results
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (msg.type === 'aiLoading') {
      if (aiPanel) {
        var spinner = aiPanel.querySelector('.ai-loading-indicator');
        if (msg.loading) {
          if (!spinner) {
            spinner = document.createElement('div');
            spinner.className = 'ai-loading-indicator';
            spinner.innerHTML = '<div class="ai-spinner"></div><span>Processing...</span>';
            aiChatHistory.appendChild(spinner);
            aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
          }
        } else {
          if (spinner) spinner.remove();
        }
      }
    }
    if (msg.type === 'aiResult') {
      // Remove loading indicator
      if (aiChatHistory) {
        var sp = aiChatHistory.querySelector('.ai-loading-indicator');
        if (sp) sp.remove();
      }

      if (msg.error) {
        addAiChatMessage('error', msg.error);
      } else if (msg.result) {
        if (msg.isAnswer) {
          addAiChatMessage('ai', msg.result);
        } else {
          var label = msg.action ? msg.action.charAt(0).toUpperCase() + msg.action.slice(1) : 'AI';
          addAiChatMessage('ai', label + ' applied successfully.');
          // Trigger diff highlight after content updates
          setTimeout(function() {
            highlightChangedBlocks(prevMarkdownForDiff, currentMarkdown);
            prevMarkdownForDiff = currentMarkdown;
          }, 500);
        }
      }
    }
  });

  // ─── Diff Highlight ───
  var prevMarkdownForDiff = currentMarkdown;

  function highlightChangedBlocks(oldMd, newMd) {
    if (oldMd === newMd || !content) return;
    setTimeout(function() {
      var blocks = content.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table');
      blocks.forEach(function(el) {
        var text = (el.textContent || '').trim();
        if (text.length < 5) return;
        var snippet = text.substring(0, Math.min(text.length, 60));
        if (!oldMd.includes(snippet)) {
          el.style.transition = 'background 1.5s ease-out';
          el.style.background = 'rgba(251, 146, 60, 0.12)';
          el.style.borderRadius = '4px';
          setTimeout(function() { el.style.background = ''; }, 3000);
        }
      });
    }, 300);
  }

  // ─── Outline Panel ───

  var outlinePanel = document.getElementById('outline-panel');
  var outlinePanelBody = document.getElementById('outline-panel-body');
  var outlineToggle = document.getElementById('btn-toggle-outline');
  var outlineClose = document.getElementById('btn-close-outline');
  var outlinePanelOpen = true; // open by default

  function toggleOutlinePanel() {
    outlinePanelOpen = !outlinePanelOpen;
    if (outlinePanel) {
      outlinePanel.classList.toggle('hidden', !outlinePanelOpen);
    }
    if (outlineToggle) {
      outlineToggle.classList.toggle('active', outlinePanelOpen);
    }
    // Close image panel and AI panel when opening outline
    if (outlinePanelOpen) {
      var _ip = document.getElementById('image-panel');
      var _it = document.getElementById('btn-toggle-images');
      if (_ip && _ip.style.display !== 'none') {
        _ip.style.display = 'none';
        if (_it) _it.classList.remove('active');
      }
      if (aiPanelOpen) {
        aiPanelOpen = false;
        if (aiPanel) aiPanel.classList.add('hidden');
        if (aiToggle) aiToggle.classList.remove('active');
      }
    }
    if (outlinePanelOpen) {
      updateOutlinePanel();
    }
  }

  if (outlineToggle) {
    outlineToggle.addEventListener('click', toggleOutlinePanel);
  }
  if (outlineClose) {
    outlineClose.addEventListener('click', toggleOutlinePanel);
  }

  function updateOutlinePanel() {
    if (!outlinePanelBody || !outlinePanelOpen) return;

    var headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
      outlinePanelBody.innerHTML = '<div class="outline-empty">No headings</div>';
      return;
    }

    var html = '';
    headings.forEach(function(heading, idx) {
      var level = parseInt(heading.tagName.charAt(1));
      var text = heading.textContent || '';
      // Assign an id for scrolling
      if (!heading.id) {
        heading.id = 'outline-heading-' + idx;
      }
      html += '<button class="outline-item" data-level="' + level + '" data-target="' + heading.id + '" title="' + text.replace(/"/g, '&quot;') + '">' + text + '</button>';
    });

    outlinePanelBody.innerHTML = html;

    // Click handlers
    outlinePanelBody.querySelectorAll('.outline-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetId = btn.getAttribute('data-target');
        var target = document.getElementById(targetId);
        if (target) {
          var scrollContainer = document.getElementById('content-scroll');
          if (scrollContainer) {
            var containerRect = scrollContainer.getBoundingClientRect();
            var targetRect = target.getBoundingClientRect();
            var scrollTop = scrollContainer.scrollTop + targetRect.top - containerRect.top - 20;
            scrollContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
          } else {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          // Highlight animation
          target.classList.remove('outline-heading-highlight');
          void target.offsetWidth; // force reflow
          target.classList.add('outline-heading-highlight');
          setTimeout(function() { target.classList.remove('outline-heading-highlight'); }, 1500);
        }
      });
    });
  }

  // Update outline when content is updated
  var origMessageHandler = null;
  window.addEventListener('message', function(event) {
    if (event.data.type === 'update') {
      // Defer outline update to after content is rendered
      setTimeout(updateOutlinePanel, 50);
    }
  });

  // Initial outline render
  setTimeout(updateOutlinePanel, 200);

  // ─── Initialize ───

  // Preserve VS Code state
  var state = vscode.getState();
  if (state && state.markdown) {
    currentMarkdown = state.markdown;
  }

  // Save state periodically
  setInterval(function () {
    vscode.setState({ markdown: currentMarkdown });
  }, 5000);

})();
