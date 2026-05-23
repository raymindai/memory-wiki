import type { Metadata } from "next";
import { Inter, Noto_Sans_KR, JetBrains_Mono } from "next/font/google";
import { FrontierVariant } from "./FrontierVariant";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-kr",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "v8 Preview — Frontier",
  robots: { index: false, follow: false },
};

export default function FrontierPage() {
  return (
    <div className={`${inter.variable} ${notoSansKR.variable} ${mono.variable}`}>
      <FrontierVariant />
    </div>
  );
}
