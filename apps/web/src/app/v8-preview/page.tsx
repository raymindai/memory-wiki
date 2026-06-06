import type { Metadata } from "next";
import { Instrument_Serif, Fraunces } from "next/font/google";
import { PreviewClient } from "./PreviewClient";

// Both load from Google Fonts. Instrument Serif = the safer / calmer
// option, Fraunces = the more variable / characterful option. Render
// both on the page so we can pick by eye.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "v8 Preview — memory.wiki",
  description: "v8 visual direction prototype. Not for production.",
  robots: { index: false, follow: false },
};

export default function V8PreviewPage() {
  return (
    <div className={`${instrumentSerif.variable} ${fraunces.variable}`}>
      <PreviewClient />
    </div>
  );
}
