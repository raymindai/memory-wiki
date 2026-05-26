import type { Metadata } from "next";
import PluginsPure from "./PluginsPure";

export const metadata: Metadata = {
  title: "Plugins and Extensions — Memory.Wiki",
  description:
    "Bring Memory.Wiki everywhere with CLI, Mac desktop app, Chrome extension, VS Code extension, and macOS QuickLook. Capture AI chats, publish from terminal.",
  alternates: {
    canonical: "https://memory.wiki/plugins",
    languages: { ko: "https://memory.wiki/ko/plugins" },
  },
  openGraph: {
    title: "Plugins and Extensions — Memory.Wiki",
    description: "Chrome extension for AI chat capture. VS Code extension, CLI, Mac app, and macOS QuickLook for Markdown.",
    url: "https://memory.wiki/plugins",
    images: [{ url: "/api/og?title=Plugins", width: 1200, height: 630 }],
  },
};

export default function PluginsPage() {
  return <PluginsPure locale="en" />;
}
