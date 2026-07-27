// js/ui/cards/science.js — "Your hormone story" Today card. Owner: Agent D (V3).
// Card contract: { id, html(ctx), wire? } with
//   ctx = { logs, settings, preds, state, today }
// Renders a hand-rolled inline SVG of the four cycle hormones, the physiology
// behind how today feels, and the glow / high-libido indicator chips.
// Flat colours only — no gradients, no external resources, no network.

import { diffDays } from '../../db.js';
import { dailyInsight, hormoneCurves, whyYouFeel } from '../../content/hormones.js';
// Namespace import on purpose: art.js is being extended concurrently, and a
// namespace import never fails to link if a named export is not there yet.
import * as ART from '../../art.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Flat curve colours (no tokens — these must stay distinguishable from each
// other regardless of theme work happening elsewhere).
const C_E2 = '#f472a8';   // oestrogen — baby pink
const C_P4 = '#8f1d2c';   // progesterone — deep cherry
const C_LH = '#d9a441';   // LH — vintage gold
const C_FSH = '#a98bc9';  // FSH — mauve

const GEO = { w: 340, h: 180, x0: 26, x1: 330, y0: 14, y1: 118 };

function bowOrnament() {
  try {
    if (typeof ART.BOW === 'string' && ART.BOW) {
      return `<span class="card-bow" aria-hidden="true" style="display:inline-block;width:26px;vertical-align:middle">${ART.BOW}</span>`;
    }
  } catch (e) { /* art.js may not have BOW yet */ }
  return '';
}

// Cycle day of ovulation, derived from the predicted ovulation date where
// possible and from luteal length otherwise.
function ovulationDayOf(state, preds, settings) {
  if (!preds) return null;
  if (preds.ovulationDate && state && state.cycleStart) {
    const d = diffDays(state.cycleStart, preds.ovulationDate) + 1;
    if (d >= 1 && d <= preds.avgCycle) return d;
  }
  const luteal = (settings && settings.lutealLength) || 14;
  return Math.max((preds.avgPeriod || 5) + 2, (preds.avgCycle || 28) - luteal);
}

function pathFor(values, n) {
  const { x0, x1, y0, y1 } = GEO;
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
  const pts = [];
  for (let i = 0; i < values.length; i += 1) {
    const x = x0 + i * step;
    const y = y1 - Math.max(0, Math.min(1, values[i])) * (y1 - y0);
    pts.push(`${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`);
  }
  return pts.join(' ');
}

function bandRect(aDay, bDay, n, fill) {
  const { x0, x1, y0, y1 } = GEO;
  if (bDay < aDay) return '';
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
  const left = Math.max(x0, x0 + (aDay - 1) * step - step / 2);
  const right = Math.min(x1, x0 + (bDay - 1) * step + step / 2);
  if (right <= left) return '';
  return `<rect x="${Math.round(left * 10) / 10}" y="${y0}" width="${Math.round((right - left) * 10) / 10}" height="${y1 - y0}" fill="${fill}"></rect>`;
}

