import * as vscode from "vscode";
import * as path from "path";
import { loadMdfyConfig, saveMdfyConfig, getApiBaseUrl, MdfyConfig, suppressAutoPreviewFor } from "./extension";
import { PreviewPanel } from "./preview";
import { AuthManager } from "./auth";
import { pullDocument, publishDocument } from "./publish";

interface DocItem {
  filePath: string;
  fileName: string;
  relativePath: string;
  config: MdfyConfig | undefined;
  isOpen: boolean;
}

interface CloudDoc {
  id: string;
  title: string | null;
  updated_at: string;
  is_draft: boolean;
  folder_id?: string | null;
  view_count?: number;
  edit_mode?: string | null;
  allowed_emails?: string[] | null;
  source?: string | null;
}

interface CloudFolder {
  id: string;
  name: string;
  section?: string;
  collapsed?: boolean;
}

export class MdfySidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mwDocuments";
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private _authManager: AuthManager;
  private _refreshInterval?: ReturnType<typeof setInterval>;

  constructor(extensionUri: vscode.Uri, authManager: AuthManager) {
    this._extensionUri = extensionUri;
    this._authManager = authManager;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready":
          await this.sendDocuments();
          break;
        case "refresh":
          this._view?.webview.postMessage({ type: "refreshing", state: true });
          await this.sendDocuments();
          this._view?.webview.postMessage({ type: "refreshing", state: false });
          break;
        case "openFile":
          this.openFile(msg.filePath);
          break;
        case "publish":
          this.publishFile(msg.filePath);
          break;
        case "copyUrl":
          if (msg.url) {
            await vscode.env.clipboard.writeText(msg.url);
            vscode.window.showInformationMessage(`URL copied: ${msg.url}`);
          }
          break;
        case "openBrowser":
          if (msg.url) {
            vscode.env.openExternal(vscode.Uri.parse(msg.url));
          }
          break;
        case "pullCloud":
          if (msg.docId && msg.title) {
            await this.pullCloudDocument(msg.docId, msg.title);
          }
          break;
        case "unsync":
          if (msg.filePath) {
            await this.unsyncDocument(msg.filePath);
          }
          break;
        case "deleteSynced":
          if (msg.filePath) {
            await this.deleteSyncedDocument(msg.filePath);
          }
          break;
        case "duplicateCloud":
          if (msg.docId) {
            await this.duplicateCloudDocument(msg.docId, msg.title);
          }
          break;
        case "deleteCloud":
          if (msg.docId) {
            await this.deleteCloudDocument(msg.docId);
          }
          break;
        case "previewCloud":
          if (msg.docId) {
            await this.previewCloudDocument(msg.docId, msg.title);
          }
          break;
        case "searchDocs":
          if (msg.query) {
            await this.searchDocuments(msg.query);
          }
          break;
        case "insert-image": {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            const pos = editor.selection.active;
            editor.edit(b => b.insert(pos, `\n![${msg.name}](${msg.url})\n`));
          } else {
            vscode.window.showWarningMessage("Open a document to insert the image.");
          }
          break;
        }
        case "login":
          // Tell the webview the OAuth round-trip is in-flight so
          // the bottom signin-btn renders as disabled "Signing in…"
          // instead of a clickable green-light. Cleared regardless
          // of outcome (success → refresh re-renders the whole user
          // bar; failure → finally branch flips the flag back).
          this._view?.webview.postMessage({ type: "auth-pending", state: true });
          try {
            await vscode.commands.executeCommand("memorywiki.login");
          } finally {
            this._view?.webview.postMessage({ type: "auth-pending", state: false });
          }
          break;
        case "logout":
          await this._authManager.logout();
          this.refresh();
          vscode.window.showInformationMessage("Signed out from memory.wiki.");
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.sendDocuments();
      }
      // Periodic poll removed (see _stopPeriodicRefresh comment) —
      // visibility flip just triggers a single refresh, no timer.
    });

    // Periodic auto-refresh removed (founder report 2026-06-01:
    // "왜 자꾸 사이드바에서 자동으로 리프레쉬를 하지?"). Sidebar
    // already refreshes on workspace file events + on explicit
    // user action (refresh button, login, sidebar reveal). The
    // 15-second timer added noise + made the loading skeleton
    // flash repeatedly. Pull-not-push for cloud staleness.
    webviewView.onDidDispose(() => {
      this._stopPeriodicRefresh();
    });
  }

  private _stopPeriodicRefresh(): void {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = undefined;
    }
  }

  refresh(): void {
    this.sendDocuments();
  }

  private async openFile(filePath: string): Promise<void> {
    suppressAutoPreviewFor(500);
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    // Show memory.wiki preview only — don't open native editor separately
    PreviewPanel.createOrShow(this._extensionUri, doc);
  }

  private async publishFile(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    vscode.commands.executeCommand("memorywiki.publish");
  }

  private async unsyncDocument(filePath: string): Promise<void> {
    const fileName = path.basename(filePath);
    const confirm = await vscode.window.showWarningMessage(
      `Unsync "${fileName}" from memory.wiki? The local file stays, only the sync connection is removed.`,
      "Unsync",
      "Cancel"
    );
    if (confirm !== "Unsync") { return; }

    // Read config to get docId before deleting
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const configPath = path.join(path.dirname(filePath), `.${base}.memorywiki.json`);
    try {
      // Clear source on server so memory.wiki no longer shows it as synced
      const configBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(configPath));
      const config = JSON.parse(Buffer.from(configBytes).toString("utf-8"));
      if (config.docId && this._authManager) {
        const token = await this._authManager.getToken();
        const baseUrl = (await import("./extension")).getApiBaseUrl();
        fetch(`${baseUrl}/api/docs/${config.docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ action: "clear-source", userId: config.userId }),
        }).catch(() => {}); // fire-and-forget
      }
      await vscode.workspace.fs.delete(vscode.Uri.file(configPath));
      this.refresh();
      vscode.window.showInformationMessage(
        `"${fileName}" unsynced. The document remains on memory.wiki but is no longer linked to this file.`
      );
    } catch {
      vscode.window.showErrorMessage("Failed to remove sync file.");
    }
  }

  private async deleteSyncedDocument(filePath: string): Promise<void> {
    const fileName = path.basename(filePath);
    const confirm = await vscode.window.showWarningMessage(
      `Delete "${fileName}" from memory.wiki? The local file stays, but the cloud copy will be removed.`,
      "Delete from Cloud",
      "Cancel"
    );
    if (confirm !== "Delete from Cloud") return;

    const config = await loadMdfyConfig(filePath);
    if (config) {
      // Soft-delete on server
      try {
        const baseUrl = getApiBaseUrl();
        const token = await this._authManager.getToken();
        const userId = await this._authManager.getUserId();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        await fetch(`${baseUrl}/api/docs/${config.docId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "soft-delete", userId, editToken: config.editToken }),
        });
      } catch { /* silent */ }
      // Remove sidecar
      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);
      const configPath = path.join(path.dirname(filePath), `.${base}.memorywiki.json`);
      try { await vscode.workspace.fs.delete(vscode.Uri.file(configPath)); } catch {}
    }
    this.refresh();
    vscode.window.showInformationMessage(`"${fileName}" removed from memory.wiki.`);
  }

  private async deleteCloudDocument(docId: string): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Move this document to trash on memory.wiki? You can restore it later.`,
      "Delete",
      "Cancel"
    );
    if (confirm !== "Delete") return;

    try {
      const baseUrl = getApiBaseUrl();
      const token = await this._authManager.getToken();
      const userId = await this._authManager.getUserId();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${baseUrl}/api/docs/${docId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action: "soft-delete", userId }),
      });
      this.refresh();
      vscode.window.showInformationMessage("Document removed from memory.wiki.");
    } catch {
      vscode.window.showErrorMessage("Failed to delete document.");
    }
  }

  private async duplicateCloudDocument(docId: string, title: string): Promise<void> {
    try {
      const remote = await pullDocument(docId, this._authManager);
      const newTitle = `${title || "Untitled"} (Copy)`;
      const result = await publishDocument(remote.markdown, newTitle, this._authManager);
      this.refresh();
      vscode.window.showInformationMessage(`Duplicated as "${newTitle}"`);
      // Open the new copy in preview
      PreviewPanel.createOrShowCloud(this._extensionUri, remote.markdown, newTitle, result.id);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to duplicate: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async previewCloudDocument(docId: string, title: string): Promise<void> {
    try {
      const remote = await pullDocument(docId, this._authManager);
      suppressAutoPreviewFor(500);
      // Open read-only cloud preview directly with markdown string (no TextDocument needed)
      PreviewPanel.createOrShowCloud(this._extensionUri, remote.markdown, title || "Cloud Document", docId);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to load: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async pullCloudDocument(docId: string, title: string): Promise<void> {
    try {
      const remote = await pullDocument(docId, this._authManager);

      // Determine save location
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showWarningMessage("Open a workspace folder first.");
        return;
      }

      const safeName = (title || docId).replace(/[^a-zA-Z0-9가-힣_\-. ]/g, "").trim() || docId;
      const defaultUri = vscode.Uri.joinPath(workspaceFolders[0].uri, `${safeName}.md`);

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { "Markdown": ["md"] },
      });
      if (!saveUri) { return; }

      // Write .md file
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(remote.markdown, "utf-8"));

      // Write .memorywiki.json sidecar
      await saveMdfyConfig(saveUri.fsPath, {
        docId,
        editToken: remote.editToken || "pulled",
        lastSyncedAt: new Date().toISOString(),
        lastServerUpdatedAt: remote.updated_at,
      });

      // Open in memory.wiki preview only (no native editor)
      suppressAutoPreviewFor(500);
      const doc = await vscode.workspace.openTextDocument(saveUri);
      PreviewPanel.createOrShow(this._extensionUri, doc);
      vscode.window.showInformationMessage(`Synced: ${safeName}.md`);

      this.refresh();
    } catch (err) {
      vscode.window.showErrorMessage(
        `Pull failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async searchDocuments(query: string): Promise<void> {
    if (!this._view) { return; }
    try {
      const baseUrl = getApiBaseUrl();
      const token = await this._authManager.getToken();
      const userId = await this._authManager.getUserId();
      if (!userId) {
        this._view.webview.postMessage({ type: "searchResults", results: [] });
        return;
      }
      const headers: Record<string, string> = { "x-user-id": userId };
      if (token) { headers["Authorization"] = `Bearer ${token}`; }
      const res = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(query)}`, { headers });
      if (!res.ok) {
        this._view.webview.postMessage({ type: "searchResults", results: [] });
        return;
      }
      const data = (await res.json()) as { results: Array<{ id: string; title: string; snippet: string; isDraft: boolean; updatedAt: string }> };
      this._view.webview.postMessage({ type: "searchResults", results: data.results || [] });
    } catch {
      this._view?.webview.postMessage({ type: "searchResults", results: [] });
    }
  }

  private async sendDocuments(): Promise<void> {
    if (!this._view) { return; }

    // Tell the webview a fetch is in flight so it can render a
    // loading skeleton instead of "no docs". Cleared in the same
    // postMessage below once data lands. Without this the sidebar
    // showed an empty list for the 1-3 seconds the cloud fetch +
    // pin fetch + folder fetch take after first login (founder
    // report: "처음 로그인후 등 로딩스테이트가 없는듯").
    this._view.webview.postMessage({ type: "loading", state: true });

    const localDocs = await this.scanWorkspace();
    const baseUrl = getApiBaseUrl();

    const items = localDocs.map((d) => ({
      filePath: d.filePath,
      fileName: d.fileName,
      relativePath: d.relativePath,
      isOpen: d.isOpen,
      published: !!d.config,
      docId: d.config?.docId,
      url: d.config ? `${baseUrl}/${d.config.docId}` : undefined,
      lastSynced: d.config?.lastSyncedAt,
    }));

    // Fetch cloud documents + folders + images + pins if logged in
    const isLoggedIn = await this._authManager.isLoggedIn();
    let cloudDocs: CloudDoc[] = [];
    let cloudFolders: CloudFolder[] = [];
    let imageData: { images: Array<{ url: string; name: string }>; quota: { used: number; total: number } } | null = null;
    let pinnedDocIds: string[] = [];
    if (isLoggedIn) {
      cloudDocs = await this.fetchCloudDocuments();
      cloudFolders = await this.fetchCloudFolders();
      imageData = await this.fetchImages();
      pinnedDocIds = await this.fetchPinnedDocIds();
      // Exclude documents already linked locally
      const linkedIds = new Set(items.filter((i) => i.docId).map((i) => i.docId));
      cloudDocs = cloudDocs.filter((c) => !linkedIds.has(c.id));
    }

    const userEmail = await this._authManager.getEmail();

    this._view.webview.postMessage({
      type: "documents",
      items,
      cloudDocs: cloudDocs.map((c) => ({
        docId: c.id,
        title: c.title || c.id,
        updatedAt: c.updated_at,
        isDraft: c.is_draft,
        folderId: c.folder_id || null,
        url: `${baseUrl}/${c.id}`,
        viewCount: c.view_count || 0,
        editMode: c.edit_mode || null,
        allowedEmails: c.allowed_emails || null,
        source: c.source || null,
      })),
      cloudFolders: cloudFolders.map((f) => ({
        id: f.id,
        name: f.name,
        section: f.section || "my",
        collapsed: f.collapsed || false,
      })),
      imageData: imageData || null,
      pinnedDocIds,
      isLoggedIn,
      userEmail: userEmail || null,
    });
  }

  /**
   * Fetch the set of document IDs the user has starred (pinned) on
   * memory.wiki. Sidebar's STARRED filter pivots on this set.
   * Bundles can also be pinned but the sidebar doesn't surface
   * bundles yet, so we ignore those rows here.
   */
  private async fetchPinnedDocIds(): Promise<string[]> {
    try {
      const baseUrl = getApiBaseUrl();
      const userId = await this._authManager.getUserId();
      const token = await this._authManager.getToken();
      if (!userId) return [];
      const headers: Record<string, string> = { "x-user-id": userId };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}/api/user/pins`, { headers });
      if (!res.ok) return [];
      const data = (await res.json()) as { pins: Array<{ kind: string; id: string }> };
      return (data.pins || []).filter((p) => p.kind === "document").map((p) => p.id);
    } catch {
      return [];
    }
  }

  private async fetchCloudDocuments(): Promise<CloudDoc[]> {
    try {
      const baseUrl = getApiBaseUrl();
      const userId = await this._authManager.getUserId();
      const token = await this._authManager.getToken();
      if (!userId) { return []; }

      const headers: Record<string, string> = { "x-user-id": userId };
      if (token) { headers["Authorization"] = `Bearer ${token}`; }
      const email = await this._authManager.getEmail();
      if (email) { headers["x-user-email"] = email; }

      const res = await fetch(`${baseUrl}/api/user/documents`, { headers });
      if (!res.ok) { return []; }

      const data = (await res.json()) as { documents: CloudDoc[] };
      return data.documents || [];
    } catch {
      return [];
    }
  }

  private async fetchImages(): Promise<{ images: Array<{ url: string; name: string }>; quota: { used: number; total: number } } | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const token = await this._authManager.getToken();
      const userId = await this._authManager.getUserId();
      if (!userId) { return null; }

      const headers: Record<string, string> = { "x-user-id": userId };
      if (token) { headers["Authorization"] = `Bearer ${token}`; }

      const res = await fetch(`${baseUrl}/api/upload/list`, { headers });
      if (!res.ok) { return null; }

      return (await res.json()) as { images: Array<{ url: string; name: string }>; quota: { used: number; total: number } };
    } catch {
      return null;
    }
  }

  private async fetchCloudFolders(): Promise<CloudFolder[]> {
    try {
      const baseUrl = getApiBaseUrl();
      const token = await this._authManager.getToken();
      const userId = await this._authManager.getUserId();
      if (!userId) { return []; }

      const headers: Record<string, string> = { "x-user-id": userId };
      if (token) { headers["Authorization"] = `Bearer ${token}`; }

      const res = await fetch(`${baseUrl}/api/user/folders`, { headers });
      if (!res.ok) { return []; }

      const data = (await res.json()) as { folders: CloudFolder[] };
      return data.folders || [];
    } catch {
      return [];
    }
  }

  private async scanWorkspace(): Promise<DocItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) { return []; }

    const openPaths = new Set(
      vscode.workspace.textDocuments
        .filter((d) => d.languageId === "markdown")
        .map((d) => d.uri.fsPath)
    );

    const mdFiles = await vscode.workspace.findFiles(
      "**/*.md",
      "{**/node_modules/**,**/dist/**,**/.git/**,**/out/**,**/.vscode/**}"
    );

    const docs: DocItem[] = [];
    for (const uri of mdFiles) {
      const filePath = uri.fsPath;
      docs.push({
        filePath,
        fileName: path.basename(filePath),
        relativePath: vscode.workspace.asRelativePath(uri),
        config: await loadMdfyConfig(filePath),
        isOpen: openPaths.has(filePath),
      });
    }

    docs.sort((a, b) => {
      if (a.config && !b.config) { return -1; }
      if (!a.config && b.config) { return 1; }
      return a.fileName.localeCompare(b.fileName);
    });

    return docs;
  }

  private getHtml(webview: vscode.Webview): string {
    // Wire the generated design tokens into the sidebar webview so
    // CSS rules below can reference --micro-lime / --micro-info /
    // --accent / etc. and a single edit to design-tokens/ propagates
    // here without code-side changes. Both theme files load — only
    // the rule matching VS Code's current html[data-theme] applies,
    // but the webview itself inherits VS Code's theme via
    // vscode-foreground etc., so we keep both available for any
    // future explicit-theme dual swatches.
    const tokenDark = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "_tokens.dark.generated.css")
    );
    const tokenLight = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "_tokens.light.generated.css")
    );
    const accentCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "_accent.generated.css")
    );
    const blobUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "blob.svg")
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${tokenDark}">
<link rel="stylesheet" href="${tokenLight}">
<link rel="stylesheet" href="${accentCss}">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  overflow-x: hidden;
}

