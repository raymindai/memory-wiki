import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_KR, JetBrains_Mono } from "next/font/google";
import { ClayMonoVariant } from "./ClayMonoVariant";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto",
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
  title: "v8 Preview — Clay Mono",
  robots: { index: false, follow: false },
};

export default function ClayMonoPage() {
  return (
    <div className={`${notoSans.variable} ${notoSansKR.variable} ${mono.variable}`}>
      <ClayMonoVariant />
    </div>
  );
}
