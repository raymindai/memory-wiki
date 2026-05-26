"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import "../styles/components/pure-button.css";

/**
 * PureButton — the canonical primary CTA. Always-white pill with
 * multi-color chromatic halo (subtle idle, vivid hover). The single
 * place primary CTA styling lives. Use everywhere.
 */
export function PureButton({
  href,
  children,
  size = "md",
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  external?: boolean;
  className?: string;
}) {
  const cls = `pure-button pure-button-${size}${className ? " " + className : ""}`;
  if (external || href.startsWith("http") || href.startsWith("mailto:")) {
    return <a href={href} className={cls} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}
