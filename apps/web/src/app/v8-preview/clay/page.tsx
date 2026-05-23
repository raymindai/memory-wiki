import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_KR } from "next/font/google";
import { ClayVariant } from "./ClayVariant";

// Multi-language primary face. Pairs Latin + Korean Noto for proper
// glyph coverage when the page mixes 한글 + English.
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

export const metadata: Metadata = {
  title: "v8 Preview — Clay",
  robots: { index: false, follow: false },
};

export default function ClayPage() {
  return (
    <div className={`${notoSans.variable} ${notoSansKR.variable}`}>
      <ClayVariant />
    </div>
  );
}
