import { CompareReport, ViewportResult, VisualChange, ChangeSeverity, ChangeType } from '../types/index.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function severityColor(s: ChangeSeverity): string {
  return s === 'high' ? '#dc2626' : s === 'medium' ? '#d97706' : '#16a34a';
}

function changeTypeBg(t: ChangeType): string {
  const map: Record<ChangeType, string> = {
    layout: '#dbeafe', typography: '#f3e8ff', color: '#fce7f3',
    spacing: '#dcfce7', visibility: '#fef9c3', content: '#ffedd5',
    image: '#e0f2fe', 'new-element': '#d1fae5', 'removed-element': '#fee2e2', other: '#f1f5f9',
  };
  return map[t] ?? '#f1f5f9';
}

function changeTypeFg(t: ChangeType): string {
  const map: Record<ChangeType, string> = {
    layout: '#1d4ed8', typography: '#7c3aed', color: '#be185d',
    spacing: '#15803d', visibility: '#854d0e', content: '#9a3412',
    image: '#0369a1', 'new-element': '#065f46', 'removed-element': '#991b1b', other: '#475569',
  };
  return map[t] ?? '#475569';
}

function renderChange(c: VisualChange): string {
  return `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:10px;background:#fff;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="background:${changeTypeBg(c.changeType)};color:${changeTypeFg(c.changeType)};font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(c.changeType)}</span>
        <span style="background:${severityColor(c.severity)}22;color:${severityColor(c.severity)};font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(c.severity)}</span>
        <code style="font-size:12px;color:#64748b;background:#f8fafc;padding:1px 6px;border-radius:4px;">${escapeHtml(c.element)}</code>
      </div>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;">${escapeHtml(c.description)}</p>
    </div>`;
}

function percentBar(pct: number): string {
  const color = pct > 20 ? '#dc2626' : pct > 5 ? '#d97706' : '#16a34a';
  const width = Math.min(100, pct).toFixed(1);
  return `
    <div style="background:#f1f5f9;border-radius:99px;height:8px;margin-top:6px;overflow:hidden;">
      <div style="background:${color};height:100%;width:${width}%;border-radius:99px;transition:width 0.3s;"></div>
    </div>`;
}

function renderVisualSection(vr: ViewportResult): string {
  if (vr.pixelAnalysis) {
    const pa = vr.pixelAnalysis;
    const pct = pa.percentChanged.toFixed(2);
    const color = pa.percentChanged > 20 ? '#dc2626' : pa.percentChanged > 5 ? '#d97706' : '#16a34a';
    const heightNote = pa.beforeHeight !== pa.afterHeight
      ? `<p style="font-size:12px;color:#94a3b8;margin:8px 0 0;font-style:italic;">Page heights differ: before ${pa.beforeHeight}px, after ${pa.afterHeight}px. Shorter page padded with white for comparison.</p>`
      : '';
    return `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px;">Pixel Diff</h3>
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:16px;">
          <div style="background:#f1f5f9;border-radius:8px;padding:10px 20px;text-align:center;min-width:140px;">
            <p style="font-size:28px;font-weight:700;color:${color};margin:0;">${pct}%</p>
            <p style="font-size:12px;color:#64748b;margin:2px 0 0;">pixels changed</p>
            ${percentBar(pa.percentChanged)}
          </div>
          <div style="background:#f1f5f9;border-radius:8px;padding:10px 20px;text-align:center;min-width:140px;">
            <p style="font-size:24px;font-weight:700;color:#0f172a;margin:0;">${pa.changedPixels.toLocaleString()}</p>
            <p style="font-size:12px;color:#64748b;margin:2px 0 0;">of ${pa.totalPixels.toLocaleString()} total</p>
          </div>
        </div>
        ${heightNote}
        <p style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 8px;">Diff image (red = changed, blue = added content)</p>
        <img src="data:image/png;base64,${pa.diffImageBase64}"
             alt="Pixel diff at ${vr.viewport}"
             style="width:100%;border:1px solid #e2e8f0;border-radius:8px;display:block;" />
      </div>`;
  }

  if (vr.visualAnalysis) {
    const va = vr.visualAnalysis;
    const changesHtml = va.changes.length === 0
      ? `<p style="color:#64748b;font-style:italic;margin:0;">No visual changes detected at this viewport.</p>`
      : va.changes.map(renderChange).join('');
    return `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px;">
          Visual Changes
          <span style="font-size:13px;font-weight:500;color:#64748b;margin-left:8px;">(${va.changes.length} found · ${va.promptTokens + va.outputTokens} tokens)</span>
        </h3>
        ${changesHtml}
        ${va.confidenceNote ? `<p style="font-size:12px;color:#94a3b8;margin:8px 0 0;font-style:italic;">${escapeHtml(va.confidenceNote)}</p>` : ''}
      </div>
      <div style="background:#f8fafc;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${escapeHtml(va.summary)}</p>
      </div>`;
  }

  return '';
}

