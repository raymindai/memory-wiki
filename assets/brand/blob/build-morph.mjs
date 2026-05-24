// Build animated morph SVG from mwblob_01..11.
//
// Two independent animation tracks:
//   1. Main blob (largest path per frame) — Flubber vertex morph, sampled SMIL <animate d>.
//   2. Satellites (circles + small accent paths) — per-slot <circle> with <animate cx/cy/r>.
//
// Slot identity is preserved across frames via greedy nearest-neighbor matching, so
// satellites glide between positions instead of teleporting. Satellites that have no
// match in the next frame collapse to r=0 in place; new satellites grow from r=0.

import pkg from 'flubber';
import svgpath from 'svgpath';
import fs from 'node:fs';

const { interpolate } = pkg;

const SIZE_W = 220;
const SIZE_H = 200;
const CX = SIZE_W / 2;
const CY = SIZE_H / 2;

const FRAMES_PER_PAIR = 8;
const MAX_SEG = 12;
const DURATION = '22s';

// ----- helpers --------------------------------------------------------------

const shift = (d, tx, ty) => svgpath(d).translate(tx, ty).round(3).toString();

function pathBBox(d) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  svgpath(d).abs().unarc().iterate((seg, _idx, curX, curY) => {
    const push = (x, y) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };
    push(curX, curY);
    const args = seg.slice(1);
    for (let i = 0; i < args.length; i += 2) push(args[i], args[i + 1]);
  });
  return { minX, minY, maxX, maxY };
}

function pathToBoundingCircle(d) {
  const { minX, minY, maxX, maxY } = pathBBox(d);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    r: Math.max(maxX - minX, maxY - minY) / 2,
  };
}

// ----- source blobs ---------------------------------------------------------
// Per-blob: viewBox dims, the main path string, and satellites either as circles
// or as paths (auto-converted to a bounding circle).

