// js/ui/insights.js — Insights screen (Agent 4)
// Hand-rolled inline SVG charts. No libraries, no external resources.

import { getAllLogs, getSettings, addDays, diffDays } from '../db.js';
import { getCycles, getPeriods, cycleStats, cycleDayProfile } from '../model.js';
import { SYMPTOMS, MOODS } from '../taxonomy.js';
import { openReport } from './report.js';
import { BUNNY_SLEEPY, SPARKLES } from '../art.js';

/* ---------------- helpers ---------------- */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function fmtShort(dateStr) {
  const p = String(dateStr).split('-');
  return `${Number(p[2])} ${MONTHS[Number(p[1]) - 1] || ''}`;
}
function fmtLong(dateStr) {
  const p = String(dateStr).split('-');
  return `${Number(p[2])} ${MONTHS_LONG[Number(p[1]) - 1] || ''} ${p[0]}`;
}

const SYMPTOM_MAP = new Map(SYMPTOMS.map((s) => [s.key, s]));
const MOOD_MAP = new Map(MOODS.map((m) => [m.key, m]));

// Phase palette (menstrual / follicular / ovulation / luteal).
// Fixed order, never cycled; every use is paired with a text legend or label.
const PHASES = [
  { key: 'menstrual', label: 'Menstrual', color: 'var(--period)' },
  { key: 'follicular', label: 'Follicular', color: 'var(--ins-follicular)' },
  { key: 'ovulation', label: 'Ovulation', color: 'var(--ovulation)' },
  { key: 'luteal', label: 'Luteal', color: 'var(--ins-luteal)' },
];
// Generic categorical order for the mood chart (same validated hue order).
const CAT_COLORS = ['var(--period)', 'var(--ins-follicular)', 'var(--ovulation)', 'var(--ins-luteal)'];

// Phase of a historic date inside a COMPLETED cycle (per spec):
// menstrual = within its period; ovulation = cycleEnd − lutealLength ± 1;
// luteal = after that window; else follicular.
function phaseOfDate(dateStr, cycle, lutealLength) {
  const day = diffDays(cycle.start, dateStr) + 1; // 1-based cycle day
  if (day <= (cycle.periodLength || 0)) return 'menstrual';
  const ovu = addDays(cycle.end, -lutealLength);
  const d = diffDays(ovu, dateStr); // dateStr − ovu
  if (Math.abs(d) <= 1) return 'ovulation';
  if (d > 1) return 'luteal';
  return 'follicular';
}

// Find the cycle a date belongs to (completed or the open last cycle).
function cycleForDate(dateStr, cycles) {
  for (const c of cycles) {
    if (diffDays(c.start, dateStr) < 0) continue;         // date before cycle start
    if (c.end == null || diffDays(dateStr, c.end) >= 0) return c; // open cycle or date ≤ end
  }
  return null;
}

/* ---------------- data shaping ---------------- */

function symptomPhaseData(logs, completedCycles, lutealLength) {
  const n = completedCycles.length;
  if (!n) return null;
  const byDate = new Map(logs.map((l) => [l.date, l]));
  // key -> { cyclesWith:Set, days:int, phases: Map(phase -> Set(cycleIdx)) }
  const acc = new Map();
  completedCycles.forEach((c, ci) => {
    let d = c.start;
    let guard = 0;
    while (diffDays(d, c.end) >= 0 && guard++ < 400) {
      const log = byDate.get(d);
      if (log && Array.isArray(log.symptoms) && log.symptoms.length) {
        const phase = phaseOfDate(d, c, lutealLength);
        for (const key of log.symptoms) {
          if (!SYMPTOM_MAP.has(key)) continue;
          let e = acc.get(key);
          if (!e) { e = { cyclesWith: new Set(), days: 0, phases: new Map() }; acc.set(key, e); }
          e.cyclesWith.add(ci);
          e.days += 1;
          if (!e.phases.has(phase)) e.phases.set(phase, new Set());
          e.phases.get(phase).add(ci);
        }
      }
      d = addDays(d, 1);
    }
  });
  if (!acc.size) return null;
  const top = [...acc.entries()]
    .sort((a, b) => (b[1].cyclesWith.size - a[1].cyclesWith.size) || (b[1].days - a[1].days))
    .slice(0, 8)
    .map(([key, e]) => {
      const t = SYMPTOM_MAP.get(key);
      return {
        key,
        label: `${t.emoji ? t.emoji + ' ' : ''}${t.label}`,
        pcts: PHASES.map((p) => Math.round(((e.phases.get(p.key) || { size: 0 }).size / n) * 100)),
      };
    });
  return { rows: top, cycleCount: n };
}

