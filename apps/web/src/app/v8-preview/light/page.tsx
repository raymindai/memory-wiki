import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { LightVariant } from "./LightVariant";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "v8 Preview — Light Paper",
  robots: { index: false, follow: false },
};

export default function LightPage() {
  return (
    <div className={fraunces.variable}>
      <LightVariant />
    </div>
  );
}