const blobs = [
  { vbW: 182.32, vbH: 188.54,
    main: 'M112.16,161.09c3.81,8.85-.88,18.9-7.78,23.53-8,5.37-17.59,5.24-25.48-.57-6.69-4.92-10.82-14.51-7.05-23.4,4.02-9.5,2.56-21.01-7.28-26.09l-1.71-.88c-3.81-1.96-7.1-4.74-9.94-7.95-5.12-5.78-13.21-7.68-20.68-4.4-7.39,3.25-14.86,3.57-22.01-.91C4.45,116.81.07,110.03,0,102.14c-.06-7.37,2.57-13.88,8.03-18.09s12.51-6.7,19.22-4.24c6.18,2.26,11.88,2.17,17.36-1.17,5.47-3.34,6.58-8.71,8.7-15.41,2.49-7.87,12.05-14.43,20.22-16.12,8.74-1.8,18.21-6.12,19.42-15.86.87-7,1.48-13.84,7.19-18.45s12.57-6.67,20.01-5.07,13.26,6.29,15.66,12.16c2.89,7.07,2.31,15.51-3.26,20.84-5.97,5.72-9.01,14.82-3.15,21.95,3.45,4.2,5.18,8.98,6.38,14.22,2.67,11.64,14.8,15.19,25.3,13.52,7.92-1.26,15.22,5.05,18.35,10.57,4.09,7.22,3.72,15.41-.37,22.26-7.13,11.92-22.06,12.9-32.34,4.93-7.63-5.92-16.62-1.86-23.6,2.07-11.37,6.4-16.49,18-10.96,30.86Z',
    sats: [
      { cx: 62.57,  cy: 14.69,  r: 14.69 },
      { cx: 24.47,  cy: 48,     r: 13.95 },
      { cx: 143.12, cy: 161.01, r: 13.96 },
      { cx: 41.25,  cy: 159.57, r: 13.73 },
      { cx: 163.42, cy: 61.57,  r: 12.99 },
    ],
  },
  { vbW: 174.22, vbH: 187.77,
    main: 'M142.7,84.11c11.06-9.17,10.79-25.05,2.09-34.85-8.59-9.68-24.28-11.05-34.43-1.41-9.62,9.13-24.92,12.74-36.21,3.5-5.64-4.62-11.58-8.61-19.58-6.26-6.22,1.83-11.55,6.81-13.88,13.98-1.91,5.87-8.62,7.89-14.48,7.99-9.31.15-17.34,6.09-21.5,12.67-5.35,8.44-6.08,17.87-2.45,26.66,4.82,11.65,16.29,18.78,29.06,16.87,8.29-1.24,17.12.67,22.19,8.47,3.51,5.4,4.91,13.13,2.92,18.98-3.12,9.2-3.2,18.87,2.93,26.56,7.08,8.89,18,12.5,29.09,9.45,9.77-2.69,15.79-11.04,18.91-21.41,2.22-7.38,11.4-10.21,18.21-10.53,8.47-.4,14.51-7.37,16.72-13.84,3.02-8.87-1.24-15.88-6.34-22.07-9.43-11.44-3.37-26.36,6.74-34.74Z',
    sats: [
      { cx: 89.87, cy: 19.55, r: 19.55 },
      { path: 'M161.75,94.03c-6.89,0-12.47,5.58-12.47,12.47s5.58,12.47,12.47,12.47,12.47-5.58,12.47-12.47-5.58-12.47-12.47-12.47Z' },
      { path: 'M27.2,140.92c-6.06,2.37-7.8,9.22-5.31,14.23,2.39,4.81,8,6.9,13.3,4.85,5.43-2.1,7.48-7.56,5.3-13.41-1.74-4.67-7.45-7.96-13.3-5.67Z' },
    ],
  },
  { vbW: 201.43, vbH: 188.54,
    main: 'M165.27,163.61c-8.51,2.12-14.3,5.77-18.41,12.89-6.01,10.41-18.77,14.44-29.31,10.61-11.76-4.27-17.83-16.13-15.12-28.86,1.11-5.21-.53-11.02-3.73-14.99-8.26-10.23-26.19-1.29-35.8-20.18-4.81-9.46-3.89-19.45,1.47-27.85,3.85-6.03,5.58-12.84,2.91-20.24-2.13-5.9-8.2-9.61-15.19-12.26-10.07-3.82-15.75-14.68-17.07-24.23-1.54-11.13,3.39-21.52,11.91-29.09,12.4-11.03,30.02-12.26,44.53-4.21,7.6,4.21,16.05,4.92,24.18,2.15,18.16-6.2,36.54,3.95,42.55,21.83,2.38,7.08,9.16,11.76,15.94,14.05,12.32,4.15,21.39,13.91,24.83,23.95,4.67,13.62,2.59,27.2-4.93,38.06-5.23,7.55-7.15,14.86-6.24,24.25,1.46,15.09-7.11,30.29-22.51,34.13Z',
    sats: [
      { cx: 48.44, cy: 157.53, r: 20.62 },
      { cx: 20.47, cy: 96.67,  r: 20.47 },
    ],
  },
  { vbW: 184.73, vbH: 188.54,
    main: 'M52.22,182.44c-8.26-6.35-11-14.98-10.82-24.68.16-8.46-5.94-17.29-14.57-18.29-12.45-1.44-22.2-9.07-25.49-19.9-3.77-12.4.64-24.68,10.29-31.67s23.76-7.19,33.31.48c3.39,2.72,6.75,4.29,11.24,3.79,3.13-.35,8.38-2.82,9.16-7.13,2.84-15.73,16.96-26.22,33.07-22.55,6.25,1.42,12.16.95,17.55-2.89,4.89-3.48,7.32-8.83,8.4-15.52,2.47-15.44,17.29-25.14,32.36-22.1,14.67,2.95,24.63,17.81,20.73,32.98-3.68,14.35-16.95,23.12-31.36,20.81-13.49-2.16-24.34,6.56-26.63,19.52-1.88,10.64.74,21.91,10.88,27.95,12.55,7.48,18.93,21.76,13.03,35.71-5.62,13.27-20.35,20.35-34.56,15.89-8.08-2.54-14.66,1.61-20.19,6.73-9.96,9.21-25.71,9.08-36.38.88Z',
    sats: [
      { cx: 44.48,  cy: 44.74,  r: 19.08 },
      { cx: 168.7,  cy: 117.75, r: 16.03 },
      { cx: 100.33, cy: 15.2,   r: 15.2 },
    ],
  },
  { vbW: 183.88, vbH: 190.53,
    main: 'M59.7,186.68c-17.82,9.05-31.89.58-36.95-9.42s-3.76-20.17.99-29.51c5.4-10.63-.79-21.94-9.67-28.1C3.15,112.08-1.25,98.49.3,85.64c2.66-22.05,22.73-36.39,44.49-32.39,15.34,2.82,32.02-7.46,32.59-23.67.38-10.89,3.68-20.39,12.82-25.7,9.22-5.36,20.55-5.43,29.28,1.48,7.63,6.04,10.9,15.53,8.86,25.04-1.82,8.5-8.17,16.3-17.29,19.16-7.77,2.44-13.4,8.26-13.69,16.35-.25,6.88,4.35,15.73,12.23,17.24,15.48,2.96,26.75,14.64,27.47,30.86.43,9.71-3.59,18.72-10.04,24.77-7.87,7.38-17.31,8.8-27.76,7.6-11.16-1.29-22.74,5.9-24.45,17.17-1.48,9.79-5.47,18.24-15.11,23.14Z',
    sats: [
      { cx: 158.14, cy: 64.15,  r: 16.82 },
      { cx: 168.76, cy: 125.17, r: 15.12 },
    ],
  },
  { vbW: 175.86, vbH: 189.8,
    main: 'M117.52,184.64c-10.33,6.68-25.36,7.13-35.56-.09-4.74-3.36-7.65-11.73-8.01-17.09-.51-7.76-1.95-14.19-7.95-18.37-5.67-3.94-14.16-5.78-20.64-1.89-13.75,8.26-30.83,4.81-39.34-9.28-5.71-9.44-5-20.98,1.1-30.24,5.63-8.55,15.94-13.3,27.02-12.33,12.05,1.06,22.45-6.69,25.43-18.28,2.36-9.2-.38-18.23-6.12-25.63-9.41-12.14-9.76-28.57.02-40.16C63.03-.08,79.57-3.43,92.87,3.86c12.99,7.12,19.64,23.18,14.39,37.75-1.6,4.44-.7,8.91,2.36,11.66,4.04,3.62,8.82,2.46,12.93-.32,17.69-11.94,34.77-.59,41.56,12.21,6.79,12.79,11.76,34.34-19.72,40.01-20.14,3.63-25.11,29.38-17.33,47.82,4.81,11.38,1.64,24.42-9.55,31.66Z',
    sats: [
      { cx: 14.85,  cy: 56.29,  r: 14.85 },
      { cx: 161.43, cy: 142.17, r: 14.43 },
    ],
  },
  { vbW: 203.09, vbH: 189.01,
    main: 'M32.38,120.48c7.48-8.8,6.25-22.81-2.74-29.21-6.19-4.4-27.42-9.43-29.32-26.25-1.9-16.82,4.74-29.21,18.97-34.9,17.73-7.09,35.8,10.53,42.02,21.33s19.45,19.16,32.65,14.15c11.41-4.33,17.82-14.24,18.16-26.33.33-11.95,8.23-22.3,17.71-26.79,11.51-5.45,23.99-4.11,33.75,3.77,9.22,7.44,13.36,19.39,10.43,31.36-2.4,9.8-10.12,19.3-21.2,22.74-13.02,4.05-21.86,14.84-21.53,28.42.31,12.83,9.36,25.94,23.38,27,13.01.99,23.92,8.76,27.61,20.54,3.99,12.76-1.62,25.78-11.81,32.4-11.83,7.68-25.47,4.95-35.63-3.54-14.6-12.2-33.24-7.99-46.25,3.94-19.2,17.59-49.83,10.5-62.36-11.53-8.87-15.59-5.4-33.47,6.19-47.1Z',
    sats: [
      { cx: 83.86,  cy: 16.33, r: 16.33 },
      { cx: 187.37, cy: 100.8, r: 15.72 },
    ],
  },
  { vbW: 172.81, vbH: 187.77,
    main: 'M56.27,148.38c-4.43,12.06-14.83,13.45-24.77,13.09s-18.77-6.21-22.98-15.37c-5.6-12.17-.79-23.84,7.75-32.83,8.44-8.88,8.97-27.82-2.65-31.77S-.65,71.1.12,62.33c.31-8.51,7.32-15.28,15.14-16.79,9.61-1.85,15.93,3.48,20.85,11.41,4.66,7.52,24.5,18.39,39.92,10.12s14.57-22.22,12.89-31.96c-2.11-12.26,2.94-23.85,12.58-30.17,10.42-6.84,23.87-6.65,34.01,1.1,7.96,6.08,12.1,16.3,10.42,26.03-1.63,9.45-7.97,18.49-17.74,21.99-9.72,3.49-16.62,14.05-12.85,24.13,2.12,5.67,3.23,11.11,3.6,17.1.67,10.8,10.37,16.32,20.14,17.54,10.91,1.36,18.58,10.95,20.92,19.99,2.91,11.22-1.22,22.13-9.71,29.02-8.49,6.89-37.32,11.97-44.19-10.67-4.15-13.69-12.22-21.71-24.88-21.32s-21.22,8.32-24.96,18.53Z',
    sats: [
      { cx: 153.98, cy: 79.45,  r: 18.83 },
      { cx: 53.02,  cy: 23.5,   r: 18.74 },
      { cx: 77.76,  cy: 170.84, r: 16.93 },
    ],
  },
  { vbW: 186.15, vbH: 189.04,
    main: 'M118.42,122.16c-4.74,15.54-34.12,16.75-41.77-1.07-2.61-6.07-6.41-10.61-11.95-12.67-5.94-2.2-14.44-2.37-18.67,2.71-5.24,6.29-10.95,10.68-19.1,11.29-7.92.6-15.39-2.79-20.9-9.32-8.05-9.54-8-23.78-.05-33.24,9.74-11.58,25.12-12.25,36.32-2.88,4.41,3.69,11.51,2.09,16.72-.38,4.22-2.01,7.26-6.76,8.62-12.45,1.72-6.9-1.03-13.27-6.87-16.43-2.63-1.42-5.01-3.29-6.69-5.76-5.3-7.8-5.53-17.63-.11-25.74,6.1-9.14,18.12-13.42,28.68-8.75,9.96,4.41,16.79,15.73,13.34,26.94-1.39,4.53-2.21,8.94.48,13.06,2.26,3.47,7.03,5.58,11.82,5.66,5.91.1,9.75,3.08,13.41,6.59,6.4,6.14,15.17,4.13,21.9.1,11.68-7,26.23-3.68,34.99,5.89,8.98,9.82,10.06,24.4,2.73,35.8-9.09,14.14-25.59,16.96-39.84,9.69-9.36-4.77-18.33-4.58-23.06,10.96Z',
    sats: [
      { cx: 84.04,  cy: 168.27, r: 20.77 },
      { cx: 152.46, cy: 19.66,  r: 19.66 },
      { cx: 138.33, cy: 151.62, r: 18.37 },
    ],
  },
  { vbW: 179.84, vbH: 194.28,
    main: 'M37.91,137.81c-10.49-8.24-3.67-13.43-18.94-19.38C3.39,112.37-3.97,94.56,2.15,79.49c6.29-15.48,23.91-22.54,39.89-16.05,16.25,6.6,35.08,9.28,46-4.63,8.42-10.72,22.8-14.34,34.41-6.89,6.85,4.39,10.75,11.51,11.22,18.74.54,8.19-2.67,15.51-9.01,20.76-4.38,3.63-7.03,8.85-7.04,14.24s2.23,11.74,7.45,14.57c9.48,5.14,16.06,14.14,16.45,24.44.42,10.95-5.01,21.1-15.1,26.65-13.21,7.27-31.33,3.38-39.24-9.96-13.47-22.71-38.79-15.32-49.28-23.56Z',
    sats: [
      { cx: 47.95,  cy: 176.01, r: 18.27 },
      { cx: 68.43,  cy: 23.74,  r: 23.74 },
      { cx: 162.06, cy: 86.03,  r: 17.77 },
    ],
  },
  { vbW: 183.41, vbH: 188.6,
    main: 'M0,107.38c0-16.44,12.72-28.39,28.05-29.93,3.52-.35,6.97-1.44,9.81-3.55,3.48-2.59,6.07-6.16,7.56-10.32.91-2.54,1.05-5.28.78-7.97-1.25-12.61,5.32-24.58,16.86-30.31,11.79-5.86,27.18-4.19,37.59,5.14,5.1,4.57,7.72,10.41,11,16.32,6.94,12.5,20.57,17.64,34.06,15.37,7.52-1.27,15.35.15,21.89,3.72,10.55,5.76,16.48,16.73,15.75,28.11-.73,11.38-8.11,21.63-18.88,25.92-6.22,2.47-11.7,2.79-18.37,2.19-11.21-1.02-23.06,7.91-24.22,19.23s-8.11,19.73-18.63,21.79c-11.45,2.24-20.28-4.54-25.42-14.58-7.25-14.15-24.33-17.95-38.19-12.46-9.17,3.63-19.23.73-26.18-3.94C5.26,126.57,0,117.57,0,107.38Z',
    sats: [
      { cx: 148.78, cy: 22.9,  r: 22.9 },
      { cx: 47.82,  cy: 169.7, r: 18.9 },
    ],
  },
];

