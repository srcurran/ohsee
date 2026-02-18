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
  imageBase64: string; // raw base64, no data: prefix
  mediaType: 'image/png';
  capturedAt: string; // ISO 8601
}

export interface StructuralSnapshot {
  viewport: ViewportName;
  url: string;
  rawHtml: string;
  inlineStyles: string;
  computedStyleSample: Array<{ selector: string; styles: Record<string, string> }>;
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
  diffImageBase64: string; // base64 PNG with changed pixels highlighted
  totalPixels: number;
  changedPixels: number;
  percentChanged: number;
  beforeWidth: number;
  beforeHeight: number;
  afterHeight: number; // full-page heights can differ
}

export interface StructuralAnalysis {
  viewport: ViewportName;
  htmlDiffSummary: string;
  htmlChangedLines: number;
  cssChangedLines: number;
  addedSelectors: string[];
  removedSelectors: string[];
  confirmsVisualFindings: boolean;
  additionalFindings: string[];
  rawHtmlDiff: string;
}

export interface ViewportResult {
  viewport: ViewportName;
  beforeScreenshot: CapturedScreenshot;
  afterScreenshot: CapturedScreenshot;
  visualAnalysis?: VisualAnalysis;  // undefined in --no-ai mode
  pixelAnalysis?: PixelAnalysis;    // defined in --no-ai mode
  structuralAnalysis: StructuralAnalysis;
  hasChanges: boolean;
}

export interface CompareReport {
  id: string; // UUID
  createdAt: string; // ISO 8601
  url1: string;
  url2: string;
  viewports: ViewportResult[];
  overallSummary: string;
  totalVisualChanges: number;
  totalStructuralChanges: number;
  durationMs: number;
  ohseeVersion: string;
  modelUsed: string;
  aiMode: boolean; // false when --no-ai
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
