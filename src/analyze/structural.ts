import { createTwoFilesPatch } from 'diff';
import * as cheerio from 'cheerio';
import {
  StructuralSnapshot,
  StructuralAnalysis,
  CssClassChange,
  ElementClassChange,
  ContentChange,
  ViewportName,
} from '../types/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function countChangedLines(patch: string): number {
  return patch
    .split('\n')
    .filter(
      (l) =>
        (l.startsWith('+') || l.startsWith('-')) &&
        !l.startsWith('+++') &&
        !l.startsWith('---'),
    ).length;
}

/** Count elements matching a CSS class in a cheerio document. */
function countByClass($: ReturnType<typeof cheerio.load>, cls: string): number {
  try {
    // Use attribute-contains-word selector — safe for any class name
    return $(`[class~="${cls}"]`).length;
  } catch {
    return 0;
  }
}

// ── 1. CSS class computed-style diff ─────────────────────────────────────────

/**
 * Compare computed styles per CSS class between before and after.
 * Reports classes where at least one visual property changed value,
 * together with how many elements use that class in each page.
 */
function diffCssClasses(
  before: StructuralSnapshot,
  after: StructuralSnapshot,
): CssClassChange[] {
  const $before = cheerio.load(before.rawHtml);
  const $after  = cheerio.load(after.rawHtml);
  const changes: CssClassChange[] = [];

  const beforeStyles = before.classComputedStyles;
  const afterStyles  = after.classComputedStyles;

  // Union of all classes seen in either site
  const allClasses = new Set([...Object.keys(beforeStyles), ...Object.keys(afterStyles)]);

  for (const cls of allClasses) {
    const bProps = beforeStyles[cls] ?? {};
    const aProps = afterStyles[cls] ?? {};

    const changedProperties = [];
    const allProps = new Set([...Object.keys(bProps), ...Object.keys(aProps)]);

    for (const prop of allProps) {
      const bVal = bProps[prop] ?? '';
      const aVal = aProps[prop] ?? '';
      if (bVal !== aVal) {
        changedProperties.push({
          property: prop,
          before: bVal || '(not declared)',
          after: aVal || '(not declared)',
        });
      }
    }

    if (changedProperties.length === 0) continue;

    changes.push({
      className: cls,
      changedProperties,
      elementCountBefore: countByClass($before, cls),
      elementCountAfter:  countByClass($after, cls),
    });
  }

  // Sort by total element impact descending so high-impact changes appear first
  return changes
    .sort((a, b) => (b.elementCountBefore + b.elementCountAfter) - (a.elementCountBefore + a.elementCountAfter))
    .slice(0, 60);
}

// ── 2. Element class-attribute diff ──────────────────────────────────────────

/**
 * Find elements whose class attribute changed between pages.
 * Matches by id (reliable) then by semantic tag (nav, header, footer, etc.).
 */
function diffElementClasses(
  beforeHtml: string,
  afterHtml: string,
): ElementClassChange[] {
  const $b = cheerio.load(beforeHtml);
  const $a = cheerio.load(afterHtml);
  const changes: ElementClassChange[] = [];
  const seen = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function compare(identifier: string, bEl: any, aEl: any) {
    if (seen.has(identifier)) return;
    seen.add(identifier);

    const tag = (bEl.tagName ?? bEl.name ?? '').toLowerCase();
    const bClasses = new Set(($b(bEl).attr('class') ?? '').split(/\s+/).filter(Boolean));
    const aClasses = new Set(($a(aEl).attr('class') ?? '').split(/\s+/).filter(Boolean));

    const added   = [...aClasses].filter((c) => !bClasses.has(c));
    const removed = [...bClasses].filter((c) => !aClasses.has(c));
    if (added.length === 0 && removed.length === 0) return;

    changes.push({
      identifier,
      tag,
      classesBefore: [...bClasses],
      classesAfter:  [...aClasses],
      classesAdded:   added,
      classesRemoved: removed,
    });
  }

  // Match by id
  $b('[id]').each((_, el) => {
    const id = $b(el).attr('id');
    if (!id) return;
    const aEls = $a(`[id="${id}"]`);
    if (aEls.length === 0) return;
    compare(`#${id}`, el, aEls[0]);
  });

  // Match semantic singleton tags
  for (const tag of ['nav', 'header', 'footer', 'main', 'aside']) {
    const bEl = $b(tag).first();
    const aEl = $a(tag).first();
    if (bEl.length && aEl.length) compare(`<${tag}>`, bEl[0], aEl[0]);
  }

  return changes.slice(0, 40);
}

// ── 3. Visible content diff ───────────────────────────────────────────────────

/**
 * Compare visible text in headings, buttons, and nav links; image src/alt;
 * and anchor hrefs between before and after.
 */
