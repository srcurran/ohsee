import ora from 'ora';
import { CompareOptions, ViewportName } from '../types/index.js';
import { captureScreenshots, VIEWPORTS } from '../capture/screenshot.js';
import { extractStructural } from '../capture/extract.js';
import { analyzeVisual, generateSummary } from '../analyze/visual.js';
import { runPixelAnalysis } from '../analyze/pixel.js';
import { buildReport } from '../report/builder.js';
import { renderReport } from '../report/render.js';
import { resolveOutputDir, writeImages, writeReport, openInBrowser } from '../utils/fs.js';
import { logger } from '../utils/logger.js';

const VERSION = '0.1.0';

function buildNoAiSummary(
  viewportNames: ViewportName[],
  pixelResults: ReturnType<typeof runPixelAnalysis>,
  structuralChanges: number,
): string {
  const affected = pixelResults.filter((p) => p.changedPixels > 0).length;
  const avgPct = (
    pixelResults.reduce((s, p) => s + p.percentChanged, 0) / pixelResults.length
  ).toFixed(1);
  const mostChanged = pixelResults.reduce((a, b) =>
    a.percentChanged > b.percentChanged ? a : b,
  );

  if (affected === 0 && structuralChanges === 0) {
    return 'No visual or structural differences detected between the two URLs across all viewports.';
  }

  const parts: string[] = [];
  if (affected > 0) {
    parts.push(
      `Pixel diffing detected changes in ${affected} of ${viewportNames.length} viewport(s), averaging ${avgPct}% pixels changed.`,
    );
    parts.push(
      `The most affected viewport is ${mostChanged.viewport} at ${mostChanged.percentChanged.toFixed(1)}%.`,
    );
  }
  if (structuralChanges > 0) {
    parts.push(`The HTML/CSS diff found ${structuralChanges} changed lines across all viewports.`);
  }
  return parts.join(' ');
}

export async function runCompare(
  url1: string,
  url2: string,
  options: CompareOptions,
): Promise<void> {
  const startedAt = Date.now();

  const viewportNames: ViewportName[] =
    options.viewports ?? (VIEWPORTS.map((v) => v.name) as ViewportName[]);

  const spinner = ora({ color: 'cyan' });

  // ── 1. Capture screenshots ──────────────────────────────────────────────
  spinner.start('Capturing screenshots for URL 1…');
  const beforeScreenshots = await captureScreenshots(url1, viewportNames, options.wait);
  spinner.succeed(`Captured ${beforeScreenshots.length} screenshots for URL 1`);

  spinner.start('Capturing screenshots for URL 2…');
  const afterScreenshots = await captureScreenshots(url2, viewportNames, options.wait);
  spinner.succeed(`Captured ${afterScreenshots.length} screenshots for URL 2`);

  // ── 2. Extract HTML/CSS ─────────────────────────────────────────────────
  spinner.start('Extracting structural snapshots for URL 1…');
  const beforeSnapshots = await extractStructural(url1, viewportNames, options.wait);
  spinner.succeed('Extracted structural snapshots for URL 1');

  spinner.start('Extracting structural snapshots for URL 2…');
  const afterSnapshots = await extractStructural(url2, viewportNames, options.wait);
  spinner.succeed('Extracted structural snapshots for URL 2');

  let overallSummary: string;
  let visualAnalyses;
  let pixelAnalyses;

  // ── 3. Pixel diff (always — used for overlay image in both modes) ──────
  spinner.start('Running pixel diff…');
  pixelAnalyses = runPixelAnalysis(beforeScreenshots, afterScreenshots, viewportNames);
  spinner.succeed('Pixel diff complete');

  if (options.noAi) {
    // Compute structural changes for summary
    const { analyzeStructural } = await import('../analyze/structural.js');
    const totalStructural = viewportNames.reduce((sum, vp) => {
      const b = beforeSnapshots.find((s) => s.viewport === vp)!;
      const a = afterSnapshots.find((s) => s.viewport === vp)!;
      const r = analyzeStructural(b, a, vp);
      return sum + r.cssClassChanges.length + r.elementClassChanges.length + r.contentChanges.length;
    }, 0);

    overallSummary = buildNoAiSummary(viewportNames, pixelAnalyses, totalStructural);
  } else {
    // ── 3b. Claude visual analysis ──────────────────────────────────────
    spinner.start(`Sending ${viewportNames.length} viewport pairs to Claude vision…`);
    visualAnalyses = await analyzeVisual(
      beforeScreenshots,
      afterScreenshots,
      viewportNames,
      options.model,
      options.debug,
    );
    spinner.succeed('Visual analysis complete');

    spinner.start('Generating executive summary…');
    overallSummary = await generateSummary(visualAnalyses, options.model, options.debug);
    spinner.succeed('Summary generated');
  }

  // ── 4. Build + render report ────────────────────────────────────────────
  spinner.start('Building report…');
  const report = buildReport({
    url1,
    url2,
    viewportNames,
    beforeScreenshots,
    afterScreenshots,
    beforeSnapshots,
    afterSnapshots,
    visualAnalyses,
    pixelAnalyses,
    overallSummary,
    startedAt,
    model: options.noAi ? 'none' : options.model,
    version: VERSION,
    aiMode: !options.noAi,
  });

  const outputDir = options.output ?? resolveOutputDir(url1);
  const imagePaths = writeImages(report, outputDir);
  const html = renderReport(report, imagePaths);
  const reportPath = writeReport(html, outputDir);
  spinner.succeed(`Report written to ${reportPath}`);

  // ── 5. Console summary ──────────────────────────────────────────────────
  if (options.noAi) {
    logger.info(`Changed pixels (total): ${report.totalVisualChanges.toLocaleString()}`);
  } else {
    logger.info(`Visual changes: ${report.totalVisualChanges}`);
  }
  logger.info(`Structural changes: ${report.totalStructuralChanges}`);
  logger.info(`Duration: ${(report.durationMs / 1000).toFixed(1)}s`);

  // ── 6. Auto-open ────────────────────────────────────────────────────────
  if (options.open !== false) {
    openInBrowser(reportPath);
  }
}
