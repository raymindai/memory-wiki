import * as vscode from "vscode";
import {
  loadMdfyConfig,
  saveMdfyConfig,
  getMdfyConfigPath,
  MdfyConfig,
} from "./extension";
import {
  updateDocument,
  pullDocument,
  checkServerUpdatedAt,
  ConflictError,
} from "./publish";
import { AuthManager } from "./auth";
import { StatusBarManager } from "./statusbar";
import { PreviewPanel } from "./preview";

export class SyncEngine {
  private static readonly MAX_OFFLINE_RETRIES = 5;
  private authManager: AuthManager;
  private statusBar: StatusBarManager;
  private pollingTimer: NodeJS.Timeout | undefined;
  private pushDebounceTimers = new Map<string, NodeJS.Timeout>();
  private isPulling = false;
  private offlineQueue: Array<{
    filePath: string;
    markdown: string;
    title: string;
    retryCount: number;
  }> = [];

  constructor(authManager: AuthManager, statusBar: StatusBarManager, private context: vscode.ExtensionContext) {
    this.authManager = authManager;
    this.statusBar = statusBar;
    this.offlineQueue = this.context.globalState.get<typeof this.offlineQueue>("memorywiki.offlineQueue") || [];
  }

  private async persistQueue(): Promise<void> {
    await this.context.globalState.update("memorywiki.offlineQueue", this.offlineQueue);
  }

  /**
   * Start the polling sync loop.
   */
  startPolling(intervalSeconds: number): void {
    this.stopPolling();
    this.pollingTimer = setInterval(() => {
      this.pollAllTrackedFiles();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop the polling sync loop.
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  /**
   * Handle file save event with debounced push.
   */
  onFileSaved(document: vscode.TextDocument): void {
    if (this.isPulling) { return; }
    const filePath = document.fileName;

    // Clear existing debounce
    const existing = this.pushDebounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    // Debounce 2 seconds
    const timer = setTimeout(async () => {
      this.pushDebounceTimers.delete(filePath);
      try {
        await this.push(document);
      } catch (err) {
        // Silently queue for offline if network error
        const config = await loadMdfyConfig(filePath);
        if (config) {
          this.queueOffline(filePath, document.getText(), extractTitle(document.getText()) || "");
        }
      }
    }, 2000);

    this.pushDebounceTimers.set(filePath, timer);
  }

  /**
   * Check if the current user owns the document.
   * Uses the GET endpoint which returns isOwner in the response.
   */
  private async checkOwnership(docId: string): Promise<boolean> {
    try {
      const result = await pullDocument(docId, this.authManager);
      return result.isOwner !== false;
    } catch {
      // If we can't determine ownership (network error, etc.), allow push
      // to avoid blocking legitimate owners when offline
      return true;
    }
  }

  /**
   * Push local changes to Memory.Wiki.
   */
  async push(document: vscode.TextDocument): Promise<void> {
    const filePath = document.fileName;
    // Never push empty content — protect against content loss
    if (!document.getText().trim()) {
      return;
    }

    const config = await loadMdfyConfig(filePath);

    if (!config) {
      vscode.window.showWarningMessage(
        "This file has not been published to Memory.Wiki yet. Use 'memory.wiki: Publish' first."
      );
      return;
    }

    // Verify ownership before pushing — only the document owner can edit
    const isOwner = await this.checkOwnership(config.docId);
    if (!isOwner) {
      vscode.window.showWarningMessage(
        "You do not own this document. Only the owner can push changes. Use 'Duplicate' to create your own copy."
      );
      this.statusBar.setIdle();
      return;
    }

    // Check for conflicts before pushing
    const checkResult = await checkServerUpdatedAt(
      config.docId,
      this.authManager
    );

    if (checkResult.status === "deleted") {
      const configPath = getMdfyConfigPath(filePath);
      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(configPath));
      } catch { /* already gone */ }
      vscode.window.showWarningMessage(
        `"${vscode.workspace.asRelativePath(document.uri)}" was deleted on Memory.Wiki. Local sync removed.`
      );
      this.statusBar.setIdle();
      return;
    }

    if (
      checkResult.status === "ok" &&
      config.lastServerUpdatedAt &&
      new Date(checkResult.updated_at).getTime() >
        new Date(config.lastServerUpdatedAt).getTime()
    ) {
      // Server changed since last sync — conflict
      const choice = await vscode.window.showWarningMessage(
        "Server has newer changes. Overwrite?",
        "Push (overwrite server)",
        "Pull (overwrite local)",
        "Show Diff"
      );

      if (choice === "Pull (overwrite local)") {
        await this.pull(document);
        return;
      } else if (choice === "Show Diff") {
        await this.showConflictDiff(document, config);
        return;
      } else if (!choice) {
        // User cancelled
        return;
      }
      // "Push (overwrite server)" — fall through to push
    }

    const markdown = document.getText();
    const title = extractTitle(markdown) || vscode.workspace.asRelativePath(document.uri);

    this.statusBar.setSyncing("Pushing...");
    PreviewPanel.updateSyncStatusForDocument(document.uri, "syncing");

    try {
      // Skip conflict detection when Yjs collaboration is active (CRDT handles merging)
      const { getCollabManager } = await import("./extension");
      const collabActive = getCollabManager()?.isActive(document.uri) ?? false;
      const result = await updateDocument(
        config.docId,
        config.editToken,
        markdown,
        title,
        this.authManager,
        collabActive ? undefined : config.lastServerUpdatedAt
      );

      config.lastSyncedAt = new Date().toISOString();
      config.lastServerUpdatedAt = result.updated_at;
      await saveMdfyConfig(filePath, config);

      this.statusBar.setSynced();
      PreviewPanel.updateSyncStatusForDocument(document.uri, "synced");
    } catch (err) {
      // Handle 409 Conflict
      if (err instanceof Error && (err as ConflictError).conflict) {
        this.statusBar.setConflict();
        PreviewPanel.updateSyncStatusForDocument(document.uri, "error");

        const choice = await vscode.window.showWarningMessage(
          "This document was modified by someone else.",
          "Push (overwrite server)",
          "Pull (overwrite local)",
          "Show Diff"
        );

        if (choice === "Push (overwrite server)") {
          // Force push without expectedUpdatedAt
          const result = await updateDocument(
            config.docId,
            config.editToken,
            markdown,
            title,
            this.authManager
            // no expectedUpdatedAt — force overwrite
          );
          config.lastSyncedAt = new Date().toISOString();
          config.lastServerUpdatedAt = result.updated_at;
          await saveMdfyConfig(filePath, config);
          this.statusBar.setSynced();
          PreviewPanel.updateSyncStatusForDocument(document.uri, "synced");
        } else if (choice === "Pull (overwrite local)") {
          await this.pull(document);
        } else if (choice === "Show Diff") {
          await this.showConflictDiff(document, config);
        }
        return;
      }

      this.statusBar.setError();
      PreviewPanel.updateSyncStatusForDocument(document.uri, "error");

      // Queue for offline retry
      this.queueOffline(filePath, markdown, title);

      throw err;
    }
  }

  /**
   * Pull latest content from Memory.Wiki into the local file.
   */
  async pull(document: vscode.TextDocument): Promise<void> {
    const filePath = document.fileName;
    const config = await loadMdfyConfig(filePath);

    if (!config) {
      vscode.window.showWarningMessage(
        "This file has not been published to Memory.Wiki yet. Use 'memory.wiki: Publish' first."
      );
      return;
    }

    this.statusBar.setSyncing("Pulling...");
    PreviewPanel.updateSyncStatusForDocument(document.uri, "syncing");

    try {
      const remote = await pullDocument(config.docId, this.authManager);

      // Apply remote content to the file
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, remote.markdown);
      await vscode.workspace.applyEdit(edit);
      this.isPulling = true;
      try { await document.save(); } finally { this.isPulling = false; }

      config.lastSyncedAt = new Date().toISOString();
      config.lastServerUpdatedAt = remote.updated_at;
      if (remote.editToken) {
        config.editToken = remote.editToken;
      }
      await saveMdfyConfig(filePath, config);

      this.statusBar.setSynced();
      PreviewPanel.updateSyncStatusForDocument(document.uri, "synced");
      vscode.window.showInformationMessage("Pulled latest from Memory.Wiki.");
    } catch (err) {
      this.statusBar.setError();
      PreviewPanel.updateSyncStatusForDocument(document.uri, "error");
      throw err;
    }
  }