function diffContent(beforeHtml: string, afterHtml: string): ContentChange[] {
  const $b = cheerio.load(beforeHtml);
  const $a = cheerio.load(afterHtml);
  const changes: ContentChange[] = [];

  // Headings and key text elements
  for (const sel of ['h1', 'h2', 'h3', 'h4', 'button', 'label']) {
    const bEls = $b(sel).toArray();
    const aEls = $a(sel).toArray();
    const len = Math.min(bEls.length, aEls.length, 20);
    for (let i = 0; i < len; i++) {
      const bText = $b(bEls[i]).text().replace(/\s+/g, ' ').trim();
      const aText = $a(aEls[i]).text().replace(/\s+/g, ' ').trim();
      if (!bText || bText === aText) continue;
      const id   = $b(bEls[i]).attr('id');
      const cls  = $b(bEls[i]).attr('class')?.split(/\s+/)[0];
      const loc  = id ? `${sel}#${id}` : cls ? `${sel}.${cls}` : `${sel}:nth(${i + 1})`;
      changes.push({ type: 'text', location: loc, before: bText.slice(0, 200), after: aText.slice(0, 200) });
    }
  }

  // Nav links
  $b('nav a').each((i, el) => {
    const bText = $b(el).text().replace(/\s+/g, ' ').trim();
    const aEl   = $a('nav a').eq(i);
    if (!aEl.length) return;
    const aText = aEl.text().replace(/\s+/g, ' ').trim();
    if (bText && aText && bText !== aText) {
      changes.push({ type: 'text', location: `nav a:nth(${i + 1})`, before: bText, after: aText });
    }
  });

  // Images — compare src and alt
  $b('img').each((i, el) => {
    const bSrc = ($b(el).attr('src') ?? $b(el).attr('data-src') ?? '').trim();
    const bAlt = ($b(el).attr('alt') ?? '').trim();
    const aEl  = $a('img').eq(i);
    if (!aEl.length) return;
    const aSrc = (aEl.attr('src') ?? aEl.attr('data-src') ?? '').trim();
    const aAlt = (aEl.attr('alt') ?? '').trim();
    const loc  = bAlt ? `img[alt="${bAlt}"]` : `img:nth(${i + 1})`;
    if (bSrc && aSrc && bSrc !== aSrc) {
      changes.push({ type: 'image', location: loc, before: bSrc, after: aSrc });
    }
    if (bAlt && aAlt && bAlt !== aAlt) {
      changes.push({ type: 'text', location: loc, before: `alt: ${bAlt}`, after: `alt: ${aAlt}` });
    }
  });

  // Links — compare href
  $b('a[href]').each((i, el) => {
    const bHref = ($b(el).attr('href') ?? '').trim();
    const aEl   = $a('a').eq(i);
    if (!aEl.length) return;
    const aHref = (aEl.attr('href') ?? '').trim();
    if (!bHref || bHref === aHref) return;
    // Skip anchors, mailto, tel — focus on page-level link changes
    if (bHref.startsWith('#') && aHref.startsWith('#')) return;
    const linkText = $b(el).text().replace(/\s+/g, ' ').trim().slice(0, 40);
    const loc = linkText ? `a "${linkText}"` : `a:nth(${i + 1})`;
    changes.push({ type: 'link', location: loc, before: bHref, after: aHref });
  });

  return changes.slice(0, 50);
}

// ── 4. Selector diff (new / removed classes) ─────────────────────────────────

function extractClassSelectors(html: string): Set<string> {
  const $ = cheerio.load(html);
  const selectors = new Set<string>();
  $('[class]').each((_, el) => {
    for (const cls of ($(el).attr('class') ?? '').split(/\s+/)) {
      if (cls) selectors.add(`.${cls}`);
    }
  });
  return selectors;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function analyzeStructural(
  before: StructuralSnapshot,
  after: StructuralSnapshot,
  viewport: ViewportName,
): StructuralAnalysis {
  const htmlPatch = createTwoFilesPatch(
    'before.html', 'after.html',
    before.rawHtml, after.rawHtml,
    '', '', { context: 3 },
  );
  const htmlChangedLines = countChangedLines(htmlPatch);

  const beforeSelectors = extractClassSelectors(before.rawHtml);
  const afterSelectors  = extractClassSelectors(after.rawHtml);
  const addedSelectors   = [...afterSelectors].filter((s) => !beforeSelectors.has(s)).slice(0, 50);
  const removedSelectors = [...beforeSelectors].filter((s) => !afterSelectors.has(s)).slice(0, 50);

  return {
    viewport,
    cssClassChanges:    diffCssClasses(before, after),
    elementClassChanges: diffElementClasses(before.rawHtml, after.rawHtml),
    contentChanges:     diffContent(before.rawHtml, after.rawHtml),
    htmlChangedLines,
    addedSelectors,
    removedSelectors,
    rawHtmlDiff: htmlPatch,
  };
}
