import {
  CompareReport,
  ViewportResult,
  VisualChange,
  ChangeSeverity,
  ChangeType,
  CssClassChange,
  ElementClassChange,
  ContentChange,
} from '../types/index.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Short display label for a URL: hostname + path (no scheme, no query) */
function urlLabel(url: string, maxLen = 45): string {
  try {
    const p = new URL(url);
    const label = p.hostname + (p.pathname === '/' ? '' : p.pathname);
    return label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;
  } catch {
    return url.slice(0, maxLen);
  }
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
  return `<div style="background:#e2e8f0;border-radius:99px;height:6px;margin-top:6px;overflow:hidden;">
    <div style="background:${color};height:100%;width:${width}%;border-radius:99px;"></div>
  </div>`;
}

const COL_LABEL = 'font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

function renderScreenshotSection(
  vr: ViewportResult,
  url1: string,
  url2: string,
  imagePaths: Record<string, string>,
): string {
  const label1 = escapeHtml(urlLabel(url1));
  const label2 = escapeHtml(urlLabel(url2));
  const vp = vr.viewport;

  // Always render the 3-column overlay if pixel analysis is available
  const pa = vr.pixelAnalysis;
  const va = vr.visualAnalysis;

  if (!pa && !va) return '';

  let screenshotHtml = '';

  if (pa) {
    const pct = pa.percentChanged.toFixed(2);
    const color = pa.percentChanged > 20 ? '#dc2626' : pa.percentChanged > 5 ? '#d97706' : '#16a34a';
    const heightNote = pa.beforeHeight !== pa.afterHeight
      ? `<p style="font-size:12px;color:#94a3b8;margin:10px 0 0;font-style:italic;text-align:center;">Page heights differ: ${pa.beforeHeight}px vs ${pa.afterHeight}px — shorter page padded for comparison.</p>`
      : '';

    screenshotHtml = `
      <!-- Three-column: URL1 | Diff | URL2 -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;align-items:start;">
        <div>
          <p style="${COL_LABEL}" title="${escapeHtml(url1)}">${label1}</p>
          <img src="${imagePaths[`before-${vp}`]}"
               alt="Screenshot of ${label1}"
               style="width:100%;border:1px solid #e2e8f0;border-radius:8px;display:block;" />
        </div>
        <div>
          <p style="${COL_LABEL}">Pixel diff <span style="color:${color};font-size:13px;font-weight:700;">${pct}% changed</span></p>
          <img src="${imagePaths[`diff-${vp}`]}"
               alt="Pixel diff at ${vp}"
               style="width:100%;border:2px solid ${color}40;border-radius:8px;display:block;" />
        </div>
        <div>
          <p style="${COL_LABEL}" title="${escapeHtml(url2)}">${label2}</p>
          <img src="${imagePaths[`after-${vp}`]}"
               alt="Screenshot of ${label2}"
               style="width:100%;border:1px solid #e2e8f0;border-radius:8px;display:block;" />
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;align-items:center;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;min-width:140px;">
          <p style="font-size:22px;font-weight:700;color:${color};margin:0;">${pct}%</p>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0;">pixels changed</p>
          ${percentBar(pa.percentChanged)}
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;min-width:140px;">
          <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0;">${pa.changedPixels.toLocaleString()}</p>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0;">of ${pa.totalPixels.toLocaleString()} total</p>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin:0;font-style:italic;">Hot pink = changed pixels. Alignment-aware per section.</p>
      </div>
      ${heightNote}`;
  }

  if (va) {
    const changesHtml = va.changes.length === 0
      ? `<p style="color:#64748b;font-style:italic;margin:0;">No visual changes detected at this viewport.</p>`
      : va.changes.map(renderChange).join('');
    screenshotHtml += `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px;">
          AI Visual Analysis
          <span style="font-size:13px;font-weight:500;color:#64748b;margin-left:8px;">(${va.changes.length} changes · ${va.promptTokens + va.outputTokens} tokens)</span>
        </h3>
        ${changesHtml}
        ${va.confidenceNote ? `<p style="font-size:12px;color:#94a3b8;margin:8px 0 0;font-style:italic;">${escapeHtml(va.confidenceNote)}</p>` : ''}
      </div>
      <div style="background:#f8fafc;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${escapeHtml(va.summary)}</p>
      </div>`;
  }

  return screenshotHtml;
}

const SITE_LABEL = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px;';

