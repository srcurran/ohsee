import { chromium } from 'playwright';
import { CapturedScreenshot, ViewportConfig, ViewportName } from '../types/index.js';

export const VIEWPORTS: ViewportConfig[] = [
  { name: 'mobile',  width: 375,  height: 812  },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'laptop',  width: 1280, height: 800  },
  { name: 'desktop', width: 1920, height: 1080 },
];

export async function captureScreenshots(
  url: string,
  viewportNames: ViewportName[],
  waitMs: number,
): Promise<CapturedScreenshot[]> {
  const configs = VIEWPORTS.filter((v) => viewportNames.includes(v.name));

  // --hide-scrollbars: removes scrollbars at the Chromium level so both pages
  // always render at exactly the full viewport width, regardless of page length.
  // --force-device-scale-factor=1: ensures screenshots are always at 1x,
  // even on Retina displays, so both URLs produce identical-width images.
  const browser = await chromium.launch({
    args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
  });

  try {
    const screenshots = await Promise.all(
      configs.map(async (vp): Promise<CapturedScreenshot> => {
        // Each viewport gets its own context with the viewport baked in.
        // Setting it at context level is more reliable than page.setViewportSize().
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
          if (waitMs > 0) await page.waitForTimeout(waitMs);

          const buffer = await page.screenshot({ fullPage: true, type: 'png' });
          return {
            viewport: vp.name,
            url,
            imageBase64: buffer.toString('base64'),
            mediaType: 'image/png',
            capturedAt: new Date().toISOString(),
          };
        } finally {
          await context.close();
        }
      }),
    );
    return screenshots;
  } finally {
    await browser.close();
  }
}