/* Sticky top area — doesn't scroll */
.sticky-top {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--vscode-sideBar-background);
}

/* Header */
.header {
  padding: 12px 14px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--vscode-foreground);
}
.logo-mark {
  width: 14px; height: 14px;
  flex-shrink: 0;
}
.header-actions { display: flex; gap: 4px; }
.icon-btn {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 4px;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-foreground);
}

/* Filters */
.filters {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 14px 8px;
}
.filter-group {
  display: flex;
  flex: 1;
  border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
  border-radius: 6px;
  overflow: hidden;
}
.filter-btn {
  flex: 1;
  padding: 4px 0;
  font-size: 10px; font-weight: 600;
  font-family: "SF Mono", "Fira Code", monospace;
  border: none;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.filter-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-foreground); }
.filter-btn.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.filter-btn.filter-icon { flex: 0 0 28px; padding: 4px 0; display: inline-flex; align-items: center; justify-content: center; }
.filter-btn.filter-icon svg { width: 12px; height: 12px; display: block; }

/* Search */
.search-box { margin: 0 14px 8px; position: relative; }
.search-box input {
  width: 100%; padding: 5px 8px 5px 26px;
  font-size: 11px;
  border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 4px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  outline: none;
}
.search-box input:focus { border-color: var(--vscode-focusBorder); }
.search-box svg {
  position: absolute; left: 8px; top: 50%;
  transform: translateY(-50%);
  color: var(--vscode-descriptionForeground);
}

