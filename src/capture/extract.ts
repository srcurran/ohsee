import { chromium } from 'playwright';
import { StructuralSnapshot, ViewportConfig, ViewportName } from '../types/index.js';
import { VIEWPORTS } from './screenshot.js';

export async function extractStructural(
  url: string,
  viewportNames: ViewportName[],
  waitMs: number,
): Promise<StructuralSnapshot[]> {
  const configs = VIEWPORTS.filter((v) => viewportNames.includes(v.name));

  const browser = await chromium.launch({
    args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
  });

  try {
    const snapshots = await Promise.all(
      configs.map(async (vp): Promise<StructuralSnapshot> => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
          if (waitMs > 0) await page.waitForTimeout(waitMs);

          const rawHtml = await page.content();

          const inlineStyles = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('[style]'))
              .map((el) => `${el.tagName.toLowerCase()}[style="${el.getAttribute('style')}"]`)
              .join('\n');
          });

          const computedStyleSample = await page.evaluate(() => {
            const SAMPLE_SELECTORS = [
              'body', 'h1', 'h2', 'nav', 'header', 'footer',
              'main', 'section', 'article', '.hero', '.container', '.wrapper',
            ];
            const PROPS = [
              'font-family', 'font-size', 'font-weight', 'color', 'background-color',
              'padding', 'margin', 'display', 'flex-direction', 'grid-template-columns',
            ];
            return SAMPLE_SELECTORS.flatMap((selector) => {
              const el = document.querySelector(selector);
              if (!el) return [];
              const computed = window.getComputedStyle(el);
              const styles: Record<string, string> = {};
              for (const prop of PROPS) {
                const val = computed.getPropertyValue(prop);
                if (val) styles[prop] = val;
              }
              return Object.keys(styles).length > 0 ? [{ selector, styles }] : [];
            });
          });

          return { viewport: vp.name, url, rawHtml, inlineStyles, computedStyleSample };
        } finally {
          await context.close();
        }
      }),
    );
    return snapshots;
  } finally {
    await browser.close();
  }
}
