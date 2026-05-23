import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { LovableVariant } from "./LovableVariant";

// Plus Jakarta Sans = closest open-source approximation to Camera Plain Variable.
// Humanist sans with rounded terminals, variable weight (we use 400 + 600).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "v8 Preview — Lovable",
  robots: { index: false, follow: false },
};

export default function LovablePage() {
  return (
    <div className={jakarta.variable}>
      <LovableVariant />
    </div>
  );
}
