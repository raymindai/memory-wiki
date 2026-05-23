import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { MonoVariant } from "./MonoVariant";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "v8 Preview — Dark Edge Mono",
  robots: { index: false, follow: false },
};

export default function MonoPage() {
  return (
    <div className={`${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
      <MonoVariant />
    </div>
  );
}
