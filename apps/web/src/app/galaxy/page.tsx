import type { Metadata } from "next";
import GalaxyClient from "./GalaxyClient";

// /galaxy — owner's full hub as a force-laid-out graph. Pulled out of
// the Start-tab embed (HubConstellation) so the visualization has its
// own real estate: search, filter pills, click-to-details panel,
// zoom-aware labels, full-page canvas. See claude memory
// `start_growing_hub_concept_2026_05` for design + iteration history.

export const metadata: Metadata = {
  title: "Galaxy — Memory.Wiki",
  description: "Your hub as a constellation. Concepts and docs, connected.",
  robots: { index: false, follow: false }, // owner-only surface
};

export default function GalaxyPage() {
  return <GalaxyClient />;
}