function graphHTML(curves, n, ovu, avgPeriod, cycleDay) {
  const { w, h, x0, x1, y0, y1 } = GEO;
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
  const xOf = (d) => x0 + (Math.max(1, Math.min(n, d)) - 1) * step;
  const yOf = (v) => y1 - Math.max(0, Math.min(1, v)) * (y1 - y0);

  // Flat, hard-edged phase bands (never gradients).
  const bands =
    bandRect(1, Math.min(avgPeriod, n), n, 'rgba(247,127,174,.20)') +
    bandRect(avgPeriod + 1, Math.max(avgPeriod + 1, ovu - 2), n, 'rgba(201,184,245,.16)') +
    bandRect(Math.max(1, ovu - 1), Math.min(n, ovu + 1), n, 'rgba(94,179,232,.22)') +
    bandRect(Math.min(n, ovu + 2), n, n, 'rgba(143,29,44,.09)');

  const line = (vals, colour, dash) =>
    `<polyline points="${pathFor(vals, n)}" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}></polyline>`;

  const onChart = Number.isFinite(cycleDay) && cycleDay >= 1 && cycleDay <= n;
  let todayBits = '';
  if (onChart) {
    const tx = Math.round(xOf(cycleDay) * 10) / 10;
    const dot = (vals, colour) => {
      const v = vals[Math.min(vals.length - 1, Math.max(0, Math.round(cycleDay) - 1))];
      return `<circle cx="${tx}" cy="${Math.round(yOf(v) * 10) / 10}" r="3.2" fill="${colour}" stroke="#fffafd" stroke-width="1.2"></circle>`;
    };
    todayBits =
      `<line x1="${tx}" y1="${y0 - 2}" x2="${tx}" y2="${y1}" stroke="#8f1d2c" stroke-width="1.4" stroke-dasharray="3 3" opacity=".75"></line>` +
      `<text x="${Math.max(14, Math.min(w - 14, tx))}" y="${y0 - 5}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#8f1d2c">today</text>` +
      dot(curves.fsh, C_FSH) + dot(curves.lh, C_LH) + dot(curves.p4, C_P4) + dot(curves.e2, C_E2);
  }

  const ovX = Math.round(xOf(ovu) * 10) / 10;
  const legendItem = (x, colour, label, dash) =>
    `<line x1="${x}" y1="${h - 17}" x2="${x + 13}" y2="${h - 17}" stroke="${colour}" stroke-width="2.4" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}></line>` +
    `<text x="${x + 17}" y="${h - 14}" font-size="9" fill="currentColor">${esc(label)}</text>`;

  const aria = `Hormone curves across a ${n}-day cycle: oestrogen peaking around day ${Math.max(1, ovu - 2)}, the LH surge on day ${Math.max(1, ovu - 1)}, ovulation on day ${ovu}, and progesterone doming in the luteal phase.`;

  return `
    <div class="hormone-graph">
      <svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(aria)}" style="display:block">
        ${bands}
        <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="currentColor" stroke-width="1" opacity=".25"></line>
        ${line(curves.fsh, C_FSH, '4 3')}
        ${line(curves.lh, C_LH)}
        ${line(curves.p4, C_P4)}
        ${line(curves.e2, C_E2)}
        ${todayBits}
        <line x1="${ovX}" y1="${y1}" x2="${ovX}" y2="${y1 + 5}" stroke="#5eb3e8" stroke-width="1.6"></line>
        <text x="${Math.max(21, Math.min(w - 21, ovX))}" y="${y1 + 15}" text-anchor="middle" font-size="8.5" fill="#5eb3e8" font-weight="700">ovulation</text>
        <text x="${x0}" y="${y1 + 15}" text-anchor="start" font-size="8.5" fill="currentColor" opacity=".6">day 1</text>
        <text x="${x1}" y="${y1 + 15}" text-anchor="end" font-size="8.5" fill="currentColor" opacity=".6">day ${n}</text>
        ${legendItem(26, C_E2, 'Oestrogen')}
        ${legendItem(98, C_P4, 'Progesterone')}
        ${legendItem(184, C_LH, 'LH')}
        ${legendItem(226, C_FSH, 'FSH', '4 3')}
      </svg>
    </div>`;
}

function pillsHTML(levels) {
  const lv = levels || {};
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '–');
  const pill = (label, val) =>
    `<span class="mini-chip hormone-pill hp-${esc(val || 'low')}"><strong>${esc(label)}</strong><span>${esc(cap(val))}</span></span>`;
  return `<div class="hormone-pills">${pill('E', lv.estrogen)}${pill('P', lv.progesterone)}${pill('LH', lv.lh)}${pill('FSH', lv.fsh)}</div>`;
}