const MOOD_BUCKETS = [
  { min: 1, max: 5, label: '1–5', sub: 'Menstrual' },
  { min: 6, max: 13, label: '6–13', sub: 'Follicular' },
  { min: 14, max: 15, label: '14–15', sub: 'Ovulation' },
  { min: 16, max: Infinity, label: '16+', sub: 'Luteal' },
];

function moodBucketData(logs, cycles) {
  const loggedDays = [0, 0, 0, 0];
  const counts = new Map(); // mood key -> [n,n,n,n]
  for (const log of logs) {
    const c = cycleForDate(log.date, cycles);
    if (!c) continue;
    const day = diffDays(c.start, log.date) + 1;
    const bi = MOOD_BUCKETS.findIndex((b) => day >= b.min && day <= b.max);
    if (bi < 0) continue;
    loggedDays[bi] += 1;
    if (Array.isArray(log.moods)) {
      for (const m of log.moods) {
        if (!MOOD_MAP.has(m)) continue;
        if (!counts.has(m)) counts.set(m, [0, 0, 0, 0]);
        counts.get(m)[bi] += 1;
      }
    }
  }
  if (!counts.size) return null;
  const top = [...counts.entries()]
    .sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0))
    .slice(0, 4)
    .map(([key, arr], i) => ({
      key,
      label: MOOD_MAP.get(key).label,
      color: CAT_COLORS[i],
      pts: arr.map((cnt, bi) => (loggedDays[bi] > 0 ? Math.round((cnt / loggedDays[bi]) * 100) : null)),
    }));
  return { series: top };
}

function temperatureData(logs, cycles) {
  const n = cycles.length;
  if (!n) return null;
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const collect = (cycle, endStr) => {
    const pts = [];
    let d = cycle.start;
    let guard = 0;
    while (diffDays(d, endStr) >= 0 && guard++ < 400) {
      const log = byDate.get(d);
      if (log && typeof log.temperature === 'number' && isFinite(log.temperature)) {
        pts.push({ day: diffDays(cycle.start, d) + 1, temp: log.temperature });
      }
      d = addDays(d, 1);
    }
    return pts;
  };
  const lastLogDate = logs.length ? logs[logs.length - 1].date : null;
  const current = cycles[n - 1];
  const currentEnd = current.end != null ? current.end : lastLogDate;
  const series = [];
  if (n >= 2) {
    const prev = cycles[n - 2];
    const pts = collect(prev, prev.end);
    if (pts.length) series.push({ name: 'Previous cycle', cls: 'ins-line-prev', dot: 'var(--ins-prev)', pts });
  }
  if (currentEnd) {
    const pts = collect(current, currentEnd);
    if (pts.length) series.push({ name: 'Current cycle', cls: 'ins-line-cur', dot: 'var(--accent)', pts });
  }
  if (!series.length) return null;
  return { series };
}

/* ---------------- SVG builders ---------------- */

function svgOpen(w, h, label) {
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label)}" class="ins-svg" xmlns="http://www.w3.org/2000/svg">`;
}

