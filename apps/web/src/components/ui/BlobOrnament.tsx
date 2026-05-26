import type { CSSProperties } from "react";

/**
 * BlobOrnament — decorative MW blob mark, masked from one of the 11
 * variations in /brand/blobs and tinted with any color. Pure CSS mask,
 * no JS runtime cost.
 *
 * Usage:
 *   <BlobOrnament v={3} size={240} color="var(--text-primary)" opacity={0.1} />
 *   <BlobOrnament v="random" size={120} />  // seed-by-key for stability across renders
 */

const BLOB_COUNT = 11;

function pickVariation(v: number | "random" | undefined, seed?: string): number {
  if (typeof v === "number") return Math.min(Math.max(1, v), BLOB_COUNT);
  if (v === "random" && seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return (h % BLOB_COUNT) + 1;
  }
  if (v === "random") return Math.floor(Math.random() * BLOB_COUNT) + 1;
  return 1;
}

export interface BlobOrnamentProps {
  /** 1-11, or "random". When "random" with `seed`, deterministic per seed. */
  v?: number | "random";
  /** When `v="random"`, pick deterministically from this seed string. */
  seed?: string;
  size?: number | string;
  color?: string;
  opacity?: number;
  rotate?: number;
  /** Positioning helpers — all optional, all CSS values. */
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  /** `absolute` (default) or `relative` for inline flow */
  position?: "absolute" | "relative" | "fixed";
  className?: string;
  style?: CSSProperties;
}

export function BlobOrnament({
  v = 1,
  seed,
  size = 200,
  color = "var(--text-primary)",
  opacity = 0.12,
  rotate = 0,
  top, left, right, bottom,
  position = "absolute",
  className,
  style,
}: BlobOrnamentProps) {
  const idx = pickVariation(v, seed);
  const url = `url(/brand/blobs/mwblob_${String(idx).padStart(2, "0")}.svg)`;
  return (
    <span
      aria-hidden
      className={className}
      style={{
        position,
        top, left, right, bottom,
        width: size,
        height: size,
        background: color,
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        opacity,
        pointerEvents: "none",
        display: "inline-block",
        ...style,
      }}
    />
  );
}
