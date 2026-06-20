/* =========================================================
   memory.wiki for Mac — Electron + Local WASM + Sidebar + Sync
   Architecture: mirrors VS Code extension model
   - Sidebar with file list (ALL/SYNCED/LOCAL/CLOUD)
   - SyncEngine (push/pull/conflict/offline queue/polling)
   - AuthManager (memorywiki:// OAuth callback, JWT tokens)
   - Workspace folder scanning
   ========================================================= */

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
  nativeTheme,
  net,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { mime } = require("./mime-types");
const Y = require("yjs");
const { createClient } = require("@supabase/supabase-js");

// ─── Constants ───

const MDFY_URL = "https://memory.wiki";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const SYNC_POLL_INTERVAL = 30000; // 30 seconds
const PUSH_DEBOUNCE_MS = 2000;
const MAX_OFFLINE_RETRIES = 5;
const AUTO_SAVE_INTERVAL = 3000;

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".mdown", ".mkd", ".txt"]);
const ALL_SUPPORTED_EXTENSIONS = new Set([
  ".md", ".markdown", ".mdown", ".mkd",
  ".pdf", ".docx", ".pptx", ".xlsx",
  ".html", ".csv", ".json", ".txt",
]);

const FILE_FILTERS = [
  { name: "All Supported", extensions: ["md", "markdown", "txt", "pdf", "docx", "pptx", "xlsx", "html", "csv", "json"] },
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
  { name: "Documents", extensions: ["pdf", "docx", "pptx", "xlsx"] },
  { name: "All Files", extensions: ["*"] },
];

// ─── Markdown Renderer ───
//
// Phase 3 of the WASM-to-markdown-it migration (Phase 1 = web,
// Phase 2 = vsce, this = desktop). Same renderer as the web app and
// the VS Code extension — preview output stays in sync with what
// the user will see at memory.wiki/<id> after publish.

const renderer = require("./render");

function renderMarkdown(markdown) {
  try {
    const result = renderer.render(markdown || "");
    const flavorPrimary = result.flavor ? result.flavor.primary : "gfm";
    return { html: result.html, flavor: { primary: flavorPrimary } };
  } catch (err) {
    console.error("[render] error:", err);
    return {
      html: `<p style="color:red">Render error: ${err.message}</p>`,
      flavor: { primary: "gfm" },
    };
  }
}

// ─── Persistent State Paths ───

const USER_DATA_DIR = app.getPath("userData");
const AUTH_PATH = path.join(USER_DATA_DIR, "auth.json");
const RECENT_FILES_PATH = path.join(USER_DATA_DIR, "recent-files.json");
const OFFLINE_QUEUE_PATH = path.join(USER_DATA_DIR, "offline-queue.json");
const WORKSPACE_PATH = path.join(USER_DATA_DIR, "workspace.json");

// ─── App State ───

let mainWindow = null;
let authWindow = null;        // in-app sign-in window (see openAuthWindow)
let currentFilePath = null;
let currentWorkspaceFolder = null;
let fileWatcher = null;
let folderWatcher = null;
let lastAutoSaveTime = 0;

// ─── AuthManager ───