function renderCssClassCard(c: CssClassChange, label1: string, label2: string): string {
  const elementCount = c.changeKind === 'added' ? c.elementCountAfter : c.elementCountBefore;
  const impactColor = elementCount >= 20 ? '#dc2626' : elementCount >= 6 ? '#d97706' : '#64748b';

  let badge = '';
  let table = '';

  if (c.changeKind === 'changed') {
    badge = `<span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:0.05em;">changed</span>`;
    const propRows = c.changedProperties.map((p) =>
      `<tr>
        <td style="padding:3px 10px 3px 0;font-size:12px;font-family:'SF Mono','Fira Code',Consolas,monospace;color:#475569;white-space:nowrap;">${escapeHtml(p.property)}</td>
        <td style="padding:3px 8px;font-size:12px;font-family:'SF Mono','Fira Code',Consolas,monospace;color:#7f1d1d;background:#fef2f2;border-radius:4px;white-space:nowrap;">${escapeHtml(p.before)}</td>
        <td style="padding:3px 8px;font-size:12px;font-family:'SF Mono','Fira Code',Consolas,monospace;color:#14532d;background:#f0fdf4;border-radius:4px;white-space:nowrap;">${escapeHtml(p.after)}</td>
      </tr>`,
    ).join('');
    table = `<table style="border-collapse:separate;border-spacing:0 3px;">
      <thead><tr>
        <th style="${SITE_LABEL}color:#94a3b8;text-align:left;padding-right:10px;font-weight:600;">property</th>
        <th style="${SITE_LABEL}color:#991b1b;text-align:left;padding-right:10px;">${escapeHtml(label1)}</th>
        <th style="${SITE_LABEL}color:#15803d;text-align:left;">${escapeHtml(label2)}</th>
      </tr></thead>
      <tbody>${propRows}</tbody>
    </table>`;
  } else if (c.changeKind === 'added') {
    badge = `<span style="background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:0.05em;">new in ${escapeHtml(label2)}</span>`;
    const propRows = c.changedProperties.map((p) =>
      `<tr>
        <td style="padding:3px 10px 3px 0;font-size:12px;font-family:'SF Mono','Fira Code',Consolas,monospace;color:#475569;white-space:nowrap;">${escapeHtml(p.property)}</td>
        <td style="padding:3px 8px;font-size:12px;font-family:'SF Mono','Fira Code',Consolas,monospace;color:#14532d;background:#f0fdf4;border-radius:4px;white-space:nowrap;">${escapeHtml(p.after)}</td>
      </tr>`,
    ).join('');
    table = `<table style="border-collapse:separate;border-spacing:0 3px;">
      <thead><tr>
        <th style="${SITE_LABEL}color:#94a3b8;text-align:left;padding-right:10px;font-weight:600;">property</th>
        <th style="${SITE_LABEL}color:#15803d;text-align:left;">${escapeHtml(label2)}</th>
      </tr></thead>
      <tbody>${propRows}</tbody>
    </table>`;
  } else {
    badge = `<span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:0.05em;">removed in ${escapeHtml(label2)}</span>`;
    const propRows = c.changedProperties.map((p) =>
      `<tr>
        <td style="padding:3px 10px 3px 0;font-size:12px;font-family:'SF Mono','Fira Code',Consolas,monospace;color:#475569;white-space:nowrap;">${escapeHtml(p.property)}</td>
        <td style="padding:3px 8px;font-size:12px;font-family:'SF Mono','Fira Code',Consolas,monospace;color:#7f1d1d;background:#fef2f2;border-radius:4px;white-space:nowrap;">${escapeHtml(p.before)}</td>
      </tr>`,
    ).join('');
    table = `<table style="border-collapse:separate;border-spacing:0 3px;">
      <thead><tr>
        <th style="${SITE_LABEL}color:#94a3b8;text-align:left;padding-right:10px;font-weight:600;">property</th>
        <th style="${SITE_LABEL}color:#991b1b;text-align:left;">${escapeHtml(label1)}</th>
      </tr></thead>
      <tbody>${propRows}</tbody>
    </table>`;
  }

  return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:8px;background:#fff;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <code style="font-size:13px;font-weight:700;color:#0f172a;background:#f1f5f9;padding:2px 8px;border-radius:4px;">.${escapeHtml(c.className)}</code>
      ${badge}
      ${elementCount > 0 ? `<span style="font-size:11px;color:${impactColor};font-weight:600;">${elementCount} element${elementCount !== 1 ? 's' : ''}</span>` : ''}
    </div>
    ${table}
  </div>`;
}

function renderCssClassChanges(changes: CssClassChange[], label1: string, label2: string): string {
  if (changes.length === 0) return '';
  const changed  = changes.filter((c) => c.changeKind === 'changed');
  const added    = changes.filter((c) => c.changeKind === 'added');
  const removed  = changes.filter((c) => c.changeKind === 'removed');

  const totalLabel = [
    changed.length  > 0 ? `${changed.length} changed`  : '',
    added.length    > 0 ? `${added.length} new`         : '',
    removed.length  > 0 ? `${removed.length} removed`   : '',
  ].filter(Boolean).join(', ');

  return `
  <div style="margin-bottom:20px;">
    <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 10px;">CSS Class Changes <span style="font-size:12px;font-weight:500;color:#64748b;">(${totalLabel})</span></h4>
    ${changes.map((c) => renderCssClassCard(c, label1, label2)).join('')}
  </div>`;
}

function renderElementClassChanges(changes: ElementClassChange[], label1: string, label2: string): string {
  if (changes.length === 0) return '';
  const rows = changes.map((c) => {
    // classesRemoved = only in site 1; classesAdded = only in site 2
    const site1Only = c.classesRemoved.map((cls) =>
      `<code style="font-size:11px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(cls)}</code>`,
    ).join('');
    const site2Only = c.classesAdded.map((cls) =>
      `<code style="font-size:11px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(cls)}</code>`,
    ).join('');
    return `<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;align-items:start;">
      <code style="font-size:12px;color:#475569;background:#f8fafc;padding:2px 8px;border-radius:4px;white-space:nowrap;">${escapeHtml(c.identifier)}</code>
      <div>
        ${site1Only ? `<p style="${SITE_LABEL}color:#991b1b;">${escapeHtml(label1)}</p><div style="display:flex;flex-wrap:wrap;gap:2px;">${site1Only}</div>` : '<span style="font-size:11px;color:#cbd5e1;">—</span>'}
      </div>
      <div>
        ${site2Only ? `<p style="${SITE_LABEL}color:#065f46;">${escapeHtml(label2)}</p><div style="display:flex;flex-wrap:wrap;gap:2px;">${site2Only}</div>` : '<span style="font-size:11px;color:#cbd5e1;">—</span>'}
      </div>
    </div>`;
  }).join('');
  return `
  <div style="margin-bottom:20px;">
    <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 10px;">Element Class Changes <span style="font-size:12px;font-weight:500;color:#64748b;">(${changes.length} element${changes.length !== 1 ? 's' : ''})</span></h4>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:0 12px;background:#fff;">
      <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:10px;padding:6px 0;border-bottom:2px solid #e2e8f0;">
        <span></span>
        <span style="${SITE_LABEL}color:#991b1b;">${escapeHtml(label1)}</span>
        <span style="${SITE_LABEL}color:#065f46;">${escapeHtml(label2)}</span>
      </div>
      ${rows}
    </div>
  </div>`;
}