// Vertical bar chart with zero baseline, optional normal band and average line.
function barChartSVG(o) {
  const W = 340; const H = 200;
  const m = { t: 16, r: 8, b: 22, l: 26 };
  const pw = W - m.l - m.r; const ph = H - m.t - m.b;
  const yMax = o.yMax;
  const y = (v) => m.t + ph * (1 - v / yMax);
  const n = o.data.length;
  const slot = pw / n;
  const bw = Math.max(6, Math.min(26, slot - 4));
  let s = svgOpen(W, H, o.aria);

  for (let v = 0; v <= yMax + 0.001; v += o.yStep) {
    const yy = y(v).toFixed(1);
    s += `<line x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}" class="ins-grid"/>`;
    s += `<text x="${m.l - 5}" y="${(y(v) + 3).toFixed(1)}" class="ins-ax" text-anchor="end">${v}</text>`;
  }
  if (o.band) {
    const bTop = y(Math.min(o.band[1], yMax));
    const bBot = y(Math.max(o.band[0], 0));
    s += `<rect x="${m.l}" y="${bTop.toFixed(1)}" width="${pw}" height="${(bBot - bTop).toFixed(1)}" class="ins-band"/>`;
    s += `<text x="${W - m.r - 4}" y="${(bTop + 10).toFixed(1)}" class="ins-band-label" text-anchor="end">${o.band[0]}–${o.band[1]} typical</text>`;
  }
  const every = n > 6 ? 2 : 1;
  const yBot = m.t + ph;
  o.data.forEach((d, i) => {
    const x = m.l + slot * i + (slot - bw) / 2;
    const r = Math.min(4, bw / 2);
    const hgt = Math.max(yBot - y(d.value), r + 1);
    const yT = yBot - hgt;
    s += `<path d="M${x.toFixed(1)},${yBot.toFixed(1)} L${x.toFixed(1)},${(yT + r).toFixed(1)} Q${x.toFixed(1)},${yT.toFixed(1)} ${(x + r).toFixed(1)},${yT.toFixed(1)} L${(x + bw - r).toFixed(1)},${yT.toFixed(1)} Q${(x + bw).toFixed(1)},${yT.toFixed(1)} ${(x + bw).toFixed(1)},${(yT + r).toFixed(1)} L${(x + bw).toFixed(1)},${yBot.toFixed(1)} Z" class="ins-bar"${o.barFill ? ` style="fill:${o.barFill}"` : ''}><title>${esc(d.tip)}</title></path>`;
    s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(yT - 4).toFixed(1)}" class="ins-val" text-anchor="middle">${d.value}</text>`;
    if ((n - 1 - i) % every === 0) {
      s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" class="ins-ax" text-anchor="middle">${esc(d.label)}</text>`;
    }
  });
  s += `<line x1="${m.l}" y1="${yBot.toFixed(1)}" x2="${W - m.r}" y2="${yBot.toFixed(1)}" class="ins-axis"/>`;
  if (o.avg != null && isFinite(o.avg)) {
    const ay = y(Math.min(o.avg, yMax)).toFixed(1);
    s += `<line x1="${m.l}" y1="${ay}" x2="${W - m.r}" y2="${ay}" class="ins-avg"/>`;
    s += `<text x="${m.l + 4}" y="${(y(Math.min(o.avg, yMax)) - 4).toFixed(1)}" class="ins-avg-label">avg ${o.avg}</text>`;
  }
  return s + '</svg>';
}

// Horizontal grouped mini-bars: one row per symptom, one bar per phase.
function symptomPhaseSVG(rows) {
  const W = 340; const headH = 18; const rowH = 62; const rightPad = 34;
  const pw = W - rightPad;
  const H = headH + rows.length * rowH;
  let s = svgOpen(W, H, 'Symptom frequency by cycle phase');
  [0, 25, 50, 75, 100].forEach((v) => {
    const x = (pw * v) / 100;
    s += `<line x1="${x.toFixed(1)}" y1="${headH}" x2="${x.toFixed(1)}" y2="${H}" class="ins-grid"/>`;
    s += `<text x="${x.toFixed(1)}" y="10" class="ins-ax" text-anchor="${v === 0 ? 'start' : 'middle'}">${v}%</text>`;
  });
  rows.forEach((r, ri) => {
    const top = headH + ri * rowH;
    s += `<text x="0" y="${top + 15}" class="ins-row-label">${esc(r.label)}</text>`;
    r.pcts.forEach((p, pi) => {
      const by = top + 21 + pi * 10;
      if (p > 0) {
        const bwid = Math.max((pw * p) / 100, 3);
        s += `<rect x="0" y="${by}" width="${bwid.toFixed(1)}" height="8" rx="2" fill="${PHASES[pi].color}"><title>${esc(r.label)} — ${PHASES[pi].label} phase: in ${p}% of cycles</title></rect>`;
        s += `<text x="${(bwid + 4).toFixed(1)}" y="${by + 7}" class="ins-pct">${p}%</text>`;
      } else {
        s += `<rect x="0" y="${by}" width="2" height="8" fill="${PHASES[pi].color}" opacity="0.35"/>`;
      }
    });
  });
  return s + '</svg>';
}

