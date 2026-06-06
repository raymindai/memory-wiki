import type { Metadata } from "next";
import InstallPure from "./InstallPure";

export const metadata: Metadata = {
  title: "Install /memory.wiki in Claude Code | memory.wiki",
  description:
    "One-line install for the /memory.wiki slash command in Claude Code. Capture, bundle, and deploy your conversations through your personal memory.wiki hub.",
};

export default function InstallPage() {
  return <InstallPure />;
}