function renderViewportPanel(vr: ViewportResult, idx: number): string {
  const { viewport, beforeScreenshot, afterScreenshot, structuralAnalysis } = vr;
  const display = idx === 0 ? 'block' : 'none';

  const addedSel = structuralAnalysis.addedSelectors
    .map((s) => `<code style="font-size:12px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(s)}</code>`)
    .join(' ');

  const removedSel = structuralAnalysis.removedSelectors
    .map((s) => `<code style="font-size:12px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(s)}</code>`)
    .join(' ');

  const additionalHtml = structuralAnalysis.additionalFindings.length === 0 ? '' : `
    <div style="margin-top:20px;">
      <h4 style="font-size:14px;font-weight:600;color:#334155;margin:0 0 8px;">DOM Changes Not Visible in Screenshots</h4>
      <ul style="margin:0;padding-left:20px;color:#64748b;font-size:13px;line-height:1.7;">
        ${structuralAnalysis.additionalFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
      </ul>
    </div>`;

  const diffHtml = escapeHtml(structuralAnalysis.rawHtmlDiff).slice(0, 50000);

  return `
  <div id="panel-${viewport}" style="display:${display};">
    <!-- Screenshots side by side -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
      <div>
        <p style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Before (URL 1)</p>
        <img src="data:image/png;base64,${beforeScreenshot.imageBase64}"
             alt="Before screenshot at ${viewport}"
             style="width:100%;border:1px solid #e2e8f0;border-radius:8px;display:block;" />
      </div>
      <div>
        <p style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">After (URL 2)</p>
        <img src="data:image/png;base64,${afterScreenshot.imageBase64}"
             alt="After screenshot at ${viewport}"
             style="width:100%;border:1px solid #e2e8f0;border-radius:8px;display:block;" />
      </div>
    </div>

    ${renderVisualSection(vr)}

    <!-- Structural diff -->
    <div style="margin-bottom:20px;">
      <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px;">Structural Diff</h3>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="background:#f1f5f9;border-radius:8px;padding:10px 16px;text-align:center;min-width:120px;">
          <p style="font-size:24px;font-weight:700;color:#0f172a;margin:0;">${structuralAnalysis.htmlChangedLines}</p>
          <p style="font-size:12px;color:#64748b;margin:2px 0 0;">HTML changed lines</p>
        </div>
        <div style="background:#f1f5f9;border-radius:8px;padding:10px 16px;text-align:center;min-width:120px;">
          <p style="font-size:24px;font-weight:700;color:#0f172a;margin:0;">${structuralAnalysis.cssChangedLines}</p>
          <p style="font-size:12px;color:#64748b;margin:2px 0 0;">CSS changed lines</p>
        </div>
        <div style="background:#d1fae5;border-radius:8px;padding:10px 16px;text-align:center;min-width:120px;">
          <p style="font-size:24px;font-weight:700;color:#065f46;margin:0;">+${structuralAnalysis.addedSelectors.length}</p>
          <p style="font-size:12px;color:#065f46;margin:2px 0 0;">new selectors</p>
        </div>
        <div style="background:#fee2e2;border-radius:8px;padding:10px 16px;text-align:center;min-width:120px;">
          <p style="font-size:24px;font-weight:700;color:#991b1b;margin:0;">-${structuralAnalysis.removedSelectors.length}</p>
          <p style="font-size:12px;color:#991b1b;margin:2px 0 0;">removed selectors</p>
        </div>
      </div>

      ${addedSel || removedSel ? `
      <div style="margin-bottom:12px;">
        ${addedSel ? `<div style="margin-bottom:6px;"><span style="font-size:12px;font-weight:600;color:#065f46;">Added: </span>${addedSel}</div>` : ''}
        ${removedSel ? `<div><span style="font-size:12px;font-weight:600;color:#991b1b;">Removed: </span>${removedSel}</div>` : ''}
      </div>` : ''}

      <details style="margin-top:12px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:#475569;user-select:none;padding:6px 0;">
          Show HTML diff (${structuralAnalysis.htmlDiffSummary})
        </summary>
        <pre style="margin:10px 0 0;padding:12px;background:#0f172a;color:#e2e8f0;border-radius:8px;font-size:11px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">${diffHtml}</pre>
      </details>
    </div>

    ${additionalHtml}
  </div>`;
}