// ----- normalize -----------------------------------------------------------
// Center each blob's viewBox at (CX, CY). Convert path-shaped satellites to
// bounding circles. Apply the same translation to satellites that's applied
// to the main path.

const frames = blobs.map(b => {
  const tx = CX - b.vbW / 2;
  const ty = CY - b.vbH / 2;
  return {
    main: shift(b.main, tx, ty),
    sats: b.sats.map(s => {
      if (s.path) {
        const c = pathToBoundingCircle(s.path);
        return { cx: c.cx + tx, cy: c.cy + ty, r: c.r };
      }
      return { cx: s.cx + tx, cy: s.cy + ty, r: s.r };
    }),
  };
});

// ----- satellite slot assignment -------------------------------------------
// Greedy nearest-neighbor matching from frame to frame builds stable slots.
// Phantom (r=0) frames fill the gaps so each slot has a value per frame.

const N = frames.length;
const slots = [];  // each slot: { traj: Array<{cx,cy,r} | null> (length N) }

function dist2(a, b) {
  const dx = a.cx - b.cx, dy = a.cy - b.cy;
  return dx * dx + dy * dy;
}

for (let i = 0; i < N; i++) {
  const sats = frames[i].sats.map((s, k) => ({ ...s, _i: k, _taken: false }));

  if (i === 0) {
    for (const s of sats) {
      const traj = Array(N).fill(null);
      traj[0] = { cx: s.cx, cy: s.cy, r: s.r };
      slots.push({ traj });
      s._taken = true;
    }
    continue;
  }

  // Live slots pick their NN among remaining sats; bigger satellites pick first.
  const liveSlots = slots.filter(sl => sl.traj[i - 1] && sl.traj[i - 1].r > 0);
  liveSlots.sort((a, b) => b.traj[i - 1].r - a.traj[i - 1].r);
  for (const sl of liveSlots) {
    const prev = sl.traj[i - 1];
    let bestI = -1, bestD = Infinity;
    sats.forEach((s, k) => {
      if (s._taken) return;
      const d = dist2(prev, s);
      if (d < bestD) { bestD = d; bestI = k; }
    });
    if (bestI >= 0) {
      const s = sats[bestI];
      sl.traj[i] = { cx: s.cx, cy: s.cy, r: s.r };
      s._taken = true;
    }
  }

  // Any unclaimed satellites spawn a brand-new slot.
  for (const s of sats) {
    if (s._taken) continue;
    const traj = Array(N).fill(null);
    traj[i] = { cx: s.cx, cy: s.cy, r: s.r };
    slots.push({ traj });
    s._taken = true;
  }
}

