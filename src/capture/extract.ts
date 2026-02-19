import { chromium } from 'playwright';
import { StructuralSnapshot, ViewportConfig, ViewportName } from '../types/index.js';
import { VIEWPORTS } from './screenshot.js';

// Visual CSS properties worth comparing per class.
// Excludes inherited text properties (font-family, letter-spacing) which are
// too noisy, and width/height which are often layout-computed rather than set.
const CLASS_STYLE_PROPS = [
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'max-width',
  'min-height',
  'display',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'border-radius',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-style',
  'opacity',
  'text-align',
  'line-height',
  'box-shadow',
  'text-decoration',
  'text-transform',
];

export async function extractStructural(
  url: string,
  viewportNames: ViewportName[],
  waitMs: number,
): Promise<StructuralSnapshot[]> {
  const configs = VIEWPORTS.filter((v) => viewportNames.includes(v.name));

  const browser = await chromium.launch({
    args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--disable-cache'],
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

          const inlineStyles = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[style]'))
              .map((el) => `${el.tagName.toLowerCase()}[style="${el.getAttribute('style')}"]`)
              .join('\n'),
          );

          const computedStyleSample = await page.evaluate(() => {
            const SELECTORS = ['body','h1','h2','nav','header','footer','main','section','article','.hero','.container','.wrapper'];
            const PROPS = ['font-family','font-size','font-weight','color','background-color','padding','margin','display','flex-direction','grid-template-columns'];
            return SELECTORS.flatMap((sel) => {
              const el = document.querySelector(sel);
              if (!el) return [];
              const computed = window.getComputedStyle(el);
              const styles: Record<string, string> = {};
              for (const prop of PROPS) {
                const val = computed.getPropertyValue(prop);
                if (val) styles[prop] = val;
              }
              return Object.keys(styles).length > 0 ? [{ selector: sel, styles }] : [];
            });
          });

          // Sample computed styles keyed by CSS class name.
          // For each unique class in the page, take the computed styles from
          // the FIRST element that uses it. This lets us detect when a class's
          // visual properties change between the two pages.
          const classComputedStyles = await page.evaluate((props: string[]) => {
            const result: Record<string, Record<string, string>> = {};
            const elements = Array.from(document.querySelectorAll('[class]'));

            for (const el of elements) {
              if (Object.keys(result).length >= 400) break;
              const classes = el.className.toString().split(/\s+/).filter(Boolean);
              const computed = window.getComputedStyle(el);

              for (const cls of classes) {
                if (result[cls]) continue; // already sampled
                const styles: Record<string, string> = {};
                for (const prop of props) {
                  const val = computed.getPropertyValue(prop);
                  if (val && val !== '') styles[prop] = val;
                }
                result[cls] = styles;
              }
            }
            return result;
          }, CLASS_STYLE_PROPS);

          return {
            viewport: vp.name,
            url,
            rawHtml,
            inlineStyles,
            computedStyleSample,
            classComputedStyles,
          };
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
