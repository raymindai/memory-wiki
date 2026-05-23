import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MiroVariant } from "./MiroVariant";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "v8 Preview — Miro",
  robots: { index: false, follow: false },
};

export default function MiroPage() {
  return (
    <div className={inter.variable}>
      <MiroVariant />
    </div>
  );
}