const AuthManager = {
  _data: null,

  load() {
    if (this._data) return this._data;
    try {
      this._data = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
      return this._data;
    } catch { return null; }
  },

  save(data) {
    this._data = data;
    try { fs.writeFileSync(AUTH_PATH, JSON.stringify(data, null, 2)); } catch {}
  },

  clear() {
    this._data = null;
    try { fs.unlinkSync(AUTH_PATH); } catch {}
  },

  getToken() {
    const data = this.load();
    if (!data || !data.token) return null;
    // Check expiry via JWT decode (no verification)
    try {
      const payload = JSON.parse(
        Buffer.from(data.token.split(".")[1], "base64").toString()
      );
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        // Token expired — try refresh
        return null;
      }
      return data.token;
    } catch {
      return data.token; // Can't decode, return as-is
    }
  },

  getUserId() {
    const data = this.load();
    if (!data) return null;
    if (data.userId) return data.userId;
    if (data.token) {
      try {
        const payload = JSON.parse(
          Buffer.from(data.token.split(".")[1], "base64").toString()
        );
        return payload.sub || payload.userId || payload.user_id || null;
      } catch { return null; }
    }
    return null;
  },

  getEmail() {
    const data = this.load();
    return data?.email || null;
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  async ensureValidToken() {
    const token = this.getToken();
    if (token) return token;
    // Token expired — try refresh
    const refreshed = await this.refreshToken();
    if (refreshed) return this.getToken();
    // Refresh failed — notify the user
    this.notifySessionExpired();
    return null;
  },

  notifySessionExpired() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth-expired");
      mainWindow.webContents.send("auth-changed", {
        loggedIn: false,
        reason: "session-expired",
      });
    }
  },

  getHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const userId = this.getUserId();
    if (userId) headers["x-user-id"] = userId;
    const email = this.getEmail();
    if (email) headers["x-user-email"] = email;
    return headers;
  },

  async getHeadersWithRefresh() {
    await this.ensureValidToken();
    return this.getHeaders();
  },

  // Single-flight refresh. Supabase refresh tokens are SINGLE-USE and rotate on
  // every refresh, so two concurrent refreshes with the SAME token make the
  // second fail ("refresh token already used") → spurious sign-out. When
  // several API calls hit an expired token at once (sync + sidebar + publish on
  // window focus), they must share ONE refresh, not race. _refreshPromise
  // dedupes them; it's cleared when the single refresh settles.
  _refreshPromise: null,
  async refreshToken() {
    if (this._refreshPromise) return this._refreshPromise;
    this._refreshPromise = this._doRefresh();
    try { return await this._refreshPromise; }
    finally { this._refreshPromise = null; }
  },

  async _doRefresh() {
    const data = this.load();
    if (!data?.refreshToken) {
      this.notifySessionExpired();
      return false;
    }
    try {
      const resp = await net.fetch(`${MDFY_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: data.refreshToken }),
      });
      if (!resp.ok) {
        this.notifySessionExpired();
        return false;
      }
      let result;
      try { result = await resp.json(); } catch { this.save(null); this.notifySessionExpired(); return false; }
      // API returns access_token and refresh_token (snake_case)
      if (result.access_token) {
        data.token = result.access_token;
        if (result.refresh_token) data.refreshToken = result.refresh_token;
        this.save(data);
        return true;
      }
    } catch {}
    this.notifySessionExpired();
    return false;
  },

  handleAuthCallback(url) {
    try {
      const parsed = new URL(url);
      const token = parsed.searchParams.get("token");
      const refreshToken = parsed.searchParams.get("refresh_token");
      if (!token) return false;

      // Decode user info from JWT
      let userId = null, email = null;
      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString()
        );
        userId = payload.sub || payload.userId || payload.user_id;
        email = payload.email;
      } catch {}

      this.save({ token, refreshToken, userId, email });

      // Wipe profile cache so the next get-user-profile fetch hits the
      // server fresh. Without this, switching accounts via the web's
      // "Use a different one" link saved the new token but kept the
      // previous account's avatar + display name in the sidebar
      // because the cache returned the stale entry on the next read.
      try { profileCache = null; } catch {}

      // Stop any live collaboration session — the Yjs/Realtime channel
      // joined under the old user's token has no business outliving
      // the account switch. Renderer will re-join with new auth when
      // the user opens a doc again.
      try { CollaborationManager.stop(); } catch {}

      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send("auth-changed", {
          loggedIn: true,
          email,
          userId,
        });
      }
      return true;
    } catch { return false; }
  },
};

// ─── .memorywiki.json Sidecar ───

function getMdfyConfigPath(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  // Hidden file (dot prefix) to keep workspace clean
  return path.join(dir, "." + base + ".memorywiki.json");
}

// Migration: rename old visible sidecar to hidden
function migrateOldSidecar(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const oldPath = path.join(dir, base + ".memorywiki.json");
  const newPath = path.join(dir, "." + base + ".memorywiki.json");
  try {
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
    }
  } catch {}
}

function loadMdfyConfig(filePath) {
  migrateOldSidecar(filePath);
  try {
    return JSON.parse(fs.readFileSync(getMdfyConfigPath(filePath), "utf8"));
  } catch { return null; }
}

function saveMdfyConfig(filePath, config) {
  try {
    fs.writeFileSync(getMdfyConfigPath(filePath), JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("[config] Failed to save .memorywiki.json:", err.message);
  }
}

function deleteMdfyConfig(filePath) {
  try { fs.unlinkSync(getMdfyConfigPath(filePath)); } catch {}
}

// ─── API Functions (mirrors publish.ts) ───

function handleApiAuthError(status) {
  if (status === 401 || status === 403) {
    AuthManager.notifySessionExpired();
  }
}

async function apiPublish(markdown, title) {
  const body = {
    markdown,
    title,
    isDraft: false,
    source: "desktop",
  };
  const userId = AuthManager.getUserId();
  const email = AuthManager.getEmail();
  if (userId) body.userId = userId;
  if (email) body.userEmail = email;

  const headers = await AuthManager.getHeadersWithRefresh();
  const resp = await net.fetch(`${MDFY_URL}/api/docs`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    handleApiAuthError(resp.status);
    throw new Error(`Publish failed: ${resp.status}`);
  }
  return resp.json();
}

async function apiUpdate(docId, editToken, markdown, title, expectedUpdatedAt) {
  const body = {
    editToken,
    markdown,
    title,
    action: "auto-save",
  };
  const userId = AuthManager.getUserId();
  const email = AuthManager.getEmail();
  if (userId) body.userId = userId;
  if (email) body.userEmail = email;
  if (expectedUpdatedAt) body.expectedUpdatedAt = expectedUpdatedAt;

  const headers = await AuthManager.getHeadersWithRefresh();
  const resp = await net.fetch(`${MDFY_URL}/api/docs/${docId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (resp.status === 409) {
    const conflictData = await resp.json().catch(() => ({}));
    const err = new Error("Conflict: document was modified by someone else");
    err.conflict = true;
    err.serverMarkdown = conflictData.serverMarkdown || "";
    err.serverUpdatedAt = conflictData.serverUpdatedAt || "";
    throw err;
  }
  if (!resp.ok) {
    handleApiAuthError(resp.status);
    throw new Error(`Update failed: ${resp.status}`);
  }
  return resp.json();
}

async function apiPull(docId) {
  const headers = await AuthManager.getHeadersWithRefresh();
  // 15s hard timeout — without this, a stalled connection (captive
  // portal, server hang, partial CORS preflight) leaves the fetch
  // pending forever, which leaves the renderer's loading spinner
  // stuck forever. AbortController + setTimeout gives a deterministic
  // failure path that the renderer can render an error from.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await net.fetch(`${MDFY_URL}/api/docs/${docId}`, {
      method: "GET",
      headers,
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      handleApiAuthError(resp.status);
      throw new Error(`Pull failed: ${resp.status}`);
    }
    return resp.json();
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("Network timeout (15s). Check your connection.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function apiCheckUpdatedAt(docId) {
  try {
    const resp = await net.fetch(`${MDFY_URL}/api/docs/${docId}`, {
      method: "HEAD",
      headers: AuthManager.getHeaders(), // HEAD is non-critical, no refresh needed
    });
    if (resp.status === 404 || resp.status === 410) return { status: "deleted" };
    if (!resp.ok) return { status: "error" };
    const updatedAt = resp.headers.get("x-updated-at") || resp.headers.get("last-modified");
    return { status: "ok", updated_at: updatedAt };
  } catch {
    return { status: "error" };
  }
}

async function apiGetCloudDocuments() {
  const userId = AuthManager.getUserId();
  if (!userId) return [];
  try {
    const headers = await AuthManager.getHeadersWithRefresh();
    const resp = await net.fetch(`${MDFY_URL}/api/user/documents`, {
      headers,
    });
    if (!resp.ok) {
      handleApiAuthError(resp.status);
      return [];
    }
    const data = await resp.json();
    return data.documents || [];
  } catch { return []; }
}

async function apiDeleteDocument(docId, editToken) {
  const body = { action: "soft-delete" };
  if (editToken) body.editToken = editToken;
  const userId = AuthManager.getUserId();
  if (userId) body.userId = userId;

  const resp = await net.fetch(`${MDFY_URL}/api/docs/${docId}`, {
    method: "PATCH",
    headers: AuthManager.getHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
  return true;
}

// ─── SyncEngine ───

const SyncEngine = {
  _pollTimer: null,
  _pushTimers: new Map(),
  _offlineQueue: [],

  start() {
    this.loadQueue();
    this.startPolling();
  },

  stop() {
    this.stopPolling();
    for (const t of this._pushTimers.values()) clearTimeout(t);
    this._pushTimers.clear();
  },

  startPolling() {
    this.stopPolling();
    this._pollTimer = setInterval(() => this.pollAll(), SYNC_POLL_INTERVAL);
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  loadQueue() {
    try {
      this._offlineQueue = JSON.parse(fs.readFileSync(OFFLINE_QUEUE_PATH, "utf8"));
    } catch {
      this._offlineQueue = [];
    }
  },

  persistQueue() {
    try {
      fs.writeFileSync(OFFLINE_QUEUE_PATH, JSON.stringify(this._offlineQueue, null, 2));
    } catch {}
  },

  // Debounced push on file save
  onFileSaved(filePath, markdown) {
    const existing = this._pushTimers.get(filePath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this._pushTimers.delete(filePath);
      try {
        await this.push(filePath, markdown);
      } catch (err) {
        console.error("[sync] Push failed, queueing offline:", err.message);
        this.queueOffline(filePath, markdown);
      }
    }, PUSH_DEBOUNCE_MS);

    this._pushTimers.set(filePath, timer);
  },

  async checkOwnership(docId) {
    try {
      const data = await apiPull(docId);
      return data.isOwner !== false;
    } catch {
      // Network error — allow push, server will reject if unauthorized
      return true;
    }
  },

  async push(filePath, markdown) {
    // Never push empty content — protect against content loss
    if (!markdown || !markdown.trim()) {
      console.warn("[sync] push skipped: empty content for", filePath);
      return;
    }
    // Per-file mutex: if a push is already in flight for this file, queue
    // the new markdown for after it finishes. Without this the 3s autoSave
    // loop could fire a second push using a stale lastServerUpdatedAt
    // (the first push hasn't written it back yet) and the server's check
    // would see "remote moved" and emit a false-alarm conflict during
    // ordinary typing.
    if (this._inflightPushes && this._inflightPushes.has(filePath)) {
      this._pendingPushes = this._pendingPushes || new Map();
      this._pendingPushes.set(filePath, markdown);
      return;
    }
    if (!this._inflightPushes) this._inflightPushes = new Set();
    this._inflightPushes.add(filePath);

    try {
      const config = loadMdfyConfig(filePath);
      if (!config) return; // Not published

      // Verify ownership before pushing — only the document owner can edit
      const isOwner = await this.checkOwnership(config.docId);
      if (!isOwner) {
        sendToRenderer("sync-status", { filePath, status: "error", message: "You do not own this document. Only the owner can push changes." });
        return;
      }

      // Removed the apiCheckUpdatedAt pre-flight: it raced with autoSave
      // (a second autoSave would compare against the in-flight push's
      // stale lastServerUpdatedAt and pop a false conflict during normal
      // typing). The real if-match check happens inside apiUpdate via
      // lastServerUpdatedAt as the optimistic-concurrency token, so the
      // pre-check was both redundant and the source of the race.

      const title = extractTitle(markdown) || path.basename(filePath, ".md");
      sendToRenderer("sync-status", { filePath, status: "syncing" });

      try {
        // Skip conflict detection when Yjs collaboration is active
        const collabActive = CollaborationManager._cloudId === config.docId;
        const result = await apiUpdate(config.docId, config.editToken, markdown, title, collabActive ? undefined : config.lastServerUpdatedAt);
        config.lastSyncedAt = new Date().toISOString();
        config.lastServerUpdatedAt = result.updated_at;
        saveMdfyConfig(filePath, config);

        sendToRenderer("sync-status", { filePath, status: "synced" });
      } catch (err) {
        if (err.conflict) {
          // Send conflict event to renderer with server data
          sendToRenderer("sync-conflict", {
            filePath,
            serverUpdatedAt: err.serverUpdatedAt,
            localUpdatedAt: config.lastServerUpdatedAt,
            serverMarkdown: err.serverMarkdown,
            conflict: true,
          });
          return;
        }
        throw err;
      }
    } finally {
      this._inflightPushes.delete(filePath);
      // Drain any newer markdown queued while we were in flight.
      if (this._pendingPushes && this._pendingPushes.has(filePath)) {
        const pendingMd = this._pendingPushes.get(filePath);
        this._pendingPushes.delete(filePath);
        // Defer to next tick so this finally returns first.
        setImmediate(() => { this.push(filePath, pendingMd).catch((e) => console.warn("[sync] drained push failed:", e.message)); });
      }
    }
  },

  async pull(filePath) {
    const config = loadMdfyConfig(filePath);
    if (!config) return null;

    sendToRenderer("sync-status", { filePath, status: "syncing" });

    const remote = await apiPull(config.docId);
    const markdown = remote.markdown || remote.content || "";

    // Write to file
    lastAutoSaveTime = Date.now();
    fs.writeFileSync(filePath, markdown, "utf8");

    // Update config
    config.lastSyncedAt = new Date().toISOString();
    config.lastServerUpdatedAt = remote.updated_at;
    if (remote.editToken) config.editToken = remote.editToken;
    saveMdfyConfig(filePath, config);

    sendToRenderer("sync-status", { filePath, status: "synced" });

    // If this file is currently open, reload it
    if (filePath === currentFilePath && mainWindow) {
      const result = renderMarkdown(markdown);
      mainWindow.webContents.send("file-changed", {
        markdown,
        html: result.html,
        flavor: result.flavor.primary,
      });
    }

    return markdown;
  },

  async pullCloudDocument(docId, title) {
    const remote = await apiPull(docId);
    const markdown = remote.markdown || remote.content || "";

    // Ask user where to save
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: (title || "untitled").replace(/[^a-zA-Z0-9-_ ]/g, "") + ".md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });

    if (result.canceled || !result.filePath) return null;

    fs.writeFileSync(result.filePath, markdown, "utf8");
    saveMdfyConfig(result.filePath, {
      docId,
      editToken: remote.editToken || "pulled",
      lastSyncedAt: new Date().toISOString(),
      lastServerUpdatedAt: remote.updated_at,
    });

    addToRecentFiles(result.filePath);
    return result.filePath;
  },

  async pollAll() {
    // Flush offline queue first
    await this.flushOfflineQueue();

    if (!AuthManager.isLoggedIn()) return;

    // Find all .memorywiki.json files in workspace
    const sidecarFiles = this.findSidecars();

    for (const sidecarPath of sidecarFiles) {
      const mdPath = sidecarPath.replace(/\.memory.wiki\.json$/, ".md");
      const config = loadMdfyConfig(mdPath);
      if (!config) continue;

      // Skip polling for documents with active Yjs collaboration
      if (CollaborationManager._cloudId === config.docId) continue;

      try {
        const check = await apiCheckUpdatedAt(config.docId);

        if (check.status === "deleted") {
          deleteMdfyConfig(mdPath);
          sendToRenderer("sync-status", { filePath: mdPath, status: "unlinked" });
          continue;
        }
        if (check.status === "error") continue;

        const serverTime = new Date(check.updated_at).getTime();
        const localTime = new Date(config.lastServerUpdatedAt || config.lastSyncedAt).getTime();

        if (serverTime > localTime) {
          // Server has newer content — auto-pull if file not dirty
          if (mdPath !== currentFilePath) {
            // File not currently being edited — safe to auto-pull
            await this.pull(mdPath);
          } else {
            // Currently editing — show conflict
            sendToRenderer("sync-conflict", {
              filePath: mdPath,
              serverUpdatedAt: check.updated_at,
              localUpdatedAt: config.lastServerUpdatedAt,
            });
          }
        }
      } catch {
        // Network error, skip
      }
    }
  },

  findSidecars() {
    const results = [];
    const searchDirs = [];

    if (currentWorkspaceFolder) {
      searchDirs.push(currentWorkspaceFolder);
    }

    // Also check recent files' directories
    const recent = loadRecentFiles();
    for (const r of recent) {
      const dir = path.dirname(r.path);
      if (!searchDirs.includes(dir)) searchDirs.push(dir);
    }

    for (const dir of searchDirs) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.endsWith(".memorywiki.json")) {
            results.push(path.join(dir, f));
          }
        }
      } catch {}
    }

    return results;
  },

  queueOffline(filePath, markdown) {
    const existing = this._offlineQueue.find((i) => i.filePath === filePath);
    const retryCount = existing ? existing.retryCount + 1 : 0;
    this._offlineQueue = this._offlineQueue.filter((i) => i.filePath !== filePath);

    if (retryCount >= MAX_OFFLINE_RETRIES) {
      console.warn("[sync] Max retries exceeded for:", filePath);
      return;
    }

    this._offlineQueue.push({
      filePath,
      markdown,
      title: extractTitle(markdown) || path.basename(filePath, ".md"),
      retryCount,
      queuedAt: new Date().toISOString(),
    });
    this.persistQueue();
  },

  async flushOfflineQueue() {
    if (this._offlineQueue.length === 0) return;
    const queue = [...this._offlineQueue];
    this._offlineQueue = [];

    for (const item of queue) {
      if (item.retryCount >= MAX_OFFLINE_RETRIES) continue;
      const config = loadMdfyConfig(item.filePath);
      if (!config) continue;

      try {
        // Re-read file content (not stale queue data)
        const markdown = fs.readFileSync(item.filePath, "utf8");
        const result = await apiUpdate(config.docId, config.editToken, markdown, item.title);
        config.lastSyncedAt = new Date().toISOString();
        config.lastServerUpdatedAt = result.updated_at;
        saveMdfyConfig(item.filePath, config);
      } catch {
        this._offlineQueue.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }
    this.persistQueue();
  },
};

// ─── CollaborationManager (Yjs CRDT + Supabase Realtime) ───

const SUPABASE_URL = "https://gxvhvcuoprbqnxkrieyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dmh2Y3VvcHJicW54a3JpZXlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTYwMDQsImV4cCI6MjA4OTYzMjAwNH0.RyPCS3KrVNwGAybrJ4bAnLVyXhcHMZJ1D4L8THvDwN0";

function uint8ToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function base64ToUint8(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

const CollaborationManager = {
  _supabase: null,
  _ydoc: null,
  _ytext: null,
  _channel: null,
  _cloudId: null,
  _isApplyingRemote: false,
  _peerCount: 0,
  _isOwner: true, // assume owner until proven otherwise

  _getSupabase() {
    if (!this._supabase) {
      this._supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return this._supabase;
  },

  /**
   * Start collaborative editing for a document.
   * Creates Y.Doc, joins Supabase Realtime Broadcast channel.
   */
  start(cloudId, initialMarkdown, isOwner) {
    // Stop any existing session
    this.stop();

    if (!cloudId) return;

    this._cloudId = cloudId;
    this._isOwner = isOwner !== false; // default to true if not specified
    this._initialMarkdown = initialMarkdown || "";

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    this._ydoc = ydoc;
    this._ytext = ytext;

    // Don't insert content yet — wait for sync-response from peers.
    // If no peers respond within a timeout, initialize with local content.
    let initialized = false;
    this._initTimer = setTimeout(() => {
      if (!initialized) {
        initialized = true;
        const content = this._initialMarkdown;
        if (content && ytext.length === 0) {
          ytext.insert(0, content);
        }
      }
    }, 1500);

    // Listen for local Y.Doc updates and broadcast to peers
    ydoc.on("update", (update, origin) => {
      if (origin === "remote") return;
      const channel = this._channel;
      if (channel) {
        channel.send({
          type: "broadcast",
          event: "yjs-update",
          payload: { update: uint8ToBase64(update) },
        });
      }
    });

    // Set up Supabase Realtime Broadcast channel
    const supabase = this._getSupabase();
    const channel = supabase.channel(`yjs-doc-${cloudId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "yjs-update" }, ({ payload }) => {
        if (!payload?.update) return;
        const update = base64ToUint8(payload.update);
        this._isApplyingRemote = true;
        Y.applyUpdate(ydoc, update, "remote");
        const merged = ytext.toString();
        sendToRenderer("collab-remote-change", { markdown: merged });
        this._isApplyingRemote = false;
      })
      .on("broadcast", { event: "yjs-sync-request" }, () => {
        // If not initialized yet but have local markdown, init now and respond
        if (!initialized && this._initialMarkdown) {
          initialized = true;
          if (this._initTimer) { clearTimeout(this._initTimer); this._initTimer = null; }
          if (ytext.length === 0) {
            ytext.insert(0, this._initialMarkdown);
          }
        }
        if (ytext.length === 0) return;
        const state = Y.encodeStateAsUpdate(ydoc);
        channel.send({
          type: "broadcast",
          event: "yjs-sync-response",
          payload: { state: uint8ToBase64(state) },
        });
      })
      .on("broadcast", { event: "yjs-sync-response" }, ({ payload }) => {
        if (!payload?.state) return;
        const state = base64ToUint8(payload.state);
        const freshDoc = new Y.Doc();
        Y.applyUpdate(freshDoc, state);
        const peerContent = freshDoc.getText("content").toString();
        freshDoc.destroy();
        if (!peerContent.trim()) return; // Never replace with empty
        this._isApplyingRemote = true;
        if (!initialized) {
          initialized = true;
          if (this._initTimer) { clearTimeout(this._initTimer); this._initTimer = null; }
          if (ytext.length > 0) {
            ydoc.transact(() => { ytext.delete(0, ytext.length); }, "remote");
          }
          ydoc.transact(() => { ytext.insert(0, peerContent); }, "remote");
          sendToRenderer("collab-remote-change", { markdown: ytext.toString() });
          this._isApplyingRemote = false;
          return;
        }
        Y.applyUpdate(ydoc, state, "remote");
        const merged = ytext.toString();
        if (merged.trim()) sendToRenderer("collab-remote-change", { markdown: merged });
        this._isApplyingRemote = false;
      })
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        this._peerCount = Math.max(0, Object.keys(presenceState).length - 1);
        sendToRenderer("collab-peers", { count: this._peerCount });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          sendToRenderer("collab-status", { active: true, cloudId });
          // Request full state from any existing peers
          channel.send({
            type: "broadcast",
            event: "yjs-sync-request",
            payload: {},
          });
          // Track presence
          await channel.track({ joined_at: Date.now() });
        }
      });

    this._channel = channel;
    console.log("[collab] Started for doc:", cloudId);
  },

  /**
   * Stop collaborative editing. Cleanup Y.Doc and channel.
   */
  stop() {
    if (this._initTimer) {
      clearTimeout(this._initTimer);
      this._initTimer = null;
    }
    if (this._channel) {
      this._channel.unsubscribe();
      this._channel = null;
    }
    if (this._ydoc) {
      this._ydoc.destroy();
      this._ydoc = null;
      this._ytext = null;
    }
    this._cloudId = null;
    this._initialMarkdown = "";
    this._peerCount = 0;
    this._isApplyingRemote = false;
    this._isOwner = true;
    sendToRenderer("collab-status", { active: false, cloudId: null });
    sendToRenderer("collab-peers", { count: 0 });
  },

  /**
   * Apply a local editor change to the Y.Doc and broadcast.
   * Blocked for non-owner documents.
   */
  applyLocalChange(newMarkdown) {
    if (this._isApplyingRemote) return;
    if (!this._isOwner) return; // Non-owners cannot broadcast changes
    const ytext = this._ytext;
    const ydoc = this._ydoc;
    if (!ytext || !ydoc) return;

    const current = ytext.toString();
    if (current === newMarkdown) return;

    // Minimal diff to avoid CRDT duplication
    ydoc.transact(() => {
      const current = ytext.toString();
      let prefixLen = 0;
      const minLen = Math.min(current.length, newMarkdown.length);
      while (prefixLen < minLen && current[prefixLen] === newMarkdown[prefixLen]) prefixLen++;
      let suffixLen = 0;
      const maxSuffix = Math.min(current.length - prefixLen, newMarkdown.length - prefixLen);
      while (suffixLen < maxSuffix && current[current.length - 1 - suffixLen] === newMarkdown[newMarkdown.length - 1 - suffixLen]) suffixLen++;
      const deleteLen = current.length - prefixLen - suffixLen;
      const insertStr = newMarkdown.slice(prefixLen, newMarkdown.length - suffixLen);
      if (deleteLen > 0) ytext.delete(prefixLen, deleteLen);
      if (insertStr.length > 0) ytext.insert(prefixLen, insertStr);
    });
  },

  /**
   * Get current collaboration state.
   */
  getState() {
    return {
      active: !!this._channel,
      cloudId: this._cloudId,
      peerCount: this._peerCount,
    };
  },
};

// ─── Workspace Scanner ───

function scanWorkspaceFiles(folderPath) {
  const results = [];
  const folders = [];
  if (!folderPath) return { files: results, folders };

  function walk(dir, depth) {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        if (entry.name === "node_modules") continue;
        if (entry.name.endsWith(".memorywiki.json")) continue;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          folders.push({
            path: fullPath,
            name: entry.name,
            relativePath: path.relative(folderPath, fullPath),
            depth,
          });
          walk(fullPath, depth + 1);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          const config = loadMdfyConfig(fullPath);
          const stats = fs.statSync(fullPath);
          results.push({
            filePath: fullPath,
            fileName: entry.name,
            relativePath: path.relative(folderPath, fullPath),
            parentFolder: path.relative(folderPath, dir) || null,
            config: config || null,
            modifiedAt: stats.mtime.toISOString(),
            size: stats.size,
          });
        }
      }
    } catch {}
  }

  walk(folderPath, 0);
  return { files: results, folders };
}

// ─── Recent Files ───

function loadRecentFiles() {
  try {
    const data = JSON.parse(fs.readFileSync(RECENT_FILES_PATH, "utf8"));
    return data
      .map((f) => (typeof f === "string" ? { path: f, openedAt: new Date().toISOString() } : f))
      .filter((f) => f.path && fs.existsSync(f.path));
  } catch { return []; }
}

function addToRecentFiles(filePath) {
  const recent = loadRecentFiles();
  const filtered = recent.filter((f) => f.path !== filePath);
  filtered.unshift({ path: filePath, openedAt: new Date().toISOString() });
  const trimmed = filtered.slice(0, 20);
  try {
    fs.writeFileSync(RECENT_FILES_PATH, JSON.stringify(trimmed, null, 2));
  } catch {}
}

// ─── Workspace Persistence ───

function loadWorkspace() {
  try {
    return JSON.parse(fs.readFileSync(WORKSPACE_PATH, "utf8"));
  } catch { return null; }
}

function saveWorkspace(data) {
  try {
    fs.writeFileSync(WORKSPACE_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

// ─── File Operations ───

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function extractTitle(md) {
  const match = (md || "").match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function startFileWatcher(filePath) {
  stopFileWatcher();
  try {
    fileWatcher = fs.watch(filePath, (eventType) => {
      if (eventType === "change" && mainWindow) {
        if (fileWatcher._debounce) clearTimeout(fileWatcher._debounce);
        fileWatcher._debounce = setTimeout(() => {
          if (Date.now() - lastAutoSaveTime < 2000) return;
          try {
            const content = fs.readFileSync(filePath, "utf8");
            const result = renderMarkdown(content);
            mainWindow.webContents.send("file-changed", {
              markdown: content,
              html: result.html,
              flavor: result.flavor.primary,
            });
            // Auto-push to cloud if published
            const config = loadMdfyConfig(filePath);
            if (config && config.docId) {
              SyncEngine.onFileSaved(filePath, content);
            }
          } catch {}
        }, 1000);
      }
    });
  } catch {}
}

function stopFileWatcher() {
  if (fileWatcher) {
    if (fileWatcher._debounce) clearTimeout(fileWatcher._debounce);
    fileWatcher.close();
    fileWatcher = null;
  }
}

function startFolderWatcher(folderPath) {
  stopFolderWatcher();
  try {
    folderWatcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // Watch for any .md file changes (create, rename, delete)
      if (filename.endsWith(".md") || filename.endsWith(".memorywiki.json")) {
        if (folderWatcher._debounce) clearTimeout(folderWatcher._debounce);
        folderWatcher._debounce = setTimeout(() => {
          sendToRenderer("workspace-changed");
        }, 300);
      }
    });
  } catch {}
}

function stopFolderWatcher() {
  if (folderWatcher) {
    folderWatcher.close();
    folderWatcher = null;
  }
}

function openFileInApp(filePath) {

  if (!mainWindow) return;
  const absolutePath = path.resolve(filePath);
  const ext = path.extname(absolutePath).toLowerCase();

  if (!ALL_SUPPORTED_EXTENSIONS.has(ext)) {
    dialog.showErrorBox("Unsupported Format", `memory.wiki does not support ${ext} files.`);
    return;
  }

  try {
    const stats = fs.statSync(absolutePath);
    if (stats.size > MAX_FILE_SIZE) {
      dialog.showErrorBox("File too large", "Files larger than 50MB are not supported.");
      return;
    }

    addToRecentFiles(absolutePath);

    if (isTextFile(absolutePath)) {
      currentFilePath = absolutePath;
      startFileWatcher(absolutePath);
      const content = fs.readFileSync(absolutePath, "utf8");
      const result = renderMarkdown(content);
      const config = loadMdfyConfig(absolutePath);

      mainWindow.setTitle(`${path.basename(absolutePath)}: memory.wiki`);
      mainWindow.webContents.send("load-document", {
        html: result.html,
        markdown: content,
        filePath: absolutePath,
        flavor: result.flavor.primary,
        config: config,
      });
    } else {
      // Non-text: show import message
      const msg = `Import ${ext} files by opening them on memory.wiki.`;
      const md = `# ${path.basename(absolutePath)}\n\n${msg}`;
      const result = renderMarkdown(md);
      mainWindow.webContents.send("load-document", {
        html: result.html,
        markdown: md,
        filePath: null,
        flavor: "gfm",
        config: null,
      });
    }
  } catch (err) {
    dialog.showErrorBox("Error", `Could not open file: ${err.message}`);
  }
}

// ─── Helper ───

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ─── URL Scheme: memorywiki:// ───

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("memorywiki", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient("memorywiki");
}

// ─── Single Instance ───

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const mwUrl = argv.find((a) => a.startsWith("memorywiki://"));
      if (mwUrl) {
        handleMdfyUrl(mwUrl);
        return;
      }

      const filePath = argv.find((a) => {
        const ext = path.extname(a).toLowerCase();
        return ALL_SUPPORTED_EXTENSIONS.has(ext);
      });
      if (filePath) openFileInApp(filePath);
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleMdfyUrl(url);
  });
}

function handleMdfyUrl(url) {
  try {
    const parsed = new URL(url);

    // Auth callback: memorywiki://auth?token=...&refresh_token=...
    if (parsed.hostname === "auth" || parsed.pathname.startsWith("/auth")) {
      AuthManager.handleAuthCallback(url);
      // Close the in-app sign-in window once the token round-trips —
      // whether it arrived via the window's will-navigate intercept or
      // the OS protocol handler.
      if (authWindow && !authWindow.isDestroyed()) authWindow.close();
      return;
    }

    // Open file: memorywiki://open?file=/path/to/file.md
    if (parsed.hostname === "open" || parsed.pathname.startsWith("/open")) {
      const filePath = parsed.searchParams.get("file");
      if (filePath && fs.existsSync(filePath)) {
        // Validate path is within user's home directory or workspace
        const resolved = path.resolve(filePath);
        const homeDir = app.getPath("home");
        if (!resolved.startsWith(homeDir + path.sep) && resolved !== homeDir) {
          console.warn("[open] Blocked path outside home directory:", resolved);
          return;
        }
        openFileInApp(resolved);
      }
      return;
    }

    // Open cloud doc: memorywiki://doc/{docId}
    if (parsed.hostname === "doc" || parsed.pathname.startsWith("/doc")) {
      const docId = parsed.pathname.split("/").pop();
      if (docId) openCloudDocumentInApp(docId);
      return;
    }
  } catch {}
}

async function openCloudDocumentInApp(docId) {
  if (!mainWindow || !net.isOnline()) return;
  try {
    const data = await apiPull(docId);
    const markdown = data.markdown || data.content || "";
    const result = renderMarkdown(markdown);
    currentFilePath = null;
    mainWindow.setTitle((data.title || docId) + ": memory.wiki");
    mainWindow.webContents.send("load-document", {
      html: result.html,
      markdown,
      filePath: null,
      flavor: result.flavor.primary,
      config: { docId, editToken: data.editToken },
    });
  } catch (err) {
    shell.openExternal(`${MDFY_URL}/${docId}`);
  }
}

// ─── Create Window ───

// Show / recreate the main window. Wired to a Window-menu item so a
// closed main window is reopenable from the menu bar, not only the Dock
// — Apple Guideline 4 (Design) flagged the missing menu affordance.
function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 400,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#09090b" : "#faf9f7",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, "assets", "icon.png"),
  });

  // Single page — always load index.html
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Save before close — auto-save current markdown
  let closeHandled = false;
  mainWindow.on("close", (e) => {
    if (currentFilePath && !closeHandled) {
      e.preventDefault();
      closeHandled = true;
      try {
        mainWindow.webContents.send("trigger-save");
        // Wait briefly for save to complete, then close
        setTimeout(() => {
          mainWindow.destroy();
        }, 500);
      } catch {
        mainWindow.destroy();
      }
    }
  });

  mainWindow.on("closed", () => {
    stopFileWatcher();
    stopFolderWatcher();
    mainWindow = null;
  });
}

