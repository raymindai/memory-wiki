/* =========================================================
   memory.wiki for Mac — Unified Editor + Sidebar
   Architecture mirrors VS Code extension:
   - Left sidebar: file list (ALL/SYNCED/LOCAL/CLOUD)
   - Right: WYSIWYG editor with toolbar
   - Sync status, auth state, workspace scanning
   ========================================================= */

(function () {
  "use strict";

  // ─── DOM References ───

  var content = document.getElementById("content");
  var toolbar = document.getElementById("toolbar");
  var welcome = document.getElementById("welcome");
  var homeScreen = document.getElementById("home-screen");
  var splitContainer = document.getElementById("split-container");
  var renderPane = document.getElementById("render-pane");
  var editorPane = document.getElementById("editor-pane");
  var flavorBadge = document.getElementById("flavor-badge");
  var flavorDropdown = document.getElementById("flavor-dropdown");
  var headerTitle = document.getElementById("header-title");
  var headerSync = document.getElementById("header-sync");
  var tableContextMenu = null;

  // ─── State ───

  var currentMarkdown = "";
  var currentFlavor = "gfm";
  var currentFilePath = null;
  var currentConfig = null;
  var editDebounceTimer = null;
  var isDirty = false;
  var isRendering = false;
  var hasDocument = false;
  var currentFilter = "all";
  var searchQuery = "";
  var cloudSearchResults = [];
  var cloudSearchTimer = null;
  var isCloudSearching = false;
  var sortMode = "newest"; // newest, oldest, az, za
  var isReadOnly = false;
  var currentCloudDoc = null; // { docId, title } when previewing cloud doc
  var isCollaborating = false;
  var collabPeerCount = 0;
  var isApplyingRemoteCollab = false;

  // ─── Theme ───

  (function initTheme() {
    if (window.mdfyDesktop) {
      window.mdfyDesktop.getTheme().then(function(theme) {
        document.documentElement.setAttribute("data-theme", theme);
      });
    }
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: light)");
      if (mq.matches) document.documentElement.setAttribute("data-theme", "light");
      mq.addEventListener("change", function(e) {
        document.documentElement.setAttribute("data-theme", e.matches ? "light" : "dark");
      });
    }
  })();

  if (window.mdfyDesktop && window.mdfyDesktop.onThemeChanged) {
    window.mdfyDesktop.onThemeChanged(function(theme) {
      document.documentElement.setAttribute("data-theme", theme);
    });
  }

  // ════════════════════════════════════════════════════════
  //  SIDEBAR
  // ════════════════════════════════════════════════════════

  var sidebarState = {
    workspaceFiles: [],
    workspaceFolders: [],
    recentFiles: [],
    cloudDocs: [],
    cloudFolders: [],
    authState: { loggedIn: false, email: null },
  };
  var collapsedFolders = {}; // { relativePath: true/false }
  var collapsedCloudFolders = {}; // { folderId: true/false }

  // ─── Sidebar: Init ───

  async function initSidebar() {
    await refreshSidebarData();
    renderSidebar();

    // Welcome buttons
    var welcomeNew = document.getElementById("welcome-new");
    var welcomeOpen = document.getElementById("welcome-open");
    var welcomeFolder = document.getElementById("welcome-folder");
    var welcomePaste = document.getElementById("welcome-paste");

    if (welcomeNew) welcomeNew.addEventListener("click", function() { window.mdfyDesktop.newDocument(); });
    if (welcomeOpen) welcomeOpen.addEventListener("click", function() { window.mdfyDesktop.openFile(); });
    if (welcomeFolder) welcomeFolder.addEventListener("click", function() {
      window.mdfyDesktop.openFolder().then(function() { refreshSidebarData().then(renderSidebar); });
    });
    if (welcomePaste) welcomePaste.addEventListener("click", function() {
      window.mdfyDesktop.readClipboard().then(function(text) {
        if (text && text.trim()) {
          loadDocumentContent(text, null);
        }
      });
    });

    // Home screen buttons
    var homeNew = document.getElementById("home-new");
    var homePaste = document.getElementById("home-paste");
    var homeImport = document.getElementById("home-import");

    if (homeNew) homeNew.addEventListener("click", function() { window.mdfyDesktop.newDocument(); });
    if (homePaste) homePaste.addEventListener("click", function() {
      window.mdfyDesktop.readClipboard().then(function(text) {
        if (text && text.trim()) {
          loadDocumentContent(text, null);
        }
      });
    });
    if (homeImport) homeImport.addEventListener("click", function() { window.mdfyDesktop.openFile(); });

    // Sidebar logo → back to home
    var sidebarLogo = document.querySelector(".sidebar-logo");
    if (sidebarLogo) {
      sidebarLogo.style.cursor = "pointer";
      sidebarLogo.title = "Home";
      sidebarLogo.addEventListener("click", function() {
        if (isDirty && currentFilePath && window.mdfyDesktop) {
          var md = htmlToMarkdown(content);
          window.mdfyDesktop.autoSave(md);
        }
        isDirty = false;
        currentFilePath = null;
        currentConfig = null;
        showHomeScreen();
      });
    }

    // QuickLook button — hide if already installed
    var welcomeQL = document.getElementById("welcome-quicklook");
    if (welcomeQL) {
      window.mdfyDesktop.isQuickLookInstalled().then(function(installed) {
        if (installed) welcomeQL.style.display = "none";
      });
      welcomeQL.addEventListener("click", function() {
        window.mdfyDesktop.openQuickLookSettings();
        welcomeQL.style.display = "none";
      });
    }

    // Drop zone on welcome
    var dropzone = document.getElementById("welcome-dropzone");
    if (dropzone) {
      document.addEventListener("dragover", function(e) { e.preventDefault(); if (dropzone) dropzone.classList.add("active"); });
      document.addEventListener("dragleave", function(e) {
        if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
          if (dropzone) dropzone.classList.remove("active");
        }
      });
      document.addEventListener("drop", function(e) {
        e.preventDefault();
        if (dropzone) dropzone.classList.remove("active");
        var files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && files[0].path) {
          window.mdfyDesktop.openFilePath(files[0].path);
        }
      });
    }

    // Periodic sidebar refresh every 15s — only when app is focused
    setInterval(function() {
      if (document.visibilityState === "visible") {
        refreshSidebarData().then(renderSidebar);
      }
    }, 15000);
  }

  async function refreshSidebarData() {
    if (!window.mdfyDesktop) return;

    var results = await Promise.all([
      window.mdfyDesktop.getWorkspaceTree().catch(function() { return { files: [], folders: [] }; }),
      window.mdfyDesktop.getRecentFiles().catch(function() { return []; }),
      window.mdfyDesktop.getAuthState().catch(function() { return { loggedIn: false }; }),
    ]);

    var tree = results[0] || {};
    sidebarState.workspaceFiles = tree.files || tree || [];
    sidebarState.workspaceFolders = tree.folders || [];
    sidebarState.recentFiles = results[1] || [];
    sidebarState.authState = results[2] || { loggedIn: false };

    if (sidebarState.authState.loggedIn) {
      var cloudResults = await Promise.all([
        window.mdfyDesktop.getCloudDocuments().catch(function() { return []; }),
        window.mdfyDesktop.getCloudFolders().catch(function() { return []; }),
      ]);
      sidebarState.cloudDocs = cloudResults[0] || [];
      sidebarState.cloudFolders = cloudResults[1] || [];
    } else {
      sidebarState.cloudDocs = [];
      sidebarState.cloudFolders = [];
    }
  }

  // ─── Sidebar: Render ───

  function renderSidebar() {
    renderFileList();
    renderUserBar();
    // Images moved to right-side panel — no longer in sidebar
  }

  function renderFileList() {
    var container = document.getElementById("file-list");
    if (!container) return;

    // Merge workspace files + recent files (dedupe by path)
    var allLocal = [];
    var seenPaths = new Set();

    // Workspace files first
    for (var i = 0; i < sidebarState.workspaceFiles.length; i++) {
      var wf = sidebarState.workspaceFiles[i];
      if (!seenPaths.has(wf.filePath)) {
        seenPaths.add(wf.filePath);
        allLocal.push({
          filePath: wf.filePath,
          fileName: wf.fileName,
          relativePath: wf.relativePath,
          config: wf.config,
          modifiedAt: wf.modifiedAt,
          source: "workspace",
        });
      }
    }

    // Recent files
    for (var j = 0; j < sidebarState.recentFiles.length; j++) {
      var rf = sidebarState.recentFiles[j];
      if (!seenPaths.has(rf.path)) {
        seenPaths.add(rf.path);
        var parts = rf.path.split("/");
        allLocal.push({
          filePath: rf.path,
          fileName: parts[parts.length - 1],
          relativePath: rf.path.replace(/^\/Users\/[^/]+/, "~"),
          config: rf.config,
          modifiedAt: rf.modifiedAt || rf.openedAt,
          source: "recent",
        });
      }
    }

    // Search filter
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      allLocal = allLocal.filter(function(f) {
        return f.fileName.toLowerCase().includes(q) || f.relativePath.toLowerCase().includes(q);
      });
    }

    // Sort based on current sort mode
    allLocal.sort(function(a, b) {
      if (sortMode === "az") return a.fileName.localeCompare(b.fileName);
      if (sortMode === "za") return b.fileName.localeCompare(a.fileName);
      var at = new Date(a.modifiedAt || 0).getTime();
      var bt = new Date(b.modifiedAt || 0).getTime();
      return sortMode === "oldest" ? at - bt : bt - at;
    });

    // Categorize
    // Only show synced status when logged in — otherwise everything is "local"
    var isLoggedIn = sidebarState.authState.loggedIn;
    var synced = isLoggedIn ? allLocal.filter(function(f) { return f.config && f.config.docId; }) : [];
    var local = isLoggedIn ? allLocal.filter(function(f) { return !f.config || !f.config.docId; }) : allLocal;
    var cloud = sidebarState.cloudDocs.filter(function(cd) {
      // Exclude cloud docs that already have local copies (synced)
      return !synced.some(function(s) { return s.config && s.config.docId === cd.id; });
    });

    if (searchQuery) {
      var q2 = searchQuery.toLowerCase();
      cloud = cloud.filter(function(cd) {
        return (cd.title || "").toLowerCase().includes(q2) || cd.id.toLowerCase().includes(q2);
      });
    }

    var html = "";

    if (currentFilter === "all") {
      // Separate workspace files from recent-only files
      var wsFiles = allLocal.filter(function(f) { return f.source === "workspace"; });
      var recentOnly = allLocal.filter(function(f) { return f.source === "recent"; });

      // Workspace section (folder tree)
      if (wsFiles.length > 0) {
        var folderGroups = {};
        var wsRootFiles = [];
        for (var ai = 0; ai < wsFiles.length; ai++) {
          var pf = wsFiles[ai].parentFolder;
          if (pf) {
            if (!folderGroups[pf]) folderGroups[pf] = [];
            folderGroups[pf].push(wsFiles[ai]);
          } else {
            wsRootFiles.push(wsFiles[ai]);
          }
        }
        html += secHeader("local", "Workspace", wsFiles.length);
        var renderedFolders = Object.keys(folderGroups).sort();
        for (var fi = 0; fi < renderedFolders.length; fi++) {
          var folderRel = renderedFolders[fi];
          var folderName = folderRel.split("/").pop();
          var isCollapsed = collapsedFolders[folderRel] || false;
          html += renderFolderGroup(folderRel, folderName, folderGroups[folderRel], isCollapsed);
        }
        for (var ri = 0; ri < wsRootFiles.length; ri++) html += renderFileItem(wsRootFiles[ri]);
      }

      // Recent section (files opened outside workspace)
      if (recentOnly.length > 0) {
        html += secHeader("local", "Recent", recentOnly.length);
        for (var rci = 0; rci < recentOnly.length; rci++) html += renderFileItem(recentOnly[rci]);
      }

      // Cloud docs — grouped by folder
      if (cloud.length > 0 && sidebarState.authState.loggedIn) {
        html += secHeader("cloud", "Cloud", cloud.length);
        html += renderCloudDocsGrouped(cloud);
      }
    } else if (currentFilter === "synced") {
      if (!sidebarState.authState.loggedIn) {
        html += '<div class="sidebar-empty"><p>Sign in to see synced documents</p><p class="sidebar-empty-hint">Publish files to memory.wiki to sync them across devices</p><button class="login-prompt-btn" onclick="window.mdfyDesktop.login()">Sign in</button></div>';
      } else if (synced.length > 0) {
        html += secHeader("synced", "Synced", synced.length);
        for (var s = 0; s < synced.length; s++) html += renderSyncedItem(synced[s]);
      } else {
        html += '<div class="sidebar-empty"><p>No synced documents</p><p class="sidebar-empty-hint">Publish a file to sync it with memory.wiki</p></div>';
      }

    } else if (currentFilter === "local") {
      // LOCAL: synced (has local copy) + local-only
      if (synced.length > 0) {
        html += secHeader("synced", "Synced", synced.length);
        for (var s2 = 0; s2 < synced.length; s2++) html += renderSyncedItem(synced[s2]);
      }
      if (local.length > 0) {
        html += secHeader("local", "Local", local.length);
        for (var l2 = 0; l2 < local.length; l2++) html += renderLocalItem(local[l2]);
      }
      if (synced.length === 0 && local.length === 0) {
        html += '<div class="sidebar-empty"><p>No local documents</p></div>';
      }

    } else if (currentFilter === "cloud") {
      // CLOUD: synced (exists on cloud) + cloud-only
      if (!sidebarState.authState.loggedIn) {
        html += '<div class="sidebar-empty"><p>Sign in to access cloud documents</p><p class="sidebar-empty-hint">Sync, publish, and access documents from anywhere</p><button class="login-prompt-btn" onclick="window.mdfyDesktop.login()">Sign in</button></div>';
      } else {
        if (synced.length > 0) {
          html += secHeader("synced", "Synced", synced.length);
          for (var s3 = 0; s3 < synced.length; s3++) html += renderSyncedItem(synced[s3]);
        }
        if (cloud.length > 0) {
          html += secHeader("cloud", "Cloud", cloud.length);
          html += renderCloudDocsGrouped(cloud);
        }
        if (synced.length === 0 && cloud.length === 0) {
          html += '<div class="sidebar-empty"><p>No cloud documents</p></div>';
        }
      }
    }

    // Cloud search results
    if (searchQuery.length >= 3 && sidebarState.authState.loggedIn) {
      if (isCloudSearching) {
        html += '<div class="section-header"><span class="section-label">Cloud results</span><span class="section-badge"><svg class="spin" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 8A6 6 0 104.8 3.3"/></svg></span></div>';
      } else if (cloudSearchResults.length > 0) {
        // Exclude results already visible in local/cloud lists
        var existingIds = new Set();
        synced.forEach(function(s) { if (s.config && s.config.docId) existingIds.add(s.config.docId); });
        cloud.forEach(function(c) { existingIds.add(c.id); });
        var uniqueResults = cloudSearchResults.filter(function(r) { return !existingIds.has(r.id); });
        if (uniqueResults.length > 0) {
          html += '<div class="section-header"><span class="section-label">Cloud results</span><span class="section-badge">' + uniqueResults.length + '</span></div>';
          html += '<div class="file-list">';
          uniqueResults.forEach(function(r) {
            var snippet = (r.snippet || "").slice(0, 80);
            html += '<div class="file-item" data-cloud-id="' + esc(r.id) + '">'
              + '<div class="file-icon" style="color:#60a5fa"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg></div>'
              + '<div class="file-info"><div class="file-name">' + esc(r.title) + '</div>'
              + '<div class="file-meta">' + esc(snippet) + '</div></div></div>';
          });
          html += '</div>';
        }
      }
    }

    if (!html) {
      if (!sidebarState.authState.loggedIn && (currentFilter === "cloud" || currentFilter === "synced")) {
        html = '<div class="sidebar-empty"><p>Sign in to see ' + currentFilter + ' documents</p></div>';
      } else {
        html = '<div class="sidebar-empty"><p>No documents</p></div>';
      }
    }

    container.innerHTML = html;

    // Section-level sort button
    var secSort = document.getElementById("sec-sort");
    if (secSort) {
      secSort.addEventListener("click", function(e) {
        e.stopPropagation();
        var modes = ["newest", "oldest", "az", "za"];
        var idx = modes.indexOf(sortMode);
        sortMode = modes[(idx + 1) % modes.length];
        renderFileList();
      });
    }
    var secNew = document.getElementById("sec-new-doc");
    if (secNew) {
      secNew.addEventListener("click", function(e) {
        e.stopPropagation();
        window.mdfyDesktop.newDocument();
      });
    }

    // File context menu (right-click)
    container.querySelectorAll(".file-item[data-path]").forEach(function(item) {
      item.addEventListener("contextmenu", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var fp = item.getAttribute("data-path");
        var config = findConfigByPath(fp);
        showFileContextMenu(e.clientX, e.clientY, fp, config);
      });
    });

    container.querySelectorAll(".file-item[data-cloud-id]").forEach(function(item) {
      item.addEventListener("contextmenu", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var docId = item.getAttribute("data-cloud-id");
        var title = item.querySelector(".file-name");
        showCloudContextMenu(e.clientX, e.clientY, docId, title ? title.textContent : "");
      });
    });

    // Folder toggle + context menu
    container.querySelectorAll("[data-toggle-folder]").forEach(function(el) {
      el.addEventListener("click", function(e) {
        e.stopPropagation();
        var folderRel = el.getAttribute("data-toggle-folder");
        collapsedFolders[folderRel] = !collapsedFolders[folderRel];
        renderFileList();
      });
      el.addEventListener("contextmenu", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var folderRel = el.getAttribute("data-toggle-folder");
        window.mdfyDesktop.getWorkspaceFolder().then(function(wsFolder) {
          if (!wsFolder) return;
          var fullPath = wsFolder + "/" + folderRel;
          hideFileContextMenu();
          var menu = document.createElement("div");
          menu.className = "file-ctx-menu";
          var items = [
            { label: "New File Here", action: function() {
              var name = "Untitled.md";
              var fp = fullPath + "/" + name;
              var counter = 1;
              // Can't check existence from renderer, just create
              window.mdfyDesktop.saveFileAs("", name, [{ name: "Markdown", extensions: ["md"] }]);
            }},
            { label: "Reveal in Finder", action: function() { window.mdfyDesktop.revealInFinder(fullPath); } },
          ];
          renderContextMenu(menu, items, e.clientX, e.clientY);
        });
      });
    });

    // Drag and drop files into folders
    container.querySelectorAll(".file-item[data-path]").forEach(function(item) {
      item.setAttribute("draggable", "true");
      item.addEventListener("dragstart", function(e) {
        e.dataTransfer.setData("text/plain", item.getAttribute("data-path"));
        e.dataTransfer.effectAllowed = "move";
        item.style.opacity = "0.4";
      });
      item.addEventListener("dragend", function() { item.style.opacity = ""; });
    });

    container.querySelectorAll(".folder-header").forEach(function(fh) {
      var folderItem = fh.closest(".folder-item");
      fh.addEventListener("dragover", function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        fh.style.background = "var(--accent-dim)";
      });
      fh.addEventListener("dragleave", function() { fh.style.background = ""; });
      fh.addEventListener("drop", function(e) {
        e.preventDefault();
        fh.style.background = "";
        var fromPath = e.dataTransfer.getData("text/plain");
        if (!fromPath || !folderItem) return;
        var folderRel = folderItem.getAttribute("data-folder");
        window.mdfyDesktop.getWorkspaceFolder().then(function(wsFolder) {
          if (!wsFolder) return;
          var toFolder = wsFolder + "/" + folderRel;
          window.mdfyDesktop.moveFile(fromPath, toFolder).then(function(result) {
            if (result.ok) { refreshSidebarData().then(renderSidebar); showToast("Moved to " + folderRel); }
            else if (result.error) { showToast("Move failed: " + result.error); }
          });
        });
      });
    });

    // Cloud folder toggle
    container.querySelectorAll("[data-toggle-cloud-folder]").forEach(function(el) {
      el.addEventListener("click", function(e) {
        e.stopPropagation();
        var folderId = el.getAttribute("data-toggle-cloud-folder");
        collapsedCloudFolders[folderId] = !collapsedCloudFolders[folderId];
        renderFileList();
      });
    });

    // Attach click handlers
    container.querySelectorAll("[data-action]").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        handleFileAction(btn.getAttribute("data-action"), btn.getAttribute("data-path") || btn.getAttribute("data-id"), btn.getAttribute("data-title"));
      });
    });

    container.querySelectorAll(".file-item").forEach(function(item) {
      item.addEventListener("click", function(e) {
        if (e.target.closest("[data-action]")) return; // Don't open file when clicking action buttons
        var fp = item.getAttribute("data-path");
        var docId = item.getAttribute("data-cloud-id");

        if (fp) {
          window.mdfyDesktop.openFilePath(fp);
        } else if (docId) {
          var docTitle = item.querySelector(".file-name");
          var t = docTitle ? docTitle.textContent : docId;
          // Show loading state
          showEditor();
          content.innerHTML = '<div class="cloud-loading"><div class="cloud-loading-spinner"></div><p>Loading ' + esc(t) + '...</p></div>';
          content.setAttribute("contenteditable", "false");
          if (headerTitle) headerTitle.textContent = t + " (Cloud)";
          window.mdfyDesktop.previewCloudDoc(docId, t);
        }
      });
    });
  }

  // Unified file item — shows synced or local icon based on config
  function renderFileItem(f) {
    if (sidebarState.authState.loggedIn && f.config && f.config.docId) return renderSyncedItem(f);
    return renderLocalItem(f);
  }

  // Folder group with collapse/expand
  function renderFolderGroup(folderRel, folderName, files, isCollapsed) {
    var html = '<div class="folder-item" data-folder="' + esc(folderRel) + '">' +
      '<div class="folder-header" data-toggle-folder="' + esc(folderRel) + '">' +
        '<svg class="folder-chevron' + (isCollapsed ? " collapsed" : "") + '" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6l4 4 4-4"/></svg>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-faint);flex-shrink:0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' +
        '<span class="folder-name">' + esc(folderName) + '</span>' +
        '<span class="folder-count">' + files.length + '</span>' +
      '</div>';
    if (!isCollapsed) {
      html += '<div class="folder-children">';
      for (var i = 0; i < files.length; i++) html += renderFileItem(files[i]);
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // Section header with icon + count (matches VS Code sidebar)
  function secHeader(type, label, count) {
    var icons = {
      synced: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg>',
      local: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1H4.5A1.5 1.5 0 003 2.5v11A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5V5z"/><path d="M9 1v4h4"/></svg>',
      cloud: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13h7.1a3.2 3.2 0 00.6-6.35 4.5 4.5 0 00-8.7 1.1A2.8 2.8 0 004.5 13z"/></svg>',
      images: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M14.5 10.5l-3.5-3.5-6 6"/></svg>',
    };
    var countStr = (count === "" || count === undefined) ? "" : ' <span class="section-count">' + count + '</span>';
    // For "Files" section, add sort + new doc buttons (like VS Code)
    var actions = "";
    if (type === "local") {
      var sortLabels = { newest: "Newest", oldest: "Oldest", az: "A→Z", za: "Z→A" };
      actions = '<div class="sec-actions">' +
        '<button class="sec-action-btn" id="sec-sort" title="Sort: ' + (sortLabels[sortMode] || sortMode) + '"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg></button>' +
        '<button class="sec-action-btn" id="sec-new-doc" title="New Document"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg></button>' +
      '</div>';
    }
    return '<div class="file-section-label">' + (icons[type] || "") + " " + label + countStr + actions + '</div>';
  }

  // VS Code matching icons (14px, Lucide style)
  var SBI = {
    check: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg>',
    circle: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/></svg>',
    cloud: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13h7.1a3.2 3.2 0 00.6-6.35 4.5 4.5 0 00-8.7 1.1A2.8 2.8 0 004.5 13z"/></svg>',
    copy: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M6 10H4.5A1.5 1.5 0 013 8.5v-5A1.5 1.5 0 014.5 2h5A1.5 1.5 0 0111 3.5V6"/></svg>',
    extLink: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4.5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 011 13.5v-8A1.5 1.5 0 012.5 4H7"/><path d="M10 1h5v5"/><path d="M15 1L7 9"/></svg>',
    upload: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11v2.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V11"/><path d="M8 10V2"/><path d="M5 4.5L8 1.5l3 3"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11v2.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V11"/><path d="M8 2v8"/><path d="M5 7.5L8 10.5l3-3"/></svg>',
    unsync: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8A6 6 0 004.8 3.3L2 6"/><path d="M2 8a6 6 0 009.2 4.7L14 10"/><path d="M4 4l8 8"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4"/><path d="M12.5 4v9a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 13V4"/></svg>',
    file: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1H4.5A1.5 1.5 0 003 2.5v11A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5V5z"/><path d="M9 1v4h4"/></svg>',
    share: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  };

  var syncBadgeHtml = '<span class="sync-badge"><svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg></span>';

  function docStatusIcon(doc) {
    var editMode = doc.edit_mode || null;
    var allowedEmails = doc.allowed_emails || null;
    var source = doc.source || null;
    var isDraft = doc.is_draft || false;
    var isSynced = source === 'vscode' || source === 'desktop' || source === 'cli' || source === 'mcp';
    var badge = isSynced ? syncBadgeHtml : '';

    if (editMode === 'readonly') {
      return '<div class="file-icon readonly" title="View only">' + SBI.eye + badge + '</div>';
    }
    if (editMode === 'view' || editMode === 'public') {
      return '<div class="file-icon shared" title="Shared publicly">' + SBI.share + badge + '</div>';
    }
    if (allowedEmails && allowedEmails.length > 0) {
      return '<div class="file-icon restricted" title="Shared with specific people">' + SBI.users + badge + '</div>';
    }
    if (doc.id || doc.docId) {
      return '<div class="file-icon cloud" title="Cloud">' + SBI.cloud + badge + '</div>';
    }
    return '<div class="file-icon local" title="Local">' + SBI.file + badge + '</div>';
  }

  function renderSyncedItem(f) {
    var synced = f.config && f.config.lastSyncedAt ? timeAgo(f.config.lastSyncedAt) : timeAgo(f.modifiedAt);
    var meta = synced ? "synced " + synced : f.relativePath;
    var active = f.filePath === currentFilePath ? " active" : "";
    return '<div class="file-item' + active + '" data-path="' + esc(f.filePath) + '">' +
      '<div class="file-icon shared" title="Synced with memory.wiki">' + SBI.share + syncBadgeHtml + '</div>' +
      '<div class="file-info"><div class="file-name">' + esc(f.fileName) + '</div><div class="file-meta">' + esc(meta) + '</div></div>' +
      '<div class="file-actions">' +
        '<button data-action="copy-url" data-path="' + esc(f.filePath) + '" title="Copy URL">' + SBI.copy + '</button>' +
        '<button data-action="open-browser" data-path="' + esc(f.filePath) + '" title="Open in browser">' + SBI.extLink + '</button>' +
        '<button data-action="unlink" data-path="' + esc(f.filePath) + '" title="Unsync">' + SBI.unsync + '</button>' +
        '<button data-action="delete-synced" data-path="' + esc(f.filePath) + '" title="Delete from cloud" style="color:#ef4444">' + SBI.trash + '</button>' +
      '</div>' +
      '<span class="file-time">' + timeAgo(f.modifiedAt) + '</span>' +
    '</div>';
  }

  function renderLocalItem(f) {
    var active = f.filePath === currentFilePath ? " active" : "";
    return '<div class="file-item' + active + '" data-path="' + esc(f.filePath) + '" title="' + esc(f.filePath) + '">' +
      '<div class="file-icon local">' + SBI.file + '</div>' +
      '<div class="file-info"><div class="file-name">' + esc(f.fileName) + '</div><div class="file-meta">' + esc(f.relativePath) + '</div></div>' +
      '<div class="file-actions">' +
        '<button data-action="publish" data-path="' + esc(f.filePath) + '" title="Sync to memory.wiki">' + SBI.upload + '</button>' +
      '</div>' +
      '<span class="file-time">' + timeAgo(f.modifiedAt) + '</span>' +
    '</div>';
  }

  function renderCloudItem(cd) {
    var title = cd.title || "Untitled";
    var viewStr = cd.view_count > 0 ? " · " + cd.view_count + " views" : "";
    var meta = timeAgo(cd.updated_at) + (cd.is_draft ? " · draft" : "") + viewStr;
    return '<div class="file-item" data-cloud-id="' + esc(cd.id) + '">' +
      docStatusIcon(cd) +
      '<div class="file-info"><div class="file-name">' + esc(title) + '</div><div class="file-meta">' + esc(meta) + '</div></div>' +
      '<div class="file-actions">' +
        '<button data-action="pull-cloud" data-id="' + esc(cd.id) + '" data-title="' + esc(title) + '" title="Sync to local">' + SBI.download + '</button>' +
        '<button data-action="open-cloud-browser" data-id="' + esc(cd.id) + '" title="Open in browser">' + SBI.extLink + '</button>' +
        '<button data-action="delete-cloud" data-id="' + esc(cd.id) + '" title="Delete from cloud" style="color:#ef4444">' + SBI.trash + '</button>' +
      '</div>' +
      '<span class="file-time">' + timeAgo(cd.updated_at) + '</span>' +
    '</div>';
  }

  // ─── Cloud Folder Grouping ───

  function renderCloudDocsGrouped(cloudList) {
    var folders = sidebarState.cloudFolders || [];
    var html = "";
    // Docs in folders
    for (var fi = 0; fi < folders.length; fi++) {
      var f = folders[fi];
      var docsInFolder = cloudList.filter(function(cd) { return cd.folder_id === f.id; });
      if (docsInFolder.length === 0) continue;
      var isCollapsed = collapsedCloudFolders[f.id] || false;
      html += '<div class="cloud-folder-item" data-cloud-folder="' + esc(f.id) + '">' +
        '<div class="cloud-folder-header" data-toggle-cloud-folder="' + esc(f.id) + '">' +
          '<svg class="folder-chevron' + (isCollapsed ? " collapsed" : "") + '" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6l4 4 4-4"/></svg>' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' +
          '<span class="folder-name">' + esc(f.name) + '</span>' +
          '<span class="folder-count">' + docsInFolder.length + '</span>' +
        '</div>';
      if (!isCollapsed) {
        html += '<div class="folder-children">';
        for (var di = 0; di < docsInFolder.length; di++) html += renderCloudItem(docsInFolder[di]);
        html += '</div>';
      }
      html += '</div>';
    }
    // Root docs (no folder)
    var rootDocs = cloudList.filter(function(cd) { return !cd.folder_id; });
    for (var ri = 0; ri < rootDocs.length; ri++) html += renderCloudItem(rootDocs[ri]);
    return html;
  }

  // ─── Image Gallery ───

  var cachedImages = null;

  async function loadImages() {
    if (!sidebarState.authState.loggedIn) return;
    if (!window.mdfyDesktop) return;
    try {
      var data = await window.mdfyDesktop.getImages();
      if (data && !data.error && data.images) {
        cachedImages = data;
        renderImageSection(data.images, data.quota);
      }
    } catch (e) { /* silent */ }
  }

  function renderImageSection(images, quota) {
    var container = document.getElementById("image-section");
    if (!container) {
      container = document.createElement("div");
      container.id = "image-section";
      var fileList = document.getElementById("file-list");
      if (fileList) fileList.after(container);
      else return;
    }

    if (!images || images.length === 0) {
      container.innerHTML = "";
      return;
    }

    var usedMB = Math.round((quota.used || 0) / 1024 / 1024);
    var totalMB = Math.round((quota.total || 1) / 1024 / 1024);

    var html = secHeader("images", "Images", images.length);
    html += '<div class="image-quota"><span>' + usedMB + 'MB / ' + totalMB + 'MB</span><div class="quota-bar"><div class="quota-fill" style="width:' + Math.min(100, (quota.used / quota.total) * 100) + '%"></div></div></div>';
    html += '<div class="image-grid">';
    images.forEach(function(img) {
      html += '<div class="image-thumb" data-url="' + esc(img.url) + '" data-name="' + esc(img.name) + '">';
      html += '<img src="' + esc(img.url) + '" loading="lazy">';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll(".image-thumb").forEach(function(el) {
      el.addEventListener("click", function() {
        var url = el.dataset.url;
        var name = (el.dataset.name || "image").replace(/\.\w+$/, "");
        insertImageElement(url, name);
      });
    });
  }

  function renderUserBar() {
    var bar = document.getElementById("user-bar");
    if (!bar) return;

    if (sidebarState.authState.loggedIn) {
      var email = sidebarState.authState.email || "User";
      var initial = email.charAt(0).toUpperCase();
      bar.innerHTML =
        '<div class="user-loggedin">' +
          '<div class="user-avatar-circle">' + initial + '</div>' +
          '<div class="user-details">' +
            '<span class="user-email">' + esc(email) + '</span>' +
            '<span class="user-status"><span class="status-dot"></span> Connected</span>' +
          '</div>' +
          '<button class="user-logout-btn" id="btn-signout">Sign out</button>' +
        '</div>';

      document.getElementById("btn-signout").addEventListener("click", function() {
        window.mdfyDesktop.logout();
        sidebarState.authState = { loggedIn: false };
        sidebarState.cloudDocs = [];
        sidebarState.cloudFolders = [];
        renderSidebar();
      });
    } else {
      bar.innerHTML =
        '<div class="user-signin-wrap">' +
          '<button class="user-signin" id="btn-signin">' +
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/></svg>' +
            'Sign in to memory.wiki' +
          '</button>' +
          '<div class="user-signin-hint">Sync, publish, and access cloud documents</div>' +
        '</div>';

      document.getElementById("btn-signin").addEventListener("click", function() {
        window.mdfyDesktop.login();
      });
    }
  }

  // ─── Sidebar: Actions ───

  async function handleFileAction(action, pathOrId, title) {
    switch (action) {
      case "copy-url": {
        var config = findConfigByPath(pathOrId);
        if (config) {
          window.mdfyDesktop.writeClipboard("https://memory.wiki/" + config.docId);
          showToast("URL copied");
        }
        break;
      }
      case "open-browser": {
        var config2 = findConfigByPath(pathOrId);
        if (config2) window.mdfyDesktop.openInBrowser("https://memory.wiki/" +config2.docId);
        break;
      }
      case "unlink":
        await window.mdfyDesktop.syncUnlink(pathOrId);
        await refreshSidebarData();
        renderSidebar();
        break;
      case "publish":
        window.mdfyDesktop.openFilePath(pathOrId);
        // After file loads, trigger publish
        setTimeout(function() {
          document.getElementById("btn-publish").click();
        }, 500);
        break;
      case "pull-cloud":
        var result = await window.mdfyDesktop.syncPullCloud(pathOrId, title);
        if (result && result.ok) {
          await refreshSidebarData();
          renderSidebar();
        }
        break;
      case "open-cloud-browser":
        window.mdfyDesktop.openInBrowser("https://memory.wiki/" +pathOrId);
        break;
      case "delete-synced":
        if (confirm("Delete this document from memory.wiki? The local file will remain.")) {
          await window.mdfyDesktop.syncDelete(pathOrId);
          await refreshSidebarData();
          renderSidebar();
          showToast("Deleted from cloud");
        }
        break;
      case "delete-cloud":
        if (confirm("Delete this document from memory.wiki?")) {
          await window.mdfyDesktop.deleteCloudDoc(pathOrId);
          await refreshSidebarData();
          renderSidebar();
          showToast("Deleted from cloud");
        }
        break;
    }
  }

  function findConfigByPath(filePath) {
    var all = sidebarState.workspaceFiles.concat(
      sidebarState.recentFiles.map(function(r) { return { filePath: r.path, config: r.config }; })
    );
    var match = all.find(function(f) { return f.filePath === filePath; });
    return match ? match.config : null;
  }

  // ─── Sidebar: Buttons ───

  var btnNewDoc = document.getElementById("btn-new-doc");
  if (btnNewDoc) btnNewDoc.addEventListener("click", function() { window.mdfyDesktop.newDocument(); });

  document.getElementById("btn-search-toggle").addEventListener("click", function() {
    var box = document.getElementById("search-box");
    box.classList.toggle("hidden");
    if (!box.classList.contains("hidden")) {
      document.getElementById("search-input").focus();
    } else {
      searchQuery = "";
      document.getElementById("search-input").value = "";
      renderFileList();
    }
  });

  document.getElementById("search-input").addEventListener("input", function(e) {
    searchQuery = e.target.value;
    renderFileList();

    // Cloud search with debounce (3+ chars)
    if (cloudSearchTimer) clearTimeout(cloudSearchTimer);
    if (searchQuery.length >= 3 && sidebarState.authState.loggedIn && window.mdfyDesktop.searchDocs) {
      isCloudSearching = true;
      cloudSearchTimer = setTimeout(function() {
        window.mdfyDesktop.searchDocs(searchQuery).then(function(data) {
          cloudSearchResults = (data && data.results) || [];
          isCloudSearching = false;
          renderFileList();
        }).catch(function() {
          cloudSearchResults = [];
          isCloudSearching = false;
          renderFileList();
        });
      }, 400);
    } else {
      cloudSearchResults = [];
      isCloudSearching = false;
    }
  });

  // Help panel toggle
  document.getElementById("btn-help-toggle").addEventListener("click", function() {
    var panel = document.getElementById("help-panel");
    var btn = document.getElementById("btn-help-toggle");
    if (panel) {
      panel.classList.toggle("hidden");
      btn.style.color = panel.classList.contains("hidden") ? "" : "var(--accent)";
    }
  });

  document.getElementById("btn-refresh").addEventListener("click", function() {
    var btn = document.getElementById("btn-refresh");
    btn.classList.add("spinning");
    refreshSidebarData().then(function() {
      renderSidebar();
      setTimeout(function() { btn.classList.remove("spinning"); }, 500);
    });
  });

  // Filter tabs
  document.querySelectorAll(".filter-tab").forEach(function(tab) {
    tab.addEventListener("click", function() {
      currentFilter = tab.getAttribute("data-filter");
      document.querySelectorAll(".filter-tab").forEach(function(t) { t.classList.remove("active"); });
      tab.classList.add("active");
      renderFileList();
    });
  });

  // ─── Image Side Panel ───

  var imagePanelOpen = false;

  var imagesToggle = document.getElementById("images-toggle");
  if (imagesToggle) {
    imagesToggle.addEventListener("click", function() {
      imagePanelOpen = !imagePanelOpen;
      var panel = document.getElementById("image-panel");
      if (panel) {
        panel.style.display = imagePanelOpen ? "" : "none";
        imagesToggle.setAttribute("data-active", imagePanelOpen ? "true" : "false");
      }
      if (imagePanelOpen) {
        populateImagePanel();
        // Close outline panel
        if (outlinePanelOpen && outlinePanelEl) {
          outlinePanelOpen = false;
          outlinePanelEl.classList.add("hidden");
          if (outlineToggle) { outlineToggle.setAttribute("data-active", "false"); outlineToggle.classList.remove("active"); }
        }
        // Close AI panel
        if (aiSidePanelOpen) {
          aiSidePanelOpen = false;
          var aiP = document.getElementById("ai-panel");
          if (aiP) aiP.style.display = "none";
          var aiT = document.getElementById("ai-toggle");
          if (aiT) { aiT.setAttribute("data-active", "false"); aiT.classList.remove("active"); }
        }
      }
    });
  }

  var imagePanelClose = document.getElementById("image-panel-close");
  if (imagePanelClose) {
    imagePanelClose.addEventListener("click", function() {
      imagePanelOpen = false;
      var panel = document.getElementById("image-panel");
      if (panel) panel.style.display = "none";
      if (imagesToggle) imagesToggle.setAttribute("data-active", "false");
    });
  }

  function populateImagePanel() {
    var body = document.getElementById("image-panel-body");
    if (!body) return;

    if (!sidebarState.authState.loggedIn) {
      body.innerHTML = '<div class="image-panel-signin"><p>Sign in to manage images</p>' +
        '<button onclick="window.mdfyDesktop.login()">Sign in</button></div>';
      return;
    }

    body.innerHTML = '<div class="image-panel-loading">Loading images...</div>';

    if (cachedImages && cachedImages.images) {
      renderImagePanel(cachedImages.images, cachedImages.quota);
      return;
    }

    window.mdfyDesktop.getImages().then(function(data) {
      if (data && !data.error && data.images) {
        cachedImages = data;
        renderImagePanel(data.images, data.quota);
      } else {
        body.innerHTML = '<div class="image-panel-empty">No images uploaded yet</div>';
      }
    }).catch(function() {
      body.innerHTML = '<div class="image-panel-empty">Failed to load images</div>';
    });
  }

  function renderImagePanel(images, quota) {
    var body = document.getElementById("image-panel-body");
    if (!body) return;

    if (!images || images.length === 0) {
      body.innerHTML = '<div class="image-panel-empty">No images uploaded yet</div>';
      return;
    }

    var usedMB = Math.round((quota.used || 0) / 1024 / 1024);
    var totalMB = Math.round((quota.total || 1) / 1024 / 1024);
    var pct = Math.min(100, ((quota.used || 0) / (quota.total || 1)) * 100);

    var html = '<div class="image-panel-quota"><span>' + usedMB + 'MB / ' + totalMB + 'MB</span>' +
      '<div class="quota-bar"><div class="quota-fill" style="width:' + pct + '%"></div></div></div>';
    html += '<div class="image-panel-grid">';
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      html += '<div class="image-panel-thumb" data-url="' + esc(img.url) + '" data-name="' + esc(img.name) + '">';
      html += '<img src="' + esc(img.url) + '" loading="lazy">';
      html += '<button class="img-insert-btn" title="Insert">+</button>';
      html += '</div>';
    }
    html += '</div>';
    body.innerHTML = html;

    body.querySelectorAll(".image-panel-thumb").forEach(function(el) {
      el.addEventListener("click", function() {
        var url = el.dataset.url;
        var name = (el.dataset.name || "image").replace(/\.\w+$/, "");
        insertImageElement(url, name);
      });
    });
  }

  // ─── Outline Side Panel ───

  var outlinePanelOpen = true; // open by default
  var outlineToggle = document.getElementById("outline-toggle");
  var outlinePanelEl = document.getElementById("outline-panel");
  var outlinePanelBody = document.getElementById("outline-panel-body");
  var outlinePanelClose = document.getElementById("outline-panel-close");

  function toggleOutlinePanel() {
    outlinePanelOpen = !outlinePanelOpen;
    if (outlinePanelEl) {
      outlinePanelEl.classList.toggle("hidden", !outlinePanelOpen);
    }
    if (outlineToggle) {
      outlineToggle.setAttribute("data-active", outlinePanelOpen ? "true" : "false");
      outlineToggle.classList.toggle("active", outlinePanelOpen);
    }
    // Close image panel when opening outline
    if (outlinePanelOpen && imagePanelOpen) {
      imagePanelOpen = false;
      var imgP = document.getElementById("image-panel");
      if (imgP) imgP.style.display = "none";
      if (imagesToggle) imagesToggle.setAttribute("data-active", "false");
    }
    // Close AI panel when opening outline
    if (outlinePanelOpen && aiSidePanelOpen) {
      aiSidePanelOpen = false;
      var aiP = document.getElementById("ai-panel");
      if (aiP) aiP.style.display = "none";
      var aiT = document.getElementById("ai-toggle");
      if (aiT) { aiT.setAttribute("data-active", "false"); aiT.classList.remove("active"); }
    }
    if (outlinePanelOpen) {
      updateOutlinePanel();
    }
  }

  if (outlineToggle) {
    outlineToggle.addEventListener("click", toggleOutlinePanel);
  }
  if (outlinePanelClose) {
    outlinePanelClose.addEventListener("click", toggleOutlinePanel);
  }

  // ─── Diff Highlight ───
  function highlightChangedBlocks(oldMd, newMd) {
    if (oldMd === newMd || !content) return;
    setTimeout(function() {
      var blocks = content.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table");
      blocks.forEach(function(el) {
        var text = (el.textContent || "").trim();
        if (text.length < 5) return;
        var snippet = text.substring(0, Math.min(text.length, 60));
        if (!oldMd.includes(snippet)) {
          el.style.transition = "background 1.5s ease-out";
          el.style.background = "rgba(251, 146, 60, 0.12)";
          el.style.borderRadius = "4px";
          setTimeout(function() { el.style.background = ""; }, 3000);
        }
      });
    }, 300);
  }

  function updateOutlinePanel() {
    if (!outlinePanelBody || !outlinePanelOpen) return;

    var headings = content.querySelectorAll("h1, h2, h3, h4, h5, h6");
    if (headings.length === 0) {
      outlinePanelBody.innerHTML = '<div class="outline-empty">No headings</div>';
      return;
    }

    var html = "";
    headings.forEach(function(heading, idx) {
      var level = parseInt(heading.tagName.charAt(1));
      var text = heading.textContent || "";
      if (!heading.id) {
        heading.id = "outline-heading-" + idx;
      }
      html += '<button class="outline-item" data-level="' + level + '" data-target="' + heading.id + '" title="' + text.replace(/"/g, '&quot;') + '">' + text + '</button>';
    });

    outlinePanelBody.innerHTML = html;

    outlinePanelBody.querySelectorAll(".outline-item").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var targetId = btn.getAttribute("data-target");
        var target = document.getElementById(targetId);
        if (target) {
          var scrollContainer = content.closest(".pane-content");
          if (scrollContainer) {
            var containerRect = scrollContainer.getBoundingClientRect();
            var targetRect = target.getBoundingClientRect();
            var scrollTop = scrollContainer.scrollTop + targetRect.top - containerRect.top - 20;
            scrollContainer.scrollTo({ top: scrollTop, behavior: "smooth" });
          } else {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          target.classList.remove("outline-heading-highlight");
          void target.offsetWidth;
          target.classList.add("outline-heading-highlight");
          setTimeout(function() { target.classList.remove("outline-heading-highlight"); }, 1500);
        }
      });
    });
  }

  // ─── Sidebar: Events from main ───

  if (window.mdfyDesktop) {
    window.mdfyDesktop.onAuthChanged(function(data) {
      sidebarState.authState = data;
      if (data.loggedIn) {
        Promise.all([
          window.mdfyDesktop.getCloudDocuments().catch(function() { return []; }),
          window.mdfyDesktop.getCloudFolders().catch(function() { return []; }),
        ]).then(function(results) {
          sidebarState.cloudDocs = results[0] || [];
          sidebarState.cloudFolders = results[1] || [];
          renderSidebar();
        });
      } else {
        sidebarState.cloudDocs = [];
        sidebarState.cloudFolders = [];
        cachedImages = null;
        var imgSection = document.getElementById("image-section");
        if (imgSection) imgSection.remove();
        renderSidebar();
        // Notify user if this was an unexpected session expiry
        if (data.reason === "session-expired") {
          showToast("Session expired. Sign in again to sync.");
        }
      }
    });

    window.mdfyDesktop.onAuthExpired(function() {
      showToast("Session expired. Sign in again to continue syncing.");
    });

    window.mdfyDesktop.onWorkspaceChanged(function() {
      refreshSidebarData().then(renderSidebar);
    });

    window.mdfyDesktop.onSyncStatus(function(data) {
      updateSyncStatusUI(data.status);
      refreshSidebarData().then(renderSidebar);
    });

    window.mdfyDesktop.onSyncConflict(function(data) {
      showConflictDialog(data);
    });
  }

  // ════════════════════════════════════════════════════════
  //  DOCUMENT LOADING
  // ════════════════════════════════════════════════════════

  function showEditor() {
    hasDocument = true;
    // Re-acquire DOM refs in case they were detached
    content = document.getElementById("content");
    splitContainer = document.getElementById("split-container");
    renderPane = document.getElementById("render-pane");
    editorPane = document.getElementById("editor-pane");
    splitDivider = document.getElementById("split-divider");
    welcome = document.getElementById("welcome");

    if (welcome) welcome.style.display = "none";
    if (homeScreen) homeScreen.style.display = "none";
    if (splitContainer) splitContainer.style.display = "";
    var cw = document.getElementById("content-wrapper");
    if (cw) cw.style.display = "";
    document.getElementById("app-header").style.display = "";
    document.getElementById("bottom-bar").style.display = "";
    // Restore header left/right visibility
    var hl = document.querySelector(".header-left");
    var hr = document.querySelector(".header-right");
    if (hl) hl.style.visibility = "";
    if (hr) hr.style.visibility = "";
    setViewMode(currentViewMode || "live");
  }

  function showWelcome() {
    hasDocument = false;
    if (welcome) welcome.style.display = "";
    if (homeScreen) homeScreen.style.display = "none";
    if (splitContainer) splitContainer.style.display = "none";
    var cw = document.getElementById("content-wrapper");
    if (cw) cw.style.display = "none";
    document.getElementById("app-header").style.display = "none";
    document.getElementById("bottom-bar").style.display = "none";
  }

  function showHomeScreen() {
    if (welcome) welcome.style.display = "none";
    if (homeScreen) homeScreen.style.display = "";
    if (splitContainer) splitContainer.style.display = "none";
    var cw = document.getElementById("content-wrapper");
    if (cw) cw.style.display = "none";
    var appHeader = document.getElementById("app-header");
    if (appHeader) appHeader.style.display = "";
    document.getElementById("bottom-bar").style.display = "none";
    // Hide header left/right on home — only show view switcher
    var hl = document.querySelector(".header-left");
    var hr = document.querySelector(".header-right");
    if (hl) hl.style.visibility = "hidden";
    if (hr) hr.style.visibility = "hidden";
    document.querySelectorAll(".view-btn").forEach(function(btn) {
      btn.classList.toggle("active", btn.getAttribute("data-view") === "home");
    });
    renderHomeScreen();
  }

  function renderHomeScreen() {
    // ─── Recent ───
    var recentList = document.getElementById("home-recent-list");
    var recentSection = document.getElementById("home-recent-section");
    if (recentList) {
      // Merge workspace + recent files, dedupe
      var allFiles = [];
      var seenPaths = new Set();
      for (var i = 0; i < sidebarState.workspaceFiles.length; i++) {
        var wf = sidebarState.workspaceFiles[i];
        if (!seenPaths.has(wf.filePath)) {
          seenPaths.add(wf.filePath);
          allFiles.push({
            filePath: wf.filePath,
            fileName: wf.fileName,
            relativePath: wf.relativePath || wf.filePath.replace(/^\/Users\/[^/]+/, "~"),
            modifiedAt: wf.modifiedAt,
            config: wf.config,
          });
        }
      }
      for (var j = 0; j < sidebarState.recentFiles.length; j++) {
        var rf = sidebarState.recentFiles[j];
        if (!seenPaths.has(rf.path)) {
          seenPaths.add(rf.path);
          var parts = rf.path.split("/");
          allFiles.push({
            filePath: rf.path,
            fileName: parts[parts.length - 1],
            relativePath: rf.path.replace(/^\/Users\/[^/]+/, "~"),
            modifiedAt: rf.modifiedAt || rf.openedAt,
            config: rf.config,
          });
        }
      }
      // Sort by newest first
      allFiles.sort(function(a, b) {
        return new Date(b.modifiedAt || 0).getTime() - new Date(a.modifiedAt || 0).getTime();
      });
      // Limit to 8
      allFiles = allFiles.slice(0, 8);

      if (allFiles.length === 0) {
        if (recentSection) recentSection.style.display = "none";
      } else {
        if (recentSection) recentSection.style.display = "";
        var html = "";
        for (var k = 0; k < allFiles.length; k++) {
          var f = allFiles[k];
          var isSynced = f.config && f.config.docId;
          var iconSvg = isSynced
            ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M6 5h4M6 8h4M6 11h2"/></svg>';
          html +=
            '<button class="home-recent-item" data-filepath="' + f.filePath.replace(/"/g, '&quot;') + '">' +
              '<div class="home-recent-icon">' + iconSvg + '</div>' +
              '<div class="home-recent-info">' +
                '<span class="home-recent-name">' + escapeHtml(f.fileName) + '</span>' +
                '<span class="home-recent-path">' + escapeHtml(f.relativePath) + '</span>' +
              '</div>' +
              '<span class="home-recent-time">' + timeAgo(f.modifiedAt) + '</span>' +
            '</button>';
        }
        recentList.innerHTML = html;
      }
    }

    // ─── Examples click — load from examples.js ───
    var EXAMPLES = window.MDFY_EXAMPLES || {};
    var exGrid = document.getElementById("home-examples-grid");
    if (exGrid) {
      exGrid.onclick = function(e) {
        var card = e.target.closest(".home-example-card");
        if (card && card.dataset.example && EXAMPLES[card.dataset.example]) {
          var md = EXAMPLES[card.dataset.example];
          currentFilePath = null;
          loadDocumentContent(md, null);
          showEditor();
        }
      };
    }

    // ─── Recent item click ───
    if (recentList) {
      recentList.onclick = function(e) {
        var item = e.target.closest(".home-recent-item");
        if (item && item.dataset.filepath) {
          window.mdfyDesktop.openFilePath(item.dataset.filepath);
        }
      };
    }

    // ─── Drop zone ───
    var dropzone = document.getElementById("home-dropzone");
    if (dropzone) {
      dropzone.ondragover = function(e) { e.preventDefault(); dropzone.classList.add("active"); };
      dropzone.ondragleave = function() { dropzone.classList.remove("active"); };
      dropzone.ondrop = function(e) {
        e.preventDefault();
        dropzone.classList.remove("active");
        var files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && files[0].path) {
          window.mdfyDesktop.openFilePath(files[0].path);
        }
      };
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var currentViewMode = "live";

  function loadDocumentContent(markdown, filePath) {
    showEditor();
    currentMarkdown = markdown || "";
    currentFilePath = filePath;
    isReadOnly = false;
    currentCloudDoc = null;
    var oldBanner = document.getElementById("cloud-banner");
    if (oldBanner) oldBanner.remove();
    content.setAttribute("contenteditable", "true");
    updateViewCount(null);

    window.mdfyDesktop.renderMarkdown(currentMarkdown).then(function(result) {
      if (result && result.html !== undefined) {
        content.innerHTML = result.html;
        postProcessAll(content);
        if (result.flavor && result.flavor.primary) {
          currentFlavor = result.flavor.primary;
          updateFlavorBadge(currentFlavor);
        }
      }
      if (cmEditor) cmEditor.setValue(currentMarkdown);
      updateSyncStatusUI("ready");
      renderFileList(); // Update active file highlight
    });
  }

  if (window.mdfyDesktop) {
    window.mdfyDesktop.onLoadDocument(function(data) {
      // Save previous file before switching (if dirty)
      if (isDirty && currentFilePath && window.mdfyDesktop) {
        var prevMarkdown = htmlToMarkdown(content);
        window.mdfyDesktop.autoSave(prevMarkdown);
      }
      isDirty = false; // Reset BEFORE changing currentFilePath

      content = document.getElementById("content");
      currentMarkdown = data.markdown || "";
      currentFilePath = data.filePath || null;
      currentConfig = data.config || null;
      isReadOnly = data.readOnly || false;
      currentCloudDoc = data.cloudDoc || null;

      if (!currentMarkdown && !data.html) {
        showEditor();
        content.innerHTML = "";
      } else {
        showEditor();
        if (data.html) {
          content.innerHTML = data.html;
          postProcessAll(content);
        }
        if (data.flavor) {
          currentFlavor = data.flavor;
          updateFlavorBadge(currentFlavor);
        }
      }

      // Read-only mode for cloud docs
      content.setAttribute("contenteditable", isReadOnly ? "false" : "true");
      var oldBanner = document.getElementById("cloud-banner");
      if (oldBanner) oldBanner.remove();

      if (currentCloudDoc && !currentFilePath) {
        var isOwnerDoc = currentCloudDoc.isOwner;
        var banner = document.createElement("div");
        banner.id = "cloud-banner";
        banner.className = "cloud-banner";
        banner.innerHTML = isOwnerDoc
          ? '<span class="cloud-banner-text">Cloud document — sync to edit locally</span>' +
            '<div class="cloud-banner-actions">' +
              '<button class="cloud-banner-btn" id="cloud-sync-local">Sync to Local</button>' +
            '</div>'
          : '<span class="cloud-banner-text">Cloud document — read only</span>' +
          '<div class="cloud-banner-actions">' +
            '<button class="cloud-banner-btn" id="cloud-duplicate-edit">Duplicate to Edit</button>' +
            '<button class="cloud-banner-btn secondary" id="cloud-sync-local">Sync to Local</button>' +
            '<button class="cloud-banner-btn secondary" id="cloud-open-browser">Open in Browser</button>' +
          '</div>';
        var paneContent = content.parentElement;
        if (paneContent) paneContent.insertBefore(banner, content);

        document.getElementById("cloud-sync-local").addEventListener("click", function() {
          window.mdfyDesktop.syncPullCloud(currentCloudDoc.docId, currentCloudDoc.title).then(function(r) {
            if (r && r.ok) { refreshSidebarData().then(renderSidebar); }
          });
        });
        var openBrowserBtn = document.getElementById("cloud-open-browser");
        if (openBrowserBtn) {
          openBrowserBtn.addEventListener("click", function() {
            window.mdfyDesktop.openInBrowser("https://memory.wiki/" +currentCloudDoc.docId);
          });
        }
        var duplicateBtn = document.getElementById("cloud-duplicate-edit");
        if (duplicateBtn) {
          duplicateBtn.addEventListener("click", function() {
            window.mdfyDesktop.duplicateCloud(currentCloudDoc.docId, currentCloudDoc.title).then(function(r) {
              if (r && r.ok) { refreshSidebarData().then(renderSidebar); }
            });
          });
        }

        // Hide toolbar in read-only mode
        if (toolbar) toolbar.style.display = "none";
      }

      // Update header title
      if (currentFilePath) {
        var parts = currentFilePath.split("/");
        if (headerTitle) headerTitle.textContent = parts[parts.length - 1];
      } else if (currentCloudDoc) {
        if (headerTitle) headerTitle.textContent = currentCloudDoc.title + " (Cloud)";
      } else {
        if (headerTitle) headerTitle.textContent = "Untitled";
      }

      if (cmEditor) cmEditor.setValue(currentMarkdown);
      updateSyncStatusUI(currentConfig && currentConfig.docId ? "synced" : "ready");
      updatePublishedUrl();
      isDirty = false;

      // Update view count if available
      if (data.viewCount !== undefined && data.viewCount !== null) {
        updateViewCount(data.viewCount);
      } else if (currentConfig && currentConfig.docId) {
        // Synced doc — view count may come from the cloud
        updateViewCount(null); // Will be shown if/when we fetch it
      } else {
        updateViewCount(null);
      }

      // Refresh sidebar to update active highlight
      refreshSidebarData().then(renderSidebar);

      // Start/stop collaboration based on whether doc is published
      if (currentConfig && currentConfig.docId && !isReadOnly) {
        window.mdfyDesktop.collabStart(currentConfig.docId, currentMarkdown);
      } else {
        window.mdfyDesktop.collabStop();
      }
    });

    window.mdfyDesktop.onFileChanged(function(data) {
      // Only apply external changes if document is NOT being edited
      if (isDirty) return; // User is editing, ignore external changes
      if (data.markdown !== undefined && data.markdown !== currentMarkdown) {
        currentMarkdown = data.markdown;
        if (data.html) {
          content.innerHTML = data.html;
          postProcessAll(content);
        }
        if (cmEditor && cmEditor.getValue() !== currentMarkdown) {
          cmEditor.setValue(currentMarkdown);
        }
      }
    });

    // Menu triggers
    window.mdfyDesktop.onTriggerSave(function() {
      if (isReadOnly) return;
      currentMarkdown = htmlToMarkdown(content);
      if (currentMarkdown) {
        window.mdfyDesktop.saveFile(currentMarkdown).then(function(p) {
          if (p) {
            currentFilePath = p;
            isDirty = false;
            updateSyncStatusUI("synced");
            if (headerTitle) headerTitle.textContent = p.split("/").pop();
            refreshSidebarData().then(renderSidebar);
          }
        });
      }
    });

    window.mdfyDesktop.onTriggerPublish(function() {
      doPublish();
    });

    // ─── Collaboration event listeners ───

    window.mdfyDesktop.onCollabRemoteChange(function(data) {
      if (!data || !data.markdown || isApplyingRemoteCollab) return;
      isApplyingRemoteCollab = true;
      currentMarkdown = data.markdown;
      // Re-render the WYSIWYG content pane
      window.mdfyDesktop.renderMarkdown(currentMarkdown).then(function(result) {
        if (result && result.html !== undefined) {
          // Preserve scroll position
          var scrollTop = content.scrollTop;
          content.innerHTML = result.html;
          postProcessAll(content);
          content.scrollTop = scrollTop;
        }
        if (cmEditor && cmEditor.getValue() !== currentMarkdown) {
          var scrollInfo = cmEditor.getScrollInfo();
          cmChanging = true;
          cmEditor.setValue(currentMarkdown);
          cmEditor.scrollTo(scrollInfo.left, scrollInfo.top);
          cmChanging = false;
        }
        isApplyingRemoteCollab = false;
      }).catch(function() {
        isApplyingRemoteCollab = false;
      });
    });

    window.mdfyDesktop.onCollabStatus(function(data) {
      isCollaborating = data && data.active;
      updateCollabIndicator();
    });

    window.mdfyDesktop.onCollabPeers(function(data) {
      collabPeerCount = data ? data.count : 0;
      updateCollabIndicator();
    });
  }

  function updateCollabIndicator() {
    var indicator = document.getElementById("collab-indicator");
    if (!indicator) {
      // Create collaboration indicator in the header
      indicator = document.createElement("span");
      indicator.id = "collab-indicator";
      indicator.style.cssText = "display:none; align-items:center; gap:4px; font-size:12px; color:var(--text-muted); margin-left:8px;";
      if (headerSync && headerSync.parentElement) {
        headerSync.parentElement.insertBefore(indicator, headerSync);
      }
    }
    if (isCollaborating && collabPeerCount > 0) {
      indicator.style.display = "inline-flex";
      indicator.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;"></span> ' +
        collabPeerCount + (collabPeerCount === 1 ? " peer" : " peers");
    } else if (isCollaborating) {
      indicator.style.display = "inline-flex";
      indicator.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;"></span> Live';
    } else {
      indicator.style.display = "none";
    }
  }

  // Show home screen on initial load
  showHomeScreen();

  // ════════════════════════════════════════════════════════
  //  PUBLISH
  // ════════════════════════════════════════════════════════

  var publishBtn = document.getElementById("btn-publish");
  if (publishBtn) publishBtn.addEventListener("click", function() { doPublish(); });

  async function doPublish() {
    // Extract fresh markdown from the Live editor before publishing
    if (hasDocument && content && !isReadOnly) {
      currentMarkdown = htmlToMarkdown(content);
      updateDocStats(currentMarkdown);
    }
    if (!currentMarkdown) return;

    var authState = await window.mdfyDesktop.getAuthState();
    if (!authState.loggedIn) {
      if (confirm("Sign in required to publish.\n\nYour document will be published as a shareable URL on memory.wiki.\n\nSign in now?")) {
        window.mdfyDesktop.login();
      }
      return;
    }

    // Confirm first publish
    var isUpdate = currentConfig && currentConfig.docId;
    if (!isUpdate) {
      if (!confirm("Publish to memory.wiki?\n\nA shareable URL will be created and copied to your clipboard.")) return;
    }

    // Save first if needed
    if (!currentFilePath) {
      var savedPath = await window.mdfyDesktop.saveFile(currentMarkdown);
      if (!savedPath) return;
      currentFilePath = savedPath;
    }

    updateSyncStatusUI("syncing");

    try {
      var result = await window.mdfyDesktop.publish(currentMarkdown);
      if (result.error) {
        updateSyncStatusUI("error");
        showToast("Sync failed: " + result.error);
        return;
      }

      if (result.url) {
        window.mdfyDesktop.writeClipboard(result.url);
        updateSyncStatusUI("synced");
        showToast("Published! URL copied.");
        currentConfig = { docId: result.docId, editToken: result.editToken };
        updatePublishedUrl();
        await refreshSidebarData();
        renderSidebar();
        // Start collaboration for newly published doc
        if (currentConfig.docId) {
          window.mdfyDesktop.collabStart(currentConfig.docId, currentMarkdown);
        }
      }
    } catch (err) {
      console.error("[publish] Error:", err);
      updateSyncStatusUI("error");
      showToast("Sync failed: " + (err.message || "Unknown error"));
    }
  }

  // ════════════════════════════════════════════════════════
  //  CONFLICT DIALOG
  // ════════════════════════════════════════════════════════

  var conflictFilePath = null;

  function showConflictDialog(data) {
    conflictFilePath = data ? data.filePath : currentFilePath;
    var dialog = document.getElementById("conflict-dialog");
    if (!dialog) return;
    var p = dialog.querySelector("p");
    if (p && data) {
      var local = data.localUpdatedAt ? new Date(data.localUpdatedAt).toLocaleString() : "unknown";
      var server = data.serverUpdatedAt ? new Date(data.serverUpdatedAt).toLocaleString() : "unknown";
      var fname = data.filePath ? data.filePath.split("/").pop() : "this document";
      p.textContent = fname + " was modified on the server (" + server + ") since your last sync (" + local + ").";
    }
    dialog.classList.remove("hidden");
  }

  document.getElementById("conflict-push").addEventListener("click", function() {
    document.getElementById("conflict-dialog").classList.add("hidden");
    window.mdfyDesktop.resolveConflict("push", conflictFilePath);
  });

  document.getElementById("conflict-pull").addEventListener("click", function() {
    document.getElementById("conflict-dialog").classList.add("hidden");
    window.mdfyDesktop.resolveConflict("pull", conflictFilePath);
  });

  document.getElementById("conflict-dismiss").addEventListener("click", function() {
    document.getElementById("conflict-dialog").classList.add("hidden");
  });

  // Show Diff button
  var conflictDiffBtn = document.getElementById("conflict-diff");
  if (conflictDiffBtn) {
    conflictDiffBtn.addEventListener("click", async function() {
      document.getElementById("conflict-dialog").classList.add("hidden");
      var result = await window.mdfyDesktop.getServerVersion(conflictFilePath);
      if (result.error) { showToast("Failed to load server version: " + result.error); return; }
      showDiffView(result.localMarkdown, result.serverMarkdown);
    });
  }

  function showDiffView(localMd, serverMd) {
    var overlay = document.createElement("div");
    overlay.className = "mermaid-modal-overlay";
    overlay.innerHTML =
      '<div class="mermaid-modal">' +
        '<div class="mermaid-modal-header">' +
          '<span class="mermaid-modal-title">Conflict: Local vs Server</span>' +
          '<div class="mermaid-modal-actions">' +
            '<button class="mermaid-modal-btn" id="diff-use-local">Use Local</button>' +
            '<button class="mermaid-modal-btn" id="diff-use-server">Use Server</button>' +
            '<button class="mermaid-modal-btn primary" id="diff-close">Close</button>' +
          '</div>' +
        '</div>' +
        '<div class="mermaid-modal-body">' +
          '<div class="diff-pane"><div class="diff-pane-label">LOCAL (yours)</div><div class="diff-pane-content" id="diff-local"></div></div>' +
          '<div class="diff-pane"><div class="diff-pane-label" style="color:#60a5fa">SERVER (remote)</div><div class="diff-pane-content" id="diff-server"></div></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Render both as CodeMirror (read-only)
    var localCm = CodeMirror(document.getElementById("diff-local"), {
      value: localMd, mode: "gfm", theme: "material-darker", readOnly: true, lineNumbers: true, lineWrapping: true,
    });
    var serverCm = CodeMirror(document.getElementById("diff-server"), {
      value: serverMd, mode: "gfm", theme: "material-darker", readOnly: true, lineNumbers: true, lineWrapping: true,
    });
    setTimeout(function() { localCm.refresh(); serverCm.refresh(); }, 50);

    document.getElementById("diff-use-local").addEventListener("click", function() {
      overlay.remove();
      window.mdfyDesktop.resolveConflict("push", conflictFilePath);
      showToast("Pushed local version");
    });
    document.getElementById("diff-use-server").addEventListener("click", function() {
      overlay.remove();
      window.mdfyDesktop.resolveConflict("pull", conflictFilePath);
      showToast("Pulled server version");
    });
    document.getElementById("diff-close").addEventListener("click", function() { overlay.remove(); });
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener("keydown", function(e) { if (e.key === "Escape") overlay.remove(); });
  }

  // ════════════════════════════════════════════════════════
  //  POST-PROCESSING
  // ════════════════════════════════════════════════════════

  function postProcessAll(root) {
    root.querySelectorAll("pre[lang] code").forEach(function(block) {
      var lang = block.parentElement.getAttribute("lang");
      if (lang && lang !== "mermaid") block.className = "language-" + lang;
    });
    root.querySelectorAll("pre code").forEach(function(block) {
      if (typeof hljs !== "undefined") hljs.highlightElement(block);
    });

    root.querySelectorAll("[data-math-style]").forEach(function(el) {
      if (typeof katex !== "undefined") {
        try {
          katex.render(el.textContent || "", el, {
            displayMode: el.getAttribute("data-math-style") === "display",
            throwOnError: false,
            strict: false,
          });
        } catch (e) {}
      }
    });

    postProcessCodeBlocks(root);
    postProcessMermaid();
    postProcessAsciiDiagrams(root);
    setupNonEditableIslands(root);

    // Update outline panel after content changes
    setTimeout(updateOutlinePanel, 50);
  }

  function postProcessAsciiDiagrams(root) {
    var boxCharsRegex = /[┌┐└┘│─├┤┬┴┼╌═║]/g;
    root.querySelectorAll("pre[lang] code, pre:not([lang]) code").forEach(function(code) {
      var pre = code.closest("pre");
      if (!pre) return;
      var lang = pre.getAttribute("lang");
      if (lang === "mermaid") return;
      if (pre.querySelector(".ascii-convert-btn")) return;

      var text = code.textContent || "";
      var matches = text.match(boxCharsRegex);
      if (!matches || matches.length < 5) return;

      var btn = document.createElement("button");
      btn.className = "ascii-convert-btn";
      btn.textContent = "Convert to Mermaid";
      btn.title = "Convert this ASCII diagram to Mermaid using AI";
      btn.style.cssText = "position:absolute;top:6px;right:6px;padding:3px 10px;font-size:10px;font-family:ui-monospace,monospace;background:var(--accent-dim,rgba(251,146,60,0.15));color:var(--accent,#fb923c);border:1px solid var(--accent,#fb923c);border-radius:4px;cursor:pointer;z-index:5;line-height:14px";
      pre.style.position = "relative";
      pre.appendChild(btn);

      btn.addEventListener("click", async function(e) {
        e.stopPropagation();
        e.preventDefault();
        btn.textContent = "Converting...";
        btn.disabled = true;
        btn.style.opacity = "0.7";

        try {
          var res = await fetch("https://memory.wiki/api/ascii-to-mermaid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ascii: text, context: (currentMarkdown || "").substring(0, 2000) }),
          });
          if (!res.ok) throw new Error("API error");
          var data = await res.json();
          if (!data.mermaid) throw new Error("No mermaid code");

          // Replace in markdown source
          var idx = currentMarkdown.indexOf(text);
          if (idx !== -1) {
            var before = currentMarkdown.lastIndexOf("```", idx);
            var after = currentMarkdown.indexOf("```", idx + text.length);
            if (before !== -1 && after !== -1) {
              var newMd = currentMarkdown.substring(0, before) + "```mermaid\n" + data.mermaid + "\n" + currentMarkdown.substring(after);
              currentMarkdown = newMd;
              if (typeof cm !== "undefined" && cm) cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: newMd } });
              reRenderMarkdown(newMd);
            }
          }
        } catch (err) {
          btn.textContent = "Failed";
          btn.style.color = "#ef4444";
          setTimeout(function() {
            btn.textContent = "Convert to Mermaid";
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.color = "var(--accent,#fb923c)";
          }, 2000);
        }
      });
    });
  }

  async function reRenderMarkdown(markdown) {
    if (isRendering || !window.mdfyDesktop) return;
    isRendering = true;
    var t0 = performance.now();
    try {
      var result = await window.mdfyDesktop.renderMarkdown(markdown);
      if (result && result.html !== undefined) {
        var caretOffset = getCaretCharacterOffset(content);
        content.innerHTML = result.html;
        postProcessAll(content);
        if (caretOffset > 0) restoreCaretPosition(content, caretOffset);
        if (result.flavor && result.flavor.primary) {
          currentFlavor = result.flavor.primary;
          updateFlavorBadge(currentFlavor);
        }
      }
      var elapsed = performance.now() - t0;
      updateRenderTime(elapsed);
    } catch (err) {
      console.error("Render error:", err);
    } finally {
      isRendering = false;
    }
    updateDocStats(markdown);
  }

  function updateDocStats(md) {
    if (!md) md = "";
    var words = md.trim() ? md.trim().split(/\s+/).length : 0;
    var chars = md.length;
    var lines = md.split("\n").length;
    var elW = document.getElementById("stat-words");
    var elC = document.getElementById("stat-chars");
    var elL = document.getElementById("stat-lines");
    if (elW) elW.textContent = words.toLocaleString() + " words";
    if (elC) elC.textContent = chars.toLocaleString() + " chars";
    if (elL) elL.textContent = lines.toLocaleString() + " lines";
  }

  function updateRenderTime(ms) {
    var el = document.getElementById("render-ms");
    if (el) el.textContent = ms.toFixed(0) + "ms";
  }

  // ════════════════════════════════════════════════════════
  //  WYSIWYG EDITING (kept from original editor.js)
  // ════════════════════════════════════════════════════════

  // Save on blur (focus lost) to prevent data loss
  content.addEventListener("blur", function() {
    if (isDirty && hasDocument && currentFilePath && window.mdfyDesktop && !isReadOnly) {
      currentMarkdown = htmlToMarkdown(content);
      window.mdfyDesktop.autoSave(currentMarkdown);
      isDirty = false;
    }
  });

  // On input in Live pane: extract markdown and sync to Source pane.
  // Never re-render the Live pane itself (user is typing there).
  var liveInputDebounce = null;
  content.addEventListener("input", function() {
    if (isReadOnly) return;
    isDirty = true;
    updateSyncStatusUI("editing");
    if (liveInputDebounce) clearTimeout(liveInputDebounce);
    liveInputDebounce = setTimeout(function() {
      currentMarkdown = htmlToMarkdown(content);
      updateDocStats(currentMarkdown);
      // Sync to Source pane if visible (user is NOT typing there)
      if (cmEditor && sourceVisible) {
        cmChanging = true;
        var scrollInfo = cmEditor.getScrollInfo();
        cmEditor.setValue(currentMarkdown);
        cmEditor.scrollTo(scrollInfo.left, scrollInfo.top);
        cmChanging = false;
      }
      // Broadcast to collaboration peers
      if (isCollaborating && !isApplyingRemoteCollab && window.mdfyDesktop) {
        window.mdfyDesktop.collabLocalChange(currentMarkdown);
      }
    }, 400);
  });

  content.addEventListener("keydown", function(e) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      switch (e.key) {
        case "b": e.preventDefault(); applyInlineFormat("bold"); break;
        case "i": e.preventDefault(); applyInlineFormat("italic"); break;
        case "k": e.preventDefault(); insertLink(); break;
        case "s":
          e.preventDefault();
          if (window.mdfyDesktop && !isReadOnly) {
            currentMarkdown = htmlToMarkdown(content);
            updateDocStats(currentMarkdown);
            if (!currentFilePath) {
              // New file — trigger save dialog
              window.mdfyDesktop.saveFile(currentMarkdown).then(function(p) {
                if (p) {
                  currentFilePath = p;
                  isDirty = false;
                  updateSyncStatusUI("synced");
                  if (headerTitle) headerTitle.textContent = p.split("/").pop();
                  refreshSidebarData().then(renderSidebar);
                }
              });
            } else {
              window.mdfyDesktop.autoSave(currentMarkdown);
              isDirty = false;
              updateSyncStatusUI("synced");
            }
          }
          break;
      }
    }
  });

  // Auto-save every 3 seconds
  // Auto-save: extract markdown from DOM only at save time, not during typing.
  setInterval(function() {
    if (isDirty && hasDocument && window.mdfyDesktop && !isReadOnly && currentFilePath) {
      currentMarkdown = htmlToMarkdown(content);
      updateDocStats(currentMarkdown);
      window.mdfyDesktop.autoSave(currentMarkdown);
      isDirty = false;
      updateSyncStatusUI("synced");
      // Sync source editor if visible (with loop guard)
      if (cmEditor && sourceVisible && cmEditor.getValue() !== currentMarkdown) {
        cmChanging = true;
        var cursor = cmEditor.getCursor();
        cmEditor.setValue(currentMarkdown);
        cmEditor.setCursor(cursor);
        cmChanging = false;
      }
    }
  }, 3000);

  // ─── Toolbar ───

  toolbar.addEventListener("click", function(e) {
    var button = e.target.closest("button[data-action]");
    if (!button) return;
    var action = button.getAttribute("data-action");
    if (!action) return;
    if (action === "ai-tools") return; // Handled by its own click listener
    e.preventDefault();
    content.focus();

    switch (action) {
      case "undo": document.execCommand("undo", false, null); triggerEditDebounce(); break;
      case "redo": document.execCommand("redo", false, null); triggerEditDebounce(); break;
      case "bold": applyInlineFormat("bold"); break;
      case "italic": applyInlineFormat("italic"); break;
      case "strikethrough": applyInlineFormat("strikethrough"); break;
      case "code": applyInlineFormat("code"); break;
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": case "p":
        applyBlockFormat(action); break;
      case "ul": case "ol": case "task": case "blockquote":
        applyBlockFormat(action); break;
      case "indent": applyIndent(); break;
      case "outdent": applyOutdent(); break;
      case "link": insertLink(); break;
      case "image": insertImagePrompt(); break;
      case "table": showTableGridSelector(button); break;
      case "codeblock": insertCodeBlock(); break;
      case "math": insertMathBlock(); break;
      case "hr": insertHorizontalRule(); break;
      case "removeFormat": removeFormatting(); break;
    }
  });

  // ─── Toggle Pills ───

  var isNarrow = true;
  var isToolbarVisible = true;
  var narrowToggle = document.getElementById("narrow-toggle");
  var toolbarToggle = document.getElementById("toolbar-toggle");

  function setupPaneToggle(btn, onToggle) {
    if (!btn) return;
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      var active = btn.getAttribute("data-active") === "true";
      var newState = !active;
      btn.setAttribute("data-active", String(newState));
      onToggle(newState);
    });
  }

  setupPaneToggle(narrowToggle, function(on) {
    isNarrow = on;
    content.classList.toggle("narrow", on);
  });

  setupPaneToggle(toolbarToggle, function(on) {
    isToolbarVisible = on;
    toolbar.style.display = on ? "" : "none";
  });

  // ─── View Mode ───

  var sourceVisible = false;
  // sourceView is now editorPane (declared above)
  var sourceEditorContainer = document.getElementById("source-editor-container");
  var sourceDebounce = null;
  var cmEditor = null;
  var cmChanging = false;

  function initCodeMirror() {
    if (cmEditor || typeof CodeMirror === "undefined") return;
    cmEditor = CodeMirror(sourceEditorContainer, {
      value: currentMarkdown,
      mode: "gfm",
      theme: "material-darker",
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      viewportMargin: 50,
      extraKeys: {
        Tab: function(cm) { cm.replaceSelection("  ", "end"); },
        "Cmd-S": function(cm) {
          if (window.mdfyDesktop && !isReadOnly) {
            currentMarkdown = cm.getValue();
            updateDocStats(currentMarkdown);
            if (!currentFilePath) {
              window.mdfyDesktop.saveFile(currentMarkdown).then(function(p) {
                if (p) {
                  currentFilePath = p;
                  isDirty = false;
                  updateSyncStatusUI("synced");
                  if (headerTitle) headerTitle.textContent = p.split("/").pop();
                  refreshSidebarData().then(renderSidebar);
                }
              });
            } else {
              window.mdfyDesktop.autoSave(currentMarkdown);
              isDirty = false;
              updateSyncStatusUI("synced");
            }
          }
        },
      },
    });
    cmEditor.on("change", function() {
      if (cmChanging) return;
      currentMarkdown = cmEditor.getValue();
      isDirty = true;
      updateSyncStatusUI("editing");
      // Update Live pane preview immediately (user is typing in Source, not Live)
      if (sourceDebounce) clearTimeout(sourceDebounce);
      sourceDebounce = setTimeout(function() {
        reRenderMarkdown(currentMarkdown);
        updateDocStats(currentMarkdown);
        // Broadcast to collaboration peers
        if (isCollaborating && !isApplyingRemoteCollab && window.mdfyDesktop) {
          window.mdfyDesktop.collabLocalChange(currentMarkdown);
        }
      }, 250);
    });
  }

  var splitDivider = document.getElementById("split-divider");
  var splitPercent = 60;

  function setViewMode(mode) {
    currentViewMode = mode;
    sourceVisible = mode === "source" || mode === "split";
    document.querySelectorAll(".view-btn").forEach(function(btn) {
      btn.classList.toggle("active", btn.getAttribute("data-view") === mode);
    });

    if (mode === "split") {
      renderPane.style.display = "flex";
      renderPane.style.width = splitPercent + "%";
      renderPane.style.flexShrink = "0";
      editorPane.style.display = "flex";
      editorPane.style.width = "";
      editorPane.style.flex = "1";
      splitDivider.style.display = "";
      if (toolbar) toolbar.style.display = isToolbarVisible ? "" : "none";
      if (!cmEditor) initCodeMirror(); else cmEditor.setValue(currentMarkdown);
      if (cmEditor) setTimeout(function() { cmEditor.refresh(); }, 50);
    } else if (mode === "source") {
      renderPane.style.display = "none";
      editorPane.style.display = "flex";
      editorPane.style.width = "100%";
      editorPane.style.flex = "1";
      splitDivider.style.display = "none";
      if (toolbar) toolbar.style.display = "none";
      if (!cmEditor) initCodeMirror(); else cmEditor.setValue(currentMarkdown);
      if (cmEditor) { cmEditor.focus(); setTimeout(function() { cmEditor.refresh(); }, 50); }
    } else {
      // Live
      renderPane.style.display = "flex";
      renderPane.style.width = "100%";
      renderPane.style.flexShrink = "";
      editorPane.style.display = "none";
      splitDivider.style.display = "none";
      if (toolbar) toolbar.style.display = isToolbarVisible ? "" : "none";
      content.focus();
    }
  }

  // ─── Split Divider Drag ───
  var isDraggingSplit = false;
  if (splitDivider) {
    splitDivider.addEventListener("mousedown", function(e) {
      e.preventDefault();
      isDraggingSplit = true;
      splitDivider.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });
  }
  document.addEventListener("mousemove", function(e) {
    if (!isDraggingSplit || !splitContainer) return;
    var rect = splitContainer.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var pct = Math.max(25, Math.min(75, (x / rect.width) * 100));
    splitPercent = pct;
    renderPane.style.width = pct + "%";
    if (cmEditor) cmEditor.refresh();
  });
  document.addEventListener("mouseup", function() {
    if (isDraggingSplit) {
      isDraggingSplit = false;
      if (splitDivider) splitDivider.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (cmEditor) cmEditor.refresh();
    }
  });

  document.addEventListener("click", function(e) {
    var btn = e.target.closest(".view-btn");
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      var view = btn.getAttribute("data-view");
      if (view === "home") {
        showHomeScreen();
      } else {
        if (hasDocument) {
          // If home screen is visible, switch back to editor first
          if (homeScreen && homeScreen.style.display !== "none") {
            showEditor();
          }
          setViewMode(view);
        } else {
          showHomeScreen();
        }
      }
    }
  });

  // ════════════════════════════════════════════════════════
  //  FORMATTING FUNCTIONS (unchanged from original)
  // ════════════════════════════════════════════════════════

  function applyInlineFormat(format) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var text = range.toString();
    if (!text) return;
    var wrapper;
    switch (format) {
      case "bold": wrapper = document.createElement("strong"); break;
      case "italic": wrapper = document.createElement("em"); break;
      case "strikethrough": wrapper = document.createElement("del"); break;
      case "code": wrapper = document.createElement("code"); break;
      default: return;
    }
    var parentTag = range.commonAncestorContainer.parentElement;
    if (parentTag && parentTag.tagName === wrapper.tagName && parentTag !== content) {
      var textNode = document.createTextNode(parentTag.textContent || "");
      parentTag.parentNode.replaceChild(textNode, parentTag);
    } else { range.surroundContents(wrapper); }
    triggerEditDebounce();
  }

  function applyBlockFormat(format) {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var blockNode = findBlockParent(range.startContainer);
    if (!blockNode || blockNode === content) {
      // No block parent — wrap in a paragraph first
      blockNode = document.createElement("p");
      blockNode.textContent = range.startContainer.textContent || "";
      if (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.parentNode === content) {
        content.replaceChild(blockNode, range.startContainer);
      } else if (content.childNodes.length === 0) {
        blockNode.innerHTML = "<br>";
        content.appendChild(blockNode);
      } else {
        return;
      }
    }
    var newNode;
    switch (format) {
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
        newNode = document.createElement(format); newNode.textContent = blockNode.textContent; break;
      case "p": newNode = document.createElement("p"); newNode.textContent = blockNode.textContent; break;
      case "blockquote":
        newNode = document.createElement("blockquote");
        var p = document.createElement("p"); p.textContent = blockNode.textContent;
        newNode.appendChild(p); break;
      case "ul": { newNode = document.createElement("ul"); var li = document.createElement("li"); li.textContent = blockNode.textContent; newNode.appendChild(li); break; }
      case "ol": { newNode = document.createElement("ol"); var li2 = document.createElement("li"); li2.textContent = blockNode.textContent; newNode.appendChild(li2); break; }
      case "task": {
        newNode = document.createElement("ul"); newNode.className = "contains-task-list";
        var tli = document.createElement("li"); tli.className = "task-list-item";
        var cb = document.createElement("input"); cb.type = "checkbox"; cb.disabled = false;
        tli.appendChild(cb); tli.appendChild(document.createTextNode(" " + blockNode.textContent));
        newNode.appendChild(tli); break;
      }
      default: return;
    }
    blockNode.parentNode.replaceChild(newNode, blockNode);
    triggerEditDebounce();
  }

  function insertLink() {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var text = range.toString() || "link text";
    var link = document.createElement("a"); link.href = "https://"; link.textContent = text;
    range.deleteContents(); range.insertNode(link);
    sel.selectAllChildren(link); triggerEditDebounce();
  }

  function insertImagePrompt() {
    var url = prompt("Image URL:"); if (!url) return;
    var alt = prompt("Alt text:", "image") || "image";
    insertImageElement(url, alt);
  }

  function insertImageElement(url, alt) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      var img = document.createElement("img"); img.src = url; img.alt = alt || "image";
      var p2 = document.createElement("p"); p2.appendChild(img); content.appendChild(p2);
    } else {
      var range = sel.getRangeAt(0);
      var img2 = document.createElement("img"); img2.src = url; img2.alt = alt || "image";
      range.deleteContents(); range.insertNode(img2); sel.collapseToEnd();
    }
    triggerEditDebounce();
  }

  function insertMathBlock() {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var blockNode = findBlockParent(range.startContainer);
    var p = document.createElement("p");
    p.textContent = "$$\nE = mc^2\n$$";
    if (blockNode && blockNode !== content) { blockNode.parentNode.insertBefore(p, blockNode.nextSibling); }
    else { content.appendChild(p); }
    triggerEditDebounce();
  }

  function insertCodeBlock() {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var blockNode = findBlockParent(range.startContainer);
    var pre = document.createElement("pre"); var code = document.createElement("code");
    code.textContent = range.toString() || "code here"; pre.appendChild(code);
    if (blockNode && blockNode !== content) { blockNode.parentNode.insertBefore(pre, blockNode.nextSibling); }
    else { content.appendChild(pre); }
    triggerEditDebounce();
  }

  function insertHorizontalRule() {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var blockNode = findBlockParent(range.startContainer);
    var hr = document.createElement("hr");
    if (blockNode && blockNode !== content) { blockNode.parentNode.insertBefore(hr, blockNode.nextSibling); }
    else { content.appendChild(hr); }
    triggerEditDebounce();
  }

  function insertTable(cols, rows) {
    cols = cols || 3; rows = rows || 3;
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var blockNode = findBlockParent(range.startContainer);
    var table = document.createElement("table");
    var thead = document.createElement("thead"); var headerRow = document.createElement("tr");
    for (var h = 0; h < cols; h++) { var th = document.createElement("th"); th.textContent = "Header " + (h + 1); headerRow.appendChild(th); }
    thead.appendChild(headerRow); table.appendChild(thead);
    var tbody = document.createElement("tbody");
    var bodyRows = Math.max(1, rows - 1); // First row is the header
    for (var r = 0; r < bodyRows; r++) { var row = document.createElement("tr"); for (var c = 0; c < cols; c++) { var td = document.createElement("td"); td.textContent = ""; row.appendChild(td); } tbody.appendChild(row); }
    table.appendChild(tbody);
    if (blockNode && blockNode !== content) { blockNode.parentNode.insertBefore(table, blockNode.nextSibling); }
    else { content.appendChild(table); }
    triggerEditDebounce();
  }

  function applyIndent() {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var li = findParentByTag(sel.getRangeAt(0).startContainer, "LI");
    if (!li) return;
    var prevLi = li.previousElementSibling;
    if (!prevLi || prevLi.tagName !== "LI") return;
    var parentList = li.parentNode;
    var nestedList = prevLi.querySelector(parentList.tagName.toLowerCase());
    if (!nestedList) { nestedList = document.createElement(parentList.tagName.toLowerCase()); prevLi.appendChild(nestedList); }
    nestedList.appendChild(li); triggerEditDebounce();
  }

  function applyOutdent() {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var li = findParentByTag(sel.getRangeAt(0).startContainer, "LI");
    if (!li) return;
    var parentList = li.parentNode; if (!parentList) return;
    var grandparentLi = parentList.parentNode;
    if (!grandparentLi || grandparentLi.tagName !== "LI") return;
    var outerList = grandparentLi.parentNode; if (!outerList) return;
    outerList.insertBefore(li, grandparentLi.nextSibling);
    if (parentList.children.length === 0) parentList.parentNode.removeChild(parentList);
    triggerEditDebounce();
  }

  function removeFormatting() {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0); var text = range.toString(); if (!text) return;
    range.deleteContents(); range.insertNode(document.createTextNode(text));
    sel.collapseToEnd(); triggerEditDebounce();
  }

  // ─── Table Grid Selector ───
  var activeGridSelector = null;
  function showTableGridSelector(button) {
    hideTableGridSelector();
    var rect = button.getBoundingClientRect();
    var grid = document.createElement("div"); grid.className = "table-grid-selector";
    grid.style.left = rect.left + "px"; grid.style.top = (rect.bottom + 4) + "px";
    var label = document.createElement("div"); label.className = "grid-label"; label.textContent = "Select size";
    grid.appendChild(label);
    var gc = document.createElement("div"); gc.className = "grid-cells";
    for (var r = 0; r < 5; r++) for (var c = 0; c < 6; c++) {
      var cell = document.createElement("div"); cell.className = "grid-cell";
      cell.setAttribute("data-row", String(r)); cell.setAttribute("data-col", String(c));
      gc.appendChild(cell);
    }
    grid.appendChild(gc);
    gc.addEventListener("mouseover", function(e) {
      var cell2 = e.target.closest(".grid-cell"); if (!cell2) return;
      var hr2 = parseInt(cell2.getAttribute("data-row")), hc2 = parseInt(cell2.getAttribute("data-col"));
      label.textContent = (hc2 + 1) + " x " + (hr2 + 1);
      gc.querySelectorAll(".grid-cell").forEach(function(c2) {
        c2.classList.toggle("active", parseInt(c2.getAttribute("data-row")) <= hr2 && parseInt(c2.getAttribute("data-col")) <= hc2);
      });
    });
    gc.addEventListener("click", function(e) {
      var cell3 = e.target.closest(".grid-cell"); if (!cell3) return;
      hideTableGridSelector(); content.focus();
      insertTable(parseInt(cell3.getAttribute("data-col")) + 1, parseInt(cell3.getAttribute("data-row")) + 1);
    });
    document.body.appendChild(grid); activeGridSelector = grid;
    setTimeout(function() { document.addEventListener("click", hideTableGridSelector, { once: true }); }, 0);
  }
  function hideTableGridSelector() { if (activeGridSelector) { activeGridSelector.remove(); activeGridSelector = null; } }

  // ─── Paste & Drop ───

  content.addEventListener("paste", function(e) {
    if (isReadOnly) return;
    var cd = e.clipboardData; if (!cd) return;

    // Check for image paste first
    var items = cd.items;
    if (items) {
      for (var idx = 0; idx < items.length; idx++) {
        if (items[idx].type.startsWith("image/")) {
          e.preventDefault();
          var file = items[idx].getAsFile();
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function(ev) {
            var dataUrl = ev.target.result;
            var base64 = dataUrl.split(",")[1];
            var mime = dataUrl.split(":")[1].split(";")[0];
            // Upload to API
            showToast("Uploading image...");
            window.mdfyDesktop.uploadImage(base64, mime, "pasted-image.png").then(function(result) {
              if (result.url) {
                insertImageElement(result.url, "image");
                showToast("Image uploaded");
              } else if (result.error) {
                // Fallback: insert as data URL
                insertImageElement(dataUrl, "image");
                showToast("Image inserted locally (upload failed)");
              }
            });
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }

    // HTML paste — sanitize and insert as HTML (preserving structure)
    var htmlData = cd.getData("text/html");
    if (htmlData && htmlData.trim()) {
      if (/<(h[1-6]|p|ul|ol|li|table|tr|td|th|blockquote|pre|code|a|strong|em|b|i|img)\b/i.test(htmlData)) {
        e.preventDefault();
        var temp = document.createElement("div"); temp.innerHTML = htmlData;
        temp.querySelectorAll("style, script, meta, link, svg").forEach(function(el) { el.remove(); });
        // Strip all class/id/style attributes to get clean HTML
        temp.querySelectorAll("*").forEach(function(el) {
          el.removeAttribute("class"); el.removeAttribute("id"); el.removeAttribute("style");
        });
        // Convert to markdown then re-render to get clean memory.wiki HTML
        var pastedMd = htmlToMarkdown(temp).trim();
        if (pastedMd) {
          window.mdfyDesktop.renderMarkdown(pastedMd).then(function(r) {
            if (r && r.html) {
              document.execCommand("insertHTML", false, r.html);
            } else {
              document.execCommand("insertText", false, pastedMd);
            }
            triggerEditDebounce();
          });
        }
        return;
      }
    }
  });

  content.addEventListener("dragover", function(e) { e.preventDefault(); });
  content.addEventListener("drop", function(e) {
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (var i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        e.preventDefault();
        var file = files[i];
        var reader = new FileReader();
        reader.onload = function(ev) { insertImageElement(ev.target.result, file.name); };
        reader.readAsDataURL(file); break;
      }
    }
  });

  // ════════════════════════════════════════════════════════
  //  HTML → MARKDOWN CONVERSION (unchanged)
  // ════════════════════════════════════════════════════════

  function htmlToMarkdown(root) {
    var result = "";
    for (var i = 0; i < root.childNodes.length; i++) {
      var child = root.childNodes[i];
      if (child.nodeType === 1 && child.classList && child.classList.contains("ce-spacer")) continue;
      if (child.nodeType === 1 && child.classList && (child.classList.contains("code-header") || child.classList.contains("mermaid-edit-btn"))) continue;
      result += nodeToMarkdown(child, 0);
    }
    return result.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function nodeToMarkdown(node, depth) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    // Skip UI elements injected by postProcessAll
    if (node.classList && (node.classList.contains("ce-spacer") || node.classList.contains("code-header") || node.classList.contains("mermaid-edit-btn") || node.classList.contains("cloud-banner"))) return "";
    var tag = node.tagName.toLowerCase();
    var innerText = node.textContent || "";
    var childMd = "";
    switch (tag) {
      case "h1": return "# " + innerText.trim() + "\n\n";
      case "h2": return "## " + innerText.trim() + "\n\n";
      case "h3": return "### " + innerText.trim() + "\n\n";
      case "h4": return "#### " + innerText.trim() + "\n\n";
      case "h5": return "##### " + innerText.trim() + "\n\n";
      case "h6": return "###### " + innerText.trim() + "\n\n";
      case "p": return inlineChildrenToMd(node) + "\n\n";
      case "br": return "\n";
      case "strong": case "b": return "**" + inlineChildrenToMd(node) + "**";
      case "em": case "i": return "*" + inlineChildrenToMd(node) + "*";
      case "del": case "s": return "~~" + inlineChildrenToMd(node) + "~~";
      case "code":
        if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") return innerText;
        return "`" + innerText.replace(/`/g, "\\`") + "`";
      case "pre": {
        var lang = node.getAttribute("lang") || "";
        var codeEl = node.querySelector("code");
        return "```" + lang + "\n" + (codeEl ? codeEl.textContent : innerText) + "\n```\n\n";
      }
      case "a": return "[" + inlineChildrenToMd(node) + "](" + (node.getAttribute("href") || "") + ")";
      case "img": return "![" + (node.getAttribute("alt") || "") + "](" + (node.getAttribute("src") || "") + ")\n\n";
      case "blockquote":
        childMd = blockChildrenToMd(node);
        return childMd.split("\n").map(function(line) { return "> " + line; }).join("\n") + "\n\n";
      case "ul": return listToMarkdown(node, "ul", depth) + "\n";
      case "ol": return listToMarkdown(node, "ol", depth) + "\n";
      case "li": return inlineChildrenToMd(node);
      case "hr": return "---\n\n";
      case "table": return tableToMarkdown(node) + "\n\n";
      case "input":
        if (node.type === "checkbox") return node.checked ? "[x] " : "[ ] ";
        return "";
      case "details": {
        var summary = node.querySelector("summary");
        var summaryText = summary ? summary.textContent.trim() : "Details";
        for (var c2 = 0; c2 < node.childNodes.length; c2++) {
          if (node.childNodes[c2] !== summary) childMd += nodeToMarkdown(node.childNodes[c2], depth);
        }
        return "<details>\n<summary>" + summaryText + "</summary>\n\n" + childMd.trim() + "\n</details>\n\n";
      }
      case "div":
        // Mermaid diagrams: preserve original code
        if (node.classList && node.classList.contains("mermaid") && node.getAttribute("data-original-code")) {
          return "```mermaid\n" + node.getAttribute("data-original-code") + "\n```\n\n";
        }
        for (var j = 0; j < node.childNodes.length; j++) childMd += nodeToMarkdown(node.childNodes[j], depth);
        return childMd;
      case "section": case "article": case "main": case "aside": case "header": case "footer": case "nav":
        for (var j2 = 0; j2 < node.childNodes.length; j2++) childMd += nodeToMarkdown(node.childNodes[j2], depth);
        return childMd;
      case "span":
        if (node.getAttribute("data-math-style") === "display") return "$$\n" + innerText.trim() + "\n$$\n\n";
        if (node.getAttribute("data-math-style") === "inline") return "$" + innerText.trim() + "$";
        // KaTeX-rendered spans have class "katex" or "katex-display"
        if (node.classList && (node.classList.contains("katex") || node.classList.contains("katex-display"))) {
          var mathEl = node.closest("[data-math-style]");
          if (mathEl) return ""; // Already handled by parent
        }
        return inlineChildrenToMd(node);
      default: return innerText;
    }
  }

  function inlineChildrenToMd(node) {
    var result = "";
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      result += c.nodeType === Node.TEXT_NODE ? (c.textContent || "") : nodeToMarkdown(c, 0);
    }
    return result;
  }

  function blockChildrenToMd(node) {
    var result = "";
    for (var i = 0; i < node.childNodes.length; i++) result += nodeToMarkdown(node.childNodes[i], 0);
    return result.trim();
  }

  function listToMarkdown(listNode, type, depth) {
    var result = "", items = listNode.children, indent = "  ".repeat(depth);
    for (var i = 0; i < items.length; i++) {
      var li = items[i]; if (li.tagName.toLowerCase() !== "li") continue;
      var prefix;
      if (type === "ol") { prefix = (i + 1) + ". "; }
      else {
        var checkbox = li.querySelector("input[type='checkbox']");
        prefix = checkbox ? (checkbox.checked ? "- [x] " : "- [ ] ") : "- ";
      }
      var textContent = "", nestedList = "";
      for (var j = 0; j < li.childNodes.length; j++) {
        var child = li.childNodes[j];
        if (child.nodeType === Node.ELEMENT_NODE) {
          var ct = child.tagName.toLowerCase();
          if (ct === "ul" || ct === "ol") { nestedList += listToMarkdown(child, ct, depth + 1); }
          else if (ct === "input" && child.type === "checkbox") { /* skip */ }
          else { textContent += nodeToMarkdown(child, depth); }
        } else if (child.nodeType === Node.TEXT_NODE) { textContent += child.textContent || ""; }
      }
      result += indent + prefix + textContent.trim() + "\n";
      if (nestedList) result += nestedList;
    }
    return result;
  }

  function tableToMarkdown(tableNode) {
    var rows = tableNode.querySelectorAll("tr"); if (rows.length === 0) return "";
    var result = "", colCount = 0;
    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].querySelectorAll("th, td");
      if (i === 0) colCount = cells.length;
      var row = "|";
      for (var j = 0; j < cells.length; j++) row += " " + (cells[j].textContent || "").trim() + " |";
      result += row + "\n";
      if (i === 0) {
        var sep = "|"; for (var k = 0; k < colCount; k++) sep += " --- |";
        result += sep + "\n";
      }
    }
    return result;
  }

  // ════════════════════════════════════════════════════════
  //  HELPERS
  // ════════════════════════════════════════════════════════

  function findBlockParent(node) {
    var blockTags = ["P","H1","H2","H3","H4","H5","H6","LI","BLOCKQUOTE","PRE","DIV","TABLE","UL","OL","HR","DETAILS"];
    var current = node;
    while (current && current !== content) {
      if (current.nodeType === Node.ELEMENT_NODE && blockTags.indexOf(current.tagName) !== -1) return current;
      current = current.parentNode;
    }
    return null;
  }

  function findParentByTag(node, tagName) {
    var current = node;
    while (current && current !== content) {
      if (current.nodeType === Node.ELEMENT_NODE && current.tagName === tagName) return current;
      current = current.parentNode;
    }
    return null;
  }

  function triggerEditDebounce() {
    // Just mark dirty. Markdown extraction happens at auto-save time.
    isDirty = true;
    updateSyncStatusUI("editing");
  }

  function getCaretCharacterOffset(element) {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      var range = sel.getRangeAt(0);
      var pre = range.cloneRange(); pre.selectNodeContents(element); pre.setEnd(range.endContainer, range.endOffset);
      return pre.toString().length;
    }
    return 0;
  }

  function restoreCaretPosition(element, offset) {
    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    var currentOffset = 0, node;
    while ((node = walker.nextNode())) {
      var len = (node.textContent || "").length;
      if (currentOffset + len >= offset) {
        var sel = window.getSelection();
        if (sel) { var range = document.createRange(); range.setStart(node, Math.min(offset - currentOffset, len)); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); }
        return;
      }
      currentOffset += len;
    }
  }

  function updateSyncStatusUI(status) {
    // Update header sync indicator
    if (headerSync) {
      switch (status) {
        case "synced": headerSync.textContent = "Saved"; headerSync.style.color = "var(--text-faint)"; break;
        case "syncing": headerSync.textContent = "Saving..."; headerSync.style.color = "#60a5fa"; break;
        case "editing": headerSync.textContent = ""; break;
        case "error": headerSync.textContent = "Error"; headerSync.style.color = "#ef4444"; break;
        default: headerSync.textContent = ""; break;
      }
    }
  }

  // ─── Non-Editable Islands ───

  function setupNonEditableIslands(root) {
    // Minimal approach: only mark mermaid diagrams as non-editable.
    // Keep everything else editable for smooth typing.
    root.querySelectorAll(".mermaid").forEach(function(el) {
      el.setAttribute("contenteditable", "false");
    });
  }

  function postProcessCodeBlocks(root) {
    root.querySelectorAll("pre[lang]").forEach(function(pre) {
      if (pre.querySelector(".code-header")) return;
      var lang = pre.getAttribute("lang"); if (lang === "mermaid") return;
      var header = document.createElement("div"); header.className = "code-header";
      var langLabel = document.createElement("span"); langLabel.className = "code-lang"; langLabel.textContent = lang;
      header.appendChild(langLabel);
      var copyBtn = document.createElement("button"); copyBtn.className = "code-copy-btn";
      copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M6 10H4.5A1.5 1.5 0 013 8.5v-5A1.5 1.5 0 014.5 2h5A1.5 1.5 0 0111 3.5V6"/></svg> Copy';
      copyBtn.addEventListener("click", function(e) {
        e.stopPropagation(); e.preventDefault();
        var code = pre.querySelector("code");
        navigator.clipboard.writeText((code || pre).textContent || "").then(function() {
          copyBtn.textContent = "Copied!"; copyBtn.classList.add("copied");
          setTimeout(function() {
            copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M6 10H4.5A1.5 1.5 0 013 8.5v-5A1.5 1.5 0 014.5 2h5A1.5 1.5 0 0111 3.5V6"/></svg> Copy';
            copyBtn.classList.remove("copied");
          }, 2000);
        });
      });
      header.appendChild(copyBtn); pre.insertBefore(header, pre.firstChild);
    });
  }

  function postProcessMermaid() {
    if (typeof mermaid === "undefined") return;
    content.querySelectorAll('pre[lang="mermaid"] code, code.language-mermaid').forEach(function(el) {
      var container = document.createElement("div"); container.className = "mermaid";
      var originalCode = el.textContent || "";
      container.setAttribute("data-original-code", originalCode);
      container.textContent = originalCode;
      var pre = el.closest("pre"); if (pre) pre.replaceWith(container);
    });
    mermaid.initialize({ startOnLoad: false, theme: "dark" });
    mermaid.run().then(function() {
      // Add edit buttons to rendered mermaid diagrams
      content.querySelectorAll(".mermaid").forEach(function(el) {
        if (el.querySelector(".mermaid-edit-btn")) return;
        var editBtn = document.createElement("button");
        editBtn.className = "mermaid-edit-btn";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", function(e) {
          e.stopPropagation();
          e.preventDefault();
          var code = el.getAttribute("data-original-code") || "";
          editMermaidCode(el, code);
        });
        el.appendChild(editBtn);
      });
    }).catch(function() {});
  }

  function editMermaidCode(el, code) {
    // Full-screen modal with CodeMirror editor + live preview
    var overlay = document.createElement("div");
    overlay.className = "mermaid-modal-overlay";
    overlay.innerHTML =
      '<div class="mermaid-modal">' +
        '<div class="mermaid-modal-header">' +
          '<span class="mermaid-modal-title">Edit Mermaid Diagram</span>' +
          '<div class="mermaid-modal-actions">' +
            '<button class="mermaid-modal-btn" id="mm-cancel">Cancel</button>' +
            '<button class="mermaid-modal-btn primary" id="mm-apply">Apply</button>' +
          '</div>' +
        '</div>' +
        '<div class="mermaid-modal-body">' +
          '<div class="mermaid-modal-editor" id="mm-editor"></div>' +
          '<div class="mermaid-modal-preview" id="mm-preview"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Init CodeMirror for mermaid code
    var editorContainer = document.getElementById("mm-editor");
    var previewContainer = document.getElementById("mm-preview");
    var mmCm = CodeMirror(editorContainer, {
      value: code,
      mode: "markdown",
      theme: "material-darker",
      lineNumbers: true,
      lineWrapping: true,
      autofocus: true,
    });

    // Live preview
    function updatePreview() {
      var src = mmCm.getValue();
      previewContainer.innerHTML = "";
      var div = document.createElement("div");
      div.className = "mermaid";
      div.textContent = src;
      previewContainer.appendChild(div);
      try {
        mermaid.initialize({ startOnLoad: false, theme: "dark" });
        mermaid.run({ nodes: [div] }).catch(function() {
          previewContainer.innerHTML = '<div style="color:#ef4444;padding:16px;font-size:12px">Syntax error</div>';
        });
      } catch (e) {
        previewContainer.innerHTML = '<div style="color:#ef4444;padding:16px;font-size:12px">Syntax error</div>';
      }
    }
    updatePreview();
    mmCm.on("change", function() {
      if (mmCm._previewDebounce) clearTimeout(mmCm._previewDebounce);
      mmCm._previewDebounce = setTimeout(updatePreview, 400);
    });
    setTimeout(function() { mmCm.refresh(); }, 50);

    // Cancel
    document.getElementById("mm-cancel").addEventListener("click", function() {
      overlay.remove();
    });

    // Apply
    document.getElementById("mm-apply").addEventListener("click", function() {
      var newCode = mmCm.getValue();
      overlay.remove();
      if (newCode !== code) {
        el.setAttribute("data-original-code", newCode);
        el.textContent = newCode;
        el.removeAttribute("data-processed");
        mermaid.run({ nodes: [el] }).then(function() {
          var editBtn = document.createElement("button");
          editBtn.className = "mermaid-edit-btn";
          editBtn.textContent = "Edit";
          editBtn.addEventListener("click", function(e) {
            e.stopPropagation(); e.preventDefault();
            editMermaidCode(el, el.getAttribute("data-original-code") || "");
          });
          el.appendChild(editBtn);
        }).catch(function() {});
        triggerEditDebounce();
      }
    });

    // Close on Escape
    overlay.addEventListener("keydown", function(e) {
      if (e.key === "Escape") overlay.remove();
    });
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ─── Selection Toolbar ───

  var selToolbar = document.getElementById("selection-toolbar");
  function showSelectionToolbar() {
    if (isReadOnly) { hideSelectionToolbar(); return; }
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { hideSelectionToolbar(); return; }
    var text = sel.toString().trim(); if (!text) { hideSelectionToolbar(); return; }
    var range = sel.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) { hideSelectionToolbar(); return; }
    var ancestor = range.commonAncestorContainer;
    var node = ancestor.nodeType === 3 ? ancestor.parentElement : ancestor;
    if (node && (node.closest("pre") || node.closest(".mermaid") || node.closest(".katex-display"))) { hideSelectionToolbar(); return; }
    var rect = range.getBoundingClientRect(); if (!selToolbar) return;
    selToolbar.classList.add("visible");
    var tbRect = selToolbar.getBoundingClientRect();
    var left = rect.left + (rect.width / 2) - (tbRect.width / 2);
    var top = rect.top - tbRect.height - 8;
    if (left < 8) left = 8;
    if (left + tbRect.width > window.innerWidth - 8) left = window.innerWidth - tbRect.width - 8;
    if (top < 8) top = rect.bottom + 8;
    selToolbar.style.left = left + "px"; selToolbar.style.top = top + "px";
  }
  function hideSelectionToolbar() { if (selToolbar) selToolbar.classList.remove("visible"); }
  document.addEventListener("selectionchange", showSelectionToolbar);
  if (selToolbar) {
    selToolbar.addEventListener("mousedown", function(e) { e.preventDefault(); });
    selToolbar.addEventListener("click", function(e) {
      var button = e.target.closest("button"); if (!button) return;
      var action = button.getAttribute("data-action"); if (!action) return;
      e.preventDefault();
      switch (action) {
        case "undo": document.execCommand("undo", false, null); triggerEditDebounce(); break;
        case "redo": document.execCommand("redo", false, null); triggerEditDebounce(); break;
        case "bold": applyInlineFormat("bold"); break;
        case "italic": applyInlineFormat("italic"); break;
        case "strikethrough": applyInlineFormat("strikethrough"); break;
        case "code": applyInlineFormat("code"); break;
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
        case "p": case "blockquote": case "ul": case "ol": case "task":
          applyBlockFormat(action); break;
        case "indent": applyIndent(); break;
        case "outdent": applyOutdent(); break;
        case "link": insertLink(); break;
        case "image": insertImagePrompt(); break;
        case "hr": insertHorizontalRule(); break;
        case "removeFormat": removeFormatting(); break;
      }
      hideSelectionToolbar();
    });
  }

  // ─── Table Editing ───

  content.addEventListener("dblclick", function(e) {
    var td = e.target.closest("td, th");
    if (td) {
      if (td.getAttribute("contenteditable") === "true") return;
      e.stopPropagation(); td.setAttribute("contenteditable", "true");
      td.classList.add("table-cell-editing"); td.focus();
      var range = document.createRange(); range.selectNodeContents(td);
      var sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      td.addEventListener("blur", function onBlur() {
        td.removeAttribute("contenteditable"); td.classList.remove("table-cell-editing");
        td.removeEventListener("blur", onBlur); triggerEditDebounce();
      });
      td.addEventListener("keydown", function(ev) {
        if (ev.key === "Enter" || ev.key === "Escape") { ev.preventDefault(); td.blur(); }
        if (ev.key === "Tab") {
          ev.preventDefault(); td.blur();
          var next = ev.shiftKey ? td.previousElementSibling : td.nextElementSibling;
          if (next && (next.tagName === "TD" || next.tagName === "TH")) next.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        }
      });
      return;
    }
    // Code block editing
    var pre = e.target.closest("pre[lang]");
    if (pre) {
      var lang = pre.getAttribute("lang"); if (lang === "mermaid") return;
      var codeEl = pre.querySelector("code"); if (!codeEl) return;
      e.stopPropagation(); e.preventDefault();
      var currentCode = codeEl.textContent || "";
      editCodeBlock(pre, codeEl, lang, currentCode);
    }
  });

  content.addEventListener("contextmenu", function(e) {
    var td = e.target.closest("td, th");
    if (!td) { hideTableContextMenu(); return; }
    e.preventDefault(); e.stopPropagation(); showTableContextMenu(e.clientX, e.clientY, td);
  });

  function showTableContextMenu(x, y, td) {
    hideTableContextMenu();
    var menu = document.createElement("div"); menu.className = "table-context-menu";
    var items = [
      { label: "Add Row Above", action: "addRowAbove" }, { label: "Add Row Below", action: "addRowBelow" },
      { label: "Add Column Left", action: "addColLeft" }, { label: "Add Column Right", action: "addColRight" },
      { label: "---" }, { label: "Delete Row", action: "deleteRow" }, { label: "Delete Column", action: "deleteCol" },
    ];
    items.forEach(function(item) {
      if (item.label === "---") { var sep = document.createElement("div"); sep.className = "table-ctx-separator"; menu.appendChild(sep); return; }
      var btn = document.createElement("button"); btn.className = "table-ctx-item"; btn.textContent = item.label;
      btn.addEventListener("click", function(e2) { e2.stopPropagation(); handleTableAction(item.action, td); hideTableContextMenu(); });
      menu.appendChild(btn);
    });
    menu.style.left = x + "px"; menu.style.top = y + "px";
    document.body.appendChild(menu); tableContextMenu = menu;
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + "px";
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + "px";
    setTimeout(function() { document.addEventListener("click", hideTableContextMenu, { once: true }); }, 0);
  }
  function hideTableContextMenu() { if (tableContextMenu) { tableContextMenu.remove(); tableContextMenu = null; } }

  function handleTableAction(action, td) {
    var tr = td.closest("tr"), table = td.closest("table"); if (!tr || !table) return;
    var cellIndex = Array.prototype.indexOf.call(tr.children, td);
    var allRows = table.querySelectorAll("tr");
    var colCount = allRows.length > 0 ? allRows[0].children.length : 0;
    switch (action) {
      case "addRowAbove": case "addRowBelow": {
        var newRow = document.createElement("tr");
        for (var c = 0; c < colCount; c++) { var newTd = document.createElement("td"); newTd.textContent = ""; newRow.appendChild(newTd); }
        tr.parentNode.insertBefore(newRow, action === "addRowAbove" ? tr : tr.nextSibling); break;
      }
      case "addColLeft": case "addColRight":
        allRows.forEach(function(row) {
          var isHeader = row.children[0] && row.children[0].tagName === "TH";
          var newCell = document.createElement(isHeader ? "th" : "td"); newCell.textContent = isHeader ? "Header" : "";
          var refCell = row.children[cellIndex];
          if (action === "addColLeft" && refCell) row.insertBefore(newCell, refCell);
          else if (refCell) row.insertBefore(newCell, refCell.nextSibling);
          else row.appendChild(newCell);
        }); break;
      case "deleteRow": {
        var rowIndex = Array.prototype.indexOf.call(allRows, tr);
        if (rowIndex === 0 || allRows.length <= 2) return;
        tr.remove(); break;
      }
      case "deleteCol":
        if (colCount <= 1) return;
        allRows.forEach(function(row) { var cell = row.children[cellIndex]; if (cell) cell.remove(); }); break;
    }
    triggerEditDebounce();
  }

  // ─── Flavor Badge ───

  function updateFlavorBadge(flavor) {
    if (!flavorBadge) return;
    var names = { gfm: "GFM", commonmark: "CommonMark", obsidian: "Obsidian", mdx: "MDX", pandoc: "Pandoc" };
    flavorBadge.textContent = (names[flavor] || flavor.toUpperCase()) + " \u25BE";
    if (flavorDropdown) {
      flavorDropdown.querySelectorAll(".flavor-option").forEach(function(opt) {
        opt.style.display = opt.getAttribute("data-flavor") === flavor ? "none" : "";
      });
    }
  }

  // Flavor badge click handler moved to Init section below

  updateFlavorBadge(currentFlavor);

  // ─── Toast Notification ───

  function showToast(message) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add("show"); }, 10);
    setTimeout(function() { toast.classList.remove("show"); setTimeout(function() { toast.remove(); }, 200); }, 3000);
  }

  // ─── Tooltips ───

  // ─── Custom Instant Tooltips (memory.wiki style) ───
  var tipEl = null;
  var tipHideTimer = null;

  document.addEventListener("mouseover", function(e) {
    var target = e.target.closest("[title], [data-tip]");
    if (!target) return;
    if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }

    var text = target.getAttribute("title");
    if (text) {
      target.setAttribute("data-tip", text);
      target.removeAttribute("title");
    } else {
      text = target.getAttribute("data-tip");
    }
    if (!text) return;

    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "mdfy-tip"; document.body.appendChild(tipEl); }

    var preview = target.getAttribute("data-preview");
    if (preview) {
      tipEl.innerHTML = '<div class="tip-label">' + esc(text) + '</div><div class="tip-preview">' + preview + '</div>';
    } else {
      tipEl.innerHTML = '<div class="tip-label">' + esc(text) + '</div>';
    }

    tipEl.classList.add("show");
    var r = target.getBoundingClientRect();
    var tw = tipEl.offsetWidth;
    var th = tipEl.offsetHeight;
    var top = r.bottom + 6;
    if (top + th > window.innerHeight - 4) top = r.top - th - 6;
    var left = r.left + (r.width / 2) - (tw / 2);
    if (left < 4) left = 4;
    if (left + tw > window.innerWidth - 4) left = window.innerWidth - tw - 4;
    tipEl.style.left = left + "px";
    tipEl.style.top = top + "px";
  });

  document.addEventListener("mouseout", function(e) {
    var target = e.target.closest("[data-tip]");
    if (!target) return;
    tipHideTimer = setTimeout(function() {
      if (tipEl) tipEl.classList.remove("show");
    }, 50);
  });

  document.addEventListener("mousedown", function() { if (tipEl) tipEl.classList.remove("show"); });

  // ─── Utility ───

  function esc(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str || ""));
    return div.innerHTML;
  }

  function timeAgo(ts) {
    if (!ts) return "";
    var d = Date.now() - new Date(ts).getTime(), m = Math.floor(d / 60000);
    if (m < 1) return "Now"; if (m < 60) return m + "m";
    var h = Math.floor(m / 60); if (h < 24) return h + "h";
    var dy = Math.floor(h / 24); if (dy < 7) return dy + "d";
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // ─── Export Button ───

  var exportBtn = document.getElementById("btn-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      // Show export dropdown
      var existing = document.getElementById("export-dropdown");
      if (existing) { existing.remove(); return; }

      var menu = document.createElement("div");
      menu.id = "export-dropdown";
      menu.className = "export-dropdown";
      var rect = exportBtn.getBoundingClientRect();
      menu.style.position = "fixed";
      menu.style.top = (rect.bottom + 4) + "px";
      menu.style.right = (window.innerWidth - rect.right) + "px";
      menu.innerHTML =
        '<div class="export-section">DOWNLOAD</div>' +
        '<button class="export-item" data-export="md">Markdown (.md)</button>' +
        '<button class="export-item" data-export="html">HTML (.html)</button>' +
        '<button class="export-item" data-export="txt">Plain Text (.txt)</button>' +
        '<div class="export-divider"></div>' +
        '<div class="export-section">COPY TO CLIPBOARD</div>' +
        '<button class="export-item" data-export="copy-html">Raw HTML</button>' +
        '<button class="export-item" data-export="copy-rich">Rich Text (Docs / Email)</button>' +
        '<button class="export-item" data-export="copy-plain">Plain Text</button>' +
        '<button class="export-item" data-export="copy-slack">Slack (mrkdwn)</button>';
      document.body.appendChild(menu);

      menu.addEventListener("click", function(ev) {
        var item = ev.target.closest("[data-export]");
        if (!item) return;
        var action = item.getAttribute("data-export");
        menu.remove();
        handleExport(action);
      });

      setTimeout(function() {
        document.addEventListener("click", function dismiss() {
          var m = document.getElementById("export-dropdown");
          if (m) m.remove();
          document.removeEventListener("click", dismiss);
        });
      }, 0);
    });
  }

  function handleExport(action) {
    if (!currentMarkdown) return;
    var baseName = currentFilePath ? currentFilePath.split("/").pop().replace(/\.md$/, "") : "untitled";
    switch (action) {
      case "md":
        window.mdfyDesktop.saveFileAs(currentMarkdown, baseName + ".md", [{ name: "Markdown", extensions: ["md"] }]).then(function(p) {
          if (p) showToast("Saved: " + p.split("/").pop());
        });
        break;
      case "html":
        window.mdfyDesktop.renderMarkdown(currentMarkdown).then(function(r) {
          var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + baseName + '</title><style>body{font-family:-apple-system,sans-serif;max-width:768px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto}code{font-size:0.85em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}img{max-width:100%}</style></head><body>' + r.html + '</body></html>';
          window.mdfyDesktop.saveFileAs(html, baseName + ".html", [{ name: "HTML", extensions: ["html"] }]).then(function(p) {
            if (p) showToast("Saved: " + p.split("/").pop());
          });
        });
        break;
      case "txt":
        window.mdfyDesktop.saveFileAs(currentMarkdown, baseName + ".txt", [{ name: "Text", extensions: ["txt"] }]).then(function(p) {
          if (p) showToast("Saved: " + p.split("/").pop());
        });
        break;
      case "copy-html":
        window.mdfyDesktop.renderMarkdown(currentMarkdown).then(function(r) {
          window.mdfyDesktop.writeClipboard(r.html);
          showToast("HTML copied");
        });
        break;
      case "copy-rich":
        window.mdfyDesktop.renderMarkdown(currentMarkdown).then(function(r) {
          window.mdfyDesktop.writeClipboardHtml(r.html);
          showToast("Rich text copied — paste into Docs or Email");
        });
        break;
      case "copy-plain":
        window.mdfyDesktop.writeClipboard(currentMarkdown);
        showToast("Plain text copied");
        break;
      case "copy-slack":
        window.mdfyDesktop.writeClipboard(markdownToSlack(currentMarkdown));
        showToast("Slack mrkdwn copied");
        break;
    }
  }

  // ─── Copy MD / Download MD Buttons ───

  var copyMdBtn = document.getElementById("btn-copy-md");
  if (copyMdBtn) {
    copyMdBtn.addEventListener("click", function() {
      if (currentMarkdown) {
        window.mdfyDesktop.writeClipboard(currentMarkdown);
        showToast("Markdown copied");
      }
    });
  }

  var downloadMdBtn = document.getElementById("btn-download-md");
  if (downloadMdBtn) {
    downloadMdBtn.addEventListener("click", function() {
      if (currentMarkdown) {
        window.mdfyDesktop.saveFile(currentMarkdown);
      }
    });
  }

  // ─── Flavor Badge (moved from inline to here) ───

  if (flavorBadge) {
    flavorBadge.addEventListener("click", function(e) {
      e.stopPropagation();
      if (flavorDropdown) flavorDropdown.classList.toggle("hidden");
    });
  }

  if (flavorDropdown) {
    flavorDropdown.querySelectorAll(".flavor-option").forEach(function(opt) {
      opt.addEventListener("click", function(e) {
        e.stopPropagation();
        var flavor = opt.getAttribute("data-flavor");
        if (flavor) {
          currentFlavor = flavor;
          updateFlavorBadge(currentFlavor);
          flavorDropdown.classList.add("hidden");
        }
      });
    });
  }

  document.addEventListener("click", function() {
    if (flavorDropdown) flavorDropdown.classList.add("hidden");
    var ed = document.getElementById("export-dropdown");
    if (ed) ed.remove();
    hideTableContextMenu();
  });

  // ─── File Context Menu ───

  var fileCtxMenu = null;

  function showFileContextMenu(x, y, filePath, config) {
    hideFileContextMenu();
    var menu = document.createElement("div");
    menu.className = "file-ctx-menu";

    var items = [];
    items.push({ label: "Open", action: function() { window.mdfyDesktop.openFilePath(filePath); } });
    items.push({ label: "Reveal in Finder", action: function() { window.mdfyDesktop.revealInFinder(filePath); } });
    items.push({ divider: true });

    if (config && config.docId) {
      items.push({ label: "Copy URL", action: function() {
        window.mdfyDesktop.writeClipboard("https://memory.wiki/" + config.docId);
        showToast("URL copied");
      }});
      items.push({ label: "Open in Browser", action: function() {
        window.mdfyDesktop.openInBrowser("https://memory.wiki/" +config.docId);
      }});
      items.push({ divider: true });
      items.push({ label: "Unsync", action: async function() {
        await window.mdfyDesktop.syncUnlink(filePath);
        await refreshSidebarData(); renderSidebar();
      }});
      items.push({ label: "Delete from Cloud", danger: true, action: async function() {
        if (confirm("Delete from memory.wiki? Local file stays.")) {
          await window.mdfyDesktop.syncDelete(filePath);
          await refreshSidebarData(); renderSidebar();
          showToast("Deleted from cloud");
        }
      }});
    } else {
      items.push({ label: "Publish to memory.wiki", action: function() {
        window.mdfyDesktop.openFilePath(filePath);
        setTimeout(function() { doPublish(); }, 500);
      }});
    }

    items.push({ divider: true });
    items.push({ label: "Copy Path", action: function() {
      window.mdfyDesktop.writeClipboard(filePath);
      showToast("Path copied");
    }});

    renderContextMenu(menu, items, x, y);
  }

  function showCloudContextMenu(x, y, docId, title) {
    hideFileContextMenu();
    var menu = document.createElement("div");
    menu.className = "file-ctx-menu";

    var items = [
      { label: "Preview", action: function() { window.mdfyDesktop.previewCloudDoc(docId, title); } },
      { label: "Sync to Local", action: async function() {
        var r = await window.mdfyDesktop.syncPullCloud(docId, title);
        if (r && r.ok) { await refreshSidebarData(); renderSidebar(); }
      }},
      { label: "Open in Browser", action: function() { window.mdfyDesktop.openInBrowser("https://memory.wiki/" +docId); } },
      { divider: true },
      { label: "Copy URL", action: function() {
        window.mdfyDesktop.writeClipboard("https://memory.wiki/" + docId);
        showToast("URL copied");
      }},
    ];

    // Move to folder submenu
    if (sidebarState.cloudFolders && sidebarState.cloudFolders.length > 0) {
      var folderItems = sidebarState.cloudFolders.map(function(f) {
        return { label: f.name, action: async function() {
          try {
            await window.mdfyDesktop.moveToFolder(docId, f.id);
            await refreshSidebarData(); renderSidebar();
          } catch(e) { console.error(e); }
        }};
      });
      folderItems.push({ label: "Root (no folder)", action: async function() {
        try {
          await window.mdfyDesktop.moveToFolder(docId, null);
          await refreshSidebarData(); renderSidebar();
        } catch(e) { console.error(e); }
      }});
      items.push({ label: "Move to", submenu: folderItems });
    }

    items.push({ divider: true });
    items.push({ label: "Delete from Cloud", danger: true, action: async function() {
      if (confirm("Delete from memory.wiki?")) {
        await window.mdfyDesktop.deleteCloudDoc(docId);
        await refreshSidebarData(); renderSidebar();
        showToast("Deleted");
      }
    }});

    items = items;

    renderContextMenu(menu, items, x, y);
  }

  function renderContextMenu(menu, items, x, y) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].divider) {
        var sep = document.createElement("div");
        sep.className = "file-ctx-sep";
        menu.appendChild(sep);
      } else if (items[i].submenu) {
        var subWrap = document.createElement("div");
        subWrap.className = "file-ctx-sub";
        subWrap.style.position = "relative";
        var subBtn = document.createElement("button");
        subBtn.className = "file-ctx-item";
        subBtn.innerHTML = items[i].label + ' <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-left:auto"><path d="M6 4l4 4-4 4"/></svg>';
        subBtn.style.display = "flex";
        subBtn.style.alignItems = "center";
        subWrap.appendChild(subBtn);
        var subMenu = document.createElement("div");
        subMenu.className = "file-ctx-menu file-ctx-submenu";
        subMenu.style.cssText = "position:absolute;left:100%;top:0;margin-left:2px;min-width:130px;display:none";
        for (var j = 0; j < items[i].submenu.length; j++) {
          var subItem = document.createElement("button");
          subItem.className = "file-ctx-item";
          subItem.textContent = items[i].submenu[j].label;
          subItem.addEventListener("click", (function(action) {
            return function(e) { e.stopPropagation(); hideFileContextMenu(); action(); };
          })(items[i].submenu[j].action));
          subMenu.appendChild(subItem);
        }
        subWrap.appendChild(subMenu);
        subWrap.addEventListener("mouseenter", function() { subMenu.style.display = "block"; });
        subWrap.addEventListener("mouseleave", function() { subMenu.style.display = "none"; });
        menu.appendChild(subWrap);
      } else {
        var btn = document.createElement("button");
        btn.className = "file-ctx-item" + (items[i].danger ? " danger" : "");
        btn.textContent = items[i].label;
        btn.addEventListener("click", (function(action) {
          return function(e) { e.stopPropagation(); hideFileContextMenu(); action(); };
        })(items[i].action));
        menu.appendChild(btn);
      }
    }
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    document.body.appendChild(menu);
    fileCtxMenu = menu;

    // Reposition if offscreen
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + "px";
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + "px";

    setTimeout(function() {
      document.addEventListener("click", hideFileContextMenu, { once: true });
    }, 0);
  }

  function hideFileContextMenu() {
    if (fileCtxMenu) { fileCtxMenu.remove(); fileCtxMenu = null; }
  }

  // ─── Published URL Display ───

  var headerUrlBtn = document.getElementById("header-url");

  function updatePublishedUrl() {
    if (!headerUrlBtn) return;
    if (currentConfig && currentConfig.docId) {
      var url = "memory.wiki/" + currentConfig.docId;
      headerUrlBtn.textContent = url;
      headerUrlBtn.style.display = "";
      headerUrlBtn.setAttribute("data-url", "https://" + url);
    } else {
      headerUrlBtn.style.display = "none";
    }
  }

  if (headerUrlBtn) {
    headerUrlBtn.addEventListener("click", function() {
      var url = headerUrlBtn.getAttribute("data-url");
      if (url) {
        window.mdfyDesktop.writeClipboard(url);
        showToast("URL copied: " + url);
      }
    });
  }

  // ─── Code Block Editor Modal ───

  function editCodeBlock(pre, codeEl, lang, code) {
    var overlay = document.createElement("div");
    overlay.className = "mermaid-modal-overlay";
    overlay.innerHTML =
      '<div class="mermaid-modal" style="width:70vw;height:70vh;max-width:900px">' +
        '<div class="mermaid-modal-header">' +
          '<span class="mermaid-modal-title">Edit Code' + (lang ? ' (' + esc(lang) + ')' : '') + '</span>' +
          '<div class="mermaid-modal-actions">' +
            '<button class="mermaid-modal-btn" id="cb-cancel">Cancel</button>' +
            '<button class="mermaid-modal-btn primary" id="cb-apply">Apply</button>' +
          '</div>' +
        '</div>' +
        '<div style="flex:1;min-height:0;overflow:auto" id="cb-editor"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var modeMap = { js: "javascript", ts: "javascript", jsx: "javascript", tsx: "javascript", css: "css", html: "xml", xml: "xml", yaml: "yaml", yml: "yaml" };
    var cmMode = modeMap[lang] || "gfm";
    var cbCm = CodeMirror(document.getElementById("cb-editor"), {
      value: code, mode: cmMode, theme: "material-darker", lineNumbers: true, lineWrapping: true, autofocus: true, indentUnit: 2, tabSize: 2,
    });
    setTimeout(function() { cbCm.refresh(); }, 50);

    document.getElementById("cb-cancel").addEventListener("click", function() { overlay.remove(); });
    document.getElementById("cb-apply").addEventListener("click", function() {
      var newCode = cbCm.getValue();
      overlay.remove();
      if (newCode !== code) { codeEl.textContent = newCode; triggerEditDebounce(); }
    });
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener("keydown", function(e) { if (e.key === "Escape") overlay.remove(); });
  }

  // ─── Markdown → Slack mrkdwn ───

  function markdownToSlack(md) {
    var slack = md.replace(/\*\*(.+?)\*\*/g, "\u27e6BOLD\u27e7$1\u27e6/BOLD\u27e7");
    slack = slack.replace(/__(.+?)__/g, "\u27e6BOLD\u27e7$1\u27e6/BOLD\u27e7");
    slack = slack.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, "_$1_");
    slack = slack.replace(/\u27e6BOLD\u27e7/g, "*").replace(/\u27e6\/BOLD\u27e7/g, "*");
    return slack
      .replace(/~~(.+?)~~/g, "~$1~")
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<$2|$1>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
      .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
      .replace(/```\w*\n/g, "```\n")
      .replace(/^(\s*)- \[x\]\s/gm, "$1:white_check_mark: ")
      .replace(/^(\s*)- \[ \]\s/gm, "$1:white_large_square: ")
      .replace(/^---+$/gm, "\u2014\u2014\u2014");
  }

  // ─── Footer Help ───

  var footerHelp = document.getElementById("footer-help");
  if (footerHelp) {
    footerHelp.addEventListener("click", function(e) {
      e.stopPropagation();
      var existing = document.getElementById("help-popup");
      if (existing) { existing.remove(); return; }

      var popup = document.createElement("div");
      popup.id = "help-popup";
      popup.className = "export-dropdown";
      var rect = footerHelp.getBoundingClientRect();
      popup.style.position = "fixed";
      popup.style.bottom = (window.innerHeight - rect.top + 4) + "px";
      popup.style.left = rect.left + "px";
      popup.innerHTML =
        '<div class="export-section">KEYBOARD SHORTCUTS</div>' +
        '<div class="help-row"><kbd>Cmd+B</kbd> Bold</div>' +
        '<div class="help-row"><kbd>Cmd+I</kbd> Italic</div>' +
        '<div class="help-row"><kbd>Cmd+K</kbd> Link</div>' +
        '<div class="help-row"><kbd>Cmd+S</kbd> Save</div>' +
        '<div class="help-row"><kbd>Cmd+N</kbd> New Document</div>' +
        '<div class="help-row"><kbd>Cmd+O</kbd> Open File</div>' +
        '<div class="help-row"><kbd>Cmd+Shift+O</kbd> Open Folder</div>' +
        '<div class="help-row"><kbd>Cmd+Shift+P</kbd> Publish</div>' +
        '<div class="export-divider"></div>' +
        '<div class="export-section">IMPORT FORMATS</div>' +
        '<div class="help-row">md, txt, pdf, docx, pptx, xlsx, html, csv, json</div>';
      document.body.appendChild(popup);
      setTimeout(function() {
        document.addEventListener("click", function dismiss() {
          var m = document.getElementById("help-popup");
          if (m) m.remove();
          document.removeEventListener("click", dismiss);
        });
      }, 0);
    });
  }

  // ─── AI Tools ───

  // ─── AI Side Panel ───

  var aiSidePanelOpen = false;
  var aiPrevMarkdown = null;

  var aiSideToggle = document.getElementById("ai-toggle");
  var aiSidePanelEl = document.getElementById("ai-panel");
  var aiSidePanelClose = document.getElementById("ai-panel-close");
  var aiSideChatHistory = document.getElementById("ai-chat-history");
  var aiSideChatInput = document.getElementById("ai-chat-input");
  var aiSideChatSend = document.getElementById("ai-chat-send");
  var aiSideUndoBtn = document.getElementById("ai-undo-btn");

  function toggleAiSidePanel() {
    aiSidePanelOpen = !aiSidePanelOpen;
    if (aiSidePanelEl) {
      aiSidePanelEl.style.display = aiSidePanelOpen ? "" : "none";
    }
    if (aiSideToggle) {
      aiSideToggle.setAttribute("data-active", aiSidePanelOpen ? "true" : "false");
      aiSideToggle.classList.toggle("active", aiSidePanelOpen);
    }
    // Close outline and image when opening AI
    if (aiSidePanelOpen) {
      if (outlinePanelOpen && outlinePanelEl) {
        outlinePanelOpen = false;
        outlinePanelEl.classList.add("hidden");
        if (outlineToggle) { outlineToggle.setAttribute("data-active", "false"); outlineToggle.classList.remove("active"); }
      }
      if (imagePanelOpen) {
        imagePanelOpen = false;
        var imgP = document.getElementById("image-panel");
        if (imgP) imgP.style.display = "none";
        if (imagesToggle) imagesToggle.setAttribute("data-active", "false");
      }
    }
  }

  if (aiSideToggle) aiSideToggle.addEventListener("click", toggleAiSidePanel);
  if (aiSidePanelClose) aiSidePanelClose.addEventListener("click", function() {
    aiSidePanelOpen = false;
    if (aiSidePanelEl) aiSidePanelEl.style.display = "none";
    if (aiSideToggle) { aiSideToggle.setAttribute("data-active", "false"); aiSideToggle.classList.remove("active"); }
  });

  function addAiSideChatMessage(role, text) {
    if (!aiSideChatHistory) return;
    var msg = document.createElement("div");
    msg.className = "ai-chat-msg ai-chat-" + role;
    msg.textContent = text;
    aiSideChatHistory.appendChild(msg);
    aiSideChatHistory.scrollTop = aiSideChatHistory.scrollHeight;
  }

  function showAiSideLoading(show) {
    if (!aiSideChatHistory) return;
    var existing = aiSideChatHistory.querySelector(".ai-loading-indicator");
    if (show && !existing) {
      var el = document.createElement("div");
      el.className = "ai-loading-indicator";
      el.innerHTML = '<div class="ai-spinner"></div><span>Processing...</span>';
      aiSideChatHistory.appendChild(el);
      aiSideChatHistory.scrollTop = aiSideChatHistory.scrollHeight;
    } else if (!show && existing) {
      existing.remove();
    }
  }

  // AI action buttons in side panel
  if (aiSidePanelEl) {
    aiSidePanelEl.querySelectorAll(".ai-action-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var action = btn.getAttribute("data-ai-action");
        if (!action) return;

        if (action === "translate") {
          showAiSideTranslateMenu(btn);
          return;
        }

        aiPrevMarkdown = currentMarkdown;
        if (aiSideUndoBtn) aiSideUndoBtn.style.display = "";
        addAiSideChatMessage("user", action.charAt(0).toUpperCase() + action.slice(1));
        showAiSideLoading(true);
        runAISidePanelAction(action);
      });
    });
  }

  function showAiSideTranslateMenu(anchorBtn) {
    var existing = document.getElementById("ai-side-translate-dropdown");
    if (existing) { existing.remove(); return; }

    var languages = [
      { code: "en", label: "English" }, { code: "ko", label: "Korean" },
      { code: "ja", label: "Japanese" }, { code: "zh", label: "Chinese" },
      { code: "es", label: "Spanish" }, { code: "fr", label: "French" },
      { code: "de", label: "German" }, { code: "pt", label: "Portuguese" }
    ];

    var rect = anchorBtn.getBoundingClientRect();
    var menu = document.createElement("div");
    menu.id = "ai-side-translate-dropdown";
    menu.className = "ai-translate-dropdown";
    menu.style.position = "fixed";
    menu.style.top = (rect.bottom + 4) + "px";
    menu.style.left = rect.left + "px";

    languages.forEach(function(lang) {
      var item = document.createElement("button");
      item.className = "ai-translate-item";
      item.textContent = lang.label;
      item.addEventListener("click", function() {
        menu.remove();
        aiPrevMarkdown = currentMarkdown;
        if (aiSideUndoBtn) aiSideUndoBtn.style.display = "";
        addAiSideChatMessage("user", "Translate to " + lang.label);
        showAiSideLoading(true);
        runAISidePanelAction("translate", lang.code);
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    setTimeout(function() {
      document.addEventListener("click", function dismiss() {
        var m = document.getElementById("ai-side-translate-dropdown");
        if (m) m.remove();
        document.removeEventListener("click", dismiss);
      });
    }, 0);
  }

  // AI chat input
  function sendAiSideChat() {
    if (!aiSideChatInput) return;
    var instruction = aiSideChatInput.value.trim();
    if (!instruction) return;
    aiSideChatInput.value = "";
    aiPrevMarkdown = currentMarkdown;
    if (aiSideUndoBtn) aiSideUndoBtn.style.display = "";
    addAiSideChatMessage("user", instruction);
    showAiSideLoading(true);
    runAISidePanelAction("chat", instruction);
  }

  if (aiSideChatSend) aiSideChatSend.addEventListener("click", sendAiSideChat);
  if (aiSideChatInput) {
    aiSideChatInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendAiSideChat();
      }
    });
  }

  // AI undo
  if (aiSideUndoBtn) {
    aiSideUndoBtn.addEventListener("click", function() {
      if (aiPrevMarkdown !== null) {
        loadDocumentContent(aiPrevMarkdown, currentFilePath);
        aiPrevMarkdown = null;
        aiSideUndoBtn.style.display = "none";
        addAiSideChatMessage("system", "Reverted to previous version.");
      }
    });
  }

  async function runAISidePanelAction(action, languageOrInstruction) {
    if (!window.mdfyDesktop) { showAiSideLoading(false); return; }

    if (!sidebarState.authState.loggedIn) {
      showAiSideLoading(false);
      addAiSideChatMessage("error", "Sign in to use AI features.");
      return;
    }

    var md = htmlToMarkdown(content);
    if (!md || !md.trim()) {
      showAiSideLoading(false);
      addAiSideChatMessage("error", "No content to process.");
      return;
    }

    var prevMd = currentMarkdown;

    try {
      var result = await window.mdfyDesktop.aiAction(action, md, languageOrInstruction || undefined);
      showAiSideLoading(false);

      if (result.error) {
        addAiSideChatMessage("error", result.error);
        return;
      }
      if (result.result) {
        var text = result.result;
        if (action === "chat" && !text.trim().startsWith("EDIT:")) {
          addAiSideChatMessage("ai", text.replace(/^ANSWER:\s*/, ""));
          return;
        }
        text = text.replace(/^EDIT:\s*/, "");

        // Apply result
        var shouldReplace = (action === "polish" || action === "translate" || action === "chat");
        if (shouldReplace) {
          loadDocumentContent(text, currentFilePath);
        } else {
          loadDocumentContent(text + "\n\n---\n\n" + md, currentFilePath);
        }

        var label = action.charAt(0).toUpperCase() + action.slice(1);
        addAiSideChatMessage("ai", label + " applied successfully.");

        // Highlight diff
        highlightChangedBlocks(prevMd, currentMarkdown);
      }
    } catch (e) {
      showAiSideLoading(false);
      addAiSideChatMessage("error", "AI failed: " + e.message);
    }
  }

  function showAIMenu(anchorBtn) {
    var existing = document.getElementById("ai-dropdown");
    if (existing) { existing.remove(); return; }

    var rect = anchorBtn.getBoundingClientRect();
    var menu = document.createElement("div");
    menu.id = "ai-dropdown";
    menu.className = "export-dropdown";
    menu.style.position = "fixed";
    menu.style.top = (rect.bottom + 4) + "px";
    menu.style.left = rect.left + "px";
    menu.innerHTML =
      '<div class="export-section">AI TOOLS</div>' +
      '<div class="export-item" data-ai="polish"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg> Polish</div>' +
      '<div class="export-item" data-ai="summary"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h14"/></svg> Summary</div>' +
      '<div class="export-item" data-ai="tldr"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h8"/></svg> TL;DR</div>' +
      '<div class="export-divider"></div>' +
      '<div class="export-item" data-ai="translate"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3M11 21l5-10 5 10M14.5 18h5"/></svg> Translate...</div>' +
      '<div class="export-divider"></div>' +
      '<div class="export-item" data-ai="chat"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Ask AI...</div>';
    document.body.appendChild(menu);

    menu.addEventListener("click", function(ev) {
      var item = ev.target.closest("[data-ai]");
      if (!item) return;
      var action = item.getAttribute("data-ai");
      menu.remove();

      if (action === "translate") {
        showTranslateMenu();
      } else if (action === "chat") {
        var instruction = prompt("Ask AI to edit your document:");
        if (instruction && instruction.trim()) {
          runAIAction("chat", instruction.trim());
        }
      } else {
        runAIAction(action);
      }
    });

    setTimeout(function() {
      document.addEventListener("click", function dismiss() {
        var m = document.getElementById("ai-dropdown");
        if (m) m.remove();
        document.removeEventListener("click", dismiss);
      });
    }, 0);
  }

  function showTranslateMenu() {
    var languages = [
      { code: "en", label: "English" },
      { code: "ko", label: "Korean" },
      { code: "ja", label: "Japanese" },
      { code: "zh", label: "Chinese" },
      { code: "es", label: "Spanish" },
      { code: "fr", label: "French" },
      { code: "de", label: "German" },
      { code: "pt", label: "Portuguese" },
    ];

    var menu = document.createElement("div");
    menu.id = "ai-dropdown";
    menu.className = "export-dropdown";
    menu.style.position = "fixed";
    menu.style.top = "50%";
    menu.style.left = "50%";
    menu.style.transform = "translate(-50%, -50%)";
    menu.innerHTML = '<div class="export-section">TRANSLATE TO</div>' +
      languages.map(function(l) {
        return '<div class="export-item" data-lang="' + l.code + '">' + l.label + '</div>';
      }).join("");
    document.body.appendChild(menu);

    menu.addEventListener("click", function(ev) {
      var item = ev.target.closest("[data-lang]");
      if (!item) return;
      var lang = item.getAttribute("data-lang");
      menu.remove();
      runAIAction("translate", lang);
    });

    setTimeout(function() {
      document.addEventListener("click", function dismiss() {
        var m = document.getElementById("ai-dropdown");
        if (m) m.remove();
        document.removeEventListener("click", dismiss);
      });
    }, 0);
  }

  async function runAIAction(action, languageOrInstruction) {
    if (!window.mdfyDesktop) return;

    // Check auth state
    if (!sidebarState.authState.loggedIn) {
      showToast("Sign in to use AI features");
      return;
    }

    // Get latest markdown from the editor
    var md = htmlToMarkdown(content);
    if (!md || !md.trim()) { showToast("No content to process"); return; }

    showToast("AI processing...");

    try {
      var result = await window.mdfyDesktop.aiAction(action, md, languageOrInstruction || undefined);
      if (result.error) {
        showToast("AI failed: " + result.error);
        return;
      }
      if (result.result) {
        // For chat-style responses that are answers, just show toast
        var text = result.result;
        if (action === "chat" && !text.trim().startsWith("EDIT:")) {
          showToast(text.replace(/^ANSWER:\s*/, ""));
          return;
        }
        text = text.replace(/^EDIT:\s*/, "");
        loadDocumentContent(text, currentFilePath);
        showToast(action.charAt(0).toUpperCase() + action.slice(1) + " complete");
      }
    } catch (e) {
      showToast("AI failed: " + e.message);
    }
  }

  // Handle AI Tools button in toolbar
  var aiToolsBtn = document.getElementById("btn-ai-tools");
  if (aiToolsBtn) {
    aiToolsBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      showAIMenu(aiToolsBtn);
    });
  }

  // ─── View Count ───

  function updateViewCount(viewCount) {
    var el = document.getElementById("stat-views");
    var sep = document.getElementById("stat-views-sep");
    var countEl = document.getElementById("stat-views-count");
    if (!el || !countEl) return;

    if (viewCount !== null && viewCount !== undefined && viewCount >= 0) {
      countEl.textContent = viewCount.toLocaleString();
      el.style.display = "";
      if (sep) sep.style.display = "";
    } else {
      el.style.display = "none";
      if (sep) sep.style.display = "none";
    }
  }

  // ─── Loading Overlay ───

  function dismissLoadingOverlay() {
    var overlay = document.getElementById("loading-overlay");
    if (!overlay) return;
    // Complete the progress bar
    var fill = overlay.querySelector(".loading-bar-fill");
    if (fill) fill.style.width = "100%";
    setTimeout(function() {
      overlay.classList.add("fade-out");
      setTimeout(function() {
        overlay.remove();
      }, 400);
    }, 200);
  }

  // ─── Init ───

  initSidebar().then(function() {
    dismissLoadingOverlay();
    // Re-render home screen now that sidebar data is loaded
    if (homeScreen && homeScreen.style.display !== "none") {
      renderHomeScreen();
    }
  }).catch(function() {
    dismissLoadingOverlay();
  });

})();
