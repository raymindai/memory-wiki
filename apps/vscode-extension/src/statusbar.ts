import * as vscode from "vscode";

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private resetTimer: NodeJS.Timeout | undefined;
  private publishedUrl: string | undefined;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = "mdfy.sync";
    this.setIdle();
  }

  show(): void {
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  setIdle(): void {
    this.clearResetTimer();
    this.publishedUrl = undefined;
    this.item.text = "$(markdown) memory.wiki";
    this.item.tooltip = "memory.wiki - Click for sync actions";
    this.item.backgroundColor = undefined;
  }

  setSynced(): void {
    this.clearResetTimer();
    this.item.text = "$(check) memory.wiki";
    this.item.tooltip = "memory.wiki - Synced";
    this.item.backgroundColor = undefined;

    // Reset to idle after 5 seconds
    this.resetTimer = setTimeout(() => {
      this.setIdle();
    }, 5000);
  }

  setSyncing(message?: string): void {
    this.clearResetTimer();
    this.item.text = `$(sync~spin) memory.wiki`;
    this.item.tooltip = `memory.wiki - ${message || "Syncing..."}`;
    this.item.backgroundColor = undefined;
  }

  setConflict(): void {
    this.clearResetTimer();
    this.item.text = "$(warning) memory.wiki";
    this.item.tooltip = "memory.wiki - Conflict detected. Click to resolve.";
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }

  setPublished(url: string): void {
    this.clearResetTimer();
    this.publishedUrl = url;
    this.item.text = "$(link) memory.wiki";
    this.item.tooltip = `${url}\nClick to copy URL`;
    this.item.backgroundColor = undefined;
    this.item.command = "mdfy.copyUrl";
  }

  getPublishedUrl(): string | undefined {
    return this.publishedUrl;
  }

  setCollaborating(peerCount: number): void {
    this.clearResetTimer();
    this.item.text = `$(radio-tower) memory.wiki (${peerCount} ${peerCount === 1 ? "peer" : "peers"})`;
    this.item.tooltip = `memory.wiki - Live collaboration with ${peerCount} ${peerCount === 1 ? "peer" : "peers"}`;
    this.item.backgroundColor = undefined;
  }

  setCollaboratingLive(): void {
    this.clearResetTimer();
    this.item.text = "$(radio-tower) memory.wiki Live";
    this.item.tooltip = "memory.wiki - Live collaboration active";
    this.item.backgroundColor = undefined;
  }

  setError(): void {
    this.clearResetTimer();
    this.item.text = "$(error) memory.wiki";
    this.item.tooltip = "memory.wiki - Sync error";
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );

    // Reset to idle after 10 seconds
    this.resetTimer = setTimeout(() => {
      this.setIdle();
    }, 10000);
  }

  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  dispose(): void {
    this.clearResetTimer();
    this.item.dispose();
  }
}
