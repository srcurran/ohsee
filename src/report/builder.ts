import { v4 as uuidv4 } from 'uuid';
import {
  CapturedScreenshot,
  StructuralSnapshot,
  VisualAnalysis,
  PixelAnalysis,
  StructuralAnalysis,
  ViewportResult,
  CompareReport,
  ViewportName,
} from '../types/index.js';
import { analyzeStructural } from '../analyze/structural.js';

export function buildReport(params: {
  url1: string;
  url2: string;
  viewportNames: ViewportName[];
  beforeScreenshots: CapturedScreenshot[];
  afterScreenshots: CapturedScreenshot[];
  beforeSnapshots: StructuralSnapshot[];
  afterSnapshots: StructuralSnapshot[];
  visualAnalyses?: VisualAnalysis[];
  pixelAnalyses?: PixelAnalysis[];
  overallSummary: string;
  startedAt: number;
  model: string;
  version: string;
  aiMode: boolean;
}): CompareReport {
  const viewports: ViewportResult[] = params.viewportNames.map((vp) => {
    const beforeScreenshot = params.beforeScreenshots.find((s) => s.viewport === vp)!;
    const afterScreenshot = params.afterScreenshots.find((s) => s.viewport === vp)!;
    const beforeSnapshot = params.beforeSnapshots.find((s) => s.viewport === vp)!;
    const afterSnapshot = params.afterSnapshots.find((s) => s.viewport === vp)!;
    const visualAnalysis = params.visualAnalyses?.find((a) => a.viewport === vp);
    const pixelAnalysis = params.pixelAnalyses?.find((a) => a.viewport === vp);

    const structuralAnalysis: StructuralAnalysis = analyzeStructural(
      beforeSnapshot,
      afterSnapshot,
      vp,
    );

    const hasChanges =
      (visualAnalysis?.changes.length ?? 0) > 0 ||
      (pixelAnalysis?.changedPixels ?? 0) > 0 ||
      structuralAnalysis.htmlChangedLines > 0 ||
      structuralAnalysis.cssChangedLines > 0;

    return {
      viewport: vp,
      beforeScreenshot,
      afterScreenshot,
      visualAnalysis,
      pixelAnalysis,
      structuralAnalysis,
      hasChanges,
    };
  });

  const totalVisualChanges = params.aiMode
    ? viewports.reduce((sum, vr) => sum + (vr.visualAnalysis?.changes.length ?? 0), 0)
    : viewports.reduce((sum, vr) => sum + (vr.pixelAnalysis?.changedPixels ?? 0), 0);

  const totalStructuralChanges = viewports.reduce(
    (sum, vr) => sum + vr.structuralAnalysis.htmlChangedLines + vr.structuralAnalysis.cssChangedLines,
    0,
  );

  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    url1: params.url1,
    url2: params.url2,
    viewports,
    overallSummary: params.overallSummary,
    totalVisualChanges,
    totalStructuralChanges,
    durationMs: Date.now() - params.startedAt,
    ohseeVersion: params.version,
    modelUsed: params.model,
    aiMode: params.aiMode,
  };
}
