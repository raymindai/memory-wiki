import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GlassVariant } from "./GlassVariant";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "v8 Preview — Liquid Glass",
  robots: { index: false, follow: false },
};

export default function GlassPage() {
  return (
    <div className={inter.variable}>
      <GlassVariant />
    </div>
  );
}
