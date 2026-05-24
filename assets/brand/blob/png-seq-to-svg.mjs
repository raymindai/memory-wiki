// PNG sequence -> single animated SVG.
//
// Usage:
//   node png-seq-to-svg.mjs <pngDir> <outSvg> [fps=30] [colour=#fff] [threshold=128]
//
// Pipeline per frame:
//   1. sharp reads PNG, replaces transparent pixels with white, blob pixels with black
//   2. potrace traces black region → SVG path
//   3. extracted "d" + viewBox accumulated
//   4. emit one <path> with SMIL <animate d> using calcMode="discrete"
//
// Why discrete: potrace produces a different point count per frame, so SMIL
// linear interpolation of d would corrupt. Discrete = pure frame-flip (looks
// identical to the source PNG sequence in motion).

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import potrace from 'potrace';

const [, , dirArg, outArg, fpsArg, colourArg, threshArg] = process.argv;
if (!dirArg || !outArg) {
  console.error('usage: node png-seq-to-svg.mjs <pngDir> <outSvg> [fps=30] [colour=#fff] [threshold=128]');
  process.exit(1);
}

const fps = +(fpsArg || 30);
const colour = colourArg || '#fff';
const threshold = +(threshArg || 128);

const entries = (await fs.readdir(dirArg))
  .filter(f => /\.png$/i.test(f))
  .sort();    // assumes zero-padded numeric names

if (!entries.length) { console.error('no PNGs in', dirArg); process.exit(1); }
console.log(`found ${entries.length} frames @ ${fps}fps`);

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pngtrace-'));

const traceFile = file => new Promise((res, rej) => {
  potrace.trace(file, {
    threshold,
    color: colour,
    background: 'transparent',
    turdSize: 4,          // drop specks smaller than this
    optTolerance: 0.4,    // smoother curves = smaller file (0.2 detailed, 1 looser)
  }, (err, svg) => err ? rej(err) : res(svg));
});

const extract = svg => {
  // potrace emits: <svg ... viewBox="..."><path d="..."/></svg>
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1];
  // Concatenate all <path d> values in document order (multi-region frames work)
  const ds = [...svg.matchAll(/<path[^>]*d="([^"]+)"/g)].map(m => m[1]);
  return { viewBox: vb, d: ds.join(' ') };
};

const frames = [];
let viewBox = null;

for (let i = 0; i < entries.length; i++) {
  const src = path.join(dirArg, entries[i]);
  const tmp = path.join(tmpDir, `f${i.toString().padStart(5, '0')}.png`);

  // Binarize: pixel becomes black where alpha > threshold, else white.
  await sharp(src)
    .ensureAlpha()
    .extractChannel('alpha')
    .threshold(threshold)
    .negate()              // alpha>thresh → black (potrace traces dark)
    .toColourspace('b-w')
    .png()
    .toFile(tmp);

  const svg = await traceFile(tmp);
  const { viewBox: vb, d } = extract(svg);
  if (!viewBox) viewBox = vb;
  frames.push(d);

  if ((i + 1) % 10 === 0 || i === entries.length - 1) {
    process.stdout.write(`\r  traced ${i + 1}/${entries.length}`);
  }
}
process.stdout.write('\n');

await fs.rm(tmpDir, { recursive: true, force: true });

const dur = (entries.length / fps).toFixed(3) + 's';
const keyTimes = frames.map((_, i) => (i / Math.max(1, frames.length - 1)).toFixed(6)).join(';');
const values = frames.join(';');

const svgOut = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="blob morph">
  <path fill="${colour}">
    <animate attributeName="d" dur="${dur}" repeatCount="indefinite"
      calcMode="discrete" keyTimes="${keyTimes}" values="${values}"/>
  </path>
</svg>
`;

await fs.writeFile(outArg, svgOut);
const { size } = await fs.stat(outArg);
console.log(`wrote ${outArg} — ${frames.length} frames, ${(size / 1024).toFixed(1)} KB, ${dur} loop`);
