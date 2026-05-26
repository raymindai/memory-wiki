import type { Metadata } from "next";
import InstallPure from "./InstallPure";

export const metadata: Metadata = {
  title: "Install /memory.wiki in Claude Code | Memory.Wiki",
  description:
    "One-line install for the /memory.wiki slash command in Claude Code. Capture, bundle, and deploy your conversations through your personal Memory.Wiki hub.",
};

export default function InstallPage() {
  return <InstallPure />;
}