  /**
   * Poll all tracked (published) markdown files for server changes.
   * Scans workspace for .memorywiki.json sidecar files, not just open documents.
   */
  private async pollAllTrackedFiles(): Promise<void> {
    await this.flushOfflineQueue();

    // Scan workspace for hidden .memorywiki.json sidecar files
    const sidecarFiles = await vscode.workspace.findFiles(
      "**/.*.memorywiki.json",
      "{**/node_modules/**,**/dist/**,**/.git/**}",
      50 // limit to prevent overload
    );

    for (const sidecarUri of sidecarFiles) {
      const sidecarPath = sidecarUri.fsPath;
      // Derive the .md file path: .foo.memorywiki.json → foo.md
      const dir = sidecarPath.substring(0, sidecarPath.lastIndexOf("/") + 1);
      const sidecarName = sidecarPath.substring(sidecarPath.lastIndexOf("/") + 1);
      const mdName = sidecarName.replace(/^\./, "").replace(/\.memory.wiki\.json$/, ".md");
      const mdPath = dir + mdName;

      const config = await loadMdfyConfig(mdPath);
      if (!config) continue;

      // Skip polling for documents with active Yjs collaboration
      const { getCollabManager } = await import("./extension");
      const mdUri = vscode.Uri.file(mdPath);
      if (getCollabManager()?.isActive(mdUri)) continue;

      try {
        const result = await checkServerUpdatedAt(config.docId, this.authManager);

        if (result.status === "deleted") {
          try { await vscode.workspace.fs.delete(sidecarUri); } catch { /* already gone */ }
          const fileName = sidecarPath.replace(/\.memory.wiki\.json$/, ".md");
          vscode.window.showInformationMessage(
            `"${vscode.workspace.asRelativePath(fileName)}" was deleted on Memory.Wiki. Sync removed.`
          );
          continue;
        }
        if (result.status === "error") continue;

        const serverTime = new Date(result.updated_at).getTime();
        // Compare against server timestamp (not client clock) to avoid clock skew
        const localTime = new Date(config.lastServerUpdatedAt || config.lastSyncedAt).getTime();

        // Check if the file is currently open
        const openDoc = vscode.workspace.textDocuments.find(d => d.fileName === mdPath);
        const localDirty = openDoc?.isDirty ?? false;

        if (serverTime > localTime && !localDirty) {
          if (openDoc) {
            await this.pull(openDoc);
          } else {
            // File not open — check if it still exists before pulling to disk
            try {
              await vscode.workspace.fs.stat(vscode.Uri.file(mdPath));
            } catch {
              // File was deleted locally — clean up orphaned sidecar
              try { await vscode.workspace.fs.delete(sidecarUri); } catch {}
              continue;
            }
            const remote = await pullDocument(config.docId, this.authManager);
            await vscode.workspace.fs.writeFile(
              vscode.Uri.file(mdPath),
              Buffer.from(remote.markdown, "utf-8")
            );
            config.lastSyncedAt = new Date().toISOString();
            config.lastServerUpdatedAt = remote.updated_at;
            if (remote.editToken) config.editToken = remote.editToken;
            await saveMdfyConfig(mdPath, config);
          }
        } else if (serverTime > localTime && localDirty) {
          this.statusBar.setConflict();
          if (openDoc) {
            const action = await vscode.window.showWarningMessage(
              `Conflict: "${vscode.workspace.asRelativePath(openDoc.uri)}" changed on server.`,
              "Pull", "Push", "Show Diff"
            );
            if (action === "Pull") await this.pull(openDoc);
            else if (action === "Push") await this.push(openDoc);
            else if (action === "Show Diff") await this.showConflictDiff(openDoc, config);
          }
        }
      } catch {
        // Network error, skip
      }
    }
  }