// ─── IPC Handlers ───

// --- File operations ---

ipcMain.handle("open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: FILE_FILTERS,
  });
  if (!result.canceled && result.filePaths[0]) {
    openFileInApp(result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle("open-folder-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  if (!result.canceled && result.filePaths[0]) {
    currentWorkspaceFolder = result.filePaths[0];
    saveWorkspace({ folder: currentWorkspaceFolder });
    startFolderWatcher(currentWorkspaceFolder);
    return currentWorkspaceFolder;
  }
  return null;
});

ipcMain.handle("open-file-path", (event, filePath) => {
  openFileInApp(filePath);
});

ipcMain.handle("new-document", async () => {
  const defaultDir = currentWorkspaceFolder || app.getPath("desktop");
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(defaultDir, "Untitled.md"),
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (result.canceled || !result.filePath) {
    // User cancelled — open empty editor without file
    currentFilePath = null;
    stopFileWatcher();
    mainWindow.setTitle("Untitled: memory.wiki");
    mainWindow.webContents.send("load-document", {
      html: "<p><br></p>", markdown: "", filePath: null, flavor: "gfm", config: null,
    });
    return;
  }
  const filePath = result.filePath;
  fs.writeFileSync(filePath, "", "utf8");
  currentFilePath = filePath;
  startFileWatcher(filePath);
  addToRecentFiles(filePath);
  mainWindow.setTitle(`${path.basename(filePath)}: memory.wiki`);
  mainWindow.webContents.send("load-document", {
    html: "<p><br></p>", markdown: "", filePath, flavor: "gfm", config: null,
  });
});

