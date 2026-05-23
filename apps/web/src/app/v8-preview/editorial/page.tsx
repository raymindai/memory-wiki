import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import { EditorialVariant } from "./EditorialVariant";

// Cormorant Garamond = closest open-source approximation to Tiempos / Copernicus.
// Weight 500 + negative letter-spacing carries the same editorial slab-serif voice.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "v8 Preview — Editorial (Claude style)",
  robots: { index: false, follow: false },
};

export default function EditorialPage() {
  return (
    <div
      className={`${cormorant.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <EditorialVariant />
    </div>
  );
}