// Mood frequency lines across the 4 cycle-day buckets.
function moodLineSVG(seriesList) {
  const W = 340; const H = 214;
  const m = { t: 12, r: 66, b: 36, l: 30 };
  const pw = W - m.l - m.r; const ph = H - m.t - m.b;
  let maxV = 0;
  seriesList.forEach((se) => se.pts.forEach((p) => { if (p != null && p > maxV) maxV = p; }));
  const yMax = Math.min(100, Math.max(20, Math.ceil(maxV / 20) * 20));
  const y = (v) => m.t + ph * (1 - v / yMax);
  const xs = [0, 1, 2, 3].map((i) => m.l + (pw * i) / 3);
  let s = svgOpen(W, H, 'Mood frequency by cycle day');

  const step = yMax / 4;
  for (let v = 0; v <= yMax + 0.001; v += step) {
    const yy = y(v).toFixed(1);
    s += `<line x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}" class="ins-grid"/>`;
    s += `<text x="${m.l - 5}" y="${(y(v) + 3).toFixed(1)}" class="ins-ax" text-anchor="end">${Math.round(v)}%</text>`;
  }
  MOOD_BUCKETS.forEach((b, i) => {
    s += `<text x="${xs[i].toFixed(1)}" y="${H - 22}" class="ins-ax-strong" text-anchor="middle">${b.label}</text>`;
    s += `<text x="${xs[i].toFixed(1)}" y="${H - 10}" class="ins-ax" text-anchor="middle">${b.sub}</text>`;
  });

  // series lines + dots
  seriesList.forEach((se) => {
    const pts = se.pts.map((p, i) => (p == null ? null : [xs[i], y(p)])).filter(Boolean);
    if (pts.length > 1) {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    se.pts.forEach((p, i) => {
      if (p == null) return;
      s += `<circle cx="${xs[i].toFixed(1)}" cy="${y(p).toFixed(1)}" r="4" fill="${se.color}" stroke="var(--card)" stroke-width="2"><title>${esc(se.label)} — days ${MOOD_BUCKETS[i].label}: on ${p}% of logged days</title></circle>`;
    });
  });

  // direct end labels, nudged apart so they never collide
  const ends = seriesList.map((se) => {
    let li = -1;
    se.pts.forEach((p, i) => { if (p != null) li = i; });
    return li < 0 ? null : { label: se.label, x: xs[li], yy: y(se.pts[li]) };
  }).filter(Boolean).sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].yy - ends[i - 1].yy < 12) ends[i].yy = ends[i - 1].yy + 12;
  }
  // keep labels inside the viewBox
  const overflow = ends.length ? ends[ends.length - 1].yy - (H - 8) : 0;
  if (overflow > 0) ends.forEach((e) => { e.yy -= overflow; });
  ends.forEach((e) => {
    s += `<text x="${(e.x + 9).toFixed(1)}" y="${(e.yy + 3).toFixed(1)}" class="ins-end">${esc(e.label)}</text>`;
  });
  return s + '</svg>';
}

function temperatureSVG(series) {
  const W = 340; const H = 200;
  const m = { t: 12, r: 12, b: 32, l: 36 };
  const pw = W - m.l - m.r; const ph = H - m.t - m.b;
  const temps = [];
  let maxDay = 1;
  series.forEach((se) => se.pts.forEach((p) => { temps.push(p.temp); if (p.day > maxDay) maxDay = p.day; }));
  let tMin = Math.min(...temps); let tMax = Math.max(...temps);
  if (tMax - tMin < 0.6) { const mid = (tMax + tMin) / 2; tMin = mid - 0.3; tMax = mid + 0.3; }
  tMin -= 0.1; tMax += 0.1;
  const y = (t) => m.t + ph * (1 - (t - tMin) / (tMax - tMin));
  const x = (day) => m.l + (pw * (day - 1)) / Math.max(maxDay - 1, 1);
  let s = svgOpen(W, H, 'Basal temperature over current and previous cycle');

  const step = tMax - tMin > 1.2 ? 0.5 : 0.2;
  for (let t = Math.ceil(tMin / step) * step; t <= tMax + 0.001; t += step) {
    const yy = y(t).toFixed(1);
    s += `<line x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}" class="ins-grid"/>`;
    s += `<text x="${m.l - 5}" y="${(y(t) + 3).toFixed(1)}" class="ins-ax" text-anchor="end">${t.toFixed(1)}</text>`;
  }
  for (let d = 1; d <= maxDay; d += 7) {
    s += `<text x="${x(d).toFixed(1)}" y="${H - 18}" class="ins-ax" text-anchor="middle">${d}</text>`;
  }
  s += `<text x="${(m.l + pw / 2).toFixed(1)}" y="${H - 5}" class="ins-ax">Cycle day</text>`;
  s += `<text x="6" y="${m.t - 2}" class="ins-ax">°C</text>`;

  series.forEach((se) => {
    if (se.pts.length > 1) {
      const d = se.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.temp).toFixed(1)}`).join(' ');
      s += `<path d="${d}" fill="none" class="${se.cls}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    se.pts.forEach((p) => {
      s += `<circle cx="${x(p.day).toFixed(1)}" cy="${y(p.temp).toFixed(1)}" r="3" fill="${se.dot}" stroke="var(--card)" stroke-width="1.5"><title>Day ${p.day} — ${p.temp.toFixed(2)} °C (${esc(se.name.toLowerCase())})</title></circle>`;
    });
  });
  return s + '</svg>';
}

