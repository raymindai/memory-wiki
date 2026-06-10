// Render the canonical mwlogoset v2 silhouette into Safari-friendly
// toolbar PNGs (template images — Safari ignores RGB, only the alpha
// channel matters, so we render solid black on transparent).
//
// Output: 16/19/32/38 PNGs into the extension's Resources/icons/.
//
// Run: node apps/safari-extension/scripts/build-toolbar-icons.mjs

import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(
  __dirname,
  "../../../assets/brand/mwlogoset v2/icon-inline-dark.svg",
);
const OUT_DIR = resolve(
  __dirname,
  "../memory.wiki Clipper/Shared (Extension)/Resources/icons",
);

const SIZES = [16, 19, 32, 38];

const raw = readFileSync(SRC, "utf8");
// Force solid black fill so the rasterized alpha is uniformly opaque
// inside the silhouette — Safari template images key on alpha only.
const blackened = raw.replace(/#fafafa/gi, "#000000");

for (const size of SIZES) {
  const svgBuf = Buffer.from(blackened, "utf8");
  const out = resolve(OUT_DIR, `toolbar-${size}.png`);
  // density scales the underlying raster — 384 dpi at viewBox ~40 gives
  // crisp edges before sharp downsamples to the target size.
  await sharp(svgBuf, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log("wrote", out);
}

console.log("done");
