export type ViewportName = 'mobile' | 'tablet' | 'laptop' | 'desktop';

export type ChangeType =
  | 'layout'
  | 'typography'
  | 'color'
  | 'spacing'
  | 'visibility'
  | 'content'
  | 'image'
  | 'new-element'
  | 'removed-element'
  | 'other';

export type ChangeSeverity = 'low' | 'medium' | 'high';

export interface ViewportConfig {
  name: ViewportName;
  width: number;
  height: number;
}

export interface CapturedScreenshot {
  viewport: ViewportName;
  url: string;
  imageBase64: string;
  mediaType: 'image/png';
  capturedAt: string;
}

export interface StructuralSnapshot {
  viewport: ViewportName;
  url: string;
  rawHtml: string;
  inlineStyles: string;
  computedStyleSample: Array<{ selector: string; styles: Record<string, string> }>;
  /** Computed styles sampled from the first element that uses each CSS class. */
  classComputedStyles: Record<string, Record<string, string>>;
}

export interface VisualChange {
  element: string;
  changeType: ChangeType;
  description: string;
  severity: ChangeSeverity;
}

export interface VisualAnalysis {
  viewport: ViewportName;
  model: string;
  changes: VisualChange[];
  summary: string;
  confidenceNote?: string;
  promptTokens: number;
  outputTokens: number;
}

export interface PixelAnalysis {
  viewport: ViewportName;
  diffImageBase64: string;
  totalPixels: number;
  changedPixels: number;
  percentChanged: number;
  beforeWidth: number;
  beforeHeight: number;
  afterHeight: number;
}

// ── Structural analysis types ────────────────────────────────────────────────

/** A single CSS property that changed value on a class. */
export interface CssPropertyChange {
  property: string;
  before: string;
  after: string;
}

/**
 * A CSS class whose computed visual properties changed between the two pages,
 * plus how many elements in each page use that class.
 */
export interface CssClassChange {
  className: string;
  changedProperties: CssPropertyChange[];
  elementCountBefore: number;
  elementCountAfter: number;
}

/**
 * An element (matched by id or semantic tag) whose class attribute changed.
 */
export interface ElementClassChange {
  identifier: string;    // e.g. '#hero' or '<header>'
  tag: string;
  classesBefore: string[];
  classesAfter: string[];
  classesAdded: string[];
  classesRemoved: string[];
}

/** A piece of visible content (text, image, link) that changed. */
export interface ContentChange {
  type: 'text' | 'image' | 'link';
  location: string;      // human-readable — e.g. 'h1', 'img[alt="Hero"]', 'a "Sign up"'
  before: string;
  after: string;
}

export interface StructuralAnalysis {
  viewport: ViewportName;
  cssClassChanges: CssClassChange[];
  elementClassChanges: ElementClassChange[];
  contentChanges: ContentChange[];
  /** Total changed HTML lines — kept for the summary stat. */
  htmlChangedLines: number;
  /** CSS class selectors that are new in URL 2. */
  addedSelectors: string[];
  /** CSS class selectors that were removed from URL 2. */
  removedSelectors: string[];
  /** Raw unified diff — shown collapsed in the report for debugging. */
  rawHtmlDiff: string;
}

export interface ViewportResult {
  viewport: ViewportName;
  beforeScreenshot: CapturedScreenshot;
  afterScreenshot: CapturedScreenshot;
  visualAnalysis?: VisualAnalysis;
  pixelAnalysis?: PixelAnalysis;
  structuralAnalysis: StructuralAnalysis;
  hasChanges: boolean;
}

export interface CompareReport {
  id: string;
  createdAt: string;
  url1: string;
  url2: string;
  viewports: ViewportResult[];
  overallSummary: string;
  totalVisualChanges: number;
  totalStructuralChanges: number;
  durationMs: number;
  ohseeVersion: string;
  modelUsed: string;
  aiMode: boolean;
}

export interface CompareOptions {
  output?: string;
  viewports?: ViewportName[];
  wait: number;
  model: string;
  debug: boolean;
  open: boolean;
  noAi: boolean;
}

export type ProgressCallback = (step: string, detail?: string) => void;