export function renderReport(report: CompareReport): string {
  const tabs = report.viewports.map((vr, i) => {
    const dot = vr.hasChanges
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-right:6px;vertical-align:middle;"></span>`
      : '';
    return `<button
      class="tab-btn"
      data-target="panel-${vr.viewport}"
      onclick="switchTab(this)"
      style="padding:10px 20px;border:none;background:${i === 0 ? '#6366f1' : '#f1f5f9'};color:${i === 0 ? '#fff' : '#334155'};border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.15s;"
    >${dot}${vr.viewport.charAt(0).toUpperCase() + vr.viewport.slice(1)}</button>`;
  }).join('\n');

  const panels = report.viewports.map((vr, i) => renderViewportPanel(vr, i)).join('\n');
  const ts = new Date(report.createdAt).toLocaleString();
  const duration = (report.durationMs / 1000).toFixed(1);

  const modeBadge = report.aiMode
    ? `<span style="background:#e0e7ff;color:#4338ca;font-size:11px;padding:3px 10px;border-radius:99px;font-weight:600;">AI analysis</span>`
    : `<span style="background:#fef3c7;color:#92400e;font-size:11px;padding:3px 10px;border-radius:99px;font-weight:600;">pixel diff · no AI</span>`;

  const summaryLabel = report.aiMode ? 'visual changes' : 'changed pixels';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ohsee report — ${escapeHtml(report.url1)} vs ${escapeHtml(report.url2)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; }
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
    a { color: #6366f1; }
    code { font-family: 'SF Mono', 'Fira Code', Consolas, monospace; }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <span style="font-size:28px;font-weight:800;color:#6366f1;letter-spacing:-1px;">ohsee</span>
        <span style="background:#f1f5f9;color:#475569;font-size:12px;padding:3px 10px;border-radius:99px;">v${escapeHtml(report.ohseeVersion)}</span>
        ${modeBadge}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div>
          <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">URL 1 (before)</p>
          <a href="${escapeHtml(report.url1)}" style="font-size:14px;word-break:break-all;">${escapeHtml(report.url1)}</a>
        </div>
        <div>
          <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">URL 2 (after)</p>
          <a href="${escapeHtml(report.url2)}" style="font-size:14px;word-break:break-all;">${escapeHtml(report.url2)}</a>
        </div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;color:#64748b;font-size:13px;">
        <span>📅 ${escapeHtml(ts)}</span>
        <span>⏱ ${escapeHtml(duration)}s</span>
        ${report.aiMode ? `<span>🤖 ${escapeHtml(report.modelUsed)}</span>` : ''}
        <span>🆔 ${escapeHtml(report.id)}</span>
      </div>
    </div>

    <!-- Executive Summary -->
    <div style="background:#6366f1;border-radius:12px;padding:24px;margin-bottom:24px;color:#fff;">
      <h2 style="font-size:18px;font-weight:700;margin:0 0 12px;">Summary</h2>
      <p style="margin:0 0 16px;line-height:1.6;opacity:0.95;">${escapeHtml(report.overallSummary)}</p>
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 20px;text-align:center;">
          <p style="font-size:28px;font-weight:800;margin:0;">${report.totalVisualChanges.toLocaleString()}</p>
          <p style="font-size:12px;opacity:0.8;margin:2px 0 0;">${summaryLabel}</p>
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 20px;text-align:center;">
          <p style="font-size:28px;font-weight:800;margin:0;">${report.totalStructuralChanges}</p>
          <p style="font-size:12px;opacity:0.8;margin:2px 0 0;">structural changed lines</p>
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 20px;text-align:center;">
          <p style="font-size:28px;font-weight:800;margin:0;">${report.viewports.filter((v) => v.hasChanges).length}/${report.viewports.length}</p>
          <p style="font-size:12px;opacity:0.8;margin:2px 0 0;">viewports affected</p>
        </div>
      </div>
    </div>

    <!-- Viewport tabs + panels -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">
        ${tabs}
      </div>
      ${panels}
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">
      Generated by <strong>ohsee</strong> v${escapeHtml(report.ohseeVersion)}
      ${report.aiMode ? ` · Model: ${escapeHtml(report.modelUsed)}` : ' · pixel diff mode'}
    </div>

  </div>

  <script>
    function switchTab(btn) {
      document.querySelectorAll('.tab-btn').forEach(function(b) {
        b.style.background = '#f1f5f9';
        b.style.color = '#334155';
      });
      btn.style.background = '#6366f1';
      btn.style.color = '#fff';
      var target = btn.getAttribute('data-target');
      document.querySelectorAll('[id^="panel-"]').forEach(function(p) {
        p.style.display = p.id === target ? 'block' : 'none';
      });
    }
  </script>
</body>
</html>`;
}
