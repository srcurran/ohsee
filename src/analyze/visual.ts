import Anthropic from '@anthropic-ai/sdk';
import { CapturedScreenshot, VisualAnalysis, VisualChange, ViewportName } from '../types/index.js';
import { VIEWPORTS } from '../capture/screenshot.js';

const VISUAL_PROMPT = (viewport: ViewportName, width: number, height: number) => `
You are a UI regression testing assistant. You will be shown two screenshots of the same page at the ${viewport} viewport (${width}×${height}px).

The FIRST image is "before" (URL 1) and the SECOND image is "after" (URL 2).

Carefully examine all visual differences between the two screenshots. These are FULL-PAGE screenshots, so examine the entire page top to bottom.

Return ONLY valid JSON (no markdown fences, no extra text) in this exact shape:
{
  "changes": [
    {
      "element": "<CSS selector or plain English element name>",
      "changeType": "<one of: layout|typography|color|spacing|visibility|content|image|new-element|removed-element|other>",
      "description": "<specific and measurable — not 'the layout changed' but 'hero padding-top increased ~12px'>",
      "severity": "<low|medium|high>"
    }
  ],
  "summary": "<1–3 sentence summary of the overall visual differences at this viewport>",
  "confidenceNote": "<optional: note if image quality or similarity makes detection uncertain>"
}

If there are no changes, return { "changes": [], "summary": "No visual differences detected.", "confidenceNote": null }.
`.trim();

const SUMMARY_PROMPT = (viewportSummaries: string) => `
You are a UI regression testing assistant. Four viewports have been analysed and each produced a summary of visual changes.

Viewport summaries:
${viewportSummaries}

Write a concise 2–4 sentence executive summary of the overall changes across all viewports. Focus on the most impactful changes and any patterns (e.g. "affects all viewports" or "only visible on mobile"). Output plain text only — no markdown, no bullet points.
`.trim();

async function callVisual(
  client: Anthropic,
  before: CapturedScreenshot,
  after: CapturedScreenshot,
  model: string,
  debug: boolean,
): Promise<VisualAnalysis> {
  const vp = VIEWPORTS.find((v) => v.name === before.viewport)!;

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: VISUAL_PROMPT(before.viewport, vp.width, vp.height),
          },
          {
            type: 'image',
            source: { type: 'base64', media_type: before.mediaType, data: before.imageBase64 },
          },
          {
            type: 'image',
            source: { type: 'base64', media_type: after.mediaType, data: after.imageBase64 },
          },
        ],
      },
    ],
  });

  const rawText = message.content.find((b) => b.type === 'text')?.text ?? '';

  if (debug) {
    process.stderr.write(`[debug] Visual response (${before.viewport}):\n${rawText}\n\n`);
  }

  let parsed: { changes: VisualChange[]; summary: string; confidenceNote?: string };

  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Retry: strip potential markdown fences
    const stripped = rawText.replace(/```(?:json)?/gi, '').trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      parsed = {
        changes: [],
        summary: `Parse error — raw response: ${rawText.slice(0, 200)}`,
        confidenceNote: 'Failed to parse Claude response as JSON.',
      };
    }
  }

  return {
    viewport: before.viewport,
    model,
    changes: parsed.changes ?? [],
    summary: parsed.summary ?? '',
    confidenceNote: parsed.confidenceNote ?? undefined,
    promptTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

export async function analyzeVisual(
  beforeScreenshots: CapturedScreenshot[],
  afterScreenshots: CapturedScreenshot[],
  viewportNames: ViewportName[],
  model: string,
  debug: boolean,
): Promise<VisualAnalysis[]> {
  const client = new Anthropic();

  // Run all viewport comparisons in parallel
  const analyses = await Promise.all(
    viewportNames.map((vp) => {
      const before = beforeScreenshots.find((s) => s.viewport === vp)!;
      const after = afterScreenshots.find((s) => s.viewport === vp)!;
      return callVisual(client, before, after, model, debug);
    }),
  );

  return analyses;
}

export async function generateSummary(
  analyses: VisualAnalysis[],
  model: string,
  debug: boolean,
): Promise<string> {
  const client = new Anthropic();

  const viewportSummaries = analyses
    .map((a) => `${a.viewport.toUpperCase()}: ${a.summary}`)
    .join('\n');

  const message = await client.messages.create({
    model,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: SUMMARY_PROMPT(viewportSummaries),
      },
    ],
  });

  const text = message.content.find((b) => b.type === 'text')?.text ?? 'No summary generated.';

  if (debug) {
    process.stderr.write(`[debug] Summary response:\n${text}\n\n`);
  }

  return text.trim();
}
