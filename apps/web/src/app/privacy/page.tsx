import type { Metadata } from "next";
import PrivacyPure from "./PrivacyPure";

export const metadata: Metadata = {
  title: "Privacy Policy — memory.wiki",
  description: "Privacy Policy for memory.wiki and the memory.wiki Chrome Extension.",
  alternates: { canonical: "https://memory.wiki/privacy" },
  openGraph: {
    title: "Privacy Policy — memory.wiki",
    url: "https://memory.wiki/privacy",
  },
};

export default function PrivacyPage() {
  return <PrivacyPure />;
}
