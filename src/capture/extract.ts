import { chromium, Browser, BrowserContext } from 'playwright';
import { StructuralSnapshot, ViewportConfig, ViewportName } from '../types/index.js';
import { VIEWPORTS } from './screenshot.js';

async function extractOne(
  context: BrowserContext,
  url: string,
  viewport: ViewportConfig,
  waitMs: number,
): Promise<StructuralSnapshot> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    const rawHtml = await page.content();

    // Collect all inline style attributes
    const inlineStyles = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('[style]'));
      return elements
        .map((el) => `${el.tagName.toLowerCase()}[style="${el.getAttribute('style')}"]`)
        .join('\n');
    });

    // Sample computed styles for key elements (limited to avoid huge payloads)
    const computedStyleSample = await page.evaluate(() => {
      const SAMPLE_SELECTORS = [
        'body',
        'h1',
        'h2',
        'nav',
        'header',
        'footer',
        'main',
        'section',
        'article',
        '.hero',
        '.container',
        '.wrapper',
      ];
      const PROPS = [
        'font-family',
        'font-size',
        'font-weight',
        'color',
        'background-color',
        'padding',
        'margin',
        'display',
        'flex-direction',
        'grid-template-columns',
      ];

      const results: Array<{ selector: string; styles: Record<string, string> }> = [];

      for (const selector of SAMPLE_SELECTORS) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const computed = window.getComputedStyle(el);
        const styles: Record<string, string> = {};
        for (const prop of PROPS) {
          const val = computed.getPropertyValue(prop);
          if (val) styles[prop] = val;
        }
        if (Object.keys(styles).length > 0) {
          results.push({ selector, styles });
        }
      }
      return results;
    });

    return {
      viewport: viewport.name,
      url,
      rawHtml,
      inlineStyles,
      computedStyleSample,
    };
  } finally {
    await page.close();
  }
}

export async function extractStructural(
  url: string,
  viewportNames: ViewportName[],
  waitMs: number,
): Promise<StructuralSnapshot[]> {
  const configs = VIEWPORTS.filter((v) => viewportNames.includes(v.name));
  const browser: Browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const snapshots = await Promise.all(
      configs.map((vp) => extractOne(context, url, vp, waitMs)),
    );
    await context.close();
    return snapshots;
  } finally {
    await browser.close();
  }
}