// Fill nulls: collapse to nearest position with r=0 so satellites pop in/out in place.
for (const sl of slots) {
  let last = null;
  for (let i = 0; i < N; i++) {
    if (sl.traj[i]) last = sl.traj[i];
    else if (last) sl.traj[i] = { cx: last.cx, cy: last.cy, r: 0 };
  }
  last = null;
  for (let i = N - 1; i >= 0; i--) {
    if (sl.traj[i] && sl.traj[i].r > 0) last = sl.traj[i];
    if (!sl.traj[i] && last) sl.traj[i] = { cx: last.cx, cy: last.cy, r: 0 };
  }
  // wrap-around: append frame 0's value as final keyframe
  sl.traj.push(sl.traj[0]);
}

console.log(`satellite slot count: ${slots.length}`);

// ----- main blob morph ------------------------------------------------------

const mainValues = [];
for (let i = 0; i < N; i++) {
  const from = frames[i].main;
  const to = frames[(i + 1) % N].main;
  const fn = interpolate(from, to, { maxSegmentLength: MAX_SEG });
  for (let f = 0; f < FRAMES_PER_PAIR; f++) {
    mainValues.push(fn(f / FRAMES_PER_PAIR));
  }
}
mainValues.push(mainValues[0]);
const mainKeyTimes = mainValues.map((_, i) => (i / (mainValues.length - 1)).toFixed(6)).join(';');

