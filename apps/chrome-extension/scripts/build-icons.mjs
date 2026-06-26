// Regenerate the Chrome extension's rounded icon set from the brand source.
//
// Why: the manifest pointed `icons` (chrome://extensions + Web Store) AND
// `action.default_icon` (toolbar) at the toolbar-*.png set, which were
// full-bleed OPAQUE squares (sharp ~90° corners). This renders one consistent
// rounded set (rounded square + ~12% transparent padding, matching the brand
// app icon) at every size both surfaces need.
//
// Source: assets/brand/mwlogoset v2/icon-app-128.svg (bg #09090b rounded rect
// rx=24 + four white glyph shapes), re-placed onto a transparent padded canvas.
//
// Run: node apps/chrome-extension/scripts/build-icons.mjs

import sharp from "sharp";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../icons");

const INK = "#09090b";
const GLYPH = `
  <path d="M107.99,63.1c-4.06,0-7.35,3.29-7.35,7.35s3.29,7.35,7.35,7.35,7.35-3.29,7.35-7.35-3.29-7.35-7.35-7.35Z"/>
  <circle cx="65.62" cy="19.19" r="11.51"/>
  <path d="M28.69,90.74c-3.58,1.4-4.58,5.43-3.14,8.38,1.42,2.85,4.72,4.06,7.85,2.87,3.21-1.24,4.4-4.45,3.14-7.9-1.03-2.77-4.4-4.69-7.82-3.35h-.03Z"/>
  <path d="M96.76,57.25c6.51-5.4,6.35-14.75,1.24-20.55-5.06-5.69-14.31-6.51-20.29-.84-5.66,5.37-14.67,7.51-21.34,2.05-3.32-2.71-6.82-5.08-11.54-3.69-3.66,1.08-6.82,4-8.19,8.25-1.13,3.45-5.08,4.66-8.54,4.72-5.48.08-10.22,3.58-12.67,7.46-3.16,4.98-3.58,10.54-1.45,15.73,2.85,6.88,9.59,11.06,17.12,9.93,4.87-.74,10.09.4,13.07,4.98,2.08,3.19,2.9,7.75,1.71,11.2-1.84,5.43-1.9,11.12,1.74,15.65,4.16,5.24,10.62,7.38,17.15,5.56,5.77-1.58,9.3-6.51,11.14-12.62,1.32-4.35,6.72-6.01,10.72-6.22,5.01-.24,8.56-4.35,9.85-8.17,1.79-5.22-.74-9.35-3.74-13.01-5.56-6.74-1.98-15.54,3.98-20.47l.03.05h.01ZM78.72,78.04c-2.74,1.69-5.32-2.21-9.96-3.95-1.5,4.64,1.24,9.01-1.21,10.54-1.21.76-3.14.82-4.11.08-2.5-1.87.61-6.06-1.13-10.67-5.06,1.84-8.04,6.9-10.75,3.06-1.16-1.63-.84-3.85,1.24-4.72,2.5-1.03,4.4-1.95,7.14-3.58l-7.53-4.48c-1.26-.76-1.37-2.53-.84-3.64.68-1.42,2.61-2.27,4-1.34l6.88,4.56c1.45-4.06-.92-8.59,1-10.33.79-.71,2.74-.82,3.98-.32,2.63,1.08.24,6.16,1.29,10.59l6.56-4.37c1.37-.92,3.24-.37,4.14.87,1,1.37.9,3.4-.92,4.24-2.48,1.16-4.5,2.27-7.06,4.08,3.64,3,8.61,3.27,8.88,6.16.11,1.11-.74,2.71-1.61,3.24l.03-.03h-.02Z"/>
`;

// 12% transparent padding each side → the rounded tile occupies the middle 76%.
// The source's own rx=24 (on a 128 box) gives the corner rounding.
const PAD = 0.12;
const SIZES = [16, 19, 32, 38, 48, 128];

for (const N of SIZES) {
  const s = (1 - 2 * PAD) * N / 128; // scale 128-space content into the inset
  const off = PAD * N;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}" viewBox="0 0 ${N} ${N}">
    <g transform="translate(${off},${off}) scale(${s})">
      <rect width="128" height="128" rx="24" ry="24" fill="${INK}"/>
      <g fill="#fff">${GLYPH}</g>
    </g>
  </svg>`;
  const out = resolve(OUT, `icon${N}.png`);
  await sharp(Buffer.from(svg), { density: 384 }).resize(N, N).png().toFile(out);
  console.log("wrote", `icon${N}.png`, `${N}x${N}`);
}

console.log("done — rounded icon set regenerated (icons + action.default_icon)");
