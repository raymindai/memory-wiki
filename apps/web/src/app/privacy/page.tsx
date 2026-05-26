import type { Metadata } from "next";
import PrivacyPure from "./PrivacyPure";

export const metadata: Metadata = {
  title: "Privacy Policy — Memory.Wiki",
  description: "Privacy Policy for Memory.Wiki and the Memory.Wiki Chrome Extension.",
  alternates: { canonical: "https://memory.wiki/privacy" },
  openGraph: {
    title: "Privacy Policy — Memory.Wiki",
    url: "https://memory.wiki/privacy",
  },
};

export default function PrivacyPage() {
  return <PrivacyPure />;
}
