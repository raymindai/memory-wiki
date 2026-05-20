import * as vscode from "vscode";
import { PreviewPanel } from "./preview";
import { publishDocument, updateDocument, pullDocument } from "./publish";
import { SyncEngine } from "./sync";
import { AuthManager } from "./auth";
import { StatusBarManager } from "./statusbar";
import { MdfySidebarProvider } from "./sidebar";
import { CollaborationManager } from "./collaboration";

let syncEngine: SyncEngine | undefined;
let statusBar: StatusBarManager | undefined;
let authManager: AuthManager | undefined;
let sidebarProvider: MdfySidebarProvider | undefined;
let collabManager: CollaborationManager | undefined;
export function getCollabManager(): CollaborationManager | undefined { return collabManager; }
let suppressAutoPreview = false;
let isApplyingRemoteCollab = false;
let remoteCollabQueue: { uri: vscode.Uri; markdown: string }[] = [];

export function suppressAutoPreviewFor(ms: number): void {
  suppressAutoPreview = true;
  setTimeout(() => { suppressAutoPreview = false; }, ms);
}

export function activate(context: vscode.ExtensionContext): void {
  authManager = new AuthManager(context);
  statusBar = new StatusBarManager();
  syncEngine = new SyncEngine(authManager, statusBar, context);
  collabManager = new CollaborationManager();

  // Share AuthManager with preview panels for image upload
  PreviewPanel.setAuthManager(authManager);

  // Handle remote collaboration changes — apply to VS Code editor
  // Uses a queue to avoid dropping concurrent remote changes during async applyEdit.
  async function processRemoteCollabQueue(): Promise<void> {
    while (remoteCollabQueue.length > 0) {
      // Take the latest entry for each URI (skip stale intermediate states)
      const latest = remoteCollabQueue[remoteCollabQueue.length - 1];
      remoteCollabQueue = [];

      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === latest.uri.toString()
      );
      if (!doc) continue;

      try {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length)
        );
        edit.replace(doc.uri, fullRange, latest.markdown);
        await vscode.workspace.applyEdit(edit);
      } catch {
        // Edit failed (e.g., doc closed) — skip
      }
    }
  }

  context.subscriptions.push(
    collabManager.onRemoteChange(async ({ uri, markdown }) => {
      remoteCollabQueue.push({ uri, markdown });
      if (isApplyingRemoteCollab) return; // queue will be drained by current processor
      isApplyingRemoteCollab = true;
      try {
        await processRemoteCollabQueue();
      } finally {
        isApplyingRemoteCollab = false;
      }
    })
  );

  // Show peer count in status bar
  context.subscriptions.push(
    collabManager.onPeersChanged(({ uri, count }) => {
      const activeUri = vscode.window.activeTextEditor?.document.uri;
      if (activeUri && activeUri.toString() === uri.toString()) {
        if (count > 0) {
          statusBar?.setCollaborating(count);
        } else if (collabManager?.isActive(uri)) {
          statusBar?.setCollaboratingLive();
        }
      }
    })
  );

  // Refresh sidebar on login/logout
  context.subscriptions.push(
    authManager.onDidLogin(() => {
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "memory.wiki: Signing in...", cancellable: false },
        async (progress) => {
          progress.report({ message: "Loading your documents..." });
          await sidebarProvider?.refresh();
          progress.report({ message: "Done" });
        }
      );
    })
  );

  context.subscriptions.push(
    authManager.onDidLogout(() => {
      syncEngine?.stopPolling();
      sidebarProvider?.refresh();
    })
  );

  // Sidebar WebviewView
  sidebarProvider = new MdfySidebarProvider(context.extensionUri, authManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MdfySidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Command: Refresh sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.sidebar.refresh", () => {
      sidebarProvider?.refresh();
    })
  );

  // Refresh sidebar when files are saved or created
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === "markdown") {
        sidebarProvider?.refresh();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles(() => {
      sidebarProvider?.refresh();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidDeleteFiles(() => {
      sidebarProvider?.refresh();
    })
  );

  // Handle file renames — move .mdfy.json sidecar alongside renamed file
  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (e) => {
      for (const { oldUri, newUri } of e.files) {
        if (!oldUri.fsPath.endsWith(".md")) continue;
        const oldConfig = getMdfyConfigPath(oldUri.fsPath);
        const newConfig = getMdfyConfigPath(newUri.fsPath);
        try {
          await vscode.workspace.fs.rename(vscode.Uri.file(oldConfig), vscode.Uri.file(newConfig));
        } catch { /* sidecar didn't exist */ }
      }
      sidebarProvider?.refresh();
    })
  );

  // Register URI handler for OAuth callback
  const uriHandler: vscode.UriHandler = {
    handleUri(uri: vscode.Uri): void {
      authManager?.handleAuthCallback(uri);
    },
  };
  context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

  // Command: Preview (WYSIWYG)
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.preview", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "markdown") {
        vscode.window.showWarningMessage("Open a Markdown file first.");
        return;
      }
      PreviewPanel.createOrShow(context.extensionUri, editor.document);
      // Check if published and show badge
      const config = await loadMdfyConfig(editor.document.fileName);
      if (config) {
        const baseUrl = getApiBaseUrl();
        setTimeout(() => {
          PreviewPanel.setPublishedStateForDocument(
            editor.document.uri,
            config.docId,
            `${baseUrl}/${config.docId}`
          );
        }, 300);
      }
    })
  );

  // Command: Publish (one-click: publish or push + auto-copy URL)
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.publish", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "markdown") {
        vscode.window.showWarningMessage("Open a Markdown file first.");
        return;
      }

      // Require login for publish
      if (!await authManager?.isLoggedIn()) {
        const choice = await vscode.window.showWarningMessage(
          "Sign in to Memory.Wiki to publish documents.",
          "Sign In"
        );
        if (choice === "Sign In") { vscode.commands.executeCommand("mdfy.login"); }
        return;
      }

      const markdown = editor.document.getText();
      const fileName = editor.document.fileName;
      const title =
        extractTitle(markdown) ||
        vscode.workspace.asRelativePath(editor.document.uri);
      const baseUrl = getApiBaseUrl();

      // If already published → push update instead
      const existing = await loadMdfyConfig(fileName);
      if (existing) {
        // Verify ownership before pushing
        try {
          const remoteDoc = await pullDocument(existing.docId, authManager);
          if (remoteDoc.isOwner === false) {
            vscode.window.showWarningMessage(
              "You do not own this document. Only the owner can push changes."
            );
            return;
          }
        } catch {
          // Network error — proceed cautiously, server will reject if unauthorized
        }

        statusBar?.setSyncing("Pushing...");
        try {
          const updateResult = await updateDocument(
            existing.docId, existing.editToken, markdown, title, authManager
          );
          existing.lastSyncedAt = new Date().toISOString();
          existing.lastServerUpdatedAt = updateResult.updated_at;
          await saveMdfyConfig(fileName, existing);

          const url = `${baseUrl}/${existing.docId}`;
          await vscode.env.clipboard.writeText(url);
          statusBar?.setPublished(url);
          sidebarProvider?.refresh();
          vscode.window.showInformationMessage(`Updated & URL copied: ${url}`);
        } catch (err) {
          statusBar?.setError();
          vscode.window.showErrorMessage(
            `Push failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        return;
      }

      // First publish
      statusBar?.setSyncing("Publishing...");
      try {
        const result = await publishDocument(markdown, title, authManager);
        const url = `${baseUrl}/${result.id}`;

        await saveMdfyConfig(fileName, {
          docId: result.id,
          editToken: result.editToken,
          lastSyncedAt: new Date().toISOString(),
          lastServerUpdatedAt: result.created_at || new Date().toISOString(),
        });

        await vscode.env.clipboard.writeText(url);
        statusBar?.setPublished(url);
        PreviewPanel.setPublishedStateForDocument(editor.document.uri, result.id, url);
        sidebarProvider?.refresh();
        vscode.window.showInformationMessage(`Published & URL copied: ${url}`);
      } catch (err) {
        statusBar?.setError();
        vscode.window.showErrorMessage(
          `Publish failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );

  // Command: Update (Push)
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.update", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "markdown") {
        vscode.window.showWarningMessage("Open a Markdown file first.");
        return;
      }

      try {
        await syncEngine?.push(editor.document);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Push failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );

  // Command: Pull
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.pull", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "markdown") {
        vscode.window.showWarningMessage("Open a Markdown file first.");
        return;
      }

      try {
        await syncEngine?.pull(editor.document);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Pull failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );

  // Command: Copy URL (from status bar click)
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.copyUrl", async () => {
      const url = statusBar?.getPublishedUrl();
      if (url) {
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage(`URL copied: ${url}`);
      } else {
        // Fall back to sync menu
        vscode.commands.executeCommand("mdfy.sync");
      }
    })
  );

  // Command: Login
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.login", async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "memory.wiki: Opening browser for login...", cancellable: false },
        async () => {
          await authManager?.login();
        }
      );
    })
  );

  // Command: Export
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.export", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "markdown") {
        vscode.window.showWarningMessage("Open a Markdown file first.");
        return;
      }

      const items: vscode.QuickPickItem[] = [
        { label: "$(file-code) Copy as HTML", description: "Copy rendered HTML to clipboard" },
        { label: "$(file-text) Copy as HTML (for email/docs)", description: "Rich paste into Google Docs, Email, Word" },
        { label: "$(comment-discussion) Copy as Slack", description: "Slack mrkdwn format" },
        { label: "$(desktop-download) Save as HTML", description: "Save rendered HTML file" },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Export document as...",
      });

      if (!selected) { return; }
      const markdown = editor.document.getText();

      if (selected.label.includes("for email/docs")) {
        const html = PreviewPanel.renderToHtml(markdown);
        await vscode.env.clipboard.writeText(html);
        vscode.window.showInformationMessage("HTML copied — paste into Google Docs, Email, or Word.");
      } else if (selected.label.includes("Copy as HTML")) {
        const html = PreviewPanel.renderToHtml(markdown);
        await vscode.env.clipboard.writeText(html);
        vscode.window.showInformationMessage("HTML copied to clipboard.");
      } else if (selected.label.includes("Slack")) {
        const slack = markdownToSlack(markdown);
        await vscode.env.clipboard.writeText(slack);
        vscode.window.showInformationMessage("Slack mrkdwn copied to clipboard.");
      } else if (selected.label.includes("Save as HTML")) {
        const html = PreviewPanel.renderToFullHtml(markdown);
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(
            editor.document.fileName.replace(/\.md$/, ".html")
          ),
          filters: { "HTML": ["html"] },
        });
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(html, "utf-8"));
          vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
        }
      }
    })
  );

  // --- AI Tool Commands ---

  async function runAiAction(action: string, language?: string, instruction?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "markdown") {
      vscode.window.showWarningMessage("Open a Markdown file first.");
      return;
    }

    // Require login for AI features
    if (!await authManager?.isLoggedIn()) {
      const choice = await vscode.window.showWarningMessage(
        "Sign in to use AI features.",
        "Sign In"
      );
      if (choice === "Sign In") { vscode.commands.executeCommand("mdfy.login"); }
      return;
    }

    const markdown = editor.document.getText();
    if (!markdown.trim()) {
      vscode.window.showWarningMessage("Document is empty.");
      return;
    }

    const baseUrl = getApiBaseUrl();
    const actionLabel = action === "chat" ? "AI Chat" : action.charAt(0).toUpperCase() + action.slice(1);

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `${actionLabel}...`, cancellable: false },
      async () => {
        try {
          const body: Record<string, string> = { action, markdown };
          if (language) { body.language = language; }
          if (instruction) { body.instruction = instruction; }

          const token = await authManager?.getToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) { headers["Authorization"] = `Bearer ${token}`; }

          const res = await fetch(`${baseUrl}/api/ai`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(errData.error || `HTTP ${res.status}`);
          }

          const data = await res.json() as { result?: string; error?: string };
          if (data.error) {
            throw new Error(data.error);
          }

          if (data.result) {
            let result = data.result;
            // Strip EDIT:/ANSWER: prefixes if present
            if (action === "chat" && !result.trim().startsWith("EDIT:")) {
              vscode.window.showInformationMessage(result.replace(/^ANSWER:\s*/, ""));
              return;
            }
            result = result.replace(/^EDIT:\s*/, "");

            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(markdown.length)
            );
            edit.replace(editor.document.uri, fullRange, result);
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage(`AI ${actionLabel} complete.`);
          }
        } catch (err) {
          vscode.window.showErrorMessage(
            `AI ${actionLabel} failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.aiPolish", () => runAiAction("polish"))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.aiSummary", () => runAiAction("summary"))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.aiTldr", () => runAiAction("tldr"))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.aiTranslate", async () => {
      const languages = [
        { label: "English", code: "en" },
        { label: "Korean", code: "ko" },
        { label: "Japanese", code: "ja" },
        { label: "Chinese", code: "zh" },
        { label: "Spanish", code: "es" },
        { label: "French", code: "fr" },
        { label: "German", code: "de" },
        { label: "Portuguese", code: "pt" },
      ];
      const selected = await vscode.window.showQuickPick(
        languages.map((l) => ({ label: l.label, description: l.code })),
        { placeHolder: "Translate to..." }
      );
      if (selected) {
        await runAiAction("translate", selected.description);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.aiChat", async () => {
      const instruction = await vscode.window.showInputBox({
        prompt: "Ask AI to edit your document...",
        placeHolder: "e.g. Make the intro shorter",
      });
      if (!instruction) { return; }
      await runAiAction("chat", undefined, instruction);
    })
  );

  // Command: Sync Status
  context.subscriptions.push(
    vscode.commands.registerCommand("mdfy.sync", async () => {
      const items: vscode.QuickPickItem[] = [
        { label: "$(cloud-upload) Publish", description: "Publish current file to Memory.Wiki" },
        { label: "$(arrow-up) Push", description: "Push local changes to Memory.Wiki" },
        { label: "$(arrow-down) Pull", description: "Pull latest from Memory.Wiki" },
        { label: "$(sign-in) Login", description: "Login to Memory.Wiki" },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Memory.Wiki Sync Actions",
      });

      if (!selected) {return;}
      if (selected.label.includes("Publish")) {
        vscode.commands.executeCommand("mdfy.publish");
      } else if (selected.label.includes("Push")) {
        vscode.commands.executeCommand("mdfy.update");
      } else if (selected.label.includes("Pull")) {
        vscode.commands.executeCommand("mdfy.pull");
      } else if (selected.label.includes("Login")) {
        vscode.commands.executeCommand("mdfy.login");
      }
    })
  );

  // Auto-sync on save — always sync published files (has .mdfy.json)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.languageId !== "markdown") { return; }
      // Always push on save if the file is published (has .mdfy.json sidecar)
      // Skip if the user is not the owner
      if (nonOwnerDocs.has(doc.uri.toString())) { return; }
      const config = await loadMdfyConfig(doc.uri.fsPath);
      if (config) {
        syncEngine?.onFileSaved(doc);
      }
    })
  );

  // Track which documents the current user does NOT own (read-only cloud docs)
  const nonOwnerDocs = new Set<string>();

  // Update preview on text change + broadcast collaboration
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === "markdown") {
        PreviewPanel.updateIfActive(e.document);
        // Broadcast local changes to collaboration peers — skip for non-owner docs
        if (!isApplyingRemoteCollab && collabManager?.isActive(e.document.uri) && !nonOwnerDocs.has(e.document.uri.toString())) {
          collabManager.applyLocalChange(e.document.uri, e.document.getText());
        }
      }
    })
  );

  // Update status bar on editor change + start/stop collaboration
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && editor.document.languageId === "markdown") {
        statusBar?.show();

        // Check if published → show URL in status bar + start collaboration
        const cfg = await loadMdfyConfig(editor.document.fileName);
        if (cfg) {
          const base = getApiBaseUrl();
          statusBar?.setPublished(`${base}/${cfg.docId}`);

          // Check ownership — mark non-owner docs to prevent editing/collaboration
          try {
            const remoteDoc = await pullDocument(cfg.docId, authManager);
            if (remoteDoc.isOwner === false) {
              nonOwnerDocs.add(editor.document.uri.toString());
            } else {
              nonOwnerDocs.delete(editor.document.uri.toString());
            }
          } catch {
            // Network error — don't block, ownership unknown
          }

          // Start collaboration if not already active
          if (!collabManager?.isActive(editor.document.uri)) {
            collabManager?.start(
              editor.document.uri,
              cfg.docId,
              editor.document.getText()
            );
          }
        } else {
          statusBar?.setIdle();
          // Stop collaboration for unpublished docs
          if (collabManager?.isActive(editor.document.uri)) {
            collabManager?.stop(editor.document.uri);
          }
        }

        // Auto-open preview if enabled (skip if sidebar just opened it)
        if (!suppressAutoPreview) {
          const autoPreview = vscode.workspace.getConfiguration("Memory.Wiki").get<boolean>("autoPreview", true);
          if (autoPreview) {
            PreviewPanel.createIfNotExists(context.extensionUri, editor.document);
          }
        }
      } else {
        statusBar?.hide();
      }
    })
  );

  // Stop collaboration when documents are closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.languageId === "markdown" && collabManager?.isActive(doc.uri)) {
        collabManager.stop(doc.uri);
      }
    })
  );

  // Start collaboration after publish completes — listen for config creation
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.languageId !== "markdown") return;
      // Check if newly published (has config but no collab session yet)
      const cfg = await loadMdfyConfig(doc.fileName);
      if (cfg && !collabManager?.isActive(doc.uri)) {
        collabManager?.start(doc.uri, cfg.docId, doc.getText());
      }
    })
  );

  // Watch for external file changes on published .md files
  const mdWatcher = vscode.workspace.createFileSystemWatcher("**/*.md");
  context.subscriptions.push(
    mdWatcher.onDidChange(async (uri) => {
      // External change detected — push if published
      const cfg = await loadMdfyConfig(uri.fsPath);
      if (cfg) {
        const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath);
        if (doc) {
          syncEngine?.onFileSaved(doc);
        }
      }
    })
  );
  context.subscriptions.push(mdWatcher);

  // Always start sync polling — published files need cloud change detection
  {
    const config = vscode.workspace.getConfiguration("Memory.Wiki");
    const interval = config.get<number>("syncInterval") ?? 30;
    syncEngine.startPolling(interval);
  }

  // Show status bar + auto-preview if active editor is markdown
  if (
    vscode.window.activeTextEditor?.document.languageId === "markdown"
  ) {
    statusBar.show();
    const activeEditor = vscode.window.activeTextEditor;
    // Check published state for status bar + start collaboration
    loadMdfyConfig(activeEditor.document.fileName).then((cfg) => {
      if (cfg) {
        const base = getApiBaseUrl();
        statusBar?.setPublished(`${base}/${cfg.docId}`);
        // Start collaboration for initially open document
        collabManager?.start(
          activeEditor.document.uri,
          cfg.docId,
          activeEditor.document.getText()
        );
      }
    });
    const autoPreview = vscode.workspace.getConfiguration("Memory.Wiki").get<boolean>("autoPreview", true);
    if (autoPreview) {
      PreviewPanel.createIfNotExists(context.extensionUri, vscode.window.activeTextEditor.document);
    }
  }

  context.subscriptions.push({
    dispose(): void {
      syncEngine?.dispose();
      statusBar?.dispose();
      collabManager?.dispose();
    },
  });
}

export function deactivate(): void {
  syncEngine?.dispose();
  statusBar?.dispose();
  collabManager?.dispose();
}

// --- Helpers ---

function extractTitle(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

export function getAuthManager(): AuthManager | undefined {
  return authManager;
}

export function getApiBaseUrl(): string {
  const config = vscode.workspace.getConfiguration("Memory.Wiki");
  return config.get<string>("apiBaseUrl") ?? "https://memory.wiki";
}

export interface MdfyConfig {
  docId: string;
  editToken: string;
  lastSyncedAt: string;
  lastServerUpdatedAt: string;
}

export async function loadMdfyConfig(
  mdFilePath: string
): Promise<MdfyConfig | undefined> {
  const configPath = getMdfyConfigPath(mdFilePath);
  try {
    const data = await vscode.workspace.fs.readFile(vscode.Uri.file(configPath));
    return JSON.parse(Buffer.from(data).toString("utf-8")) as MdfyConfig;
  } catch {
    return undefined;
  }
}

export async function saveMdfyConfig(
  mdFilePath: string,
  config: MdfyConfig
): Promise<void> {
  const configPath = getMdfyConfigPath(mdFilePath);
  const data = Buffer.from(JSON.stringify(config, null, 2), "utf-8");
  await vscode.workspace.fs.writeFile(vscode.Uri.file(configPath), data);
}

function markdownToSlack(md: string): string {
  // Bold first with placeholder to avoid italic regex matching
  let slack = md.replace(/\*\*(.+?)\*\*/g, "⟦BOLD⟧$1⟦/BOLD⟧");
  slack = slack.replace(/__(.+?)__/g, "⟦BOLD⟧$1⟦/BOLD⟧");
  // Then italic (won't match placeholders)
  slack = slack.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "_$1_");
  // Restore bold
  slack = slack.replace(/⟦BOLD⟧/g, "*").replace(/⟦\/BOLD⟧/g, "*");
  return slack
    // Strikethrough: ~~text~~ → ~text~
    .replace(/~~(.+?)~~/g, "~$1~")
    // Images BEFORE links (![alt](url) contains [alt](url) pattern)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<$2|$1>")
    // Links: [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
    // Headers: # text → *text*
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    // Inline code stays as `code`
    // Code blocks: ```lang\n...\n``` → ```\n...\n```
    .replace(/```\w*\n/g, "```\n")
    // Task lists: - [x] → :white_check_mark:, - [ ] → :white_large_square:
    .replace(/^(\s*)- \[x\]\s/gm, "$1:white_check_mark: ")
    .replace(/^(\s*)- \[ \]\s/gm, "$1:white_large_square: ")
    // Horizontal rule
    .replace(/^---+$/gm, "———");
}

export function getMdfyConfigPath(mdFilePath: string): string {
  const path = require("path");
  const fs = require("fs");
  const dir = path.dirname(mdFilePath);
  const base = path.basename(mdFilePath, path.extname(mdFilePath));
  const newPath = path.join(dir, `.${base}.mdfy.json`);
  // Migrate old visible sidecar to hidden
  const oldPath = path.join(dir, `${base}.mdfy.json`);
  try {
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
    }
  } catch {}
  return newPath;
}
