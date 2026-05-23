import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { WiseVariant } from "./WiseVariant";

// Wise Sans is proprietary. Manrope at weight 800/900 is the closest
// open-source approximation for the heavy display weight; Inter for
// sub-display + body (Wise actually uses Inter as its secondary face).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "v8 Preview — Wise",
  robots: { index: false, follow: false },
};

export default function WisePage() {
  return (
    <div className={`${inter.variable} ${manrope.variable}`}>
      <WiseVariant />
    </div>
  );
}
