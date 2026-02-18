import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { CapturedScreenshot, PixelAnalysis, ViewportName } from '../types/index.js';

function decodePng(base64: string): PNG {
  const buffer = Buffer.from(base64, 'base64');
  return PNG.sync.read(buffer);
}

/**
 * Pads a PNG to target dimensions (width + height) with white pixels.
 * Required because full-page screenshots can differ in both dimensions.
 */
function padToSize(png: PNG, targetWidth: number, targetHeight: number): PNG {
  if (png.width === targetWidth && png.height === targetHeight) return png;

  const padded = new PNG({ width: targetWidth, height: targetHeight });
  padded.data.fill(255); // white background
  PNG.bitblt(png, padded, 0, 0, Math.min(png.width, targetWidth), Math.min(png.height, targetHeight), 0, 0);
  return padded;
}

export function analyzePixels(
  before: CapturedScreenshot,
  after: CapturedScreenshot,
  viewport: ViewportName,
): PixelAnalysis {
  const beforePng = decodePng(before.imageBase64);
  const afterPng = decodePng(after.imageBase64);

  // Normalise to the same canvas — pad both to max width × max height
  const maxWidth = Math.max(beforePng.width, afterPng.width);
  const maxHeight = Math.max(beforePng.height, afterPng.height);

  const paddedBefore = padToSize(beforePng, maxWidth, maxHeight);
  const paddedAfter = padToSize(afterPng, maxWidth, maxHeight);

  const diff = new PNG({ width: maxWidth, height: maxHeight });

  const changedPixels = pixelmatch(
    paddedBefore.data,
    paddedAfter.data,
    diff.data,
    maxWidth,
    maxHeight,
    {
      threshold: 0.1,        // sensitivity: 0 = exact, 1 = very tolerant
      includeAA: false,      // ignore anti-aliasing differences
      diffColor: [220, 38, 38],   // red highlight for changed pixels
      diffColorAlt: [37, 99, 235], // blue for added content
      alpha: 0.3,
    },
  );

  const diffBuffer = PNG.sync.write(diff);
  const diffImageBase64 = diffBuffer.toString('base64');

  const totalPixels = maxWidth * maxHeight;
  const percentChanged = (changedPixels / totalPixels) * 100;

  return {
    viewport,
    diffImageBase64,
    totalPixels,
    changedPixels,
    percentChanged,
    beforeWidth: beforePng.width,
    beforeHeight: beforePng.height,
    afterHeight: afterPng.height,
  };
}

export function runPixelAnalysis(
  beforeScreenshots: CapturedScreenshot[],
  afterScreenshots: CapturedScreenshot[],
  viewportNames: ViewportName[],
): PixelAnalysis[] {
  return viewportNames.map((vp) => {
    const before = beforeScreenshots.find((s) => s.viewport === vp)!;
    const after = afterScreenshots.find((s) => s.viewport === vp)!;
    return analyzePixels(before, after, vp);
  });
}
