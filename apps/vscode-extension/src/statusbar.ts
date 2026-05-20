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
    this.item.text = "$(markdown) Memory.Wiki";
    this.item.tooltip = "Memory.Wiki - Click for sync actions";
    this.item.backgroundColor = undefined;
  }

  setSynced(): void {
    this.clearResetTimer();
    this.item.text = "$(check) Memory.Wiki";
    this.item.tooltip = "Memory.Wiki - Synced";
    this.item.backgroundColor = undefined;

    // Reset to idle after 5 seconds
    this.resetTimer = setTimeout(() => {
      this.setIdle();
    }, 5000);
  }

  setSyncing(message?: string): void {
    this.clearResetTimer();
    this.item.text = `$(sync~spin) Memory.Wiki`;
    this.item.tooltip = `Memory.Wiki - ${message || "Syncing..."}`;
    this.item.backgroundColor = undefined;
  }

  setConflict(): void {
    this.clearResetTimer();
    this.item.text = "$(warning) Memory.Wiki";
    this.item.tooltip = "Memory.Wiki - Conflict detected. Click to resolve.";
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }

  setPublished(url: string): void {
    this.clearResetTimer();
    this.publishedUrl = url;
    this.item.text = "$(link) Memory.Wiki";
    this.item.tooltip = `${url}\nClick to copy URL`;
    this.item.backgroundColor = undefined;
    this.item.command = "mdfy.copyUrl";
  }

  getPublishedUrl(): string | undefined {
    return this.publishedUrl;
  }

  setCollaborating(peerCount: number): void {
    this.clearResetTimer();
    this.item.text = `$(radio-tower) Memory.Wiki (${peerCount} ${peerCount === 1 ? "peer" : "peers"})`;
    this.item.tooltip = `Memory.Wiki - Live collaboration with ${peerCount} ${peerCount === 1 ? "peer" : "peers"}`;
    this.item.backgroundColor = undefined;
  }

  setCollaboratingLive(): void {
    this.clearResetTimer();
    this.item.text = "$(radio-tower) Memory.Wiki Live";
    this.item.tooltip = "Memory.Wiki - Live collaboration active";
    this.item.backgroundColor = undefined;
  }

  setError(): void {
    this.clearResetTimer();
    this.item.text = "$(error) Memory.Wiki";
    this.item.tooltip = "Memory.Wiki - Sync error";
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
