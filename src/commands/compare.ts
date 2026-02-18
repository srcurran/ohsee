import ora from 'ora';
import { CompareOptions, ViewportName, ProgressCallback } from '../types/index.js';
import { captureScreenshots, VIEWPORTS } from '../capture/screenshot.js';
import { extractStructural } from '../capture/extract.js';
import { analyzeVisual, generateSummary } from '../analyze/visual.js';
import { buildReport } from '../report/builder.js';
import { renderReport } from '../report/render.js';
import { resolveOutputDir, writeReport, openInBrowser } from '../utils/fs.js';
import { logger } from '../utils/logger.js';

const VERSION = '0.1.0';

export async function runCompare(
  url1: string,
  url2: string,
  options: CompareOptions,
): Promise<void> {
  const startedAt = Date.now();

  const viewportNames: ViewportName[] =
    options.viewports ?? (VIEWPORTS.map((v) => v.name) as ViewportName[]);

  const spinner = ora({ color: 'cyan' });

  const progress: ProgressCallback = (step, detail) => {
    spinner.text = detail ? `${step} — ${detail}` : step;
  };

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

  // ── 3. Visual analysis (parallel across viewports) ──────────────────────
  spinner.start(`Sending ${viewportNames.length} viewport pairs to Claude vision…`);
  const visualAnalyses = await analyzeVisual(
    beforeScreenshots,
    afterScreenshots,
    viewportNames,
    options.model,
    options.debug,
  );
  spinner.succeed('Visual analysis complete');

  // ── 4. Overall summary ──────────────────────────────────────────────────
  spinner.start('Generating executive summary…');
  const overallSummary = await generateSummary(visualAnalyses, options.model, options.debug);
  spinner.succeed('Summary generated');

  // ── 5. Build report data ─────────────────────────────────────────────────
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
    overallSummary,
    startedAt,
    model: options.model,
    version: VERSION,
  });

  // ── 6. Render + write HTML ───────────────────────────────────────────────
  const html = renderReport(report);
  const outputDir = options.output ?? resolveOutputDir(url1);
  const reportPath = writeReport(html, outputDir);
  spinner.succeed(`Report written to ${reportPath}`);

  // ── 7. Summary to console ────────────────────────────────────────────────
  logger.info(`Visual changes: ${report.totalVisualChanges}`);
  logger.info(`Structural changed lines: ${report.totalStructuralChanges}`);
  logger.info(`Duration: ${(report.durationMs / 1000).toFixed(1)}s`);

  // ── 8. Auto-open ─────────────────────────────────────────────────────────
  if (options.open !== false) {
    openInBrowser(reportPath);
  }
}