  /**
   * Show a diff between local and server content.
   */
  private async showConflictDiff(
    document: vscode.TextDocument,
    config: MdfyConfig
  ): Promise<void> {
    try {
      const remote = await pullDocument(config.docId, this.authManager);

      // Create a temporary document with server content
      const serverDoc = await vscode.workspace.openTextDocument({
        content: remote.markdown,
        language: "markdown",
      });

      await vscode.commands.executeCommand(
        "vscode.diff",
        serverDoc.uri,
        document.uri,
        `Memory.Wiki (server) <-> ${vscode.workspace.asRelativePath(document.uri)} (local)`
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to fetch server version: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Queue a failed push for offline retry.
   */
  private queueOffline(filePath: string, markdown: string, title: string): void {
    // Find existing entry for this file to preserve retryCount
    const existing = this.offlineQueue.find(
      (item) => item.filePath === filePath
    );
    const retryCount = existing ? existing.retryCount + 1 : 0;

    // Remove existing entry for this file
    this.offlineQueue = this.offlineQueue.filter(
      (item) => item.filePath !== filePath
    );

    if (retryCount >= SyncEngine.MAX_OFFLINE_RETRIES) {
      vscode.window.showWarningMessage(
        `Sync for "${filePath}" failed after ${SyncEngine.MAX_OFFLINE_RETRIES} retries. Please try pushing manually.`
      );
      return;
    }

    this.offlineQueue.push({ filePath, markdown, title, retryCount });
    this.persistQueue();
  }

  /**
   * Retry queued offline pushes.
   */
  private async flushOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {return;}

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queue) {
      if (item.retryCount >= SyncEngine.MAX_OFFLINE_RETRIES) {
        // Skip items that have exceeded max retries
        continue;
      }

      const config = await loadMdfyConfig(item.filePath);
      if (!config) {continue;}

      try {
        // Re-read file content instead of using stale queue data
        const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(item.filePath));
        const currentMarkdown = Buffer.from(fileContent).toString("utf-8");
        const updateResult = await updateDocument(
          config.docId,
          config.editToken,
          currentMarkdown,
          item.title,
          this.authManager
        );

        config.lastSyncedAt = new Date().toISOString();
        config.lastServerUpdatedAt = updateResult.updated_at;
        await saveMdfyConfig(item.filePath, config);
      } catch {
        // Still offline, re-queue with incremented retryCount
        this.offlineQueue.push({
          ...item,
          retryCount: item.retryCount + 1,
        });
      }
    }
    await this.persistQueue();
  }

  dispose(): void {
    this.stopPolling();
    for (const timer of this.pushDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.pushDebounceTimers.clear();
  }
}

function extractTitle(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}