/* Section */
.section-header {
  padding: 8px 14px 4px;
  font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--vscode-descriptionForeground);
  display: flex; align-items: center; gap: 6px;
}
.section-count { font-weight: 400; opacity: 0.7; }

/* Document list */
.doc-list { list-style: none; }
.doc-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 14px;
  cursor: pointer; transition: background 0.1s;
  position: relative;
}
.doc-item:hover { background: var(--vscode-list-hoverBackground); }
.doc-icon {
  flex-shrink: 0; width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
}
/* Row icon colours mirror the web canonical mapping
   (MdEditor.tsx L8484-8488). One colour per semantic state so
   the sidebar reads identical to memory.wiki's own sidebar.
     Public    → Globe (green #22c55e)  anyone with link
     Shared    → Users (blue  #60a5fa)  specific people / password
     Private   → Cloud (blue  #60a5fa)  cloud-only, owner-only
     View only → Eye   (purple #a78bfa) shared with you, read
     Local     → File   neutral          local-only, no cloud copy */
.doc-icon.public    { color: #22c55e; }
.doc-icon.shared,
.doc-icon.private,
.doc-icon.restricted { color: #60a5fa; }
.doc-icon.view-only,
.doc-icon.readonly  { color: #a78bfa; }
.doc-icon.local     { color: var(--vscode-descriptionForeground); }
.doc-icon { position: relative; }
/* Sync-badge mirrors web's overlay exactly — small ring with a
   green check inside (MdEditor.tsx L8492). Web spec: outer circle
   uses neutral surface tone so the check itself carries the
   colour. Previously had a solid lime fill, which read as "lime
   on every synced doc" instead of the subtle green check. */
.doc-icon .sync-badge { position: absolute; bottom: -2px; right: -3px; width: 9px; height: 9px; display: flex; align-items: center; justify-content: center; }
.doc-icon .sync-badge svg { width: 9px; height: 9px; }
.doc-info { flex: 1; min-width: 0; overflow: hidden; }
.doc-name {
  font-size: 12px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.doc-meta {
  font-size: 10px; color: var(--vscode-descriptionForeground);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.doc-actions { display: none; gap: 2px; flex-shrink: 0; }
.doc-item:hover .doc-actions { display: flex; }
.doc-action {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 4px;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
}
.doc-action:hover {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-foreground);
}

/* Tooltip — multi-line wrap for row state (`Public (anyone…)
   \n Synced from this editor \n Starred \n id…`). max-width
   keeps it from spanning the editor area when the sidebar is
   narrow. pre-line honours the `\n` separators that docStateText
   emits in place of middle-dots. */
.sb-tooltip {
  position: fixed;
  z-index: 9999;
  padding: 5px 9px;
  max-width: 240px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.45;
  color: var(--vscode-foreground);
  background: var(--vscode-editorWidget-background, #1e1e1e);
  border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.1));
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  pointer-events: none;
  white-space: pre-line;
  word-break: break-word;
  opacity: 0;
  transition: opacity 0.1s;
}
.sb-tooltip.show { opacity: 1; }

/* Login prompt — plain inline guidance, no card chrome. The sticky
   bottom Sign-in button is the action; this is just text telling
   the user what each empty section will hold once signed in. */
.login-prompt {
  padding: 6px 14px 10px;
  text-align: center;
}
.login-prompt p {
  font-size: 11px; color: var(--vscode-descriptionForeground);
  margin: 0;
}
.login-btn {
  padding: 4px 16px;
  font-size: 11px; font-weight: 600;
  border: none; border-radius: 4px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
}
.login-btn:hover { background: var(--vscode-button-hoverBackground); }

/* Empty */
.empty {
  text-align: center; padding: 24px 14px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}

/* Help panel */
.help-panel {
  margin: 0 14px 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.04));
  border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
  font-size: 11px;
}
.hidden { display: none !important; }
.help-panel.hidden { display: none; }
.help-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 4px 0;
}
.help-icon {
  flex-shrink: 0; width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  margin-top: 1px;
  color: var(--vscode-descriptionForeground);
}
.help-row strong {
  font-size: 11px; font-weight: 600;
  color: var(--vscode-foreground);
  display: block;
}
.help-desc {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  display: block; margin-top: 1px;
}
.help-divider {
  height: 1px; margin: 6px 0;
  background: var(--vscode-panel-border, rgba(255,255,255,0.08));
}
.help-btn { transition: color 0.15s; }
.help-btn.open { color: var(--vscode-foreground); }

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Brand blob loading state — vertically centred in the sidebar
   body region. The SMIL morph animation inside blob.svg carries
   the motion; we just fade-in the asset + the mono LOADING
   caption below (canonical BrandLoader pattern from brand wiki
   sec 12.2: blob + "LOADING" mono(10) Medium, tracking 1.4 sp,
   18 px gap). */
@keyframes blobFadeIn {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}
.blob-loading {
  /* Anchored to the sidebar viewport so the blob sits at the
     middle of the available body area regardless of how much
     content might land below. Top inset = header + filter strip
     (~108 px). Bottom inset = sticky user-bar (~50 px). */
  position: fixed;
  left: 0; right: 0;
  top: 108px;
  bottom: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  pointer-events: none;
  animation: blobFadeIn 0.32s ease-out both;
  z-index: 1;
}
.blob-loading img {
  display: block;
  opacity: 0.92;
}
.blob-loading-caption {
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 1.4px;
  color: var(--vscode-descriptionForeground);
}
.icon-btn.spinning svg { animation: spin 0.8s linear infinite; }