ipcMain.handle("save-file", async (event, markdown) => {
  if (currentFilePath) {
    lastAutoSaveTime = Date.now();
    try {
      fs.writeFileSync(currentFilePath, markdown, "utf8");
    } catch (err) {
      console.error("[save-file] Failed to write:", currentFilePath, err.message);
      mainWindow?.webContents.send("save-error", { path: currentFilePath, message: err.message });
      return null;
    }

    // Push to cloud if published
    const config = loadMdfyConfig(currentFilePath);
    if (config && config.docId) {
      SyncEngine.onFileSaved(currentFilePath, markdown);
    }
    return currentFilePath;
  } else {
    const title = extractTitle(markdown) || "untitled";
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: title + ".md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!result.canceled && result.filePath) {
      currentFilePath = result.filePath;
      lastAutoSaveTime = Date.now();
      try {
        fs.writeFileSync(result.filePath, markdown, "utf8");
      } catch (err) {
        console.error("[save-file] Failed to write:", result.filePath, err.message);
        mainWindow?.webContents.send("save-error", { path: result.filePath, message: err.message });
        return null;
      }
      mainWindow.setTitle(`${path.basename(result.filePath)}: memory.wiki`);
      addToRecentFiles(result.filePath);
      startFileWatcher(result.filePath);
      return result.filePath;
    }
    return null;
  }
});

