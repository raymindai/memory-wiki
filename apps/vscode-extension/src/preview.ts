import * as vscode from "vscode";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { AuthManager } from "./auth";
import { render as renderMarkdown } from "./render";

export class PreviewPanel {
  private static panels: Map<string, PreviewPanel> = new Map();
  private static readonly viewType = "mwPreview";
  private static authManagerRef: AuthManager | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private trackedDocument: vscode.TextDocument | undefined;
  private isUpdatingFromWebview = false;
  private disposables: vscode.Disposable[] = [];
  public isCloudPreview = false;
  public cloudTitle = "";

  /**
   * Set the shared AuthManager reference for image uploads.
   */
  public static setAuthManager(auth: AuthManager): void {
    PreviewPanel.authManagerRef = auth;
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    const key = document.uri.toString();
    const existing = PreviewPanel.panels.get(key);

    if (existing) {
      existing.trackedDocument = document;
      existing.panel.reveal(column);
      existing.updateContent(document.getText());
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      `Memory.Wiki Preview: ${path.basename(document.fileName)}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );
    panel.iconPath = {
      dark: vscode.Uri.joinPath(extensionUri, "media", "icon-dark.svg"),
      light: vscode.Uri.joinPath(extensionUri, "media", "icon-light.svg"),
    };

    const previewPanel = new PreviewPanel(panel, extensionUri, document);
    PreviewPanel.panels.set(key, previewPanel);
  }

  /**
   * Create a read-only preview for a cloud document (no local file).
   * Shows a banner indicating it's cloud-only and needs sync to edit.
   */
  /**
   * Create a read-only preview for a cloud document.
   * Takes raw markdown string — no TextDocument needed, so no editor tab opens.
   */
  public static createOrShowCloud(
    extensionUri: vscode.Uri,
    markdown: string,
    title: string,
    docId: string
  ): void {
    const key = `cloud:${docId}`;
    const existing = PreviewPanel.panels.get(key);

    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.One);
      existing.updateContent(markdown, title, true);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      `☁ ${title}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );
    panel.iconPath = {
      dark: vscode.Uri.joinPath(extensionUri, "media", "icon-dark.svg"),
      light: vscode.Uri.joinPath(extensionUri, "media", "icon-light.svg"),
    };

    // Create panel without a tracked document (read-only, no source sync)
    const previewPanel = new PreviewPanel(panel, extensionUri);
    previewPanel.isCloudPreview = true;
    previewPanel.cloudTitle = title;
    previewPanel.trackedDocument = undefined;
    PreviewPanel.panels.set(key, previewPanel);
    // Set initial HTML directly
    panel.webview.html = previewPanel.getHtml(markdown);
  }