function indicatorsHTML(cycleDay, ovu, settings) {
  const rel = cycleDay - ovu; // 0 = ovulation day
  const glow = rel >= -3 && rel <= 0;
  const sexy = rel >= -4 && rel <= 1;
  if (!glow && !sexy) return '';

  const chips = [];
  if (glow) chips.push('<span class="chip glow-chip">Glow day ✨ — oestrogen at its golden hour</span>');
  if (sexy) chips.push('<span class="chip sex-chip">High-libido window 💗</span>');

  const lines = [];
  if (glow) {
    lines.push('Oestrogen is at its cycle high, and it supports skin collagen and hydration — the reason this handful of days tends to photograph well.');
  }
  if (sexy) {
    const cover = settings && settings.iudType === 'copper'
      ? 'your copper IUD already handles contraception'
      : 'your contraception already handles that side of things';
    lines.push(`Desire tends to rise here on peak oestrogen and a small mid-cycle testosterone bump. This is libido and pleasure information, not contraception guidance — ${cover}, and no day is ever marked safe or unsafe.`);
  }

  return `
      <div class="science-indicators" style="margin:0 0 12px">
        <div class="science-chips" style="display:flex;flex-wrap:wrap;gap:8px">${chips.join('')}</div>
        ${lines.map((t) => `<p class="science-chip-why" style="margin:8px 0 0;font-size:12.5px;line-height:1.55;color:var(--muted)">${esc(t)}</p>`).join('')}
      </div>`;
}

function emptyHTML() {
  return `
    <div class="card science-card">
      <div class="section-title">Your hormone story ${bowOrnament()}</div>
      <p class="science-empty" style="margin:6px 0 0;font-size:13.5px;line-height:1.6;color:var(--muted)">Log a period to unlock your hormone story — the curves, the glow days, and the reason today feels the way it does.</p>
    </div>`;
}

export default {
  id: 'science',

  html(ctx) {
    const c = ctx || {};
    const settings = c.settings || {};

    // Pregnancy mode has its own physiology entirely — hide this card.
    if (settings.mode === 'pregnancy') return '';

    const preds = c.preds || null;
    const state = c.state || null;
    if (!preds || !state || state.cycleDay == null) return emptyHTML();

    const n = Math.max(15, Math.min(60, preds.avgCycle || 28));
    const avgPeriod = Math.max(1, Math.min(10, preds.avgPeriod || 5));
    const ovuRaw = ovulationDayOf(state, preds, settings);
    const ovu = Math.max(avgPeriod + 2, Math.min(n - 1, ovuRaw || n - 14));
    const cycleDay = Number(state.cycleDay);

    const hctx = { avgCycle: n, avgPeriod, ovulationDay: ovu, phase: state.phase };

    let curves = null;
    let graph = '';
    try {
      curves = hormoneCurves(n, ovu);
      graph = graphHTML(curves, n, ovu, avgPeriod, cycleDay);
    } catch (e) { graph = ''; }

    let insight = null;
    try { insight = dailyInsight(cycleDay, hctx); } catch (e) { insight = null; }

    let feel = null;
    try { feel = whyYouFeel(cycleDay, hctx); } catch (e) { feel = null; }

    let indicators = '';
    try { indicators = indicatorsHTML(cycleDay, ovu, settings); } catch (e) { indicators = ''; }

    const facts = (feel && Array.isArray(feel.facts) ? feel.facts : []).slice(0, 5);

    return `
    <div class="card science-card">
      <div class="section-title">Your hormone story ${bowOrnament()}</div>
      ${indicators}
      ${graph}
      <p class="science-graphnote" style="margin:4px 0 12px;font-size:11.5px;color:var(--muted);text-align:center">Day ${esc(cycleDay)} of about ${esc(n)} — relative levels across a typical cycle of your length, not a blood test.</p>
      ${feel ? `<h3 class="science-headline" style="margin:0;font-family:'Didot','Bodoni 72',Georgia,serif;font-size:20px;font-weight:700">${esc(feel.headline)}</h3><p class="science-body" style="margin:6px 0 10px;font-size:13.5px;line-height:1.6">${esc(feel.body)}</p>` : ''}
      ${facts.length ? `<ul class="why-facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      ${insight ? pillsHTML(insight.levels) : ''}
      ${insight ? `<p class="science-insight" style="margin:6px 0 0;font-size:13px;line-height:1.6;color:var(--muted)">${esc(insight.body || '')}</p>` : ''}
    </div>`;
  }
};
