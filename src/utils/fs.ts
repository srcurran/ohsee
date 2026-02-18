import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { logger } from './logger.js';

/**
 * Derives a slug from a URL for use in folder names.
 * e.g. https://example.com/about/page → example.com-about-page
 */
export function urlToSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathSlug = parsed.pathname
      .replace(/^\/|\/$/g, '') // trim leading/trailing slashes
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-_.]/g, '')
      .slice(0, 60);
    return pathSlug ? `${host}-${pathSlug}` : host;
  } catch {
    return url.replace(/[^a-zA-Z0-9-_.]/g, '-').slice(0, 60);
  }
}

/**
 * Returns the output folder path: ~/ohsee/YYYYMMDD--<url1-slug>
 */
export function resolveOutputDir(url1: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const slug = urlToSlug(url1);
  const dirName = `${dateStr}--${slug}`;
  return path.join(os.homedir(), 'ohsee', dirName);
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

/**
 * Opens a file in the default browser using the OS-appropriate command.
 */
export function openInBrowser(filePath: string): void {
  const absolutePath = path.resolve(filePath);
  try {
    switch (process.platform) {
      case 'darwin':
        execSync(`open "${absolutePath}"`);
        break;
      case 'win32':
        execSync(`start "" "${absolutePath}"`);
        break;
      default:
        execSync(`xdg-open "${absolutePath}"`);
    }
  } catch (err) {
    logger.warn(`Could not auto-open browser: ${err}`);
  }
}
