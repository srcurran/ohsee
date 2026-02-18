import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { CapturedScreenshot, PixelAnalysis, ViewportName } from '../types/index.js';

// Strip height for the alignment search. Smaller = more precise alignment,
// but slower. 400px covers most page sections without being too granular.
const STRIP_HEIGHT = 400;

// Max vertical offset to search when aligning strips. 300px handles even
// large layout shifts without excessive search time.
const MAX_SHIFT = 300;

// Coarse sampling steps for the alignment SAD computation (speed vs accuracy)
const COARSE_X = 16;
const COARSE_Y = 8;

function decodePng(base64: string): PNG {
  return PNG.sync.read(Buffer.from(base64, 'base64'));
}

function padToSize(png: PNG, targetWidth: number, targetHeight: number): PNG {
  if (png.width === targetWidth && png.height === targetHeight) return png;
  const padded = new PNG({ width: targetWidth, height: targetHeight });
  padded.data.fill(255); // white background
  PNG.bitblt(png, padded, 0, 0, Math.min(png.width, targetWidth), Math.min(png.height, targetHeight), 0, 0);
  return padded;
}

/**
 * Returns a view of the raw RGBA bytes for a horizontal strip.
 * Uses subarray (zero-copy) for performance.
 */
function getStripBuffer(data: Buffer, width: number, y: number, h: number): Buffer {
  const bytesPerRow = width * 4;
  return data.subarray(y * bytesPerRow, (y + h) * bytesPerRow);
}

/**
 * Mean absolute difference between two strips using coarse sampling.
 * Used to find the best vertical alignment offset.
 */
function computeStripSAD(
  aData: Buffer, aWidth: number, aY: number,
  bData: Buffer, bWidth: number, bY: number,
  stripH: number,
  maxH: number,
): number {
  const actualH = Math.min(stripH, maxH - aY, maxH - bY);
  if (actualH <= 0) return Infinity;
  const w = Math.min(aWidth, bWidth);
  let sum = 0;
  let count = 0;
  for (let dy = 0; dy < actualH; dy += COARSE_Y) {
    for (let x = 0; x < w; x += COARSE_X) {
      const ai = ((aY + dy) * aWidth + x) * 4;
      const bi = ((bY + dy) * bWidth + x) * 4;
      sum += Math.abs(aData[ai]     - bData[bi]);
      sum += Math.abs(aData[ai + 1] - bData[bi + 1]);
      sum += Math.abs(aData[ai + 2] - bData[bi + 2]);
      count += 3;
    }
  }
  return count > 0 ? sum / count : Infinity;
}

/**
 * Finds the vertical offset in `after` that best aligns with the given
 * strip in `before`. Searches ±MAX_SHIFT pixels.
 *
 * This is the core of the shift-tolerant diff: a small padding change at
 * the top of a page shifts everything below it by a few pixels. Without
 * alignment, pixelmatch would flag every subsequent pixel as changed.
 * With alignment, each strip is matched to its counterpart in the other
 * page regardless of vertical displacement, so only genuine differences
 * are reported.
 */
function findBestOffset(
  beforeData: Buffer, width: number, beforeH: number,
  afterData: Buffer, afterH: number,
  stripY: number,
): number {
  const stripH = Math.min(STRIP_HEIGHT, beforeH - stripY);
  let bestOffset = 0;
  let bestSAD = Infinity;

  for (let dy = -MAX_SHIFT; dy <= MAX_SHIFT; dy++) {
    const afterY = stripY + dy;
    if (afterY < 0 || afterY + stripH > afterH) continue;
    const sad = computeStripSAD(
      beforeData, width, stripY,
      afterData, width, afterY,
      stripH, Math.min(beforeH, afterH),
    );
    if (sad < bestSAD) {
      bestSAD = sad;
      bestOffset = dy;
    }
  }
  return bestOffset;
}

export function analyzePixels(
  before: CapturedScreenshot,
  after: CapturedScreenshot,
  viewport: ViewportName,
): PixelAnalysis {
  const beforePng = decodePng(before.imageBase64);
  const afterPng  = decodePng(after.imageBase64);

  const maxWidth  = Math.max(beforePng.width,  afterPng.width);
  const maxHeight = Math.max(beforePng.height, afterPng.height);

  const paddedBefore = padToSize(beforePng, maxWidth, maxHeight);
  const paddedAfter  = padToSize(afterPng,  maxWidth, maxHeight);

  const diff = new PNG({ width: maxWidth, height: maxHeight });
  diff.data.fill(255); // start with white

  let totalChanged = 0;

  for (let stripY = 0; stripY < maxHeight; stripY += STRIP_HEIGHT) {
    const stripH = Math.min(STRIP_HEIGHT, maxHeight - stripY);

    const offset = findBestOffset(
      paddedBefore.data, maxWidth, maxHeight,
      paddedAfter.data, maxHeight,
      stripY,
    );

    const alignedAfterY = Math.max(0, Math.min(maxHeight - stripH, stripY + offset));

    const beforeStrip = getStripBuffer(paddedBefore.data, maxWidth, stripY, stripH);
    const afterStrip  = getStripBuffer(paddedAfter.data,  maxWidth, alignedAfterY, stripH);
    const diffStrip   = Buffer.alloc(maxWidth * stripH * 4);

    const changed = pixelmatch(
      beforeStrip,
      afterStrip,
      diffStrip,
      maxWidth,
      stripH,
      {
        threshold: 0.1,
        includeAA: false,
        diffColor: [255, 0, 100], // hot pink — distinct from any UI colour
        alpha: 0.3,
      },
    );

    totalChanged += changed;
    diffStrip.copy(diff.data, stripY * maxWidth * 4);
  }

  const diffBuffer     = PNG.sync.write(diff);
  const diffImageBase64 = diffBuffer.toString('base64');
  const totalPixels    = maxWidth * maxHeight;

  return {
    viewport,
    diffImageBase64,
    totalPixels,
    changedPixels: totalChanged,
    percentChanged: (totalChanged / totalPixels) * 100,
    beforeWidth:  beforePng.width,
    beforeHeight: beforePng.height,
    afterHeight:  afterPng.height,
  };
}

export function runPixelAnalysis(
  beforeScreenshots: CapturedScreenshot[],
  afterScreenshots:  CapturedScreenshot[],
  viewportNames: ViewportName[],
): PixelAnalysis[] {
  return viewportNames.map((vp) => {
    const before = beforeScreenshots.find((s) => s.viewport === vp)!;
    const after  = afterScreenshots.find((s)  => s.viewport === vp)!;
    return analyzePixels(before, after, vp);
  });
}
