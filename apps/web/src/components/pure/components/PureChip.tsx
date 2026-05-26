"use client";

import { type ReactNode } from "react";
import "../styles/components/pure-chip.css";

/**
 * PureChip — atomic translucent pill, ink text, optional small
 * leading element (status dot, provider icon, etc.).
 */
export function PureChip({
  children,
  href,
  leading,
  muted = false,
  className = "",
  onClick,
}: {
  children: ReactNode;
  href?: string;
  leading?: ReactNode;
  /** Render in a muted, "+ more" style (smaller, transparent bg). */
  muted?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const cls = `trust-chip${muted ? " pure-eco-more mono" : ""}${className ? " " + className : ""}`;
  const content = <>{leading}{children}</>;
  if (href) {
    return <a href={href} className={cls} onClick={onClick}>{content}</a>;
  }
  return <span className={cls} onClick={onClick}>{content}</span>;
}
