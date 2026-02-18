import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { CompareReport } from '../types/index.js';
import { logger } from './logger.js';

export function urlToSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathSlug = parsed.pathname
      .replace(/^\/|\/$/g, '')
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-_.]/g, '')
      .slice(0, 60);
    return pathSlug ? `${host}-${pathSlug}` : host;
  } catch {
    return url.replace(/[^a-zA-Z0-9-_.]/g, '-').slice(0, 60);
  }
}

/**
 * Returns the output folder path: ~/ohsee/YYYYMMDD-HHMMSS--<url1-slug>
 * Includes time so multiple runs on the same day each get their own folder.
 */
export function resolveOutputDir(url1: string): string {
  const now = new Date();
  const p = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const timeStr = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const slug = urlToSlug(url1);
  return path.join(os.homedir(), 'ohsee', `${dateStr}-${timeStr}--${slug}`);
}

/**
 * Writes all screenshots and diff images as individual PNG files.
 * Returns a map of image keys → relative filenames for use in the HTML report.
 *
 * File naming:
 *   {viewport}-before.png  — URL 1 screenshot
 *   {viewport}-after.png   — URL 2 screenshot
 *   {viewport}-diff.png    — pixel diff image (--no-ai mode only)
 */
export function writeImages(report: CompareReport, outputDir: string): Record<string, string> {
  fs.mkdirSync(outputDir, { recursive: true });
  const paths: Record<string, string> = {};

  for (const vr of report.viewports) {
    const vp = vr.viewport;

    const beforeFile = `${vp}-before.png`;
    fs.writeFileSync(
      path.join(outputDir, beforeFile),
      Buffer.from(vr.beforeScreenshot.imageBase64, 'base64'),
    );
    paths[`before-${vp}`] = beforeFile;

    const afterFile = `${vp}-after.png`;
    fs.writeFileSync(
      path.join(outputDir, afterFile),
      Buffer.from(vr.afterScreenshot.imageBase64, 'base64'),
    );
    paths[`after-${vp}`] = afterFile;

    if (vr.pixelAnalysis) {
      const diffFile = `${vp}-diff.png`;
      fs.writeFileSync(
        path.join(outputDir, diffFile),
        Buffer.from(vr.pixelAnalysis.diffImageBase64, 'base64'),
      );
      paths[`diff-${vp}`] = diffFile;
    }
  }

  return paths;
}

/**
 * Writes the HTML report to the output directory.
 * Returns the full path to the written file.
 */
export function writeReport(html: string, outputDir: string): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, 'report.html');
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

export function openInBrowser(filePath: string): void {
  const absolutePath = path.resolve(filePath);
  try {
    switch (process.platform) {
      case 'darwin': execSync(`open "${absolutePath}"`); break;
      case 'win32':  execSync(`start "" "${absolutePath}"`); break;
      default:       execSync(`xdg-open "${absolutePath}"`);
    }
  } catch (err) {
    logger.warn(`Could not auto-open browser: ${err}`);
  }
}
