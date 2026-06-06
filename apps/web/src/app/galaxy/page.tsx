import type { Metadata } from "next";
import GalaxyPageClient from "./GalaxyPageClient";

// /galaxy — owner's full hub as a force-laid-out graph. Renders the
// same MdEditor shell as the root route; MdEditor reads the pathname
// on mount and boots with showGalaxy=true so the user sees the editor
// chrome (sidebar + toolbar + tabs) with the Galaxy overlay layered
// on top. Refreshing or deep-linking /galaxy preserves the frame
// instead of stripping to a bare standalone canvas like the old
// page did. See claude memory `start_growing_hub_concept_2026_05`.

export const metadata: Metadata = {
  title: "Galaxy — memory.wiki",
  description: "Your hub as a constellation. Concepts and docs, connected.",
  robots: { index: false, follow: false }, // owner-only surface
};

export default function GalaxyPage() {
  return <GalaxyPageClient />;
}