function renderContentChanges(changes: ContentChange[], label1: string, label2: string): string {
  if (changes.length === 0) return '';
  const typeBg: Record<string, string> = { text: '#f3e8ff', image: '#e0f2fe', link: '#ffedd5' };
  const typeFg: Record<string, string> = { text: '#7c3aed', image: '#0369a1', link: '#9a3412' };
  const rows = changes.map((c) => {
    const bg = typeBg[c.type] ?? '#f1f5f9';
    const fg = typeFg[c.type] ?? '#475569';
    return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:8px;background:#fff;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="background:${bg};color:${fg};font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(c.type)}</span>
        <code style="font-size:12px;color:#64748b;">${escapeHtml(c.location)}</code>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <p style="${SITE_LABEL}color:#991b1b;margin-bottom:4px;">${escapeHtml(label1)}</p>
          <div style="background:#fef2f2;border-radius:6px;padding:6px 10px;font-size:12px;color:#7f1d1d;font-family:'SF Mono','Fira Code',Consolas,monospace;word-break:break-all;">${escapeHtml(c.before)}</div>
        </div>
        <div>
          <p style="${SITE_LABEL}color:#15803d;margin-bottom:4px;">${escapeHtml(label2)}</p>
          <div style="background:#f0fdf4;border-radius:6px;padding:6px 10px;font-size:12px;color:#14532d;font-family:'SF Mono','Fira Code',Consolas,monospace;word-break:break-all;">${escapeHtml(c.after)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  return `
  <div style="margin-bottom:20px;">
    <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 10px;">Content Changes <span style="font-size:12px;font-weight:500;color:#64748b;">(${changes.length})</span></h4>
    ${rows}
  </div>`;
}

function renderViewportPanel(vr: ViewportResult, idx: number, url1: string, url2: string, imagePaths: Record<string, string>): string {
  const { viewport, structuralAnalysis: sa } = vr;
  const display = idx === 0 ? 'block' : 'none';

  const totalStructural = sa.cssClassChanges.length + sa.elementClassChanges.length + sa.contentChanges.length;

  const addedSel = sa.addedSelectors
    .map((s) => `<code style="font-size:12px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(s)}</code>`)
    .join(' ');
  const removedSel = sa.removedSelectors
    .map((s) => `<code style="font-size:12px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(s)}</code>`)
    .join(' ');

  const diffHtml = escapeHtml(sa.rawHtmlDiff).slice(0, 50000);

  return `
  <div id="panel-${viewport}" style="display:${display};">
    ${renderScreenshotSection(vr, url1, url2, imagePaths)}

    <div style="margin-bottom:20px;">
      <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px;">Structural Analysis</h3>

      <!-- Stats row -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
        <div style="background:#f1f5f9;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
          <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0;">${totalStructural}</p>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0;">structural changes</p>
        </div>
        <div style="background:#f1f5f9;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
          <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0;">${sa.cssClassChanges.length}</p>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0;">CSS class changes</p>
        </div>
        <div style="background:#f1f5f9;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
          <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0;">${sa.elementClassChanges.length}</p>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0;">element changes</p>
        </div>
        <div style="background:#f1f5f9;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
          <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0;">${sa.contentChanges.length}</p>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0;">content changes</p>
        </div>
        ${sa.addedSelectors.length > 0 ? `<div style="background:#d1fae5;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
          <p style="font-size:22px;font-weight:700;color:#065f46;margin:0;">+${sa.addedSelectors.length}</p>
          <p style="font-size:11px;color:#065f46;margin:2px 0 0;">new selectors</p>
        </div>` : ''}
        ${sa.removedSelectors.length > 0 ? `<div style="background:#fee2e2;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
          <p style="font-size:22px;font-weight:700;color:#991b1b;margin:0;">-${sa.removedSelectors.length}</p>
          <p style="font-size:11px;color:#991b1b;margin:2px 0 0;">removed selectors</p>
        </div>` : ''}
      </div>

      ${renderCssClassChanges(sa.cssClassChanges, urlLabel(url1), urlLabel(url2))}
      ${renderElementClassChanges(sa.elementClassChanges, urlLabel(url1), urlLabel(url2))}
      ${renderContentChanges(sa.contentChanges, urlLabel(url1), urlLabel(url2))}

      ${addedSel || removedSel ? `
      <div style="margin-bottom:16px;">
        <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 8px;">New / Removed CSS Selectors</h4>
        ${addedSel   ? `<div style="margin-bottom:6px;"><span style="font-size:12px;font-weight:600;color:#065f46;">Only in ${escapeHtml(urlLabel(url2))}: </span>${addedSel}</div>` : ''}
        ${removedSel ? `<div><span style="font-size:12px;font-weight:600;color:#991b1b;">Only in ${escapeHtml(urlLabel(url1))}: </span>${removedSel}</div>` : ''}
      </div>` : ''}

      <details style="margin-top:12px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:#475569;user-select:none;padding:6px 0;">
          Raw HTML diff (${sa.htmlChangedLines} changed lines)
        </summary>
        <pre style="margin:10px 0 0;padding:12px;background:#0f172a;color:#e2e8f0;border-radius:8px;font-size:11px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">${diffHtml}</pre>
      </details>
    </div>
  </div>`;
}

export function renderReport(report: CompareReport, imagePaths: Record<string, string>): string {
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

  const panels = report.viewports
    .map((vr, i) => renderViewportPanel(vr, i, report.url1, report.url2, imagePaths))
    .join('\n');

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
  <title>ohsee — ${escapeHtml(urlLabel(report.url1))} vs ${escapeHtml(urlLabel(report.url2))}</title>
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
          <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">${escapeHtml(urlLabel(report.url1))}</p>
          <a href="${escapeHtml(report.url1)}" style="font-size:13px;color:#64748b;word-break:break-all;">${escapeHtml(report.url1)}</a>
        </div>
        <div>
          <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">${escapeHtml(urlLabel(report.url2))}</p>
          <a href="${escapeHtml(report.url2)}" style="font-size:13px;color:#64748b;word-break:break-all;">${escapeHtml(report.url2)}</a>
        </div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;color:#64748b;font-size:13px;">
        <span>📅 ${escapeHtml(ts)}</span>
        <span>⏱ ${escapeHtml(duration)}s</span>
        ${report.aiMode ? `<span>🤖 ${escapeHtml(report.modelUsed)}</span>` : ''}
        <span style="font-size:11px;color:#cbd5e1;">ID: ${escapeHtml(report.id)}</span>
      </div>
    </div>

    <!-- Summary -->
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
          <p style="font-size:12px;opacity:0.8;margin:2px 0 0;">structural changes</p>
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