/* User bar — always visible at bottom */
.user-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 10px 14px;
  border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
  background: var(--vscode-sideBar-background);
  font-size: 11px;
  z-index: 5;
}

/* Logged out state */
.user-bar-loggedout {
  display: flex; flex-direction: column; gap: 8px; align-items: stretch;
}
.user-bar-loggedout .signin-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 7px 0;
  font-size: 12px; font-weight: 600;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none; border-radius: 6px;
  cursor: pointer; transition: background 0.12s;
}
.user-bar-loggedout .signin-btn:hover { background: var(--vscode-button-hoverBackground); }
.user-bar-loggedout .signin-hint {
  text-align: center; font-size: 10px;
  color: var(--vscode-descriptionForeground); opacity: 0.7;
}

/* Logged in state */
.cloud-folder { margin-bottom: 4px; }
.cloud-folder-header {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 12px; font-size: 11px; font-weight: 600;
  color: var(--fg-muted); user-select: none;
}
.cloud-folder-count { font-size: 9px; opacity: 0.5; margin-left: auto; }
.cloud-folder-list { padding-left: 8px; }

/* Local folder grouping */
.local-folder { margin-bottom: 4px; }
.local-folder-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; font-size: 12px; font-weight: 600;
  color: var(--vscode-descriptionForeground);
  cursor: pointer; user-select: none;
  transition: color 0.12s, background 0.12s;
  border-radius: 4px;
  margin: 0 6px;
}
.local-folder-header:hover { color: var(--vscode-foreground); background: var(--vscode-list-hoverBackground); }
.local-folder-chevron {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; flex-shrink: 0;
  transition: transform 0.15s ease;
  transform: rotate(90deg);
}
.local-folder-chevron.collapsed { transform: rotate(0deg); }
.local-folder-count { font-size: 10px; opacity: 0.5; margin-left: auto; }
.local-folder-list { margin-left: 20px; border-left: 1px solid var(--vscode-panel-border); }
.local-folder-list .doc-item { padding-left: 16px; }
.local-folder-list.collapsed { display: none; }

