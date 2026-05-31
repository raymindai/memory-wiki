const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mwDesktop", {
  isDesktop: true,

  // ─── File Operations ───
  openFile: () => ipcRenderer.invoke("open-file-dialog"),
  openFolder: () => ipcRenderer.invoke("open-folder-dialog"),
  openFilePath: (filePath) => ipcRenderer.invoke("open-file-path", filePath),
  newDocument: () => ipcRenderer.invoke("new-document"),
  saveFile: (markdown) => ipcRenderer.invoke("save-file", markdown),
  saveFileAs: (content, defaultName, filters) => ipcRenderer.invoke("save-file-as", content, defaultName, filters),
  autoSave: (markdown) => ipcRenderer.invoke("auto-save", markdown),
  getFilePath: () => ipcRenderer.invoke("get-file-path"),

  // ─── Rendering ───
  renderMarkdown: (markdown) => ipcRenderer.invoke("render-markdown", markdown),

  // ─── Workspace ───
  getWorkspaceFiles: () => ipcRenderer.invoke("get-workspace-files"),
  getWorkspaceTree: () => ipcRenderer.invoke("get-workspace-tree"),
  createFolder: (parentPath) => ipcRenderer.invoke("create-folder", parentPath),
  moveFile: (fromPath, toFolder) => ipcRenderer.invoke("move-file", fromPath, toFolder),
  getWorkspaceFolder: () => ipcRenderer.invoke("get-workspace-folder"),
  getRecentFiles: () => ipcRenderer.invoke("get-recent-files"),

  // ─── Auth ───
  login: () => ipcRenderer.invoke("login"),
  logout: () => ipcRenderer.invoke("logout"),
  getAuthState: () => ipcRenderer.invoke("get-auth-state"),
  getUserProfile: () => ipcRenderer.invoke("get-user-profile"),

  // ─── Sync ───
  publish: (markdown) => ipcRenderer.invoke("publish", markdown),
  syncPush: () => ipcRenderer.invoke("sync-push"),
  syncPull: (filePath) => ipcRenderer.invoke("sync-pull", filePath),
  syncPullCloud: (docId, title) => ipcRenderer.invoke("sync-pull-cloud", docId, title),
  syncUnlink: (filePath) => ipcRenderer.invoke("sync-unlink", filePath),
  syncDelete: (filePath) => ipcRenderer.invoke("sync-delete", filePath),
  deleteCloudDoc: (docId) => ipcRenderer.invoke("delete-cloud-doc", docId),
  duplicateCloud: (docId, title) => ipcRenderer.invoke("duplicate-cloud", docId, title),
  resolveConflict: (action, filePath) => ipcRenderer.invoke("resolve-conflict", action, filePath),
  getServerVersion: (filePath) => ipcRenderer.invoke("get-server-version", filePath),
  previewCloudDoc: (docId, title) => ipcRenderer.invoke("preview-cloud-doc", docId, title),
  getCloudDocuments: () => ipcRenderer.invoke("get-cloud-documents"),
  getCloudFolders: () => ipcRenderer.invoke("get-cloud-folders"),
  moveToFolder: (docId, folderId) => ipcRenderer.invoke("move-to-folder", docId, folderId),
  searchDocs: (query) => ipcRenderer.invoke("search-docs", query),

  // ─── AI Tools ───
  aiAction: (action, markdown, extra) => ipcRenderer.invoke("ai-action", action, markdown, extra),

  // ─── Images ───
  getImages: () => ipcRenderer.invoke("get-images"),

  // ─── Misc ───
  uploadImage: (base64, mime, name) => ipcRenderer.invoke("upload-image", base64, mime, name),
  getVersion: () => ipcRenderer.invoke("get-version"),
  openInBrowser: (url) => ipcRenderer.invoke("open-in-browser", url),
  openQuickLookSettings: () => ipcRenderer.invoke("open-quicklook-settings"),
  isQuickLookInstalled: () => ipcRenderer.invoke("is-quicklook-installed"),
  revealInFinder: (path) => ipcRenderer.invoke("reveal-in-finder", path),
  readClipboard: () => ipcRenderer.invoke("read-clipboard"),
  writeClipboard: (text) => ipcRenderer.invoke("write-clipboard", text),
  writeClipboardHtml: (html) => ipcRenderer.invoke("write-clipboard-html", html),
  getTheme: () => ipcRenderer.invoke("get-theme"),

  // ─── Collaboration ───
  collabStart: (cloudId, markdown) => ipcRenderer.invoke("collab-start", cloudId, markdown),
  collabStop: () => ipcRenderer.invoke("collab-stop"),
  collabLocalChange: (markdown) => ipcRenderer.invoke("collab-local-change", markdown),
  collabGetState: () => ipcRenderer.invoke("collab-get-state"),

  // ─── Events from main process ───
  onLoadDocument: (cb) => ipcRenderer.on("load-document", (_, d) => cb(d)),
  onFileChanged: (cb) => ipcRenderer.on("file-changed", (_, d) => cb(d)),
  onAuthChanged: (cb) => ipcRenderer.on("auth-changed", (_, d) => cb(d)),
  onAuthExpired: (cb) => ipcRenderer.on("auth-expired", () => cb()),
  onSyncStatus: (cb) => ipcRenderer.on("sync-status", (_, d) => cb(d)),
  onSyncConflict: (cb) => ipcRenderer.on("sync-conflict", (_, d) => cb(d)),
  onWorkspaceChanged: (cb) => ipcRenderer.on("workspace-changed", () => cb()),
  onThemeChanged: (cb) => ipcRenderer.on("theme-changed", (_, t) => cb(t)),
  onTriggerSave: (cb) => ipcRenderer.on("trigger-save", () => cb()),
  onTriggerPublish: (cb) => ipcRenderer.on("trigger-publish", () => cb()),
  onCollabRemoteChange: (cb) => ipcRenderer.on("collab-remote-change", (_, d) => cb(d)),
  onCollabStatus: (cb) => ipcRenderer.on("collab-status", (_, d) => cb(d)),
  onCollabPeers: (cb) => ipcRenderer.on("collab-peers", (_, d) => cb(d)),
});
