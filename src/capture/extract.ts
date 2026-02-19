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

const PROP_SET = new Set(CLASS_STYLE_PROPS);

/**
 * Walk CSS text and call onRule(selector, body) for every non-at-rule block.
 * Recurses into @media / @supports / @layer / @layer etc.
 */
function walkCssRules(text: string, onRule: (selector: string, body: string) => void): void {
  let i = 0;
  while (i < text.length) {
    const blockStart = text.indexOf('{', i);
    if (blockStart === -1) break;

    let depth = 1;
    let j = blockStart + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }

    const selector = text.slice(i, blockStart).trim();
    const body = text.slice(blockStart + 1, j - 1);

    if (selector.startsWith('@')) {
      walkCssRules(body, onRule);
    } else {
      onRule(selector, body);
    }
    i = j;
  }
}

/**
 * Extract CSS custom property values from :root {} blocks.
 * Returns a map of --variable-name → value.
 */
function parseCssCustomProps(stripped: string): Record<string, string> {
  const props: Record<string, string> = {};
  walkCssRules(stripped, (selector, body) => {
    if (!selector.split(',').some((s) => s.trim() === ':root')) return;
    for (const decl of body.split(';')) {
      const colon = decl.indexOf(':');
      if (colon === -1) continue;
      const name = decl.slice(0, colon).trim();
      const val  = decl.slice(colon + 1).trim();
      if (name.startsWith('--') && val) props[name] = val;
    }
  });
  return props;
}

/**
 * Resolve one level of var(--name[, fallback]) substitution.
 * Handles the most common case; doesn't recurse for variables-in-variables.
 */
function resolveVars(value: string, customProps: Record<string, string>): string {
  return value.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]*))?\)/g, (_match, name: string, fallback?: string) => {
    return customProps[name] ?? fallback?.trim() ?? _match;
  });
}

/**
 * Parse CSS text and extract declared properties for simple class selectors.
 * Handles @media/@supports nesting by recursing into blocks.
 * Only matches bare class selectors like `.foo` or `.foo-bar` — not
 * `.foo .bar`, `.foo:hover`, etc.
 * CSS custom properties (var(--x)) are resolved from :root declarations so
 * differences in variable values are surfaced as property changes.
 */
function parseClassStylesFromCss(cssText: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};

  // Strip block comments
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

  // Collect :root custom properties first so we can resolve var() references
  const customProps = parseCssCustomProps(stripped);

  walkCssRules(stripped, (selector, body) => {
    for (const sel of selector.split(',')) {
      const trimmed = sel.trim();
      const match = trimmed.match(/^\.([\w-]+)$/);
      if (!match) continue;
      const cls = match[1];
      if (!result[cls]) result[cls] = {};
      for (const decl of body.split(';')) {
        const colon = decl.indexOf(':');
        if (colon === -1) continue;
        const prop = decl.slice(0, colon).trim();
        const raw  = decl.slice(colon + 1).trim();
        if (PROP_SET.has(prop) && raw) {
          result[cls][prop] = resolveVars(raw, customProps);
        }
      }
    }
  });

  return result;
}

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

          // Collect stylesheet URLs + inline <style> text from the page,
          // then fetch external sheets from Node.js (no CORS restriction) and
          // parse declared rules. This correctly attributes each property to
          // the class that actually declares it, avoiding the false-positive
          // where multiple co-located classes all showed the same computed value.
          const { sheetUrls, inlineStyleText } = await page.evaluate(() => ({
            sheetUrls: Array.from(document.styleSheets)
              .map((s) => s.href)
              .filter((h): h is string => Boolean(h)),
            inlineStyleText: Array.from(document.querySelectorAll('style'))
              .map((s) => s.textContent ?? '')
              .join('\n'),
          }));

          const cssTexts: string[] = [inlineStyleText];
          await Promise.all(
            sheetUrls.map(async (cssUrl) => {
              try {
                const res = await fetch(cssUrl);
                if (res.ok) cssTexts.push(await res.text());
              } catch {
                // Unreachable URL — skip
              }
            }),
          );

          const classComputedStyles = parseClassStylesFromCss(cssTexts.join('\n'));

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