/* ---------------- HTML pieces ---------------- */

function legendHTML(items) {
  return `<div class="ins-legend">${items.map((i) =>
    `<span class="ins-key"><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join('')}</div>`;
}

function sectionHTML(title, sub, body) {
  return `<section class="card ins-section"><h2 class="section-title">${esc(title)}</h2>${
    sub ? `<p class="ins-note">${esc(sub)}</p>` : ''}${body}</section>`;
}

function tileHTML(value, unit, label) {
  return `<div class="card ins-tile"><div class="ins-tile-value">${esc(value)}<span class="ins-tile-unit">${esc(unit)}</span></div><div class="ins-tile-label">${esc(label)}</div></div>`;
}

function chartEmptyHTML(msg) {
  return `<p class="ins-chart-empty">${esc(msg)}</p>`;
}

/* ---------------- screen module ---------------- */

export default {
  id: 'insights',
  title: 'Insights',

  async render(el) {
    const [logs, settings] = await Promise.all([getAllLogs(), getSettings()]);
    const cycles = getCycles(logs);
    const completed = cycles.filter((c) => c.length != null);
    const stats = cycleStats(cycles) || {};
    const luteal = (settings && settings.lutealLength) || 14;

    // V3 (Agent C): personal pain/bleeding profile by cycle day (all cycles, incl. current).
    const profile = cycleDayProfile(logs);
    let heaviest = null;
    for (const e of profile) {
      if (e.avgFlow != null && e.avgFlow > 0 && (heaviest == null || e.avgFlow > heaviest.avgFlow)) heaviest = e;
    }

    const has = (v) => v != null && isFinite(v) && v > 0;
    const tiles =
      tileHTML(has(stats.avgCycle) ? stats.avgCycle : '—', has(stats.avgCycle) ? ' days' : '', 'Average cycle') +
      tileHTML(has(stats.avgPeriod) ? stats.avgPeriod : '—', has(stats.avgPeriod) ? ' days' : '', 'Average period') +
      tileHTML(stats.stdCycle != null && isFinite(stats.stdCycle) && completed.length >= 2 ? `±${stats.stdCycle}` : '—',
        stats.stdCycle != null && isFinite(stats.stdCycle) && completed.length >= 2 ? ' days' : '', 'Cycle variability') +
      tileHTML(cycles.length, '', cycles.length === 1 ? 'Cycle tracked' : 'Cycles tracked') +
      (heaviest ? tileHTML(`Day ${heaviest.day}`, '', 'Heaviest day') : '');

    let body = '';

    if (completed.length < 2) {
      const doneMsg = completed.length === 1
        ? 'You have completed 1 cycle — one more to go.'
        : (cycles.length ? 'Your first cycle is in progress.' : 'Start by logging your period from the Today or Log screen.');
      body = `
        <div class="card ins-empty">
          <div class="bunny-art" aria-hidden="true">${BUNNY_SLEEPY}</div>
          <h3>Charts unlock after 2 full cycles</h3>
          <p>${esc(doneMsg)} Keep logging your period, symptoms and moods — your cycle history, symptom patterns and trends will bloom here.</p>
        </div>`;
    } else {
      // Cycle length history
      const cyc = completed.slice(-12);
      const cycleData = cyc.map((c) => ({
        label: fmtShort(c.start),
        value: c.length,
        tip: `Cycle started ${fmtLong(c.start)} — ${c.length} days`,
      }));
      const cycleYMax = Math.max(40, Math.ceil((Math.max(...cycleData.map((d) => d.value)) + 2) / 10) * 10);
      body += sectionHTML('Cycle length', `Last ${cyc.length} completed cycles - shaded band is the typical 21-35 day range`,
        barChartSVG({ data: cycleData, avg: has(stats.avgCycle) ? stats.avgCycle : null, band: [21, 35], yMax: cycleYMax, yStep: 10, aria: 'Cycle length history bar chart' }));

      // Period length history
      const periods = getPeriods(logs).slice(-12);
      if (periods.length) {
        const perData = periods.map((p) => ({
          label: fmtShort(p.start),
          value: p.length,
          tip: `Period started ${fmtLong(p.start)} — ${p.length} days`,
        }));
        const perYMax = Math.max(8, Math.ceil((Math.max(...perData.map((d) => d.value)) + 1) / 2) * 2);
        body += sectionHTML('Period length', `Last ${periods.length} periods`,
          barChartSVG({ data: perData, avg: has(stats.avgPeriod) ? stats.avgPeriod : null, band: null, yMax: perYMax, yStep: 2, aria: 'Period length history bar chart' }));
      }

      // Symptom patterns by phase
      const symData = symptomPhaseData(logs, completed, luteal);
      body += sectionHTML('Symptom patterns', 'How often each symptom shows up, by cycle phase (% of completed cycles)',
        symData
          ? legendHTML(PHASES) + symptomPhaseSVG(symData.rows)
          : chartEmptyHTML('No symptoms logged yet. Add symptoms on the Log screen and patterns will show up here.'));

      // Mood trend by cycle-day bucket
      const moodData = moodBucketData(logs, cycles);
      body += sectionHTML('Mood across your cycle', 'How often each mood is logged, by cycle day',
        moodData
          ? legendHTML(moodData.series.map((se) => ({ label: se.label, color: se.color }))) + moodLineSVG(moodData.series)
          : chartEmptyHTML('No moods logged yet. Track moods on the Log screen to see how they move across your cycle.'));

      // Temperature (only when data exists)
      const tempData = temperatureData(logs, cycles);
      if (tempData) {
        body += sectionHTML('Basal temperature', 'Current and previous cycle',
          legendHTML(tempData.series.map((se) => ({ label: se.name, color: se.dot }))) + temperatureSVG(tempData.series));
      }
    }

    // V3 (Agent C): pain & bleeding across the cycle — shown as soon as any cycle exists.
    if (cycles.length) {
      const painDays = profile.filter((e) => e.avgPain != null);
      const painBody = painDays.length
        ? `<div class="ins-pain-chart">${barChartSVG({
            data: painDays.map((e) => ({
              label: String(e.day),
              value: Math.round(e.avgPain * 10) / 10,
              tip: `Day ${e.day} — average pain ${Math.round(e.avgPain * 10) / 10}/10, worst ${e.maxPain}/10 (${e.n} day${e.n === 1 ? '' : 's'} logged)`,
            })),
            avg: null, band: null, yMax: 10, yStep: 2,
            aria: 'Average pain by cycle day',
            barFill: 'var(--cherry, #8f1d2c)',
          })}</div>`
        : chartEmptyHTML('No pain logged yet. Rate your pain 0–10 on the Log screen and your personal pattern will appear here, day by day.');
      body += sectionHTML('Pain across your cycle', 'Average pain (0–10) by cycle day, from your own logs — heavy is your normal, not your fault',
        painBody);

      const flowDays = profile.filter((e) => e.avgFlow != null && e.avgFlow > 0);
      const flowBody = flowDays.length
        ? `<div class="ins-pain-chart">${barChartSVG({
            data: flowDays.map((e) => ({
              label: String(e.day),
              value: Math.round(e.avgFlow * 10) / 10,
              tip: `Day ${e.day} — average flow ${Math.round(e.avgFlow * 10) / 10} of 4 (${e.n} day${e.n === 1 ? '' : 's'} logged)`,
            })),
            avg: null, band: null, yMax: 4, yStep: 1,
            aria: 'Average bleeding heaviness by cycle day',
            barFill: 'var(--cherry, #8f1d2c)',
          })}</div>`
        : chartEmptyHTML('Log your flow each period day and your bleeding curve will appear here.');
      body += sectionHTML('Bleeding across your cycle', 'Average flow by cycle day — 1 spotting · 2 light · 3 medium · 4 heavy',
        flowBody);
    }

    el.innerHTML = `
      <div class="ins-wrap">
        <header class="ins-header">
          <h1>Insights</h1>
          <p class="ins-sub">Your cycle story, in numbers</p>
        </header>
        <div class="sparkle-art" aria-hidden="true">${SPARKLES}</div>
        <div class="ins-tiles">${tiles}</div>
        ${body}
        <button id="ins-export" type="button" class="btn btn-primary ins-export">Export health report</button>
        <p class="ins-privacy">Generated locally — data never leaves this device.</p>
      </div>`;

    const btn = el.querySelector('#ins-export');
    if (btn) btn.addEventListener('click', () => openReport(logs, settings));
  },
};
