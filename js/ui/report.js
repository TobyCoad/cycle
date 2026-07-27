// js/ui/report.js — Printable health report (Agent 4)
// openReport(logs, settings) opens a blank tab and writes a clean white
// printable document. Works as a PDF via the browser/iOS print dialog.

import { getCycles, cycleStats } from '../model.js';
import { predictions } from '../predict.js';
import { SYMPTOMS } from '../taxonomy.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function fmtLong(dateStr) {
  if (!dateStr) return '—';
  const p = String(dateStr).split('-');
  return `${Number(p[2])} ${MONTHS_LONG[Number(p[1]) - 1] || ''} ${p[0]}`;
}

function todayLocalStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const CONFIDENCE_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

function buildReportHTML(logs, settings) {
  const cycles = getCycles(logs);
  const completed = cycles.filter((c) => c.length != null);
  const stats = cycleStats(cycles) || {};
  const preds = settings.mode === 'pregnancy' ? null : predictions(logs, settings);
  const name = (settings.name || '').trim();

  /* --- cycle summary table (last 6 cycles) --- */
  const last6 = cycles.slice(-6).reverse();
  const cycleRows = last6.map((c) => `
    <tr>
      <td>${esc(fmtLong(c.start))}</td>
      <td>${c.length != null ? `${c.length} days` : 'In progress'}</td>
      <td>${c.periodLength ? `${c.periodLength} days` : '—'}</td>
    </tr>`).join('');
  const cycleTable = last6.length ? `
    <table>
      <thead><tr><th>Cycle start</th><th>Cycle length</th><th>Period length</th></tr></thead>
      <tbody>${cycleRows}</tbody>
    </table>` : '<p class="muted">No periods logged yet.</p>';

  /* --- summary stats line --- */
  const statBits = [];
  if (stats.avgCycle) statBits.push(`Average cycle: <strong>${stats.avgCycle} days</strong>`);
  if (stats.avgPeriod) statBits.push(`Average period: <strong>${stats.avgPeriod} days</strong>`);
  if (stats.stdCycle != null && isFinite(stats.stdCycle) && completed.length >= 2) {
    statBits.push(`Variability: <strong>±${stats.stdCycle} days</strong>`);
  }
  statBits.push(`Cycles tracked: <strong>${cycles.length}</strong>`);

  /* --- predictions --- */
  let predsHTML = '';
  if (settings.mode === 'pregnancy') {
    predsHTML = `<p class="muted">Pregnancy mode is on${settings.pregnancyLMP
      ? ` — last menstrual period ${esc(fmtLong(settings.pregnancyLMP))}, estimated due date ${esc(fmtLong(addDaysLocal(settings.pregnancyLMP, 280)))}`
      : ''}. Cycle predictions are paused.</p>`;
  } else if (preds) {
    const rows = [
      ['Next period (predicted)', `${fmtLong(preds.nextPeriodStart)} – ${fmtLong(preds.nextPeriodEnd)}`],
      ['Fertile window (predicted)', `${fmtLong(preds.fertileStart)} – ${fmtLong(preds.fertileEnd)}`],
      ['Ovulation (predicted)', fmtLong(preds.ovulationDate)],
      ['Prediction confidence', `${CONFIDENCE_LABEL[preds.confidence] || esc(preds.confidence)}${preds.irregular ? ' (cycles look irregular)' : ''}`],
    ];
    if (preds.overdueDays > 0) rows.push(['Currently', `${preds.overdueDays} day${preds.overdueDays === 1 ? '' : 's'} past predicted start`]);
    predsHTML = `<table><tbody>${rows.map((r) =>
      `<tr><th class="rowhead">${esc(r[0])}</th><td>${r[1]}</td></tr>`).join('')}</tbody></table>
      <p class="muted small">Predictions are estimates based on logged history — not medical advice.</p>`;
  } else {
    predsHTML = '<p class="muted">Not enough data for predictions yet.</p>';
  }

  /* --- symptom frequency table --- */
  const freq = SYMPTOMS.map((s) => {
    const days = logs.filter((l) => Array.isArray(l.symptoms) && l.symptoms.includes(s.key)).length;
    let cyclePct = null;
    if (completed.length) {
      const withIt = completed.filter((c) => logs.some((l) =>
        Array.isArray(l.symptoms) && l.symptoms.includes(s.key) &&
        l.date >= c.start && l.date <= c.end)).length;
      cyclePct = Math.round((withIt / completed.length) * 100);
    }
    return { label: s.label, days, cyclePct };
  }).filter((r) => r.days > 0).sort((a, b) => b.days - a.days);

  const freqTable = freq.length ? `
    <table>
      <thead><tr><th>Symptom</th><th>Days logged</th><th>% of completed cycles</th></tr></thead>
      <tbody>${freq.map((r) => `
        <tr><td>${esc(r.label)}</td><td>${r.days}</td><td>${r.cyclePct != null ? `${r.cyclePct}%` : '—'}</td></tr>`).join('')}
      </tbody>
    </table>` : '<p class="muted">No symptoms logged.</p>';

  /* --- notes --- */
  const noted = logs.filter((l) => l.notes && String(l.notes).trim())
    .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  const notesTable = noted.length ? `
    <table>
      <thead><tr><th class="w-date">Date</th><th>Note</th></tr></thead>
      <tbody>${noted.map((l) => `
        <tr><td>${esc(fmtLong(l.date))}</td><td class="note">${esc(l.notes)}</td></tr>`).join('')}
      </tbody>
    </table>` : '<p class="muted">No notes logged.</p>';

  const generated = fmtLong(todayLocalStr());

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cycle Health Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #ffffff; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #111111; max-width: 720px; margin: 0 auto; padding: 32px 24px 48px;
    font-size: 14px; line-height: 1.5;
  }
  header { border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 22px; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .meta { color: #555; font-size: 13px; }
  h2 { font-size: 15px; margin: 26px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #dddddd; vertical-align: top; }
  thead th { border-bottom: 2px solid #999999; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: #444; }
  th.rowhead { width: 46%; font-weight: 600; color: #333; }
  td.note { white-space: pre-wrap; }
  th.w-date { width: 32%; }
  .stats { margin: 4px 0 2px; }
  .stats span { display: inline-block; margin-right: 18px; }
  .muted { color: #666666; }
  .small { font-size: 12px; margin-top: 4px; }
  footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #dddddd; color: #666666; font-size: 12px; }
  .printbar { text-align: right; margin-bottom: 16px; }
  .printbar button {
    font: inherit; font-weight: 600; min-height: 44px; padding: 10px 22px;
    border: 1px solid #111111; border-radius: 8px; background: #111111; color: #ffffff; cursor: pointer;
  }
  @media print { .printbar { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="printbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
  <header>
    <h1>Cycle Health Report${name ? ` — ${esc(name)}` : ''}</h1>
    <p class="meta">Generated ${esc(generated)}</p>
  </header>

  <h2>Summary</h2>
  <p class="stats">${statBits.map((b) => `<span>${b}</span>`).join('')}</p>

  <h2>Recent cycles (last 6)</h2>
  ${cycleTable}

  <h2>Predictions</h2>
  ${predsHTML}

  <h2>Symptom frequency</h2>
  ${freqTable}

  <h2>Notes</h2>
  ${notesTable}

  <footer>Generated locally — data never leaves this device.</footer>
</body>
</html>`;
}

// Tiny local date-add for the pregnancy due-date line (keeps this module
// independent of db.js so the report works purely from its arguments).
function addDaysLocal(dateStr, n) {
  const p = String(dateStr).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2] + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function openReport(logs, settings) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Could not open the report — please allow pop-ups for this app and try again.');
    return;
  }
  const html = buildReportHTML(Array.isArray(logs) ? logs : [], settings || {});
  w.document.open();
  w.document.write(html);
  w.document.close();
}
