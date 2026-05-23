import type { Metadata } from "next";
import { FrontierVariant } from "./FrontierVariant";

export const metadata: Metadata = {
  title: "v8 Preview — Frontier",
  robots: { index: false, follow: false },
};

export default function FrontierPage() {
  return <FrontierVariant />;
}
