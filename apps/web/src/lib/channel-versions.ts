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
    version: "2.7.4",
    size: "510 KB",
    primaryUrl:
      "https://chromewebstore.google.com/detail/mdfycc-%E2%80%94-publish-ai-outpu/nkmkgmebaeaiapjgmmalbeilggfhnold",
    primaryLabel: "Add to Chrome",
    secondaryUrl: "/downloads/memory-wiki-clipper-2.7.4.zip",
    secondaryLabel: "Download v2.7.4 zip",
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
    primaryUrl:
      "https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode",
    primaryLabel: "Install from Marketplace",
    secondaryUrl:
      "https://github.com/raymindai/memory-wiki/releases?q=vscode",
    secondaryLabel: "All versions on GitHub",
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
    version: "1.0",
    primaryUrl: "#",
    primaryLabel: "Google Play (coming soon)",
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
