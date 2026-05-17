/**
 * Server-side PDF image extraction.
 *
 * pdf-parse gives us text-only output. To preserve embedded images we
 * run a second pass with pdfjs-dist: enumerate each page's operator
 * list, pull every image XObject the renderer encounters, convert
 * the raw pixel data to a PNG via sharp, and hand the buffer back to
 * the import route so it can upload through the shared helper.
 *
 * Heavy dep (~3MB unpacked) — only imported lazily so PDF imports
 * that don't actually contain images don't pay the cold-start cost.
 */

import type sharpType from "sharp";

export interface ExtractedPdfImage {
  pageIndex: number;       // 1-based
  imageIndex: number;      // per-page, 1-based
  buffer: Buffer;
  contentType: string;     // always image/png — we convert everything
  width: number;
  height: number;
}

export interface PdfParseResult {
  text: string;
  pages: number;
  title: string | null;
}

/**
 * Parse a PDF buffer with pdfjs-dist and return plain text + metadata.
 * We use this instead of `pdf-parse` because pdf-parse is unmaintained
 * (last release 2020) and chokes on PDFs produced by modern tools
 * (reportlab, pdf-lib, Marp) with "bad XRef entry" / "Unknown compression"
 * errors. pdfjs-dist is the Mozilla reference implementation and
 * accepts every PDF the spec permits.
 */
export async function parsePdfText(buffer: Buffer): Promise<PdfParseResult> {
  // unpdf wraps pdfjs-dist's serverless build and ships a self-
  // contained no-worker bundle, sidestepping the "Setting up fake
  // worker failed: Cannot find module .../pdf.worker.mjs" error
  // pdfjs-dist's legacy build throws on Vercel (where outputFileTracing
  // doesn't pull the worker file even with serverExternalPackages +
  // outputFileTracingIncludes hints). Same Mozilla parsing core under
  // the hood, just bundled for serverless. Image extraction below
  // still uses pdfjs-dist directly — text is the critical path.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const uint8 = new Uint8Array(buffer);
  const doc = await getDocumentProxy(uint8);

  let title: string | null = null;
  try {
    const meta = await doc.getMetadata();
    const info = (meta?.info as Record<string, unknown> | null) || null;
    if (info && typeof info.Title === "string" && (info.Title as string).trim()) {
      title = (info.Title as string).trim();
    }
  } catch { /* metadata is best-effort */ }

  const { text, totalPages } = await extractText(doc, { mergePages: true });
  const joined: string = Array.isArray(text) ? text.join("\n\n") : (text as string);
  return {
    text: joined.trim(),
    pages: totalPages,
    title,
  };
}

/**
 * Extract every embedded image from a PDF buffer. Returns an array
 * ordered by (pageIndex, imageIndex) so callers can stitch them back
 * near the matching page text. Robust to per-page failures — one bad
 * image just gets skipped with a console.warn.
 *
 * Bounded to MAX_IMAGES total. Vercel function memory is tight on
 * the free tier and a PDF stuffed with embedded photos can otherwise
 * push past the limit.
 */
export async function extractPdfImages(
  buffer: Buffer,
  opts: { maxImages?: number; maxPages?: number } = {},
): Promise<ExtractedPdfImage[]> {
  const maxImages = opts.maxImages ?? 40;
  const maxPages = opts.maxPages ?? 60;

  // Lazy import to avoid the cold-start hit when there are no images.
  // The legacy build skips the worker dependency, which is what we
  // want in a Node serverless environment.
  const pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs") = await import(
    /* webpackIgnore: true */ "pdfjs-dist/legacy/build/pdf.mjs"
  );
  // pdfjs-dist needs pdf.worker.mjs even when running server-side
  // (its "fake worker" path imports the worker module to grab the
  // parsing code). Vercel's trace pulls pdf.mjs but skips
  // pdf.worker.mjs unless we point GlobalWorkerOptions.workerSrc at
  // the resolved file — that resolve() call is what the tracer
  // follows to include the file in the deploy.
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  } catch { /* leave default; getDocument will throw with a clearer error */ }
  const sharp: typeof sharpType = (await import("sharp")).default;

  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({
    data: uint8,
    // Disable network features that shouldn't fire in a serverless
    // context; PDFs that depend on them fail loudly rather than
    // attempting to phone home.
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const pageCount = Math.min(doc.numPages, maxPages);
  const out: ExtractedPdfImage[] = [];

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
    if (out.length >= maxImages) break;
    let page;
    try {
      page = await doc.getPage(pageIndex);
    } catch (err) {
      console.warn(`[pdf-images] getPage(${pageIndex}) failed:`, err);
      continue;
    }
    let opList;
    try {
      opList = await page.getOperatorList();
    } catch (err) {
      console.warn(`[pdf-images] getOperatorList(${pageIndex}) failed:`, err);
      continue;
    }

    const OPS = pdfjs.OPS;
    let imagePerPageIndex = 0;

    for (let i = 0; i < opList.fnArray.length; i++) {
      if (out.length >= maxImages) break;
      const op = opList.fnArray[i];
      if (op !== OPS.paintImageXObject && op !== OPS.paintInlineImageXObject) continue;

      type ImgRef = { width: number; height: number; data?: Uint8ClampedArray; bitmap?: ImageBitmap; kind?: number };
      const imgName = opList.argsArray[i]?.[0];
      let imgRef: ImgRef | null = null;
      try {
        imgRef = await new Promise<ImgRef | null>((resolve) => {
          // pdfjs may park the image in page.objs or commonObjs depending
          // on the PDF's structure. Try with a hard timeout so a
          // pathological PDF can't block the request indefinitely.
          let settled = false;
          const finish = (v: ImgRef | null) => { if (!settled) { settled = true; resolve(v); } };
          const timer = setTimeout(() => finish(null), 5000);
          try {
            page.objs.get(imgName, (v: ImgRef) => { clearTimeout(timer); finish(v); });
          } catch {
            // Fall through; some PDF page object stores throw on miss.
          }
        });
      } catch {
        imgRef = null;
      }
      if (!imgRef) continue;

      // pdfjs gives us pixel data, not the original embedded JPEG/PNG.
      // It can come as either Uint8ClampedArray (data) or as a bitmap
      // (modern path with ImageBitmap). We always re-encode via sharp
      // so the output is a predictable WebP-or-PNG with stable size.
      try {
        let pngBuf: Buffer | null = null;
        if (imgRef.data && imgRef.width && imgRef.height) {
          // RGBA or grayscale; pdfjs sets `kind` (1: grayscale, 2: RGB, 3: RGBA).
          const channels = imgRef.kind === 1 ? 1 : imgRef.kind === 2 ? 3 : 4;
          pngBuf = await sharp(Buffer.from(imgRef.data.buffer), {
            raw: { width: imgRef.width, height: imgRef.height, channels: channels as 1 | 3 | 4 },
          }).png().toBuffer();
        }
        if (!pngBuf) continue;
        imagePerPageIndex++;
        out.push({
          pageIndex,
          imageIndex: imagePerPageIndex,
          buffer: pngBuf,
          contentType: "image/png",
          width: imgRef.width,
          height: imgRef.height,
        });
      } catch (err) {
        console.warn(`[pdf-images] sharp re-encode failed (page ${pageIndex} img ${imagePerPageIndex + 1}):`, err);
      }
    }

    // Free the page's data — important on large PDFs.
    try { page.cleanup(); } catch { /* ignore */ }
  }

  try { await doc.destroy(); } catch { /* ignore */ }
  return out;
}
