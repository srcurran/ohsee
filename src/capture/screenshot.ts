import { chromium, Browser, BrowserContext } from 'playwright';
import { CapturedScreenshot, ViewportConfig, ViewportName } from '../types/index.js';

export const VIEWPORTS: ViewportConfig[] = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1920, height: 1080 },
];

async function captureOne(
  context: BrowserContext,
  url: string,
  viewport: ViewportConfig,
  waitMs: number,
): Promise<CapturedScreenshot> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    // Full-page screenshot captures the entire scrollable document
    const buffer = await page.screenshot({ fullPage: true, type: 'png' });
    const imageBase64 = buffer.toString('base64');

    return {
      viewport: viewport.name,
      url,
      imageBase64,
      mediaType: 'image/png',
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await page.close();
  }
}

export async function captureScreenshots(
  url: string,
  viewportNames: ViewportName[],
  waitMs: number,
): Promise<CapturedScreenshot[]> {
  const configs = VIEWPORTS.filter((v) => viewportNames.includes(v.name));
  const browser: Browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const screenshots = await Promise.all(
      configs.map((vp) => captureOne(context, url, vp, waitMs)),
    );
    await context.close();
    return screenshots;
  } finally {
    await browser.close();
  }
}
