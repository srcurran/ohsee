import { createTwoFilesPatch } from 'diff';
import * as cheerio from 'cheerio';
import { StructuralSnapshot, StructuralAnalysis, ViewportName } from '../types/index.js';

function countChangedLines(patch: string): number {
  return patch
    .split('\n')
    .filter((line) => (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---'))
    .length;
}

function extractSelectors(html: string): Set<string> {
  const $ = cheerio.load(html);
  const selectors = new Set<string>();

  $('[class]').each((_, el) => {
    const classes = $(el).attr('class')?.split(/\s+/) ?? [];
    for (const cls of classes) {
      if (cls) selectors.add(`.${cls}`);
    }
  });

  $('[id]').each((_, el) => {
    const id = $(el).attr('id');
    if (id) selectors.add(`#${id}`);
  });

  return selectors;
}

function summariseDiff(patch: string, changedLines: number): string {
  if (changedLines === 0) return 'No HTML changes detected.';
  const additions = patch.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
  const deletions = patch.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length;
  return `${changedLines} changed lines (${additions} additions, ${deletions} deletions).`;
}

export function analyzeStructural(
  before: StructuralSnapshot,
  after: StructuralSnapshot,
  viewport: ViewportName,
): StructuralAnalysis {
  // HTML diff
  const htmlPatch = createTwoFilesPatch(
    'before.html',
    'after.html',
    before.rawHtml,
    after.rawHtml,
    '',
    '',
    { context: 3 },
  );
  const htmlChangedLines = countChangedLines(htmlPatch);

  // CSS/inline-style diff
  const cssPatch = createTwoFilesPatch(
    'before.styles',
    'after.styles',
    before.inlineStyles,
    after.inlineStyles,
    '',
    '',
    { context: 2 },
  );
  const cssChangedLines = countChangedLines(cssPatch);

  // Selector diff via cheerio
  const beforeSelectors = extractSelectors(before.rawHtml);
  const afterSelectors = extractSelectors(after.rawHtml);

  const addedSelectors = [...afterSelectors].filter((s) => !beforeSelectors.has(s));
  const removedSelectors = [...beforeSelectors].filter((s) => !afterSelectors.has(s));

  // Computed style diff for additional findings
  const additionalFindings: string[] = [];
  const beforeStyleMap = new Map(before.computedStyleSample.map((s) => [s.selector, s.styles]));
  const afterStyleMap = new Map(after.computedStyleSample.map((s) => [s.selector, s.styles]));

  for (const [selector, afterStyles] of afterStyleMap) {
    const beforeStyles = beforeStyleMap.get(selector);
    if (!beforeStyles) {
      additionalFindings.push(`New element in computed styles: ${selector}`);
      continue;
    }
    for (const [prop, afterVal] of Object.entries(afterStyles)) {
      const beforeVal = beforeStyles[prop];
      if (beforeVal !== afterVal) {
        additionalFindings.push(
          `Computed style change on "${selector}": ${prop} changed from "${beforeVal ?? 'unset'}" to "${afterVal}"`,
        );
      }
    }
  }

  for (const [selector] of beforeStyleMap) {
    if (!afterStyleMap.has(selector)) {
      additionalFindings.push(`Element removed from computed styles: ${selector}`);
    }
  }

  return {
    viewport,
    htmlDiffSummary: summariseDiff(htmlPatch, htmlChangedLines),
    htmlChangedLines,
    cssChangedLines,
    addedSelectors: addedSelectors.slice(0, 50), // cap for report size
    removedSelectors: removedSelectors.slice(0, 50),
    confirmsVisualFindings: htmlChangedLines > 0 || cssChangedLines > 0,
    additionalFindings: additionalFindings.slice(0, 20),
    rawHtmlDiff: htmlPatch,
  };
}