/* Auth prompt for images */
.auth-prompt {
  margin: 8px 14px;
  padding: 14px 12px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--micro-ai) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--micro-ai) 20%, transparent);
  text-align: center;
}
.auth-prompt p {
  font-size: 11px; color: var(--vscode-descriptionForeground);
  margin-bottom: 8px;
}
.auth-prompt-btn {
  padding: 5px 16px;
  font-size: 11px; font-weight: 600;
  border: none; border-radius: 4px;
  background: var(--micro-ai); color: #000;
  cursor: pointer;
  transition: background 0.12s;
}
.auth-prompt-btn:hover { background: #8b5cf6; }
.user-bar-loggedin {
  display: flex; align-items: center; gap: 8px;
}
.user-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--vscode-badge-background, rgba(255,255,255,0.12));
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  color: var(--vscode-badge-foreground, var(--vscode-foreground));
  font-size: 11px; font-weight: 700;
}
.user-details {
  flex: 1; min-width: 0; overflow: hidden;
}
.user-name {
  font-size: 11px; font-weight: 600;
  color: var(--vscode-foreground);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.user-status {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; color: var(--vscode-descriptionForeground);
}
.user-status-dot {
  width: 5px; height: 5px; border-radius: 50%; background: var(--micro-lime);
}
.user-logout-btn {
  padding: 3px 8px;
  font-size: 10px; font-weight: 600;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
  border-radius: 4px;
  cursor: pointer; transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
}
.user-logout-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-foreground);
}
</style>
</head>
<body>
  <div class="sticky-top">
  <div class="header">
    <a class="logo" href="https://memory.wiki" target="_blank" style="text-decoration:none;cursor:pointer"><svg class="logo-mark" viewBox="3 2 26 28" fill="currentColor" aria-hidden="true"><path d="M26.77,16.03c-.99,0-1.8.81-1.8,1.8s.81,1.8,1.8,1.8,1.8-.81,1.8-1.8-.81-1.8-1.8-1.8Z"/><circle cx="16.4" cy="5.27" r="2.82"/><path d="M7.35,22.79c-.88.34-1.12,1.33-.77,2.05.35.7,1.15.99,1.92.7.79-.3,1.08-1.09.77-1.94-.25-.68-1.08-1.15-1.92-.82h0Z"/><path d="M24.02,14.59c1.59-1.32,1.55-3.61.3-5.03-1.24-1.39-3.5-1.59-4.97-.21-1.39,1.32-3.59,1.84-5.23.5-.81-.66-1.67-1.25-2.83-.9-.9.26-1.67.98-2.01,2.02-.28.85-1.25,1.14-2.09,1.15-1.34.02-2.5.88-3.1,1.83-.77,1.22-.88,2.58-.35,3.85.7,1.68,2.35,2.71,4.19,2.43,1.19-.18,2.47.1,3.2,1.22.51.78.71,1.9.42,2.74-.45,1.33-.46,2.72.43,3.83,1.02,1.28,2.6,1.81,4.2,1.36,1.41-.39,2.28-1.59,2.73-3.09.32-1.06,1.65-1.47,2.63-1.52,1.23-.06,2.1-1.06,2.41-2,.44-1.28-.18-2.29-.92-3.19-1.36-1.65-.48-3.81.97-5.01h0l.02.02ZM19.6,19.68c-.67.41-1.3-.54-2.44-.97-.37,1.14.3,2.21-.3,2.58-.3.19-.77.2-1.01.02-.61-.46.15-1.48-.28-2.61-1.24.45-1.97,1.69-2.63.75-.28-.4-.21-.94.3-1.15.61-.25,1.08-.48,1.75-.88l-1.85-1.1c-.31-.19-.34-.62-.21-.89.17-.35.64-.55.98-.33l1.68,1.12c.35-.99-.23-2.1.25-2.53.19-.17.67-.2.97-.08.65.26.06,1.51.32,2.59l1.61-1.07c.34-.23.79-.09,1.01.21.25.34.22.83-.23,1.04-.61.28-1.1.55-1.73,1,.89.74,2.11.8,2.17,1.51.03.27-.18.66-.39.79h.03Z"/></svg>memory.wiki</a>
    <div class="header-actions">
      <button class="icon-btn" id="btn-toggle-folders" title="Expand all folders">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4,6 8,2 12,6"/><polyline points="4,10 8,14 12,10"/></svg>
      </button>
      <button class="icon-btn" id="btn-search-toggle" title="Search">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>
      </button>
      <button class="icon-btn help-btn" id="btn-help" title="Help">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M6.2 6.2a2 2 0 013.6.8c0 1.2-1.8 1.2-1.8 2.4"/><circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none"/></svg>
      </button>
      <button class="icon-btn" id="btn-refresh" title="Refresh">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8A6 6 0 004.8 3.3L2 6"/><path d="M2 2v4h4"/><path d="M2 8a6 6 0 009.2 4.7L14 10"/><path d="M14 14v-4h-4"/></svg>
      </button>
    </div>
  </div>

  <div class="filters">
    <div class="filter-group">
      <button class="filter-btn active" data-filter="all" title="Show all documents">ALL</button>
      <button class="filter-btn filter-icon" data-filter="starred" title="Starred (pinned on memory.wiki)" aria-label="Starred"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1l2.09 4.26L15 6l-3.5 3.41.83 4.84L8 12l-4.33 2.25.83-4.84L1 6l4.91-.74L8 1z"/></svg></button>
      <button class="filter-btn" data-filter="synced" title="Local files linked to memory.wiki">SYNCED</button>
      <button class="filter-btn" data-filter="local" title="Local files not yet published">LOCAL</button>
      <button class="filter-btn" data-filter="cloud" title="Cloud documents not synced locally">CLOUD</button>
    </div>
  </div>

  <div class="search-box hidden" id="search-box">
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>
    <input type="text" id="search" placeholder="Search documents..." />
  </div>
  </div>

  <div class="help-panel hidden" id="help-panel">
    <div class="help-row"><span class="help-icon" ><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg></span><div><strong>Synced</strong><span class="help-desc">Local file linked to memory.wiki. Edits can be pushed/pulled.</span></div></div>
    <div class="help-row"><span class="help-icon"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/></svg></span><div><strong>Local</strong><span class="help-desc">Only on your machine. Sync to upload to memory.wiki.</span></div></div>
    <div class="help-row"><span class="help-icon" ><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13h7.1a3.2 3.2 0 00.6-6.35 4.5 4.5 0 00-8.7 1.1A2.8 2.8 0 004.5 13z"/></svg></span><div><strong>Cloud</strong><span class="help-desc">Only on memory.wiki. Sync to download a local copy.</span></div></div>
    <div class="help-divider"></div>
    <div class="help-row"><span class="help-icon"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M6 10H4.5A1.5 1.5 0 013 8.5v-5A1.5 1.5 0 014.5 2h5A1.5 1.5 0 0111 3.5V6"/></svg></span><div><strong>Copy URL</strong><span class="help-desc">Copy the memory.wiki link to clipboard.</span></div></div>
    <div class="help-row"><span class="help-icon"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11v2.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V11"/><path d="M8 10V2"/><path d="M5 4.5L8 1.5l3 3"/></svg></span><div><strong>Sync Up</strong><span class="help-desc">Upload local file to memory.wiki and get a shareable URL.</span></div></div>
    <div class="help-row"><span class="help-icon"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11v2.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V11"/><path d="M8 2v8"/><path d="M5 7.5L8 10.5l3-3"/></svg></span><div><strong>Sync Down</strong><span class="help-desc">Download cloud document to your local workspace.</span></div></div>
    <div class="help-row"><span class="help-icon"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8A6 6 0 004.8 3.3L2 6"/><path d="M2 8a6 6 0 009.2 4.7L14 10"/><path d="M4 4l8 8"/></svg></span><div><strong>Unsync</strong><span class="help-desc">Remove sync connection. File stays local, moves back to Local.</span></div></div>
    <div class="help-divider"></div>
    <div style="font-size:10px;color:var(--fg-muted);line-height:1.6">
      <a href="https://memory.wiki" style="color:var(--accent);text-decoration:none">memory.wiki</a>: Web editor and sharing<br>
      <a href="https://chrome.google.com/webstore" style="color:var(--fg-muted);text-decoration:none">Chrome Extension</a>: Capture from ChatGPT/Claude
    </div>
  </div>

  <div id="doc-container" style="padding-bottom: 70px;"></div>

  <div class="user-bar" id="user-bar">
    <div class="user-bar-loggedout" id="user-loggedout">
      <button class="signin-btn" id="signin-btn" title="Sign in to sync and access cloud documents">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5"/></svg>
        Sign in to memory.wiki
      </button>
      <div class="signin-hint">Sync, publish, and access cloud documents</div>
    </div>
    <div class="user-bar-loggedin hidden" id="user-loggedin">
      <div class="user-avatar" id="user-avatar"></div>
      <div class="user-details">
        <div class="user-name" id="user-name"></div>
        <div class="user-status"><span class="user-status-dot"></span> Connected</div>
      </div>
      <button class="user-logout-btn" id="logout-btn" title="Sign out">Sign out</button>
    </div>
  </div>

  <script>
    var vscode = acquireVsCodeApi();
    var BLOB_URI = ${JSON.stringify(blobUri.toString())};
    var allDocs = [];
    var cloudDocs = [];
    var cloudFolders = [];
    var imageData = null;
    var pinnedDocIds = new Set(); // populated from message
    var isLoggedIn = false;
    var currentFilter = 'all';
    var searchQuery = '';
    var localFolderState = {}; // folderName -> true (collapsed)

    // Icons — 16x16 viewBox, optimized for small sizes, Lucide-compatible style
    var I = {
      check:        '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg>',
      circle:       '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/></svg>',
      cloud:        '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13h7.1a3.2 3.2 0 00.6-6.35 4.5 4.5 0 00-8.7 1.1A2.8 2.8 0 004.5 13z"/></svg>',
      copy:         '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M6 10H4.5A1.5 1.5 0 013 8.5v-5A1.5 1.5 0 014.5 2h5A1.5 1.5 0 0111 3.5V6"/></svg>',
      externalLink: '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4.5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 011 13.5v-8A1.5 1.5 0 012.5 4H7"/><path d="M10 1h5v5"/><path d="M15 1L7 9"/></svg>',
      upload:       '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11v2.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V11"/><path d="M8 10V2"/><path d="M5 4.5L8 1.5l3 3"/></svg>',
      download:     '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11v2.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V11"/><path d="M8 2v8"/><path d="M5 7.5L8 10.5l3-3"/></svg>',
      unsync:       '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8A6 6 0 004.8 3.3L2 6"/><path d="M2 8a6 6 0 009.2 4.7L14 10"/><path d="M4 4l8 8"/></svg>',
      refresh:      '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8A6 6 0 004.8 3.3L2 6"/><path d="M2 2v4h4"/><path d="M2 8a6 6 0 009.2 4.7L14 10"/><path d="M14 14v-4h-4"/></svg>',
      file:         '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1H4.5A1.5 1.5 0 003 2.5v11A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5V5z"/><path d="M9 1v4h4"/></svg>',
      sync:         '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8A6 6 0 004.8 3.3L2 6"/><path d="M2 2v4h4"/><path d="M2 8a6 6 0 009.2 4.7L14 10"/><path d="M14 14v-4h-4"/></svg>',
      trash:        '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12"/><path d="M5.5 4V2.5A1 1 0 016.5 1.5h3a1 1 0 011 1V4"/><path d="M12.5 4v9a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 13V4"/></svg>',
      folder:       '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5A1.5 1.5 0 013.5 2h3l2 2h4A1.5 1.5 0 0114 5.5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5z"/></svg>',
      chevron:      '<svg width="S" height="S" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>',
      share:        '<svg width="S" height="S" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
      users:        '<svg width="S" height="S" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
      eye:          '<svg width="S" height="S" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
      // Lucide Globe (lucide-react source) — used by web for the
      // "Public — anyone with the link can read" doc state.
      globe:        '<svg width="S" height="S" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
      // Lucide Lock — used for password-protected docs.
      lock:         '<svg width="S" height="S" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    };
    function icon(name, size) {
      size = size || 14;
      return (I[name] || '').replace(/S/g, size);
    }

    // Sync badge mirrors web's overlay (MdEditor.tsx L8492): neutral
    // surface ring + small green check. Greens match the Public
    // globe colour (#22c55e) so the "this lives on memory.wiki + is
    // synced locally" pair reads as one consistent green semantic.
    var syncBadge = '<span class="sync-badge"><svg viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="3.5" fill="var(--vscode-sideBar-background)" stroke="var(--vscode-panel-border, rgba(255,255,255,0.12))" stroke-width="0.6"/><path d="M2.5 4.2L3.5 5.2L5.5 3" stroke="#22c55e" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span>';
    // Inline star prefix for starred (pinned) rows. 10px so it tucks
    // under the doc title without competing with the row icon. Uses
    // --micro-warn (subdued gold) so the row reads "this one is
    // flagged" without the lime "live" semantic collision.
    var starInline = '<svg width="10" height="10" viewBox="0 0 16 16" fill="var(--micro-warn)" style="vertical-align:-1px;margin-right:1px" aria-label="Starred"><path d="M8 1l2.09 4.26L15 6l-3.5 3.41.83 4.84L8 12l-4.33 2.25.83-4.84L1 6l4.91-.74L8 1z"/></svg>';

    /** Human-readable state shown on row hover. Mirrors the
     *  visual icon mapping but spells the semantics out so the
     *  user doesn't have to memorise the glyph palette. */
    function docStateText(doc) {
      var editMode = doc.editMode || null;
      var allowedEmails = doc.allowedEmails || null;
      var source = doc.source || null;
      var isDraft = doc.isDraft || false;
      var isSynced = source === 'vscode' || source === 'desktop' || source === 'cli' || source === 'mcp';
      var pinned = doc.docId && pinnedDocIds.has(doc.docId);
      var parts = [];
      if (editMode === 'readonly') {
        parts.push('View only (shared with you)');
      } else if (allowedEmails && allowedEmails.length > 0) {
        parts.push('Shared (restricted to ' + allowedEmails.length + ' email' + (allowedEmails.length === 1 ? '' : 's') + ')');
      } else if (!isDraft) {
        parts.push('Public (anyone with the link can read)');
      } else if (doc.docId) {
        parts.push('Private (cloud-only, only you can read)');
      } else {
        parts.push('Local (not yet synced to memory.wiki)');
      }
      if (isSynced) parts.push('Synced from this editor');
      if (pinned) parts.push('Starred');
      if (doc.docId) parts.push(doc.docId);
      // Newline-joined so the tooltip CSS (white-space: pre-line)
      // renders each fact on its own line. Drops the · separator
      // per brand voice rule.
      return parts.join('\n');
    }

    function docStatusIcon(doc) {
      var editMode = doc.editMode || null;
      var allowedEmails = doc.allowedEmails || null;
      var source = doc.source || null;
      var isDraft = doc.isDraft || false;
      var isSynced = source === 'vscode' || source === 'desktop' || source === 'cli' || source === 'mcp';
      var badge = isSynced ? syncBadge : '';

      // Mirror web's iconography (see MdEditor.tsx L8484-8488,
      // founder ask 2026-06-01 "문서 아이콘들이 웹이랑 같아야함").
      //
      //   View only  → Eye   (purple)  shared with you
      //   Shared     → Users (blue)    specific people / password
      //   Public     → Globe (green)   anyone with link
      //   Private    → Cloud (blue)    cloud-only, owner-only
      //   Local      → File             local-only, no cloud copy
      if (editMode === 'readonly') {
        return '<div class="doc-icon view-only">' + icon('eye', 14) + badge + '</div>';
      }
      if (allowedEmails && allowedEmails.length > 0) {
        return '<div class="doc-icon shared">' + icon('users', 14) + badge + '</div>';
      }
      if (!isDraft) {
        return '<div class="doc-icon public">' + icon('globe', 14) + badge + '</div>';
      }
      if (doc.docId) {
        return '<div class="doc-icon private">' + icon('cloud', 14) + badge + '</div>';
      }
      return '<div class="doc-icon local">' + icon('file', 14) + badge + '</div>';
    }

    window.addEventListener('message', function(e) {
      if (e.data.type === 'refreshing') {
        var refreshBtn = document.getElementById('btn-refresh');
        if (refreshBtn) {
          if (e.data.state) refreshBtn.classList.add('spinning');
          else { refreshBtn.classList.remove('spinning'); }
        }
        return;
      }
      if (e.data.type === 'auth-pending') {
        setSigninPending(!!e.data.state);
        return;
      }
      if (e.data.type === 'loading') {
        // Brand blob fade-in while the cloud fetch is in flight.
        // SMIL animation inside blob.svg runs the morph; we just
        // drop the asset centered with a soft fade. Replaces the
        // earlier skeleton-shimmer which the founder flagged as
        // "너무 못생김". Cleared by the 'documents' message via
        // render() overwriting #doc-container's HTML.
        if (e.data.state) {
          var ctr = document.getElementById('doc-container');
          if (ctr && !ctr.querySelector('.blob-loading')) {
            ctr.innerHTML = '<div class="blob-loading"><img src="' + BLOB_URI + '" alt="" width="64" height="64"/><span class="blob-loading-caption">LOADING</span></div>';
          }
        }
        return;
      }
      if (e.data.type === 'searchResults') {
        cloudSearchResults = e.data.results || [];
        isCloudSearching = false;
        render();
        return;
      }
      if (e.data.type === 'documents') {
        allDocs = e.data.items || [];
        cloudDocs = e.data.cloudDocs || [];
        cloudFolders = e.data.cloudFolders || [];
        imageData = e.data.imageData || null;
        pinnedDocIds = new Set(e.data.pinnedDocIds || []);
        isLoggedIn = e.data.isLoggedIn || false;
        currentUserId = e.data.userEmail || null;
        render();
        updateUserBar();
      }
    });

    document.querySelector('.filters').addEventListener('click', function(e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.filter === currentFilter);
      });
      render();
    });

    var cloudSearchResults = [];
    var cloudSearchTimer = null;
    var isCloudSearching = false;

    document.getElementById('search').addEventListener('input', function(e) {
      searchQuery = e.target.value.toLowerCase();
      render();

      // Cloud search with debounce (3+ chars)
      if (cloudSearchTimer) clearTimeout(cloudSearchTimer);
      if (e.target.value.length >= 3) {
        isCloudSearching = true;
        cloudSearchTimer = setTimeout(function() {
          vscode.postMessage({ type: 'searchDocs', query: e.target.value });
        }, 400);
      } else {
        cloudSearchResults = [];
        isCloudSearching = false;
      }
    });

    document.getElementById('btn-refresh').addEventListener('click', function() {
      vscode.postMessage({ type: 'refresh' });
    });

    // Expand / collapse every folder (cloud + local-relative) in one
    // shot. If any folder is currently collapsed → expand all; else
    // collapse all. localFolderState is the truth + render() reads
    // it on every paint, so we just rewrite + render. Tooltip flips
    // to reflect what the NEXT click will do.
    document.getElementById('btn-toggle-folders').addEventListener('click', function() {
      var anyCollapsed = false;
      // Cloud folders use ids
      (cloudFolders || []).forEach(function(f) {
        if (localFolderState[f.id] === true) anyCollapsed = true;
      });
      // Local folders use folder names — gather distinct names from
      // current allDocs so we cover what's actually on screen.
      var localNames = {};
      (allDocs || []).forEach(function(d) {
        if (d.relativePath) {
          var parts = d.relativePath.split('/');
          if (parts.length > 1) localNames[parts.slice(0, -1).join('/')] = true;
        }
      });
      Object.keys(localNames).forEach(function(n) {
        if (localFolderState[n] === true) anyCollapsed = true;
      });

      var nextState = anyCollapsed ? false : true; // expand all OR collapse all
      (cloudFolders || []).forEach(function(f) { localFolderState[f.id] = nextState; });
      Object.keys(localNames).forEach(function(n) { localFolderState[n] = nextState; });

      var btn = document.getElementById('btn-toggle-folders');
      if (btn) btn.title = nextState ? 'Expand all folders' : 'Collapse all folders';
      render();
    });

    document.getElementById('btn-search-toggle').addEventListener('click', function() {
      var box = document.getElementById('search-box');
      var btn = document.getElementById('btn-search-toggle');
      if (box) {
        box.classList.toggle('hidden');
        var isOpen = !box.classList.contains('hidden');
        if (btn) btn.style.color = isOpen ? 'var(--vscode-foreground)' : '';
        if (isOpen) {
          box.querySelector('input').focus();
        } else {
          box.querySelector('input').value = '';
          searchQuery = '';
          render();
        }
      }
    });

    document.getElementById('btn-help').addEventListener('click', function() {
      var panel = document.getElementById('help-panel');
      var btn = document.getElementById('btn-help');
      if (panel) {
        panel.classList.toggle('hidden');
        btn.classList.toggle('open', !panel.classList.contains('hidden'));
      }
    });

    function render() {
      var container = document.getElementById('doc-container');
      var html = '';

      var syncedDocs = allDocs.filter(function(d) { return d.published; });
      var localOnlyDocs = allDocs.filter(function(d) { return !d.published; });

      // Filter logic: synced is in both LOCAL and CLOUD
      // 'starred' is its own surface — only pinned cloud + synced rows.
      var showSynced, showLocal, showCloud, showStarredOnly;
      if (currentFilter === 'all') {
        showSynced = true; showLocal = true; showCloud = true; showStarredOnly = false;
      } else if (currentFilter === 'starred') {
        showSynced = true; showLocal = false; showCloud = true; showStarredOnly = true;
      } else if (currentFilter === 'synced') {
        showSynced = true; showLocal = false; showCloud = false; showStarredOnly = false;
      } else if (currentFilter === 'local') {
        showSynced = true; showLocal = true; showCloud = false; showStarredOnly = false; // synced has local files
      } else if (currentFilter === 'cloud') {
        showSynced = true; showLocal = false; showCloud = true; showStarredOnly = false; // synced is on cloud
      }

      // Apply search
      var synced = syncedDocs;
      var local = localOnlyDocs;
      if (searchQuery) {
        synced = synced.filter(function(d) { return d.fileName.toLowerCase().includes(searchQuery) || d.relativePath.toLowerCase().includes(searchQuery); });
        local = local.filter(function(d) { return d.fileName.toLowerCase().includes(searchQuery) || d.relativePath.toLowerCase().includes(searchQuery); });
      }

      var cloudFiltered = cloudDocs;
      if (searchQuery) {
        cloudFiltered = cloudFiltered.filter(function(d) { return d.title.toLowerCase().includes(searchQuery) || d.docId.toLowerCase().includes(searchQuery); });
      }
      if (showStarredOnly) {
        // Limit to pinned cloud + synced rows.
        cloudFiltered = cloudFiltered.filter(function(d) { return pinnedDocIds.has(d.docId); });
        synced = synced.filter(function(d) { return d.docId && pinnedDocIds.has(d.docId); });
      }

      // Synced section
      if (showSynced) {
        if (!isLoggedIn && (currentFilter === 'all' || currentFilter === 'synced')) {
          html += secHeader('sync', 'Synced', '');
          html += '<div class="login-prompt"><p>Sign in to see your synced files.</p></div>';
        } else if (synced.length > 0) {
          html += secHeader('sync', 'Synced', synced.length);
          html += '<ul class="doc-list">';
          synced.forEach(function(doc) { html += renderSyncedDoc(doc); });
          html += '</ul>';
        }
      }

      // Local-only section — flat list
      if (showLocal && local.length > 0) {
        html += secHeader('file', 'Local', local.length);
        html += '<ul class="doc-list">';
        local.forEach(function(doc) { html += renderLocalDoc(doc); });
        html += '</ul>';
      }

      // Cloud — grouped by folder
      if (showCloud) {
        if (!isLoggedIn) {
          html += secHeader('globe', 'Cloud', '');
          html += '<div class="login-prompt"><p>Sign in to load your cloud documents.</p></div>';
        } else if (cloudFiltered.length > 0) {
          html += secHeader('globe', 'Cloud', cloudFiltered.length);
          // Docs without folder
          var rootCloud = cloudFiltered.filter(function(d) { return !d.folderId; });
          // Docs in folders
          var folderIds = [];
          cloudFolders.forEach(function(f) {
            var docs = cloudFiltered.filter(function(d) { return d.folderId === f.id; });
            if (docs.length > 0) folderIds.push({ folder: f, docs: docs });
          });
          // Render folders first — with fold/unfold
          folderIds.forEach(function(group) {
            var collapsed = localFolderState[group.folder.id] === true;
            html += '<div class="local-folder">'
              + '<div class="local-folder-header" data-action="toggle-local-folder" data-folder="' + esc(group.folder.id) + '">'
              + '<span class="local-folder-chevron' + (collapsed ? ' collapsed' : '') + '">' + icon('chevron', 10) + '</span>'
              + icon('folder', 12)
              + ' <span>' + esc(group.folder.name) + '</span>'
              + '<span class="local-folder-count">' + group.docs.length + '</span>'
              + '</div>'
              + '<ul class="doc-list local-folder-list' + (collapsed ? ' collapsed' : '') + '">';
            group.docs.forEach(function(doc) { html += renderCloudDoc(doc); });
            html += '</ul></div>';
          });
          // Then root docs
          if (rootCloud.length > 0) {
            html += '<ul class="doc-list">';
            rootCloud.forEach(function(doc) { html += renderCloudDoc(doc); });
            html += '</ul>';
          }
        }
      }

      // Images section removed from sidebar — now in LIVE header panel

      // Cloud search results
      if (searchQuery.length >= 3) {
        if (isCloudSearching) {
          html += '<div class="section-header">' + icon('cloud', 12) + ' Cloud results <span class="section-count" style="animation:spin 0.8s linear infinite">...</span></div>';
        } else if (cloudSearchResults.length > 0) {
          // Exclude already-visible docs
          var existingIds = {};
          allDocs.forEach(function(d) { if (d.docId) existingIds[d.docId] = true; });
          cloudDocs.forEach(function(d) { existingIds[d.docId] = true; });
          var unique = cloudSearchResults.filter(function(r) { return !existingIds[r.id]; });
          if (unique.length > 0) {
            html += '<div class="section-header">' + icon('cloud', 12) + ' Cloud results <span class="section-count">' + unique.length + '</span></div>';
            html += '<ul class="doc-list">';
            unique.forEach(function(r) {
              var snippet = (r.snippet || '').slice(0, 80);
              var meta = relTime(r.updatedAt) + (r.isDraft ? ' \\u00b7 draft' : '');
              html += '<li class="doc-item" data-action="openCloud" data-docid="' + esc(r.id) + '" data-title="' + esc(r.title) + '">'
                + '<div class="doc-icon cloud">' + icon('cloud', 14) + '</div>'
                + '<div class="doc-info"><div class="doc-name">' + esc(r.title) + '</div><div class="doc-meta">' + esc(snippet || meta) + '</div></div>'
                + '</li>';
            });
            html += '</ul>';
          }
        }
      }

      if (!html) {
        html = '<div class="empty">No documents found</div>';
      }

      container.innerHTML = html;
      bindEvents(container);
    }

    function secHeader(type, label, count) {
      var colors = { sync: 'currentColor', file: 'currentColor', globe: 'currentColor', image: 'currentColor' };
      var names = { sync: 'sync', file: 'file', globe: 'cloud', image: 'file' };
      var ic = icon(names[type] || type, 12).replace('stroke="currentColor"', 'stroke="' + (colors[type]||'currentColor') + '"');
      if (type === 'image') ic = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M14.5 10.5l-3.5-3.5-6 6"/></svg>';
      return '<div class="section-header">' + ic + ' ' + label + ' <span class="section-count">' + (count === '' ? '' : count) + '</span></div>';
    }

    function renderSyncedDoc(doc) {
      var ic = '<div class="doc-icon shared">' + icon('share', 14) + syncBadge + '</div>';
      var synced = doc.lastSynced ? relTime(doc.lastSynced) : '';
      var meta = synced ? 'synced ' + synced : doc.docId;
      var pinned = doc.docId && pinnedDocIds.has(doc.docId);
      var actions = ''
        + '<button class="doc-action" data-action="copy" data-url="' + esc(doc.url) + '" title="Copy URL">' + icon('copy', 14) + '</button>'
        + '<button class="doc-action" data-action="browser" data-url="' + esc(doc.url) + '" title="Open in browser">' + icon('externalLink', 14) + '</button>'
        + '<button class="doc-action" data-action="unsync" data-path="' + esc(doc.filePath) + '" title="Remove sync link (cloud copy remains)">' + icon('unsync', 14) + '</button>'
        + '<button class="doc-action" data-action="deleteSynced" data-path="' + esc(doc.filePath) + '" title="Delete from cloud" style="color:var(--micro-red)">' + icon('trash', 14) + '</button>';
      return '<li class="doc-item" data-action="open" data-path="' + esc(doc.filePath) + '" title="' + esc(docStateText(doc)) + '">'
        + ic
        + '<div class="doc-info"><div class="doc-name">' + (pinned ? starInline + ' ' : '') + esc(doc.fileName) + '</div><div class="doc-meta">' + esc(meta) + '</div></div>'
        + '<div class="doc-actions">' + actions + '</div></li>';
    }

    function renderLocalDoc(doc) {
      var ic = '<div class="doc-icon local">' + icon('file', 14) + '</div>';
      var meta = doc.relativePath || doc.fileName;
      var actions = '<button class="doc-action" data-action="publish" data-path="' + esc(doc.filePath) + '" title="Sync to memory.wiki">' + icon('upload', 14) + '</button>';
      return '<li class="doc-item" data-action="open" data-path="' + esc(doc.filePath) + '" title="' + esc(docStateText(doc) + '\n' + (doc.relativePath || doc.fileName)) + '">'
        + ic
        + '<div class="doc-info"><div class="doc-name">' + esc(doc.fileName) + '</div><div class="doc-meta">' + esc(meta) + '</div></div>'
        + '<div class="doc-actions">' + actions + '</div></li>';
    }

    function renderCloudDoc(doc) {
      var ic = docStatusIcon(doc);
      var viewStr = doc.viewCount > 0 ? ' · ' + doc.viewCount + ' views' : '';
      var meta = relTime(doc.updatedAt) + (doc.isDraft ? ' · draft' : '') + viewStr;
      var pinned = pinnedDocIds.has(doc.docId);
      var actions = '<button class="doc-action" data-action="pull" data-docid="' + esc(doc.docId) + '" data-title="' + esc(doc.title) + '" title="Sync to local">' + icon('download', 14) + '</button>'
        + '<button class="doc-action" data-action="duplicateCloud" data-docid="' + esc(doc.docId) + '" data-title="' + esc(doc.title) + '" title="Duplicate">' + icon('copy', 14) + '</button>'
        + '<button class="doc-action" data-action="browser" data-url="' + esc(doc.url) + '" title="Open in browser">' + icon('externalLink', 14) + '</button>'
        + '<button class="doc-action" data-action="deleteCloud" data-docid="' + esc(doc.docId) + '" title="Delete from cloud" style="color:var(--micro-red)">' + icon('trash', 14) + '</button>';
      return '<li class="doc-item" data-action="openCloud" data-url="' + esc(doc.url) + '" data-docid="' + esc(doc.docId) + '" data-title="' + esc(doc.title) + '" title="' + esc(docStateText(doc)) + '">'
        + ic
        + '<div class="doc-info"><div class="doc-name">' + (pinned ? starInline + ' ' : '') + esc(doc.title) + '</div><div class="doc-meta">' + esc(meta) + '</div></div>'
        + '<div class="doc-actions">' + actions + '</div></li>';
    }

    function bindEvents(container) {
      container.querySelectorAll('[data-action="open"]').forEach(function(el) {
        el.addEventListener('click', function(e) {
          if (e.target.closest('.doc-action')) return;
          vscode.postMessage({ type: 'openFile', filePath: el.dataset.path });
        });
      });
      container.querySelectorAll('[data-action="copy"]').forEach(function(btn) {
        btn.addEventListener('click', function() { vscode.postMessage({ type: 'copyUrl', url: btn.dataset.url }); });
      });
      container.querySelectorAll('[data-action="browser"]').forEach(function(btn) {
        btn.addEventListener('click', function() { vscode.postMessage({ type: 'openBrowser', url: btn.dataset.url }); });
      });
      container.querySelectorAll('[data-action="publish"]').forEach(function(btn) {
        btn.addEventListener('click', function() { vscode.postMessage({ type: 'publish', filePath: btn.dataset.path }); });
      });
      container.querySelectorAll('[data-action="pull"]').forEach(function(btn) {
        btn.addEventListener('click', function() { vscode.postMessage({ type: 'pullCloud', docId: btn.dataset.docid, title: btn.dataset.title }); });
      });
      container.querySelectorAll('[data-action="openCloud"]').forEach(function(el) {
        el.addEventListener('click', function(e) {
          if (e.target.closest('.doc-action')) return;
          vscode.postMessage({ type: 'previewCloud', docId: el.dataset.docid, title: el.dataset.title });
        });
      });
      container.querySelectorAll('[data-action="unsync"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          vscode.postMessage({ type: 'unsync', filePath: btn.dataset.path });
        });
      });
      container.querySelectorAll('[data-action="deleteSynced"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          vscode.postMessage({ type: 'deleteSynced', filePath: btn.dataset.path });
        });
      });
      container.querySelectorAll('[data-action="duplicateCloud"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          vscode.postMessage({ type: 'duplicateCloud', docId: btn.dataset.docid, title: btn.dataset.title });
        });
      });
      container.querySelectorAll('[data-action="deleteCloud"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          vscode.postMessage({ type: 'deleteCloud', docId: btn.dataset.docid });
        });
      });
      container.querySelectorAll('[data-action="insert-image"]').forEach(function(el) {
        el.addEventListener('click', function() {
          var url = el.dataset.url;
          var name = (el.dataset.name || 'image').replace(/\\.\\w+$/, '');
          vscode.postMessage({ type: 'insert-image', url: url, name: name });
        });
      });
      // Local folder toggle
      container.querySelectorAll('[data-action="toggle-local-folder"]').forEach(function(el) {
        el.addEventListener('click', function() {
          var folder = el.dataset.folder;
          localFolderState[folder] = !localFolderState[folder];
          var chevron = el.querySelector('.local-folder-chevron');
          var list = el.nextElementSibling;
          if (chevron) chevron.classList.toggle('collapsed', localFolderState[folder]);
          if (list) list.classList.toggle('collapsed', localFolderState[folder]);
        });
      });
      // Images auth prompt sign-in
      container.querySelectorAll('[data-action="sign-in"]').forEach(function(btn) {
        btn.addEventListener('click', function() { vscode.postMessage({ type: 'login' }); });
      });
      var loginBtn = document.getElementById('login-btn');
      if (loginBtn) {
        loginBtn.addEventListener('click', function() { vscode.postMessage({ type: 'login' }); });
      }
    }

    function relTime(iso) {
      if (!iso) return '';
      var diff = Date.now() - new Date(iso).getTime();
      var s = Math.floor(diff/1000);
      if (s < 60) return 'just now';
      var m = Math.floor(s/60);
      if (m < 60) return m + 'm ago';
      var h = Math.floor(m/60);
      if (h < 24) return h + 'h ago';
      var d = Math.floor(h/24);
      if (d < 30) return d + 'd ago';
      return new Date(iso).toLocaleDateString();
    }

    function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    var currentUserId = null;

    function updateUserBar() {
      var loggedOut = document.getElementById('user-loggedout');
      var loggedIn = document.getElementById('user-loggedin');
      if (!loggedOut || !loggedIn) return;

      if (isLoggedIn) {
        loggedOut.classList.add('hidden');
        loggedIn.classList.remove('hidden');
        // Show user initial in avatar
        var avatar = document.getElementById('user-avatar');
        var nameEl = document.getElementById('user-name');
        var email = currentUserId || '';
        var initial = email.charAt(0).toUpperCase() || 'U';
        if (avatar) avatar.textContent = initial;
        if (nameEl) nameEl.textContent = email || 'memory.wiki user';
      } else {
        loggedOut.classList.remove('hidden');
        loggedIn.classList.add('hidden');
      }
    }

    // Bind sign in / sign out buttons
    document.getElementById('signin-btn').addEventListener('click', function() {
      // Optimistic disable — extension also posts auth-pending, but
      // disabling here removes the click-during-flight race.
      setSigninPending(true);
      vscode.postMessage({ type: 'login' });
    });
    function setSigninPending(pending) {
      var btn = document.getElementById('signin-btn');
      if (!btn) return;
      btn.disabled = !!pending;
      btn.style.opacity = pending ? '0.6' : '';
      btn.style.cursor = pending ? 'default' : '';
      // Cache + restore the original label so the "Signing in…"
      // state doesn't permanently overwrite it.
      if (pending) {
        if (!btn.dataset.originalLabel) btn.dataset.originalLabel = btn.innerHTML;
        btn.innerHTML = '<span style="opacity:0.85">Signing in…</span>';
      } else if (btn.dataset.originalLabel) {
        btn.innerHTML = btn.dataset.originalLabel;
        delete btn.dataset.originalLabel;
      }
    }
    document.getElementById('logout-btn').addEventListener('click', function() {
      vscode.postMessage({ type: 'logout' });
    });

    // Tooltip system — always stays inside sidebar bounds
    var tipEl = null;
    document.addEventListener('mouseover', function(e) {
      var target = e.target.closest('[title]');
      if (!target) return;
      var text = target.getAttribute('title');
      if (!text) return;
      target.setAttribute('data-tip', text);
      target.removeAttribute('title');
      if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'sb-tooltip'; document.body.appendChild(tipEl); }
      tipEl.textContent = text;
      tipEl.classList.add('show');

      var r = target.getBoundingClientRect();
      var bw = document.body.clientWidth;
      var bh = document.body.clientHeight;

      // Measure tooltip
      var tw = tipEl.offsetWidth;
      var th = tipEl.offsetHeight;

      // Prefer above, fallback below
      var top = r.top - th - 4;
      if (top < 4) top = r.bottom + 4;
      if (top + th > bh - 4) top = bh - th - 4;

      // Horizontal: center on target, clamp to sidebar
      var left = r.left + (r.width / 2) - (tw / 2);
      if (left < 4) left = 4;
      if (left + tw > bw - 4) left = bw - tw - 4;

      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';
    });
    document.addEventListener('mouseout', function(e) {
      var target = e.target.closest('[data-tip]');
      if (target) { target.setAttribute('title', target.getAttribute('data-tip')); target.removeAttribute('data-tip'); }
      if (tipEl) tipEl.classList.remove('show');
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