ipcMain.handle("auto-save", (event, markdown) => {
  if (currentFilePath && markdown !== undefined) {
    lastAutoSaveTime = Date.now();
    try {
      fs.writeFileSync(currentFilePath, markdown, "utf8");
    } catch (err) {
      console.warn("[auto-save] Failed to write:", currentFilePath, err.message);
      mainWindow?.webContents.send("save-error", { path: currentFilePath, message: err.message });
      return;
    }

    const config = loadMdfyConfig(currentFilePath);
    if (config && config.docId) {
      SyncEngine.onFileSaved(currentFilePath, markdown);
    }
  }
});

ipcMain.handle("save-file-as", async (event, content, defaultName, filters) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || "export",
    filters: filters || [{ name: "All Files", extensions: ["*"] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, "utf8");
    return result.filePath;
  }
  return null;
});

ipcMain.handle("get-file-path", () => currentFilePath);

// --- Rendering ---

ipcMain.handle("render-markdown", (event, markdown) => {
  return renderMarkdown(markdown);
});

// --- Workspace ---

ipcMain.handle("get-workspace-files", () => {
  var result = scanWorkspaceFiles(currentWorkspaceFolder);
  return result.files || result; // backward compat
});

ipcMain.handle("get-workspace-tree", () => {
  return scanWorkspaceFiles(currentWorkspaceFolder);
});