  /**
   * Create preview panel only if one doesn't already exist for this document.
   * Does NOT steal focus from the editor. Used for auto-preview.
   */
  public static createIfNotExists(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument
  ): void {
    const key = document.uri.toString();
    if (PreviewPanel.panels.has(key)) {
      // Already open — just update content, don't reveal/focus
      const existing = PreviewPanel.panels.get(key)!;
      existing.trackedDocument = document;
      existing.updateContent(document.getText());
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      `Memory.Wiki Preview: ${path.basename(document.fileName)}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );
    panel.iconPath = {
      dark: vscode.Uri.joinPath(extensionUri, "media", "icon-dark.svg"),
      light: vscode.Uri.joinPath(extensionUri, "media", "icon-light.svg"),
    };

    const previewPanel = new PreviewPanel(panel, extensionUri, document);
    PreviewPanel.panels.set(key, previewPanel);
  }

  public static updateIfActive(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const panel = PreviewPanel.panels.get(key);
    if (panel && !panel.isUpdatingFromWebview) {
      panel.updateContent(document.getText());
    }
  }

  /**
   * Render markdown to HTML string (for clipboard/export).
   */
  public static renderToHtml(markdown: string): string {
    return renderMarkdownWithFlavor(markdown).html;
  }

  /**
   * Render markdown to standalone HTML document (for file export).
   */
  public static renderToFullHtml(markdown: string): string {
    const result = renderMarkdownWithFlavor(markdown);
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() || "Document";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.40/katex.min.css">
<style>
body { max-width: 820px; margin: 0 auto; padding: 40px 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.7; color: #fafafa; background: #09090b; }
h1,h2,h3,h4,h5,h6 { font-weight: 700; line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.5em; }
h1 { font-size: 2em; border-bottom: 1px solid #27272a; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #27272a; padding-bottom: 0.25em; }
a { color: #fb923c; text-decoration: none; }
code { font-family: "SF Mono","Fira Code",Consolas,monospace; font-size: 0.9em; background: #27272a; padding: 0.15em 0.4em; border-radius: 4px; }
pre { padding: 16px; background: #1e1e2e; border-radius: 8px; overflow-x: auto; border: 1px solid #27272a; }
pre code { background: transparent; padding: 0; }
blockquote { border-left: 4px solid #fb923c; padding: 0.5em 1em; color: #a1a1aa; background: rgba(251,146,60,0.05); }
table { width: 100%; border-collapse: collapse; }
th,td { padding: 8px 12px; border: 1px solid #27272a; }
th { background: #18181b; font-weight: 600; }
img { max-width: 100%; border-radius: 8px; }
hr { border: none; border-top: 1px solid #27272a; margin: 2em 0; }
</style>
</head>
<body>
${result.html}
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.40/katex.min.js"><\/script>
<script>
document.querySelectorAll('pre[lang] code').forEach(b=>{var l=b.parentElement.getAttribute('lang');if(l)b.className='language-'+l;});
document.querySelectorAll('pre code').forEach(b=>hljs.highlightElement(b));
document.querySelectorAll('[data-math-style]').forEach(el=>{try{katex.render(el.textContent||'',el,{displayMode:el.getAttribute('data-math-style')==='display',throwOnError:false})}catch(e){}});
<\/script>
</body>
</html>`;
  }

  /**
   * Update sync status for the preview panel tracking the given document URI.
   */
  public static updateSyncStatusForDocument(
    uri: vscode.Uri,
    status: string
  ): void {
    const key = uri.toString();
    const panel = PreviewPanel.panels.get(key);
    if (panel) {
      panel.setSyncStatus(status);
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document?: vscode.TextDocument
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.trackedDocument = document;

    if (document) {
      this.panel.webview.html = this.getHtml(document.getText());
    }

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message: {
        type: string;
        markdown?: string;
        data?: string;
        name?: string;
        code?: string;
        lang?: string;
        index?: number;
        target?: string;
        action?: string;
        language?: string;
        instruction?: string;
      }) => {
        switch (message.type) {
          case "edit": {
            if (!message.markdown || !this.trackedDocument) {return;}
            this.isUpdatingFromWebview = true;
            try {
              const edit = new vscode.WorkspaceEdit();
              const fullRange = new vscode.Range(
                this.trackedDocument.positionAt(0),
                this.trackedDocument.positionAt(
                  this.trackedDocument.getText().length
                )
              );
              edit.replace(this.trackedDocument.uri, fullRange, message.markdown);
              await vscode.workspace.applyEdit(edit);
            } finally {
              // Longer delay to fully suppress the echo cycle
              // edit → applyEdit → onDidChangeTextDocument → updateIfActive → must be blocked
              setTimeout(() => {
                this.isUpdatingFromWebview = false;
              }, 500);
            }
            break;
          }
          case "requestUpdate": {
            if (this.trackedDocument) {
              this.updateContent(this.trackedDocument.getText());
            }
            break;
          }
          case "load-images": {
            try {
              const { getApiBaseUrl } = await import("./extension");
              const baseUrl = getApiBaseUrl();
              const token = PreviewPanel.authManagerRef ? await PreviewPanel.authManagerRef.getToken() : undefined;
              if (!token) {
                this.panel.webview.postMessage({ type: "image-data", authenticated: false, images: [], quota: null });
                break;
              }
              const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
              const res = await fetch(`${baseUrl}/api/upload/list`, { headers });
              if (res.ok) {
                const data = (await res.json()) as { images?: unknown[]; quota?: unknown };
                this.panel.webview.postMessage({ type: "image-data", authenticated: true, images: data.images || [], quota: data.quota });
              } else {
                this.panel.webview.postMessage({ type: "image-data", authenticated: true, images: [], quota: null });
              }
            } catch {
              this.panel.webview.postMessage({ type: "image-data", authenticated: false, images: [], quota: null });
            }
            break;
          }
          case "insert-image": {
            const editor = vscode.window.activeTextEditor;
            if (editor && message.name) {
              const url = (message as { url?: string }).url || "";
              const pos = editor.selection.active;
              editor.edit(b => b.insert(pos, `\n![${message.name}](${url})\n`));
            } else {
              vscode.window.showWarningMessage("Open a document to insert the image.");
            }
            break;
          }
          case "login": {
            vscode.commands.executeCommand("memorywiki.login");
            break;
          }
          case "uploadImage": {
            await this.handleImageUpload(message.data, message.name);
            break;
          }
          case "requestImageUrl": {
            const url = await vscode.window.showInputBox({
              prompt: "Enter image URL",
              placeHolder: "https://example.com/image.png",
              validateInput: (value) => {
                if (!value) {return "URL is required";}
                if (!value.startsWith("http://") && !value.startsWith("https://")) {
                  return "URL must start with http:// or https://";
                }
                return null;
              },
            });
            if (url) {
              const alt = await vscode.window.showInputBox({
                prompt: "Alt text (optional)",
                placeHolder: "image",
              });
              this.panel.webview.postMessage({
                type: "insertImage",
                url,
                alt: alt || "image",
              });
            }
            break;
          }
          case "editMermaid": {
            await this.handleMermaidEdit(message.code, message.index);
            break;
          }
          case "asciiRender": {
            await this.handleAsciiRender(message.code);
            break;
          }
          case "editCodeBlock": {
            await this.handleCodeBlockEdit(message.code, message.lang, message.index);
            break;
          }
          case "convertFlavor": {
            await this.handleFlavorConversion(message.target);
            break;
          }
          case "aiAction": {
            await this.handleAiAction(
              message.action,
              message.language,
              message.instruction
            );
            break;
          }
          case "syncToLocal": {
            // Cloud preview → trigger pull to local
            if (this.isCloudPreview) {
              const match = [...PreviewPanel.panels.entries()].find(([, p]) => p === this);
              const docId = match?.[0]?.replace("cloud:", "") || "";
              if (docId) {
                vscode.commands.executeCommand("memorywiki.sidebar.refresh");
                // Pull via sidebar handler — post a message to sidebar
                vscode.window.showInformationMessage(
                  `To sync "${this.cloudTitle}" to local, click the download icon next to it in the sidebar.`,
                  "Open Sidebar"
                ).then(choice => {
                  if (choice === "Open Sidebar") {
                    vscode.commands.executeCommand("workbench.view.extension.memory.wiki");
                  }
                });
              }
            }
            break;
          }
          case "openInBrowser": {
            if (this.isCloudPreview) {
              const match = [...PreviewPanel.panels.entries()].find(([, p]) => p === this);
              const docId = match?.[0]?.replace("cloud:", "") || "";
              if (docId) {
                const baseUrl = vscode.workspace.getConfiguration("Memory.Wiki").get<string>("apiBaseUrl", "https://memory.wiki");
                vscode.env.openExternal(vscode.Uri.parse(`${baseUrl}/${docId}`));
              }
            }
            break;
          }
        }
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(
      () => {
        // Remove from the panels map
        if (this.trackedDocument) {
          PreviewPanel.panels.delete(this.trackedDocument.uri.toString());
        }
        this.dispose();
      },
      null,
      this.disposables
    );
  }

  public setSyncStatus(status: string): void {
    this.panel.webview.postMessage({ type: "syncStatus", status });
  }

  public setPublishedState(docId: string | undefined, url: string | undefined): void {
    this.panel.webview.postMessage({ type: "publishedState", docId, url });
  }

  public static setPublishedStateForDocument(
    uri: vscode.Uri,
    docId: string | undefined,
    url: string | undefined
  ): void {
    const key = uri.toString();
    const panel = PreviewPanel.panels.get(key);
    if (panel) {
      panel.setPublishedState(docId, url);
    }
  }

  private updateContent(markdown: string, cloudTitle?: string, isCloud?: boolean): void {
    const result = renderMarkdownWithFlavor(markdown);
    const cloudBanner = (isCloud || this.isCloudPreview)
      ? `<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:#94a3b8;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13h7.1a3.2 3.2 0 00.6-6.35 4.5 4.5 0 00-8.7 1.1A2.8 2.8 0 004.5 13z"/></svg>
            <span>This is a cloud document. View only — to edit, sync to local or open in Memory.Wiki.</span>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button onclick="vscode.postMessage({type:'syncToLocal'})" style="background:#fb923c;color:#0a0a0c;border:none;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer">Sync to Local</button>
            <button onclick="vscode.postMessage({type:'openInBrowser'})" style="background:transparent;color:#60a5fa;border:1px solid #334155;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer">Open in Memory.Wiki</button>
          </div>
        </div>`
      : "";
    this.panel.webview.postMessage({
      type: "update",
      html: cloudBanner + result.html,
      markdown,
      flavor: result.flavor,
    });
  }

  private async handleMermaidEdit(
    code: string | undefined,
    index: number | undefined
  ): Promise<void> {
    if (!code || !this.trackedDocument) {return;}

    // Open the mermaid code in a new untitled text editor
    const doc = await vscode.workspace.openTextDocument({
      content: code.trim(),
      language: "markdown",
    });

    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });

    // Watch for save on this temp document — replace the mermaid code block
    const disposable = vscode.workspace.onDidSaveTextDocument(async (saved) => {
      if (saved.uri.toString() !== doc.uri.toString()) {return;}
      if (!this.trackedDocument) {return;}

      const newCode = saved.getText().trim();
      const mdText = this.trackedDocument.getText();

      // Find all mermaid code blocks and replace the one at the given index
      const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)```/g;
      let match: RegExpExecArray | null;
      let blockIndex = 0;

      let newMd = mdText;
      mermaidBlockRegex.lastIndex = 0;
      while ((match = mermaidBlockRegex.exec(mdText)) !== null) {
        if (blockIndex === (index ?? 0)) {
          const before = mdText.substring(0, match.index);
          const after = mdText.substring(match.index + match[0].length);
          newMd = before + "```mermaid\n" + newCode + "\n```" + after;
          break;
        }
        blockIndex++;
      }

      if (newMd !== mdText) {
        this.isUpdatingFromWebview = true;
        try {
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            this.trackedDocument.positionAt(0),
            this.trackedDocument.positionAt(mdText.length)
          );
          edit.replace(this.trackedDocument.uri, fullRange, newMd);
          await vscode.workspace.applyEdit(edit);
          // Re-render
          this.updateContent(newMd);
        } finally {
          setTimeout(() => {
            this.isUpdatingFromWebview = false;
          }, 100);
        }
      }
    });

    // Clean up when the temp editor is closed
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((closed) => {
      if (closed.uri.toString() === doc.uri.toString()) {
        disposable.dispose();
        closeDisposable.dispose();
      }
    });

    this.disposables.push(disposable, closeDisposable);
  }

  private async handleAsciiRender(code: string | undefined): Promise<void> {
    if (!code || !this.trackedDocument) { return; }

    const auth = PreviewPanel.authManagerRef;
    const userId = await auth?.getUserId();
    if (!auth || !userId) {
      const action = await vscode.window.showInformationMessage(
        "Sign in to Memory.Wiki to use ASCII to Mermaid conversion.",
        "Sign in"
      );
      if (action === "Sign in") {
        vscode.commands.executeCommand("memorywiki.login");
      }
      return;
    }

    const apiBaseUrl = vscode.workspace
      .getConfiguration("Memory.Wiki")
      .get<string>("apiBaseUrl", "https://memory.wiki");

    const token = await auth.getToken();

    this.panel.webview.postMessage({ type: "asciiRenderStart" });

    try {
      const docText = this.trackedDocument.getText();
      const response = await fetch(`${apiBaseUrl}/api/ascii-to-mermaid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ascii: code, context: docText.substring(0, 2000) }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { mermaid?: string; html?: string };
      const mermaidCode = data.mermaid;
      if (!mermaidCode) { throw new Error("No mermaid code returned"); }

      // Replace ASCII block with ```mermaid block in the document
      const fullText = this.trackedDocument.getText();
      const idx = fullText.indexOf(code);
      if (idx !== -1) {
        // Find enclosing ``` block
        const before = fullText.lastIndexOf("```", idx);
        const after = fullText.indexOf("```", idx + code.length);
        if (before !== -1 && after !== -1) {
          const edit = new vscode.WorkspaceEdit();
          const startPos = this.trackedDocument.positionAt(before);
          const endPos = this.trackedDocument.positionAt(after + 3);
          edit.replace(this.trackedDocument.uri, new vscode.Range(startPos, endPos), "```mermaid\n" + mermaidCode + "\n```");
          await vscode.workspace.applyEdit(edit);
        }
      }

      this.panel.webview.postMessage({ type: "asciiRenderComplete" });
    } catch (err) {
      vscode.window.showErrorMessage(
        `Convert to Mermaid failed: ${err instanceof Error ? err.message : String(err)}`
      );
      this.panel.webview.postMessage({ type: "asciiRenderFailed" });
    }
  }

  private async handleCodeBlockEdit(
    code: string | undefined,
    lang: string | undefined,
    index: number | undefined
  ): Promise<void> {
    if (!code || !this.trackedDocument) { return; }

    // Let user change the language
    const newLang = await vscode.window.showInputBox({
      prompt: "Code block language",
      value: lang || "",
      placeHolder: "e.g. javascript, python, rust",
    });
    if (newLang === undefined) { return; } // cancelled

    // Open code in a temp editor for editing
    const langId = newLang || "plaintext";
    const doc = await vscode.workspace.openTextDocument({
      content: code.trim(),
      language: langId,
    });

    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });

    // Watch for save — replace the code block in source
    const disposable = vscode.workspace.onDidSaveTextDocument(async (saved) => {
      if (saved.uri.toString() !== doc.uri.toString()) { return; }
      if (!this.trackedDocument) { return; }

      const newCode = saved.getText().trim();
      const mdText = this.trackedDocument.getText();

      // Find all fenced code blocks (excluding mermaid) at the given index
      const codeBlockRegex = /```(\w*)\s*\n([\s\S]*?)```/g;
      let match: RegExpExecArray | null;
      let blockIndex = 0;
      let nonMermaidIndex = 0;

      let newMd = mdText;
      codeBlockRegex.lastIndex = 0;
      while ((match = codeBlockRegex.exec(mdText)) !== null) {
        const blockLang = match[1];
        if (blockLang === "mermaid") {
          blockIndex++;
          continue;
        }
        if (nonMermaidIndex === (index ?? 0)) {
          const before = mdText.substring(0, match.index);
          const after = mdText.substring(match.index + match[0].length);
          newMd = before + "```" + (newLang || "") + "\n" + newCode + "\n```" + after;
          break;
        }
        nonMermaidIndex++;
        blockIndex++;
      }

      if (newMd !== mdText) {
        this.isUpdatingFromWebview = true;
        try {
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            this.trackedDocument.positionAt(0),
            this.trackedDocument.positionAt(mdText.length)
          );
          edit.replace(this.trackedDocument.uri, fullRange, newMd);
          await vscode.workspace.applyEdit(edit);
          this.updateContent(newMd);
        } finally {
          setTimeout(() => {
            this.isUpdatingFromWebview = false;
          }, 100);
        }
      }
    });

    const closeDisposable = vscode.workspace.onDidCloseTextDocument((closed) => {
      if (closed.uri.toString() === doc.uri.toString()) {
        disposable.dispose();
        closeDisposable.dispose();
      }
    });

    this.disposables.push(disposable, closeDisposable);
  }

  private async handleFlavorConversion(
    target: string | undefined
  ): Promise<void> {
    if (!target || !this.trackedDocument) {return;}

    const mdText = this.trackedDocument.getText();
    const currentResult = renderMarkdownWithFlavor(mdText);
    const currentFlavor = currentResult.flavor.primary;
    let converted = mdText;

    // Obsidian → other: convert wikilinks and callouts
    if (currentFlavor === "obsidian" && target !== "obsidian") {
      // [[page|display]] → [display](page)
      converted = converted.replace(
        /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
        "[$2]($1)"
      );
      // [[page]] → [page](page)
      converted = converted.replace(/\[\[([^\]]+)\]\]/g, "[$1]($1)");
      // > [!note] callouts → > **Note:**
      converted = converted.replace(
        /^>\s*\[!(\w+)\]\s*(.*)$/gm,
        "> **$1:** $2"
      );
    }

    // other → Obsidian: self-referencing links to wikilinks
    if (target === "obsidian" && currentFlavor !== "obsidian") {
      converted = converted.replace(/\[([^\]]+)\]\(\1\)/g, "[[$1]]");
    }

    // MDX → any: strip JSX and imports
    if (currentFlavor === "mdx") {
      converted = converted.replace(/<[A-Z]\w+[^>]*\/>/g, "");
      converted = converted.replace(
        /<[A-Z]\w+[^>]*>[\s\S]*?<\/[A-Z]\w+>/g,
        ""
      );
      converted = converted.replace(/^import\s+.*$/gm, "");
      converted = converted.replace(/^export\s+default\s+.*$/gm, "");
    }

    // any → CommonMark: strip GFM extensions
    if (target === "commonmark") {
      converted = converted.replace(/~~([^~]+)~~/g, "$1");
      converted = converted.replace(/^(\s*)- \[[ x]\] /gm, "$1- ");
    }

    // Clean up excessive blank lines
    converted = converted.replace(/\n{3,}/g, "\n\n").trim();

    if (converted === mdText.trim()) {
      this.panel.webview.postMessage({
        type: "flavorConvertResult",
        changed: false,
      });
      return;
    }

    // Apply the converted text
    this.isUpdatingFromWebview = true;
    try {
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        this.trackedDocument.positionAt(0),
        this.trackedDocument.positionAt(mdText.length)
      );
      edit.replace(this.trackedDocument.uri, fullRange, converted + "\n");
      await vscode.workspace.applyEdit(edit);
      this.updateContent(converted + "\n");
      this.panel.webview.postMessage({
        type: "flavorConvertResult",
        changed: true,
      });
    } finally {
      setTimeout(() => {
        this.isUpdatingFromWebview = false;
      }, 100);
    }
  }

  private async handleAiAction(
    action: string | undefined,
    language?: string,
    instruction?: string
  ): Promise<void> {
    if (!action) { return; }

    const markdown = this.trackedDocument
      ? this.trackedDocument.getText()
      : "";
    if (!markdown.trim()) {
      this.panel.webview.postMessage({ type: "aiResult", error: "Document is empty." });
      return;
    }

    const auth = PreviewPanel.authManagerRef;
    const loggedIn = await auth?.isLoggedIn();
    if (!auth || !loggedIn) {
      this.panel.webview.postMessage({ type: "aiResult", error: "Sign in to use AI features." });
      const choice = await vscode.window.showWarningMessage(
        "Sign in to Memory.Wiki to use AI features.",
        "Sign in"
      );
      if (choice === "Sign in") {
        vscode.commands.executeCommand("memorywiki.login");
      }
      return;
    }

    this.panel.webview.postMessage({ type: "aiLoading", loading: true });

    try {
      const { getApiBaseUrl } = await import("./extension");
      const baseUrl = getApiBaseUrl();
      const token = await auth.getToken();

      const body: Record<string, string> = { action, markdown };
      if (language) { body.language = language; }
      if (instruction) { body.instruction = instruction; }

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
        const isAnswer = action === "chat" && !result.trim().startsWith("EDIT:");
        result = result.replace(/^(EDIT:|ANSWER:)\s*/, "");

        if (isAnswer) {
          this.panel.webview.postMessage({ type: "aiResult", result, action, isAnswer: true });
        } else {
          // Apply changes to document
          if (this.trackedDocument) {
            const shouldReplace = (action === "polish" || action === "translate" || action === "chat");
            let newText: string;
            if (shouldReplace) {
              newText = result;
            } else {
              newText = result + "\n\n---\n\n" + markdown;
            }

            this.isUpdatingFromWebview = true;
            try {
              const edit = new vscode.WorkspaceEdit();
              const fullRange = new vscode.Range(
                this.trackedDocument.positionAt(0),
                this.trackedDocument.positionAt(markdown.length)
              );
              edit.replace(this.trackedDocument.uri, fullRange, newText);
              await vscode.workspace.applyEdit(edit);
              this.updateContent(newText);
            } finally {
              setTimeout(() => { this.isUpdatingFromWebview = false; }, 500);
            }
          }
          this.panel.webview.postMessage({ type: "aiResult", result, action, isAnswer: false });
        }
      }
    } catch (err) {
      this.panel.webview.postMessage({
        type: "aiResult",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.panel.webview.postMessage({ type: "aiLoading", loading: false });
    }
  }

  private async handleImageUpload(
    dataUrl: string | undefined,
    name: string | undefined
  ): Promise<void> {
    if (!dataUrl) {
      this.panel.webview.postMessage({ type: "imageUploadFailed" });
      return;
    }

    const auth = PreviewPanel.authManagerRef;
    const userId = await auth?.getUserId();
    if (!auth || !userId) {
      vscode.window.showWarningMessage(
        "Sign in to Memory.Wiki to upload images (memory.wiki: Login)."
      );
      this.panel.webview.postMessage({ type: "imageUploadFailed" });
      return;
    }

    try {
      // Parse base64 data URL
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex === -1) {
        throw new Error("Invalid data URL");
      }
      const base64Data = dataUrl.substring(commaIndex + 1);
      const mimeMatch = dataUrl.match(/^data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const imageBuffer = Buffer.from(base64Data, "base64");

      const ext = name?.split(".").pop() || "png";
      const fileName = name || `image.${ext}`;

      const apiBaseUrl = vscode.workspace
        .getConfiguration("Memory.Wiki")
        .get<string>("apiBaseUrl", "https://memory.wiki");

      // Build multipart/form-data manually
      const boundary =
        "----memorywikiUpload" + Math.random().toString(36).substring(2);
      const parts: Buffer[] = [];

      // File part
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
            `Content-Type: ${mimeType}\r\n\r\n`
        )
      );
      parts.push(imageBuffer);
      parts.push(Buffer.from("\r\n"));

      // End boundary
      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      // Make the HTTP request
      const url = new URL(`${apiBaseUrl}/api/upload`);
      const isHttps = url.protocol === "https:";
      const requestModule = isHttps ? https : http;

      const result = await new Promise<{ url: string }>((resolve, reject) => {
        const req = requestModule.request(
          {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: "POST",
            headers: {
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
              "Content-Length": body.length,
              "x-user-id": userId,
            },
          },
          (res) => {
            let data = "";
            res.on("data", (chunk: Buffer) => {
              data += chunk.toString();
            });
            res.on("end", () => {
              try {
                const json = JSON.parse(data);
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && json.url) {
                  resolve(json);
                } else {
                  reject(
                    new Error(json.error || `HTTP ${res.statusCode}`)
                  );
                }
              } catch {
                reject(new Error(`Invalid response: ${data.substring(0, 200)}`));
              }
            });
          }
        );

        req.on("error", reject);
        req.write(body);
        req.end();
      });

      // Send the uploaded URL back to the webview
      this.panel.webview.postMessage({
        type: "imageUploaded",
        url: result.url,
        alt: fileName.replace(/\.[^.]+$/, ""),
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Image upload failed: ${errMsg}`);
      this.panel.webview.postMessage({ type: "imageUploadFailed" });
    }
  }

  private getHtml(markdown: string): string {
    const webview = this.panel.webview;

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "preview.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "preview.js")
    );

    const nonce = getNonce();
    const result = renderMarkdownWithFlavor(markdown);
    const cloudBanner = this.isCloudPreview
      ? `<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:#94a3b8;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13h7.1a3.2 3.2 0 00.6-6.35 4.5 4.5 0 00-8.7 1.1A2.8 2.8 0 004.5 13z"/></svg>
            <span>This is a cloud document. View only — to edit, sync to local or open in Memory.Wiki.</span>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button onclick="vscode.postMessage({type:'syncToLocal'})" style="background:#fb923c;color:#0a0a0c;border:none;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer">Sync to Local</button>
            <button onclick="vscode.postMessage({type:'openInBrowser'})" style="background:transparent;color:#60a5fa;border:1px solid #334155;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer">Open in Memory.Wiki</button>
          </div>
        </div>`
      : "";
    const renderedHtml = cloudBanner + result.html;

    const themeSetting = vscode.workspace
      .getConfiguration("Memory.Wiki")
      .get<string>("theme", "auto");

    let themeClass: string;
    if (themeSetting === "auto") {
      const kind = vscode.window.activeColorTheme.kind;
      themeClass =
        kind === vscode.ColorThemeKind.Light ||
        kind === vscode.ColorThemeKind.HighContrastLight
          ? "light"
          : "dark";
    } else {
      themeClass = themeSetting;
    }

    const cdnBase = "https://cdnjs.cloudflare.com/ajax/libs";

    return `<!DOCTYPE html>
<html lang="en" data-theme="${themeClass}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;">
  <link rel="stylesheet" href="${cdnBase}/highlight.js/11.11.1/styles/github-dark.min.css">
  <link rel="stylesheet" href="${cdnBase}/KaTeX/0.16.40/katex.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/theme/material-darker.css">
  <link rel="stylesheet" href="${cssUri}">
  ${this.isCloudPreview ? `<style>
    #formatting-toolbar, #live-formatting-toolbar, #source-view, #split-divider, .toolbar-group, #selection-toolbar { display: none !important; }
    #live-pane { width: 100% !important; height: 100% !important; }
    #content-wrapper { flex: 1; min-height: 0; }
    #content-scroll { height: 100%; }
    body { cursor: default; }
    article[contenteditable="false"] { user-select: text; cursor: default; }
  </style>` : ""}
  <title>Memory.Wiki Preview</title>
</head>
<body${this.isCloudPreview ? ' class="live-mode"' : ""}>
  <!-- Loading state -->
  <div id="loading-overlay" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:1000;transition:opacity 0.3s">
    <div style="text-align:center">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px"><span style="color:var(--accent)">Memory</span><span style="color:var(--fg)">.Wiki</span></div>
      <div style="width:40px;height:2px;background:var(--border);border-radius:1px;margin:0 auto;overflow:hidden"><div style="width:50%;height:100%;background:var(--accent);border-radius:1px;animation:loadbar 1s ease-in-out infinite"></div></div>
    </div>
  </div>
  <style>@keyframes loadbar{0%{transform:translateX(-100%)}50%{transform:translateX(100%)}100%{transform:translateX(-100%)}}</style>
  <!-- Global toolbar: logo + view mode only -->
  <div id="toolbar">
    <a class="toolbar-logo" href="https://memory.wiki" target="_blank" style="text-decoration:none;cursor:pointer"><span style="color:var(--accent)">Memory</span><span style="color:var(--fg)">.Wiki</span></a>
    <div class="view-switcher" style="margin-left:6px">
      <button class="view-btn active" data-view="live" title="Live preview"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5.5 6l2.5 2-2.5 2"/><line x1="9" y1="10" x2="11.5" y2="10"/></svg> Live</button>
      <button class="view-btn" data-view="split" title="Split view"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="1" y="2" width="14" height="12" rx="2"/><line x1="8" y1="2" x2="8" y2="14"/></svg> Split</button>
      <button class="view-btn" data-view="source" title="Source view"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M4 3.5L1.5 6L4 8.5M12 3.5l2.5 2.5L12 8.5M9 2l-2 12"/></svg> Source</button>
    </div>
  </div>

  <div id="editor-wrapper">
    <!-- Live pane: own header + content -->
    <div id="live-pane">
      <!-- Live pane header: label + toggle icons (like Memory.Wiki) -->
      <div id="live-header" class="pane-header">
        <span class="pane-label" style="color:var(--accent)">LIVE</span>
        <span style="flex:1"></span>
        <button id="btn-toggle-toolbar" class="pane-icon-btn active" title="Formatting toolbar">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 4h14M1 8h14M1 12h14"/><circle cx="5" cy="4" r="1.5" fill="currentColor"/><circle cx="10" cy="8" r="1.5" fill="currentColor"/><circle cx="7" cy="12" r="1.5" fill="currentColor"/></svg>
        </button>
        <button id="btn-toggle-narrow" class="pane-icon-btn active" title="Narrow view">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4 2v12M12 2v12M1 8h3M12 8h3" stroke-linecap="round"/><path d="M6 6.5L8 8l-2 1.5M10 6.5L8 8l2 1.5" stroke-linecap="round"/></svg>
        </button>
        <span style="width:1px;height:14px;background:var(--border);margin:0 2px;opacity:0.3"></span>
        <button class="pane-icon-btn" id="btn-toggle-images" title="My images">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M1.5 11l3-3 2 2 3-3 5 4"/></svg>
        </button>
        <button class="pane-icon-btn active" id="btn-toggle-outline" title="Document outline">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 3h12M4 6.5h10M4 10h10M2 13.5h12"/></svg>
        </button>
        <button class="pane-icon-btn" id="btn-toggle-ai" title="AI Tools">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>
        </button>
        <button class="pane-icon-btn" id="btn-export" title="Export">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 10v3h10v-3M8 9V2M5 4.5L8 2l3 2.5"/></svg>
        </button>
      </div>
      <!-- Collapsible formatting toolbar -->
      <div id="live-formatting-toolbar" class="pane-toolbar">
        <button data-action="undo" title="Undo"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 7h7a3 3 0 010 6H8"/><path d="M6 4L3 7l3 3"/></svg></button>
        <button data-action="redo" title="Redo"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 7H6a3 3 0 000 6h2"/><path d="M10 4l3 3-3 3"/></svg></button>
        <span class="toolbar-divider"></span>
        <button data-action="h1" title="H1"><span style="font-size:10px;font-weight:700">H1</span></button>
        <button data-action="h2" title="H2"><span style="font-size:10px;font-weight:700">H2</span></button>
        <button data-action="h3" title="H3"><span style="font-size:10px;font-weight:600">H3</span></button>
        <button data-action="h4" title="H4"><span style="font-size:10px">H4</span></button>
        <button data-action="h5" title="H5"><span style="font-size:10px">H5</span></button>
        <button data-action="h6" title="H6"><span style="font-size:10px">H6</span></button>
        <button data-action="p" title="P"><span style="font-size:10px">P</span></button>
        <span class="toolbar-divider"></span>
        <button data-action="bold" title="Bold"><span style="font-weight:700;font-size:12px">B</span></button>
        <button data-action="italic" title="Italic"><span style="font-style:italic;font-size:12px">I</span></button>
        <button data-action="strikethrough" title="S"><span style="text-decoration:line-through;font-size:12px">S</span></button>
        <button data-action="code" title="Code"><span style="font-family:monospace;font-size:10px">&lt;/&gt;</span></button>
        <span class="toolbar-divider"></span>
        <button data-action="ul" title="Bullet list"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="4" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="3" cy="12" r="1"/><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg></button>
        <button data-action="ol" title="Numbered list"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><text x="1" y="5" font-size="4.5" font-weight="700">1</text><text x="1" y="9" font-size="4.5" font-weight="700">2</text><text x="1" y="13" font-size="4.5" font-weight="700">3</text><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg></button>
        <button data-action="task" title="Task list"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="5" height="5" rx="1"/><path d="M3.5 4.5l1 1 2-2" stroke-linecap="round"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="3" width="5" height="2" rx="0.5" fill="currentColor"/><rect x="9" y="10" width="5" height="2" rx="0.5" fill="currentColor"/></svg></button>
        <button data-action="indent" title="Indent"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h10M7 8h6M7 12h6M3 7l2 1.5L3 10"/></svg></button>
        <button data-action="outdent" title="Outdent"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h10M7 8h6M7 12h6M5 7l-2 1.5L5 10"/></svg></button>
        <span class="toolbar-divider"></span>
        <button data-action="blockquote" title="Quote"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3h4v4H5.5L4 10H3V3zm6 0h4v4h-1.5L10 10H9V3z"/></svg></button>
        <button data-action="hr" title="Horizontal rule"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="8" x2="14" y2="8"/></svg></button>
        <span class="toolbar-divider"></span>
        <button data-action="link" title="Link"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 8.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1"/><path d="M9.5 7.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1"/></svg></button>
        <button data-action="image" title="Image"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.2"/><path d="M2 11l3.5-3 2.5 2 3-2.5L14 11" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button data-action="removeFormat" title="Clear"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 13h10M6 3l-2.5 7h9L10 3"/><line x1="4" y1="8" x2="12" y2="8"/></svg></button>
        <span class="toolbar-divider"></span>
        <button data-action="table" title="Table"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="2" y1="6" x2="14" y2="6"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="6" y1="2" x2="6" y2="14"/><line x1="10" y1="2" x2="10" y2="14"/></svg></button>
        <button data-action="codeblock" title="Code block"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M5 4L2 8l3 4M11 4l3 4-3 4M9 2l-2 12"/></svg></button>
        <button data-action="math" title="Math"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><text x="2" y="12" font-size="11" font-family="serif" font-style="italic">fx</text></svg></button>
        <button data-action="mermaid" title="Mermaid"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="2" y="1" width="5" height="4" rx="1"/><rect x="9" y="1" width="5" height="4" rx="1"/><rect x="5.5" y="11" width="5" height="4" rx="1"/><path d="M4.5 5v2.5a2 2 0 002 2h3a2 2 0 002-2V5"/><path d="M8 9.5V11"/></svg></button>
      </div>
      <div id="content-wrapper">
        <div id="content-scroll">
        <article id="content" class="mdcore-rendered narrow" contenteditable="${this.isCloudPreview ? "false" : "true"}">
          ${renderedHtml}
        </article>
        </div><!-- end content-scroll -->
        <div id="image-panel" style="display:none;width:260px;flex-shrink:0;border-left:1px solid var(--border);overflow-y:auto;background:var(--bg)">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border)">
            <span style="font-size:11px;font-weight:600;color:var(--fg)">My Images</span>
            <button id="btn-close-images" style="background:none;border:none;cursor:pointer;color:var(--fg-muted);padding:2px" title="Close">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>
          </div>
          <div id="image-panel-content" style="padding:8px">
            <div style="text-align:center;padding:24px 8px;color:var(--fg-muted);font-size:11px">Loading...</div>
          </div>
        </div>
        <div id="outline-panel" class="outline-panel">
          <div class="outline-panel-header">
            <span class="pane-label">OUTLINE</span>
            <button class="pane-icon-btn" id="btn-close-outline" title="Close">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>
          </div>
          <div class="outline-panel-body" id="outline-panel-body"></div>
        </div>
        <div id="ai-panel" class="ai-panel hidden">
          <div class="ai-panel-header">
            <span class="pane-label" style="color:var(--accent)">AI TOOLS</span>
            <span style="flex:1"></span>
            <button class="pane-icon-btn" id="ai-undo-btn" title="Undo last AI change" style="display:none">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 7h7a3 3 0 010 6H8"/><path d="M6 4L3 7l3 3"/></svg>
            </button>
            <button class="pane-icon-btn" id="ai-panel-close" title="Close">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>
          </div>
          <div class="ai-panel-actions">
            <button class="ai-action-btn" data-ai-action="polish"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg><span>Polish</span></button>
            <button class="ai-action-btn" data-ai-action="summary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h14"/></svg><span>Summary</span></button>
            <button class="ai-action-btn" data-ai-action="tldr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h8"/></svg><span>TL;DR</span></button>
            <button class="ai-action-btn" data-ai-action="translate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3M11 21l5-10 5 10M14.5 18h5"/></svg><span>Translate</span></button>
          </div>
          <div class="ai-panel-chat" id="ai-chat-history"></div>
          <div class="ai-panel-input-row">
            <input type="text" id="ai-chat-input" placeholder="Ask AI to edit..." spellcheck="false">
            <button id="ai-chat-send" title="Send">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Draggable divider for split view -->
    <div id="split-divider"></div>

    <!-- Source pane: header with flavor + copy + download -->
    <div id="source-view" class="hidden">
      <div id="source-header" class="pane-header">
        <span class="pane-label" style="color:var(--accent)">SOURCE</span>
        <div style="position:relative;display:flex;align-items:center">
          <button id="flavor-badge" class="pane-badge" title="Markdown flavor">${result.flavor.primary.toUpperCase()} &#9662;</button>
          <div id="flavor-dropdown" class="flavor-dropdown hidden" style="position:absolute;top:100%;left:0;margin-top:4px;min-width:180px;padding:4px;border-radius:8px;background:var(--surface);border:1px solid var(--border);box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:999">
            <div style="padding:4px 8px;font-size:9px;color:var(--fg-muted);text-transform:uppercase;letter-spacing:0.5px">Convert to</div>
            <button class="flavor-option" data-flavor="gfm" style="display:block;width:100%;text-align:left;padding:6px 8px;border:none;background:none;color:var(--fg);font-size:11px;cursor:pointer;border-radius:4px"><b>GFM</b> <span style="color:var(--fg-muted);font-size:10px">Tables, task lists</span></button>
            <button class="flavor-option" data-flavor="commonmark" style="display:block;width:100%;text-align:left;padding:6px 8px;border:none;background:none;color:var(--fg);font-size:11px;cursor:pointer;border-radius:4px"><b>CommonMark</b> <span style="color:var(--fg-muted);font-size:10px">Standard</span></button>
            <button class="flavor-option" data-flavor="obsidian" style="display:block;width:100%;text-align:left;padding:6px 8px;border:none;background:none;color:var(--fg);font-size:11px;cursor:pointer;border-radius:4px"><b>Obsidian</b> <span style="color:var(--fg-muted);font-size:10px">Wikilinks, callouts</span></button>
          </div>
        </div>
        <span style="flex:1"></span>
        <button class="pane-icon-btn" id="btn-copy-md" title="Copy Markdown">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>
        </button>
      </div>
      <div id="source-editor-container"></div>
      <textarea id="source-editor" style="display:none">${markdown.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
    </div>
  </div>

  <div id="selection-toolbar">
    <button data-action="undo" title="Undo"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 7h7a3 3 0 010 6H8"/><path d="M6 4L3 7l3 3"/></svg></button>
    <button data-action="redo" title="Redo"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 7H6a3 3 0 000 6h2"/><path d="M10 4l3 3-3 3"/></svg></button>
    <span class="sel-divider"></span>
    <button data-action="h1" data-block="h1" title="Heading 1"><span class="sel-label">H1</span></button>
    <button data-action="h2" data-block="h2" title="Heading 2"><span class="sel-label">H2</span></button>
    <button data-action="h3" data-block="h3" title="Heading 3"><span class="sel-label">H3</span></button>
    <button data-action="h4" data-block="h4" title="Heading 4"><span class="sel-label sel-light">H4</span></button>
    <button data-action="h5" data-block="h5" title="Heading 5"><span class="sel-label sel-light">H5</span></button>
    <button data-action="h6" data-block="h6" title="Heading 6"><span class="sel-label sel-light">H6</span></button>
    <button data-action="p" data-block="p" title="Paragraph"><span class="sel-label">P</span></button>
    <span class="sel-divider"></span>
    <button data-action="bold" data-fmt="bold" title="Bold"><span style="font-weight:700;font-size:13px">B</span></button>
    <button data-action="italic" data-fmt="italic" title="Italic"><span style="font-style:italic;font-size:13px">I</span></button>
    <button data-action="strikethrough" data-fmt="strikethrough" title="Strikethrough"><span style="text-decoration:line-through;font-size:13px">S</span></button>
    <button data-action="code" data-fmt="code" title="Inline code"><span style="font-family:monospace;font-size:11px">&lt;/&gt;</span></button>
    <span class="sel-divider"></span>
    <button data-action="ul" data-fmt="ul" title="Bullet list"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="4" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="3" cy="12" r="1"/><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg></button>
    <button data-action="ol" data-fmt="ol" title="Numbered list"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><text x="1" y="5" font-size="4.5" font-weight="700">1</text><text x="1" y="9" font-size="4.5" font-weight="700">2</text><text x="1" y="13" font-size="4.5" font-weight="700">3</text><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg></button>
    <button data-action="indent" title="Indent"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h10M7 8h6M7 12h6M3 7l2 1.5L3 10"/></svg></button>
    <button data-action="outdent" title="Outdent"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h10M7 8h6M7 12h6M5 7l-2 1.5L5 10"/></svg></button>
    <span class="sel-divider"></span>
    <button data-action="blockquote" data-block="blockquote" title="Blockquote"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3h4v4H5.5L4 10H3V3zm6 0h4v4h-1.5L10 10H9V3z"/></svg></button>
    <button data-action="hr" title="Horizontal rule"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="8" x2="14" y2="8"/></svg></button>
    <span class="sel-divider"></span>
    <button data-action="link" title="Link"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 8.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1"/><path d="M9.5 7.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1"/></svg></button>
    <button data-action="image" title="Image"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.2"/><path d="M2 11l3.5-3 2.5 2 3-2.5L14 11" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button data-action="table" title="Insert table"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="2" y1="6" x2="14" y2="6"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="6" y1="2" x2="6" y2="14"/><line x1="10" y1="2" x2="10" y2="14"/></svg></button>
    <button data-action="removeFormat" title="Clear formatting"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 13h10M6 3l-2.5 7h9L10 3"/><line x1="4" y1="8" x2="12" y2="8"/></svg></button>
  </div>


  <div id="bottom-bar-removed" style="display:none">
  </div>

  <!-- Syntax highlighting -->
  <script nonce="${nonce}" src="${cdnBase}/highlight.js/11.11.1/highlight.min.js"></script>
  <!-- KaTeX math rendering -->
  <script nonce="${nonce}" src="${cdnBase}/KaTeX/0.16.40/katex.min.js"></script>
  <!-- Mermaid diagrams -->
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/mermaid@11.13.0/dist/mermaid.min.js"></script>
  <!-- CodeMirror for source view (load order matters: xml before markdown, overlay before gfm) -->
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.js"></script>
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/mode/overlay.min.js"></script>
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/xml/xml.min.js"></script>
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/javascript/javascript.min.js"></script>
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/css/css.min.js"></script>
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/yaml/yaml.min.js"></script>
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/meta.min.js"></script>
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/markdown/markdown.min.js"></script>
  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/gfm/gfm.min.js"></script>

  <script nonce="${nonce}">
    window.__initialMarkdown = ${JSON.stringify(markdown)};
    window.__initialFlavor = ${JSON.stringify(result.flavor)};

    // Post-process: syntax highlighting — copy lang from <pre lang="X"> to <code class="language-X">
    document.querySelectorAll('pre[lang] code').forEach(function(block) {
      var lang = block.parentElement.getAttribute('lang');
      if (lang && lang !== 'mermaid') {
        block.className = 'language-' + lang;
      }
    });
    document.querySelectorAll('pre code').forEach(function(block) {
      if (typeof hljs !== 'undefined') hljs.highlightElement(block);
    });

    // Post-process: KaTeX math
    document.querySelectorAll('[data-math-style]').forEach(function(el) {
      if (typeof katex !== 'undefined') {
        try {
          katex.render(el.textContent || '', el, {
            displayMode: el.getAttribute('data-math-style') === 'display',
            throwOnError: false
          });
        } catch(e) {}
      }
    });

    // Post-process: Mermaid diagrams — save original code before rendering
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: '${themeClass === "dark" ? "dark" : "default"}' });
      document.querySelectorAll('pre[lang="mermaid"] code, code.language-mermaid').forEach(function(el) {
        var container = document.createElement('div');
        container.className = 'mermaid';
        var originalCode = el.textContent || '';
        container.setAttribute('data-original-code', originalCode);
        container.textContent = originalCode;
        el.closest('pre').replaceWith(container);
      });
      mermaid.run();
      // Mermaid edit buttons are added by preview.js after it initializes
    }
    // Dismiss loading overlay
    var loadingEl = document.getElementById('loading-overlay');
    if (loadingEl) { loadingEl.style.opacity = '0'; setTimeout(function() { loadingEl.remove(); }, 300); }
  </script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

interface FlavorInfo {
  primary: string;
  math: boolean;
  mermaid: boolean;
  wikilinks: boolean;
  jsx: boolean;
}

interface RenderResult {
  html: string;
  flavor: FlavorInfo;
}

function renderMarkdownWithFlavor(markdown: string): RenderResult {
  try {
    // Same render pipeline as Memory.Wiki's web viewers (Phase 2 of the
    // WASM-to-markdown-it migration) — keeps preview output in sync
    // with what the user will see at memory.wiki/<id> after they publish.
    const result = renderMarkdown(markdown);
    const f = result.flavor;
    return {
      html: result.html,
      flavor: {
        primary: f.primary,
        math: f.math,
        mermaid: f.mermaid,
        wikilinks: f.wikilinks,
        jsx: f.jsx,
      },
    };
  } catch {
    return {
      html: `<p style="color:red">Render error</p>`,
      flavor: { primary: "gfm", math: false, mermaid: false, wikilinks: false, jsx: false },
    };
  }
}

function getNonce(): string {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
