import type { Metadata } from "next";
import { Inter, Noto_Sans_KR, JetBrains_Mono } from "next/font/google";
import { ModernVariant } from "./ModernVariant";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto-kr",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "v8 Preview — Modern",
  robots: { index: false, follow: false },
};

export default function ModernPage() {
  return (
    <div className={`${inter.variable} ${notoSansKR.variable} ${mono.variable}`}>
      <ModernVariant />
    </div>
  );
}