ipcMain.handle("create-folder", async (event, parentPath) => {
  const target = parentPath || currentWorkspaceFolder;
  if (!target) return { error: "No workspace" };
  if (currentWorkspaceFolder) {
    const resolvedTarget = path.resolve(target);
    const resolvedWorkspace = path.resolve(currentWorkspaceFolder);
    if (!resolvedTarget.startsWith(resolvedWorkspace + path.sep) && resolvedTarget !== resolvedWorkspace) {
      return { error: "Path must be within the workspace directory" };
    }
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(target, "New Folder"),
    buttonLabel: "Create Folder",
  });
  if (result.canceled || !result.filePath) return { error: "Cancelled" };
  if (currentWorkspaceFolder) {
    const resolvedResult = path.resolve(result.filePath);
    const resolvedWorkspace = path.resolve(currentWorkspaceFolder);
    if (!resolvedResult.startsWith(resolvedWorkspace + path.sep) && resolvedResult !== resolvedWorkspace) {
      return { error: "Folder must be created within the workspace directory" };
    }
  }
  try {
    fs.mkdirSync(result.filePath, { recursive: true });
    return { ok: true, path: result.filePath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("move-file", async (event, fromPath, toFolder) => {
  try {
    if (!currentWorkspaceFolder) return { error: "No workspace" };
    const resolvedFrom = path.resolve(fromPath);
    const resolvedTo = path.resolve(toFolder);
    const resolvedWorkspace = path.resolve(currentWorkspaceFolder);
    if (!resolvedFrom.startsWith(resolvedWorkspace + path.sep) || !resolvedTo.startsWith(resolvedWorkspace + path.sep)) {
      return { error: "Path must be within the workspace directory" };
    }
    const fileName = path.basename(fromPath);
    const destPath = path.join(toFolder, fileName);
    if (fs.existsSync(destPath)) return { error: "File already exists in destination" };
    fs.renameSync(fromPath, destPath);
    // Move sidecar too
    const oldConfig = getMdfyConfigPath(fromPath);
    const newConfig = getMdfyConfigPath(destPath);
    if (fs.existsSync(oldConfig)) fs.renameSync(oldConfig, newConfig);
    // Update current file path if it was the moved file
    if (currentFilePath === fromPath) {
      currentFilePath = destPath;
      startFileWatcher(destPath);
    }
    addToRecentFiles(destPath);
    return { ok: true, newPath: destPath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("get-workspace-folder", () => currentWorkspaceFolder);

ipcMain.handle("get-recent-files", () => {
  return loadRecentFiles().map((f) => {
    const config = loadMdfyConfig(f.path);
    let modifiedAt = f.openedAt;
    try { modifiedAt = fs.statSync(f.path).mtime.toISOString(); } catch {}
    return { ...f, config: config || null, modifiedAt };
  });
});

// --- Auth ---

// A standard Chrome User-Agent with the Electron + app tokens stripped.
// OAuth providers (Google / Sign in with Apple) refuse to authenticate
// inside an "embedded webview" they can fingerprint, so the in-app sign-in
// window must present itself as a plain browser.
function cleanChromeUserAgent() {
  try {
    return app.userAgentFallback
      .replace(/ Electron\/[^ ]+/g, "")
      .replace(/ memory\.wiki(?:-desktop)?\/[^ ]+/gi, "")
      .replace(new RegExp(` ${app.getName().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/[^ ]+`, "g"), "")
      .trim();
  } catch {
    return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  }
}

// In-app sign-in window. Apple Guideline 4 (Design) rejects handing users
// off to the default web browser to sign in; this keeps the flow inside
// the app. The web auth page finishes by redirecting to
// memorywiki://auth?token=... — we intercept that (or let the OS protocol
// handler catch it), run the same callback the deep-link path uses, and
// close the window (see handleMdfyUrl).
function openAuthWindow(url) {
  const ua = cleanChromeUserAgent();
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    authWindow.webContents.userAgent = ua;
    authWindow.loadURL(url);
    return;
  }
  const hasParent = !!(mainWindow && !mainWindow.isDestroyed());
  authWindow = new BrowserWindow({
    width: 460,
    height: 760,
    parent: hasParent ? mainWindow : undefined,
    title: "Sign in to memory.wiki",
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#09090b" : "#faf9f7",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Dedicated, persisted session so provider cookies survive between
      // sign-ins and never mingle with the app's own session.
      partition: "persist:memorywiki-auth",
    },
  });
  // Apply the clean UA to every navigation in this window (provider
  // redirects included), not just the first load.
  authWindow.webContents.userAgent = ua;
  const consume = (target) => {
    if (typeof target === "string" && target.startsWith("memorywiki://")) {
      handleMdfyUrl(target);   // stores the token + closes this window
      return true;
    }
    return false;
  };
  authWindow.webContents.on("will-redirect", (e, target) => { if (consume(target)) e.preventDefault(); });
  authWindow.webContents.on("will-navigate", (e, target) => { if (consume(target)) e.preventDefault(); });
  authWindow.webContents.setWindowOpenHandler(({ url: u }) => (consume(u) ? { action: "deny" } : { action: "allow" }));
  authWindow.on("closed", () => { authWindow = null; });
  authWindow.loadURL(url);
}

ipcMain.handle("login", () => {
  const callbackUrl = encodeURIComponent("memorywiki://auth");
  const url = `${MDFY_URL}/auth/desktop?redirect=${callbackUrl}`;
  console.log("[login] Opening in-app sign-in window:", url);
  openAuthWindow(url);
});

ipcMain.handle("logout", () => {
  AuthManager.clear();
  profileCache = null;
  SyncEngine.stopPolling();
  sendToRenderer("auth-changed", { loggedIn: false });
});

ipcMain.handle("get-auth-state", () => {
  return {
    loggedIn: AuthManager.isLoggedIn(),
    email: AuthManager.getEmail(),
    userId: AuthManager.getUserId(),
  };
});

// Account deletion. Apple Guideline 5.1.1(v): an app that supports account
// creation must let users initiate deletion from within the app. Native
// two-step confirmation, then DELETE /api/user/delete (erases all cloud
// data + the auth user server-side), then the same teardown as sign-out.
async function promptDeleteAccount() {
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  if (!AuthManager.isLoggedIn()) {
    await dialog.showMessageBox(parent, {
      type: "info",
      message: "You're not signed in.",
      detail: "Sign in first if you want to delete your account.",
    });
    return;
  }
  const email = AuthManager.getEmail() || "your account";
  const first = await dialog.showMessageBox(parent, {
    type: "warning",
    buttons: ["Cancel", "Delete Account"],
    defaultId: 0,
    cancelId: 0,
    title: "Delete Account",
    message: `Permanently delete ${email}?`,
    detail: "This erases your account and every document, folder, and bundle stored in your memory.wiki cloud. It cannot be undone.",
  });
  if (first.response !== 1) return;
  const second = await dialog.showMessageBox(parent, {
    type: "warning",
    buttons: ["Cancel", "Delete Everything"],
    defaultId: 0,
    cancelId: 0,
    title: "This is permanent",
    message: "Are you absolutely sure?",
    detail: "All your cloud data will be deleted immediately, with no recovery.",
  });
  if (second.response !== 1) return;
  try {
    const headers = await AuthManager.getHeadersWithRefresh();
    const resp = await net.fetch(`${MDFY_URL}/api/user/delete`, { method: "DELETE", headers });
    if (!resp.ok) {
      let detail = `The server returned ${resp.status}.`;
      try { const j = await resp.json(); if (j?.error) detail = j.error; } catch {}
      await dialog.showMessageBox(parent, { type: "error", message: "Couldn't delete your account", detail });
      return;
    }
    // Same teardown as logout.
    AuthManager.clear();
    profileCache = null;
    try { SyncEngine.stopPolling(); } catch {}
    try { CollaborationManager.stop(); } catch {}
    sendToRenderer("auth-changed", { loggedIn: false });
    await dialog.showMessageBox(parent, {
      type: "info",
      message: "Account deleted",
      detail: "Your memory.wiki account and all its data have been permanently deleted.",
    });
  } catch (err) {
    await dialog.showMessageBox(parent, {
      type: "error",
      message: "Couldn't delete your account",
      detail: String((err && err.message) || err),
    });
  }
}

ipcMain.handle("delete-account", () => promptDeleteAccount());

// Pins (starred docs). Renderer CSP blocks cross-origin fetch to
// memory.wiki, so all three pin verbs route through the main process,
// which has net.fetch + AuthManager available.
ipcMain.handle("get-pins", async () => {
  if (!AuthManager.isLoggedIn()) return [];
  try {
    const headers = await AuthManager.getHeadersWithRefresh();
    const resp = await net.fetch(`${MDFY_URL}/api/user/pins`, { headers });
    if (!resp.ok) return [];
    const json = await resp.json();
    return json?.pins || [];
  } catch {
    return [];
  }
});

ipcMain.handle("pin-document", async (_event, docId) => {
  if (!AuthManager.isLoggedIn() || !docId) return false;
  try {
    const headers = await AuthManager.getHeadersWithRefresh();
    const resp = await net.fetch(`${MDFY_URL}/api/user/pins`, {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "document", id: docId }),
    });
    return resp.ok;
  } catch {
    return false;
  }
});

ipcMain.handle("unpin-document", async (_event, docId) => {
  if (!AuthManager.isLoggedIn() || !docId) return false;
  try {
    const headers = await AuthManager.getHeadersWithRefresh();
    const resp = await net.fetch(
      `${MDFY_URL}/api/user/pins?kind=document&id=${encodeURIComponent(docId)}`,
      { method: "DELETE", headers }
    );
    return resp.ok;
  } catch {
    return false;
  }
});

// One-shot profile cache so we don't refetch /api/user/profile on
// every sidebar repaint. Cleared on logout via the auth-changed event.
let profileCache = null;
ipcMain.handle("get-user-profile", async () => {
  if (!AuthManager.isLoggedIn()) {
    profileCache = null;
    return null;
  }
  if (profileCache) return profileCache;
  try {
    const headers = await AuthManager.getHeadersWithRefresh();
    const resp = await net.fetch(`${MDFY_URL}/api/user/profile`, { headers });
    if (!resp.ok) return null;
    const json = await resp.json();
    profileCache = json?.profile || null;
    return profileCache;
  } catch {
    return null;
  }
});

// --- Sync ---

ipcMain.handle("publish", async (event, markdown) => {
  // Try to refresh token if expired before giving up
  if (!AuthManager.isLoggedIn()) {
    const refreshed = await AuthManager.refreshToken();
    if (!refreshed || !AuthManager.isLoggedIn()) {
      return { error: "Not logged in" };
    }
  }

  const title = extractTitle(markdown) || "Untitled";

  // If current file is already published, push update
  if (currentFilePath) {
    const existing = loadMdfyConfig(currentFilePath);
    if (existing) {
      // Verify ownership before pushing
      const isOwner = await SyncEngine.checkOwnership(existing.docId);
      if (!isOwner) {
        return { error: "You do not own this document. Only the owner can push changes." };
      }

      try {
        const result = await apiUpdate(existing.docId, existing.editToken, markdown, title);
        existing.lastSyncedAt = new Date().toISOString();
        existing.lastServerUpdatedAt = result.updated_at;
        saveMdfyConfig(currentFilePath, existing);
        return { url: `${MDFY_URL}/${existing.docId}`, docId: existing.docId };
      } catch (err) {
        return { error: err.message };
      }
    }
  }

  // First publish
  try {
    const result = await apiPublish(markdown, title);
    const url = `${MDFY_URL}/${result.id}`;

    if (currentFilePath) {
      saveMdfyConfig(currentFilePath, {
        docId: result.id,
        editToken: result.editToken,
        lastSyncedAt: new Date().toISOString(),
        lastServerUpdatedAt: result.created_at || new Date().toISOString(),
      });
    }

    return { url, docId: result.id, editToken: result.editToken };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("sync-push", async () => {
  if (!currentFilePath) return { error: "No file open" };
  const config = loadMdfyConfig(currentFilePath);
  if (!config) return { error: "Not published" };

  try {
    const markdown = fs.readFileSync(currentFilePath, "utf8");
    await SyncEngine.push(currentFilePath, markdown);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("sync-pull", async (event, filePath) => {
  const target = filePath || currentFilePath;
  if (!target) return { error: "No file" };

  try {
    const markdown = await SyncEngine.pull(target);
    return { ok: true, markdown };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("sync-pull-cloud", async (event, docId, title) => {
  try {
    const savedPath = await SyncEngine.pullCloudDocument(docId, title);
    if (savedPath) {
      openFileInApp(savedPath);
      return { ok: true, filePath: savedPath };
    }
    return { error: "Cancelled" };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("sync-unlink", async (event, filePath) => {
  const target = filePath || currentFilePath;
  const config = loadMdfyConfig(target);
  if (config && config.docId) {
    try {
      const headers = await AuthManager.getHeadersWithRefresh();
      await net.fetch(`${MDFY_URL}/api/docs/${config.docId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action: "clear-source", userId: AuthManager.getUserId() }),
      });
    } catch {}
  }
  deleteMdfyConfig(target);
  return { ok: true };
});

ipcMain.handle("sync-delete", async (event, filePath) => {
  const target = filePath || currentFilePath;
  const config = loadMdfyConfig(target);
  if (!config) return { error: "Not published" };

  try {
    await apiDeleteDocument(config.docId, config.editToken);
    deleteMdfyConfig(target);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("delete-cloud-doc", async (event, docId) => {
  try {
    await apiDeleteDocument(docId, null);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("duplicate-cloud", async (event, docId, title) => {
  try {
    const data = await apiPull(docId);
    const markdown = data.markdown || data.content || "";
    const newTitle = (title || "Untitled") + " (Copy)";
    const result = await apiPublish(markdown, newTitle);
    // Open the duplicate in the editor
    const rendered = renderMarkdown(markdown);
    currentFilePath = null;
    stopFileWatcher();
    mainWindow.setTitle(newTitle + ": memory.wiki");
    mainWindow.webContents.send("load-document", {
      html: rendered.html,
      markdown,
      filePath: null,
      flavor: rendered.flavor.primary,
      config: { docId: result.id, editToken: result.editToken },
      cloudDoc: { docId: result.id, title: newTitle, isOwner: true },
      readOnly: false,
      viewCount: 0,
    });
    return { ok: true, docId: result.id };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("move-to-folder", async (event, docId, folderId) => {
  try {
    const headers = AuthManager.getHeaders();
    const res = await net.fetch(`${MDFY_URL}/api/docs/${docId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "move", folderId: folderId || null }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("resolve-conflict", async (event, action, filePath) => {
  const target = filePath || currentFilePath;
  if (!target) return;
  if (action === "push") {
    const markdown = fs.readFileSync(target, "utf8");
    const config = loadMdfyConfig(target);
    if (config) {
      const title = extractTitle(markdown) || path.basename(target, ".md");
      // Force push: no expectedUpdatedAt — overwrite server
      const result = await apiUpdate(config.docId, config.editToken, markdown, title);
      config.lastSyncedAt = new Date().toISOString();
      config.lastServerUpdatedAt = result.updated_at;
      saveMdfyConfig(target, config);
      sendToRenderer("sync-status", { filePath: target, status: "synced" });
    }
  } else if (action === "pull") {
    await SyncEngine.pull(target);
  }
});

// Get server version for diff view
ipcMain.handle("get-server-version", async (event, filePath) => {
  const target = filePath || currentFilePath;
  if (!target) return { error: "No file" };
  const config = loadMdfyConfig(target);
  if (!config) return { error: "Not published" };
  try {
    const remote = await apiPull(config.docId);
    const local = fs.readFileSync(target, "utf8");
    return { serverMarkdown: remote.markdown || remote.content || "", localMarkdown: local, serverUpdatedAt: remote.updated_at };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("preview-cloud-doc", async (event, docId, title) => {
  try {
    const data = await apiPull(docId);
    const markdown = data.markdown || data.content || "";
    const result = renderMarkdown(markdown);
    currentFilePath = null;
    stopFileWatcher();

    // Check ownership — if user owns it, allow editing
    const userId = AuthManager.getUserId();
    const isOwner = !!(userId && data.user_id && data.user_id === userId);
    const editToken = data.editToken || null;

    mainWindow.setTitle((title || docId) + (isOwner ? "" : " (Cloud)") + ": memory.wiki");
    mainWindow.webContents.send("load-document", {
      html: result.html,
      markdown,
      filePath: null,
      flavor: result.flavor.primary,
      config: isOwner && editToken ? { docId, editToken } : null,
      cloudDoc: { docId, title: title || docId, isOwner },
      readOnly: !isOwner,
      viewCount: data.view_count || 0,
    });
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("get-cloud-documents", async () => {
  return apiGetCloudDocuments();
});

ipcMain.handle("search-docs", async (event, query) => {
  if (!net.isOnline()) return { results: [] };
  if (!AuthManager.isLoggedIn()) return { results: [] };
  try {
    const resp = await net.fetch(`${MDFY_URL}/api/search?q=${encodeURIComponent(query)}`, {
      headers: AuthManager.getHeaders(),
    });
    if (!resp.ok) return { results: [] };
    return await resp.json();
  } catch { return { results: [] }; }
});

ipcMain.handle("get-cloud-folders", async () => {
  if (!net.isOnline()) return [];
  const userId = AuthManager.getUserId();
  if (!userId) return [];
  try {
    const headers = AuthManager.getHeaders();
    const resp = await net.fetch(`${MDFY_URL}/api/user/folders`, { headers });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.folders || [];
  } catch { return []; }
});

// --- AI Tools ---

ipcMain.handle("ai-action", async (event, action, markdown, extra) => {
  if (!markdown || !markdown.trim()) return { error: "No content" };
  if (!net.isOnline()) return { error: "Offline" };
  if (!AuthManager.isLoggedIn()) return { error: "Sign in to use AI features" };

  try {
    const body = { action, markdown };
    // v2.7.0 — extra now also covers the new selection_* actions
    // routed from the floating selection toolbar (mountSelectionToolbar
    // in @mdcore/editor). chat + selection_rewrite both carry a free-
    // form instruction; translate + selection_translate carry a target
    // language. polish/shorten/expand/summary/tldr take no extra.
    if ((action === "chat" || action === "selection_rewrite") && extra) {
      body.instruction = extra;
    } else if ((action === "translate" || action === "selection_translate") && extra) {
      body.language = extra;
    }

    const resp = await net.fetch(`${MDFY_URL}/api/ai`, {
      method: "POST",
      headers: AuthManager.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return { error: errData.error || `AI request failed: ${resp.status}` };
    }
    const data = await resp.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
});

// --- Image Gallery ---

ipcMain.handle("get-images", async () => {
  if (!net.isOnline()) return { error: "Offline" };
  const userId = AuthManager.getUserId();
  if (!userId) return { error: "Not logged in" };
  try {
    const headers = AuthManager.getHeaders();
    const resp = await net.fetch(`${MDFY_URL}/api/upload/list`, { headers });
    if (!resp.ok) return { error: `Failed: ${resp.status}` };
    const data = await resp.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
});

// --- Misc ---

ipcMain.handle("upload-image", async (event, base64Data, mimeType, fileName) => {
  if (!net.isOnline()) return { error: "Offline" };
  try {
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > 10 * 1024 * 1024) return { error: "File too large (max 10MB)" };
    const boundary = "----memorywikiUpload" + Date.now();
    const safeFileName = fileName.replace(/["\r\n\\]/g, "_");
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeFileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const headers = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    };
    const userId = AuthManager.getUserId();
    if (userId) headers["x-user-id"] = userId;
    const token = AuthManager.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const resp = await net.fetch(`${MDFY_URL}/api/upload`, {
      method: "POST",
      headers,
      body,
    });
    if (!resp.ok) return { error: `Upload failed: ${resp.status}` };
    const result = await resp.json();
    if (!result || !result.url) return { error: "Upload succeeded but no URL returned" };
    return { url: result.url };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("get-version", () => app.getVersion());

ipcMain.handle("reveal-in-finder", (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle("open-in-browser", (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle("open-quicklook-settings", () => {
  shell.openExternal("x-apple.systempreferences:com.apple.ExtensionsPreferences");
  // Mark as installed after user opens settings
  const marker = path.join(USER_DATA_DIR, ".quicklook-installed");
  fs.writeFileSync(marker, new Date().toISOString());
});

// Source-of-truth bundle id for the QL extension. Used by both the
// status check and the repair handler. Mirrors the value Xcode
// stamps into the .appex Info.plist at build time.
const QL_EXT_BUNDLE_ID = "wiki.memory.quicklook.qlextension";

// Real registration check — asks macOS, not the filesystem. The old
// version returned true whenever the .appex / host bundle EXISTED on
// disk, which is independent of whether LaunchServices ever indexed
// or pluginkit registered the extension. Users routinely saw a
// false-positive "Active" badge while Space-in-Finder did nothing.
//
// pluginkit's output for a registered extension looks like:
//   "+    wiki.memory.quicklook.qlextension(1.0)"  ← enabled
//   "-    wiki.memory.quicklook.qlextension(1.0)"  ← disabled by user
//   "?    wiki.memory.quicklook.qlextension(1.0)"  ← awaiting decision
// Any of those lines means the system knows about the extension.
// Empty output = not registered, which is the failure we want to
// surface so the renderer can show a "Repair" CTA instead of lying.
function isQuickLookExtRegistered() {
  try {
    const { execSync } = require("child_process");
    const out = execSync(`pluginkit -m -i ${QL_EXT_BUNDLE_ID}`, { encoding: "utf8", timeout: 3000 }).trim();
    return out.length > 0;
  } catch {
    // pluginkit missing or errored — fall back to existence check so
    // we don't permanently misreport on weird systems.
    const embeddedAppex = path.join(path.dirname(app.getAppPath()), "..", "PlugIns", "MemoryWikiQLExtension.appex");
    const userAppsBundle = path.join(app.getPath("home"), "Applications", "memory.wiki QuickLook.app");
    return fs.existsSync(embeddedAppex) || fs.existsSync(userAppsBundle);
  }
}

ipcMain.handle("is-quicklook-installed", () => {
  return isQuickLookExtRegistered();
});

// Force LaunchServices to re-scan the QL host bundle so pluginkit
// re-registers the .appex inside it. Three things this needs to
// handle for the install to actually work, learned the hard way:
//   1. Strip quarantine xattr — files cp'd out of a freshly-mounted
//      DMG inherit the quarantine flag, which causes lsregister to
//      reject with -10811 / -10814 ("failed to scan ... from
//      spotlight"). xattr -cr is idempotent.
//   2. Unregister any STALE path that LaunchServices still has for
//      our bundle id (Xcode derived-data builds during development,
//      or older app versions that lived elsewhere). Without this,
//      pluginkit may "win" with the stale path even when our
//      current bundle is also registered.
//   3. lsregister -f against the host bundle (LaunchServices then
//      indexes the nested .appex automatically).
function refreshQuickLookRegistration() {
  const { execSync } = require("child_process");
  const lsregister = "/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister";
  const candidates = [
    path.join(app.getPath("home"), "Applications", "memory.wiki QuickLook.app"),
    path.join(path.dirname(app.getAppPath()), ".."),
  ];

  // Step 1: strip quarantine.
  for (const target of candidates) {
    if (!fs.existsSync(target)) continue;
    try {
      execSync(`/usr/bin/xattr -cr "${target}"`, { timeout: 3000 });
    } catch { /* xattr might fail on read-only locations — non-fatal */ }
  }

  // Step 2: unregister any path pointing somewhere our bundles
  // aren't. Iterates pluginkit's view of our bundle id and prunes
  // anything that doesn't match an installed bundle below.
  const validPaths = candidates.filter(fs.existsSync).map((p) => path.resolve(p));
  try {
    const list = execSync(`/usr/sbin/pluginkit -mvvv -i wiki.memory.quicklook.qlextension 2>&1 || true`, { timeout: 3000 }).toString();
    const matches = list.match(/Path = ([^\n]+)/g) || [];
    for (const m of matches) {
      const p = m.replace(/^Path = /, "").trim();
      // The registered path is the .appex inside the host bundle.
      // Resolve to the host bundle for comparison.
      const hostFromAppex = p.replace(/\/Contents\/PlugIns\/[^/]+\.appex$/, "");
      const stale = !validPaths.some((vp) => path.resolve(hostFromAppex) === vp);
      if (stale) {
        try { execSync(`"${lsregister}" -u "${p}"`, { timeout: 3000 }); } catch { /* best-effort */ }
      }
    }
  } catch { /* pluginkit not available — skip prune step */ }

  // Step 3: register current bundles.
  for (const target of candidates) {
    if (!fs.existsSync(target)) continue;
    try {
      execSync(`"${lsregister}" -f "${target}"`, { timeout: 5000 });
    } catch (err) {
      console.log("[quicklook] lsregister failed for", target, "—", err.message);
    }
  }
}

ipcMain.handle("repair-quicklook", () => {
  refreshQuickLookRegistration();
  // Give pluginkit a moment to re-index before reading status back.
  return new Promise((resolve) => setTimeout(() => resolve(isQuickLookExtRegistered()), 600));
});

ipcMain.handle("read-clipboard", () => {
  const { clipboard } = require("electron");
  return clipboard.readText() || "";
});

ipcMain.handle("write-clipboard", (event, text) => {
  const { clipboard } = require("electron");
  clipboard.writeText(text);
});

ipcMain.handle("write-clipboard-html", (event, html) => {
  const { clipboard } = require("electron");
  clipboard.write({ text: html, html: html });
});

ipcMain.handle("get-theme", () => {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
});

// --- Collaboration ---

ipcMain.handle("collab-start", (event, cloudId, markdown, isOwner) => {
  CollaborationManager.start(cloudId, markdown, isOwner);
  return { ok: true };
});

ipcMain.handle("collab-stop", () => {
  CollaborationManager.stop();
  return { ok: true };
});

ipcMain.handle("collab-local-change", (event, markdown) => {
  CollaborationManager.applyLocalChange(markdown);
  return { ok: true };
});

ipcMain.handle("collab-get-state", () => {
  return CollaborationManager.getState();
});

// ─── Menu ───

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{
      label: "memory.wiki",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "Delete Account…", click: () => promptDeleteAccount() },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    }] : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Document",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            if (!mainWindow) return;
            currentFilePath = null;
            stopFileWatcher();
            mainWindow.setTitle("Untitled: memory.wiki");
            mainWindow.webContents.send("load-document", {
              html: "<p><br></p>", markdown: "", filePath: null, flavor: "gfm", config: null,
            });
          },
        },
        {
          label: "Open File...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openFile"],
              filters: FILE_FILTERS,
            });
            if (!result.canceled && result.filePaths[0]) openFileInApp(result.filePaths[0]);
          },
        },
        {
          label: "Open Folder...",
          accelerator: "CmdOrCtrl+Shift+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openDirectory"],
            });
            if (!result.canceled && result.filePaths[0]) {
              currentWorkspaceFolder = result.filePaths[0];
              saveWorkspace({ folder: currentWorkspaceFolder });
              startFolderWatcher(currentWorkspaceFolder);
              sendToRenderer("workspace-changed");
            }
          },
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("trigger-save");
            }
          },
        },
        { type: "separator" },
        {
          label: "Publish to memory.wiki",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => {
            if (mainWindow) mainWindow.webContents.send("trigger-publish");
          },
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => { if (mainWindow) mainWindow.webContents.send("menu-undo"); },
        },
        {
          label: "Redo",
          accelerator: "Shift+CmdOrCtrl+Z",
          click: () => { if (mainWindow) mainWindow.webContents.send("menu-redo"); },
        },
        { type: "separator" },
        { role: "cut" }, { role: "copy" }, { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" }, { role: "zoom" },
        { type: "separator" },
        // Reopen the main window after it's been closed (Apple Guideline 4:
        // a closed window must be recoverable from the menu, not just Dock).
        { label: "memory.wiki", accelerator: "CmdOrCtrl+Shift+0", click: () => showMainWindow() },
        ...(isMac ? [{ type: "separator" }, { role: "front" }] : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "memory.wiki", click: () => shell.openExternal("https://memory.wiki") },
        { label: "About memory.wiki", click: () => shell.openExternal("https://memory.wiki/about") },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── QuickLook Extension Installer (legacy DMG fallback only) ───
// v2.5.0+: the QuickLook .appex is now embedded directly in
// Contents/PlugIns/ of the host app via scripts/afterPack.js, which
// is the App Store-required layout. macOS auto-discovers any .appex
// living there on first launch — no copy step needed.
//
// We keep this fallback for two cases only:
//   1. Legacy DMG builds (pre-2.5.0) where the .appex shipped at
//      Contents/Resources/memory.wiki QuickLook.app instead.
//   2. Hand-built local dev runs where the PlugIns embed didn't run.
// If the PlugIns location already exists we no-op so MAS builds stay
// sandbox-clean (writes to ~/Applications are blocked under App
// Sandbox anyway).

function installQuickLook() {
  // If the .appex is already inside our own bundle at the standard
  // PlugIns location, LaunchServices auto-registers it on first
  // launch. We still poke lsregister at the end though — users have
  // reported the embed not getting indexed reliably across upgrades.
  const embeddedAppex = path.join(
    path.dirname(app.getAppPath()),
    "..",
    "PlugIns",
    "MemoryWikiQLExtension.appex"
  );
  if (fs.existsSync(embeddedAppex)) {
    refreshQuickLookRegistration();
    return;
  }

  const marker = path.join(USER_DATA_DIR, `.quicklook-installed-${app.getVersion()}`);
  const qlSource = path.join(process.resourcesPath, "memory.wiki QuickLook.app");
  if (!fs.existsSync(qlSource)) {
    // No bundle to install. Still try a registration refresh against
    // whatever sidecar might already exist — covers the case where
    // an older build copied the bundle but the current build skipped
    // packaging it.
    refreshQuickLookRegistration();
    return;
  }

  const userApps = path.join(app.getPath("home"), "Applications");
  const qlDest = path.join(userApps, "memory.wiki QuickLook.app");
  const needsCopy = !fs.existsSync(marker) || !fs.existsSync(qlDest);

  try {
    if (needsCopy) {
      if (!fs.existsSync(userApps)) fs.mkdirSync(userApps, { recursive: true });
      if (fs.existsSync(qlDest)) {
        const { execSync } = require("child_process");
        execSync(`rm -rf "${qlDest}"`);
      }
      const { execSync } = require("child_process");
      execSync(`cp -R "${qlSource}" "${qlDest}"`);
      fs.writeFileSync(marker, new Date().toISOString());
      console.log("[quicklook] Legacy install/refresh to ~/Applications/");
    }
    // CRITICAL: copying the bundle is NOT enough — without lsregister
    // macOS often doesn't index the .appex, so pluginkit shows
    // nothing and Space-in-Finder is silent. Run it on every launch
    // (idempotent, ~50-200ms) to guarantee the extension is known to
    // the system. This was the root cause of the "ACTIVE badge says
    // on but QL doesn't work" bug.
    refreshQuickLookRegistration();
  } catch (err) {
    console.log("[quicklook] Install failed (non-critical):", err.message);
  }
}

// ─── App Events ───

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (mainWindow) openFileInApp(filePath);
  else app._queuedFile = filePath;
});

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: "memory.wiki",
    applicationVersion: app.getVersion(),
    version: `Electron ${process.versions.electron}`,
    copyright: "Copyright 2024-2026 memory.wiki",
    website: "https://memory.wiki",
    iconPath: path.join(__dirname, "assets", "icon.png"),
  });

  buildMenu();
  createWindow();

  // Restore workspace
  const ws = loadWorkspace();
  if (ws && ws.folder && fs.existsSync(ws.folder)) {
    currentWorkspaceFolder = ws.folder;
    startFolderWatcher(currentWorkspaceFolder);
  }

  // Determine the file to open on startup (priority: queued > argv > recent)
  let startupFile = null;
  if (app._queuedFile) {
    startupFile = app._queuedFile;
    app._queuedFile = null;
  }
  if (!startupFile) {
    startupFile = process.argv.find((a) => {
      const ext = path.extname(a).toLowerCase();
      return ALL_SUPPORTED_EXTENSIONS.has(ext);
    }) || null;
  }

  // Restore workspace + open file after renderer loads
  mainWindow.webContents.once("did-finish-load", () => {
    if (currentWorkspaceFolder) {
      sendToRenderer("workspace-changed");
    }
    // Only open a file if explicitly requested (double-click, argv, URL scheme)
    // Otherwise show welcome screen
    if (startupFile && fs.existsSync(startupFile)) {
      setTimeout(() => openFileInApp(startupFile), 300);
    }
  });

  // Start sync engine
  SyncEngine.start();

  // Install QuickLook extension on first run
  installQuickLook();

  // Handle theme changes
  nativeTheme.on("updated", () => {
    sendToRenderer("theme-changed", nativeTheme.shouldUseDarkColors ? "dark" : "light");
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopFileWatcher();
  stopFolderWatcher();
  SyncEngine.stop();
  CollaborationManager.stop();
  if (process.platform !== "darwin") app.quit();
});