// ----- satellite keyTimes ---------------------------------------------------

const satKeyTimes = Array.from({ length: N + 1 }, (_, i) => (i / N).toFixed(6)).join(';');
const splineEase = Array(N).fill('0.45 0 0.55 1').join(';');
const splinePop  = Array(N).fill('0.5 0 0.5 1').join(';');

// ----- emit SVG -------------------------------------------------------------

const satCircles = slots.map(sl => {
  const cxVals = sl.traj.map(p => p.cx.toFixed(2)).join(';');
  const cyVals = sl.traj.map(p => p.cy.toFixed(2)).join(';');
  const rVals  = sl.traj.map(p => p.r.toFixed(2)).join(';');
  return `  <circle r="0">
    <animate attributeName="cx" dur="${DURATION}" repeatCount="indefinite" calcMode="spline"
      keyTimes="${satKeyTimes}" keySplines="${splineEase}" values="${cxVals}"/>
    <animate attributeName="cy" dur="${DURATION}" repeatCount="indefinite" calcMode="spline"
      keyTimes="${satKeyTimes}" keySplines="${splineEase}" values="${cyVals}"/>
    <animate attributeName="r" dur="${DURATION}" repeatCount="indefinite" calcMode="spline"
      keyTimes="${satKeyTimes}" keySplines="${splinePop}" values="${rVals}"/>
  </circle>`;
}).join('\n');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE_W} ${SIZE_H}" role="img" aria-label="Memory.Wiki morphing blob">
  <g fill="var(--mw-blob, #fff)">
    <path>
      <animate attributeName="d" dur="${DURATION}" repeatCount="indefinite" calcMode="linear"
        keyTimes="${mainKeyTimes}"
        values="${mainValues.join(';')}"/>
    </path>
${satCircles}
  </g>
</svg>
`;

const out = process.argv[2] || 'mwblob_morph.svg';
fs.writeFileSync(out, svg);
const bytes = fs.statSync(out).size;
console.log(`wrote ${out} — main ${mainValues.length} frames, ${slots.length} satellite slots, ${(bytes / 1024).toFixed(1)} KB`);
