/**
 * Deterministic user-color assignment for collab features
 * (presence avatars, remote cursors).
 *
 * Why deterministic: the same user should get the same color
 * across reconnects, devices, and sessions — otherwise other
 * collaborators see a confusing "person X switched colors" when
 * a peer just refreshed. We hash userId → palette index instead
 * of cycling per-join.
 *
 * Palette: 8 hues that read clearly on both --background tones
 * (zinc-950 dark, paper-white light). Picked for max contrast
 * against the orange brand accent and against each other so two
 * collaborators are visually distinct even when their indices
 * are adjacent. All chosen at ~70% saturation / 60% lightness
 * so the avatar dot doesn't shout.
 */

const PALETTE = [
  "#60a5fa", // sky-400
  "#4ade80", // green-400
  "#a78bfa", // violet-400
  "#fbbf24", // amber-400
  "#f472b6", // pink-400
  "#22d3ee", // cyan-400
  "#fb7185", // rose-400
  "#c4b5fd", // violet-300
] as const;

/** Cheap, stable string hash — DJB2 variant. Enough to spread
 *  evenly across 8 buckets for any realistic userId space. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function userColor(userId: string | null | undefined): string {
  if (!userId) return PALETTE[0];
  return PALETTE[hashString(userId) % PALETTE.length];
}

/** Translucent variant for cursor selection bands. */
export function userColorTint(userId: string | null | undefined, alpha = 0.18): string {
  const hex = userColor(userId);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
