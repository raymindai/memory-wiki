/**
 * channel-versions.ts — single source of truth for every distribution
 * channel's current version + canonical install URL. Update this file
 * when you publish a new release; surfaces that need it
 * (/plugins, /docs, marketing pages, etc) read straight from here so
 * versions can't drift between pages.
 */

export type Channel =
  | "chrome"
  | "safari"
  | "vscode"
  | "desktop"
  | "ios"
  | "android"
  | "cli"
  | "mcp"
  | "quicklook";

export interface ChannelInfo {
  version: string;          // semver shown on download buttons
  size?: string;            // human-readable size, where applicable
  primaryUrl: string;       // canonical install / store link
  primaryLabel: string;     // user-facing label for the primary button
  secondaryUrl?: string;    // optional alternate (direct download, github, etc.)
  secondaryLabel?: string;
}

export const CHANNELS: Record<Channel, ChannelInfo> = {
  chrome: {
    version: "2.7.6",
    size: "515 KB",
    primaryUrl:
      "https://chromewebstore.google.com/detail/mdfycc-%E2%80%94-publish-ai-outpu/nkmkgmebaeaiapjgmmalbeilggfhnold",
    primaryLabel: "Add to Chrome",
    secondaryUrl: "/downloads/memory-wiki-clipper-2.7.6.zip",
    secondaryLabel: "Download v2.7.6 zip",
  },

  safari: {
    version: "2.7.4",
    primaryUrl: "#",
    primaryLabel: "App Store (coming soon)",
    secondaryUrl: "https://github.com/raymindai/memory-wiki/releases",
    secondaryLabel: "Builds on GitHub Releases",
  },

  vscode: {
    version: "1.7.0",
    size: "VSIX",
    primaryUrl:
      "https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode",
    primaryLabel: "Install from Marketplace",
    secondaryUrl:
      "https://github.com/raymindai/memory-wiki/releases/download/vscode-v1.7.0/memory-wiki-vscode-1.7.0.vsix",
    secondaryLabel: "Download v1.7.0 vsix",
  },

  desktop: {
    version: "2.7.5",
    size: "Apple Silicon",
    primaryUrl: "https://github.com/raymindai/memory-wiki/releases/latest",
    primaryLabel: "Download v2.7.5 dmg",
    secondaryUrl: "#",
    secondaryLabel: "Mac App Store (coming soon)",
  },

  ios: {
    version: "1.0",
    primaryUrl: "https://apps.apple.com/us/app/memory-wiki/id6774713489",
    primaryLabel: "Get on the App Store",
  },

  android: {
    version: "1.0.0",
    size: "APK",
    primaryUrl: "#",
    primaryLabel: "Google Play (coming soon)",
    secondaryUrl:
      "https://github.com/raymindai/memory-wiki/releases/download/android-v1.0.0/memory-wiki-1.0.0.apk",
    secondaryLabel: "Download v1.0.0 apk",
  },

  cli: {
    version: "1.4.3",
    primaryUrl: "https://www.npmjs.com/package/memory-wiki-cli",
    primaryLabel: "Install from npm",
  },

  mcp: {
    version: "1.5.4",
    primaryUrl: "https://www.npmjs.com/package/memory-wiki-mcp",
    primaryLabel: "Install from npm",
  },

  quicklook: {
    version: "bundled with Desktop",
    primaryUrl: "https://github.com/raymindai/memory-wiki/releases/latest",
    primaryLabel: "Get memory.wiki for Mac",
  },
};
