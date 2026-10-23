// js/ui/calendar.js — Calendar screen (Agent 3)
// Month grid (Mon-start) with flow/prediction/fertile overlays, legend,
// and a bottom-sheet day summary. Pure ES module, no external resources.

import { getAllLogs, getSettings, todayStr, addDays, diffDays } from '../db.js';
import { predictions } from '../predict.js';
import { FLOWS, SYMPTOMS, MOODS, DISCHARGE, SEX, MEDS } from '../taxonomy.js';
import { moonPhase, moonMarker } from '../moon.js';
// V3: namespace import on purpose — cycleDayProfile is being added to model.js
// concurrently, and a namespace import still links if the export is missing.
import * as MODEL from '../model.js';

// ---------- tiny helpers ----------

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const p2 = (n) => String(n).padStart(2, '0');
const dstr = (y, m, d) => `${y}-${p2(m + 1)}-${p2(d)}`; // m is 0-based

const byKey = (arr) => {
  const m = new Map();
  (Array.isArray(arr) ? arr : []).forEach((o) => { if (o && o.key) m.set(o.key, o); });
  return m;
};
const FLOW_MAP = byKey(FLOWS);
const SYM_MAP = byKey(SYMPTOMS);
const MOOD_MAP = byKey(MOODS);
const DIS_MAP = byKey(DISCHARGE);
const SEX_MAP = byKey(SEX);
const MED_MAP = byKey(MEDS);

const labelOf = (map, key) => {
  const o = map.get(key);
  if (!o) return String(key);
  return (o.emoji ? o.emoji + ' ' : '') + (o.label || key);
};

const DROPLETS = { spotting: 1, light: 1, medium: 2, heavy: 3 };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Day markers: a little heart when sex was logged; a quiet grey dot for any
// other non-flow data (symptoms, pain, notes, …) so it never reads as blood.
function hasSexLogged(log) {
  return !!(log && Array.isArray(log.sex) && log.sex.length);
}
function hasOtherData(log) {
  if (!log) return false;
  if (Array.isArray(log.symptoms) && log.symptoms.length) return true;
  if (Array.isArray(log.moods) && log.moods.length) return true;
  if (Array.isArray(log.meds) && log.meds.length) return true;
  if (log.discharge != null && log.discharge !== '') return true;
  if (log.painLevel != null) return true;
  if (log.temperature != null) return true;
  if (log.weight != null) return true;
  if (log.water != null) return true;
  if (log.sleep != null) return true;
  if (log.notes && String(log.notes).trim()) return true;
  return false;
}

// Add every date string from a..b (inclusive) to a Set. Capped for safety.
function addRange(set, a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return;
  let d = a;
  let i = 0;
  while (d <= b && i < 62) { set.add(d); d = addDays(d, 1); i += 1; }
}

// ---------- module-level view state (survives 'data-changed' re-renders) ----------

let viewY = null;  // full year
let viewM = null;  // 0-based month

export default {
  id: 'calendar',
  title: 'Calendar',

  async render(el) {
    // -------- load data (everything guarded — empty DB must never crash) --------
    let logs = [];
    let settings = {};
    try { logs = (await getAllLogs()) || []; } catch (e) { logs = []; }
    try { settings = (await getSettings()) || {}; } catch (e) { settings = {}; }

    let preds = null;
    if (settings.mode !== 'pregnancy') {
      try { preds = predictions(logs, settings); } catch (e) { preds = null; }
    }

    const today = todayStr();
    if (viewY == null || viewM == null) {
      viewY = parseInt(today.slice(0, 4), 10);
      viewM = parseInt(today.slice(5, 7), 10) - 1;
    }

    const logsMap = new Map();
    logs.forEach((l) => { if (l && l.date) logsMap.set(l.date, l); });

    // Prediction overlay sets — only ever painted on today/future dates.
    const fertileSet = new Set();
    const predictedSet = new Set();
    let ovuDate = null;
    if (preds) {
      if (preds.fertileStart && preds.fertileEnd) addRange(fertileSet, preds.fertileStart, preds.fertileEnd);
      (Array.isArray(preds.futurePeriods) ? preds.futurePeriods : [])
        .slice(0, 3)
        .forEach((p) => { if (p && p.start && p.end) addRange(predictedSet, p.start, p.end); });
      ovuDate = preds.ovulationDate || null;
    }

    const fertVis = (ds) => ds >= today && fertileSet.has(ds);
    const predVis = (ds) => ds >= today && predictedSet.has(ds) && !(logsMap.get(ds) && logsMap.get(ds).flow);
    const ovuVis = (ds) => ds >= today && ds === ovuDate;

    // -------- V3: day-sheet only extras (the grid stays deliberately clean) --------
    // Everything below is guarded: a missing model export or a bad number must
    // never stop a day sheet from opening.
    let periodList = [];
    try { periodList = (typeof MODEL.getPeriods === 'function' ? MODEL.getPeriods(logs) : []) || []; } catch (e) { periodList = []; }

    let dayProfile = null;
    try {
      if (typeof MODEL.cycleDayProfile === 'function') dayProfile = MODEL.cycleDayProfile(logs) || null;
    } catch (e) { dayProfile = null; }

    // Cycle day of any date, from the most recent period start on or before it.
    function cycleDayFor(ds) {
      for (let i = periodList.length - 1; i >= 0; i -= 1) {
        const p = periodList[i];
        if (p && p.start && p.start <= ds) {
          const d = diffDays(p.start, ds) + 1;
          return (d >= 1 && d <= 60) ? d : null;
        }
      }
      return null;
    }

    // Where a date sits relative to the nearest ovulation, projecting the
    // predicted ovulation backwards/forwards by whole cycles.
    // 0 = ovulation day, negative = before it.
    function ovuOffset(ds) {
      if (!preds || !preds.ovulationDate) return null;
      const cyc = Math.max(15, Math.min(60, preds.avgCycle || 28));
      const off = diffDays(preds.ovulationDate, ds);
      if (!Number.isFinite(off)) return null;
      return off - Math.round(off / cyc) * cyc;
    }

    // "Historically a heavy day for you" — needs at least two cycles of history
    // before it earns the word "historically".
    function heavyExpectation(ds) {
      if (!Array.isArray(dayProfile)) return null;
      const cd = cycleDayFor(ds);
      if (!cd) return null;
      const e = dayProfile[cd - 1];
      if (!e || (e.n || 0) < 2) return null;
      const flow = Number(e.avgFlow);
      const pain = Number(e.avgPain);
      const heavyFlow = Number.isFinite(flow) && flow >= 3;
      const bigPain = Number.isFinite(pain) && pain >= 7;
      if (!heavyFlow && !bigPain) return null;
      const bits = [];
      if (heavyFlow) bits.push('heavier flow');
      if (bigPain) bits.push(`pain around ${Math.round(pain)}/10`);
      return `Day ${cd} — historically a heavy day for you (${bits.join(', ')})`;
    }

    // -------- cell builder --------
    function cellHTML(y, m, d, out) {
      const ds = dstr(y, m, d);
      const log = logsMap.get(ds);
      const cls = ['cal-cell'];
      let ariaBits = '';

      if (out) {
        cls.push('out');
      } else {
        if (ds === today) cls.push('today');
        if (log && log.flow && FLOW_MAP.has(log.flow)) { cls.push('flow-' + log.flow); ariaBits += ', period logged'; }
        if (predVis(ds)) { cls.push('pred'); ariaBits += ', predicted period'; }
        if (fertVis(ds)) {
          cls.push('fertile');
          if (!fertVis(addDays(ds, -1))) cls.push('fertile-start');
          if (!fertVis(addDays(ds, 1))) cls.push('fertile-end');
          ariaBits += ', fertile window';
        }
        if (ovuVis(ds)) { cls.push('ovu'); ariaBits += ', predicted ovulation'; }
      }
      const sexMark = !out && hasSexLogged(log);
      const otherMark = !out && !sexMark && hasOtherData(log);
      if (sexMark) ariaBits += ', sex logged';
      else if (otherMark) ariaBits += ', has log entries';

      // V2: mark the one day nearest each exact new/full moon (guarded — a moon
      // failure must never break the calendar). Corner emoji, clear of the
      // bottom-centre logged-data dot.
      let moonHTML = '';
      if (!out) {
        try {
          const mm = moonMarker(ds);
          if (mm) {
            moonHTML = `<span class="cal-moon" aria-hidden="true" style="position:absolute;top:1px;right:2px;font-size:8px;line-height:1;pointer-events:none;opacity:.8">${mm === 'new' ? '🌑' : '🌕'}</span>`;
            ariaBits += mm === 'new' ? ', new moon' : ', full moon';
          }
        } catch (e) { moonHTML = ''; }
      }

      const dt = new Date(y, m, d);
      const aria = dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + ariaBits;

      return `<button type="button" class="${cls.join(' ')}${moonHTML ? ' has-moon' : ''}" data-date="${ds}"` +
        (moonHTML ? ' style="position:relative"' : '') +
        (out ? ' disabled tabindex="-1" aria-hidden="true"' : ` aria-label="${esc(aria)}"`) +
        `><span class="cal-circle"><span class="cal-daynum">${d}</span></span>` +
        `<span class="cal-mark${sexMark ? ' heart' : ''}${(sexMark || otherMark) ? '' : ' off'}">${sexMark ? '♥' : ''}</span>${moonHTML}</button>`;
    }

    function gridHTML(y, m) {
      const firstIdx = (new Date(y, m, 1).getDay() + 6) % 7; // Mon = 0
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const prevDays = new Date(y, m, 0).getDate();
      const cells = [];
      // leading days of previous month (faded, inert)
      for (let i = 0; i < firstIdx; i += 1) {
        const d = prevDays - firstIdx + 1 + i;
        const pm = new Date(y, m - 1, 1);
        cells.push(cellHTML(pm.getFullYear(), pm.getMonth(), d, true));
      }
      for (let d = 1; d <= daysInMonth; d += 1) cells.push(cellHTML(y, m, d, false));
      // trailing days of next month to complete the final week
      const rem = (7 - ((firstIdx + daysInMonth) % 7)) % 7;
      for (let d = 1; d <= rem; d += 1) {
        const nm = new Date(y, m + 1, 1);
        cells.push(cellHTML(nm.getFullYear(), nm.getMonth(), d, true));
      }
      return cells.join('');
    }

    // -------- full screen draw --------
    function draw(animDir) {
      const monthName = new Date(viewY, viewM, 1)
        .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const onCurrentMonth =
        viewY === parseInt(today.slice(0, 4), 10) && viewM === parseInt(today.slice(5, 7), 10) - 1;

      el.innerHTML = `
<section class="cal">
  <header class="cal-head">
    <h2 class="cal-title">${esc(monthName)}</h2>
    <div class="cal-nav">
      <button type="button" class="cal-navbtn" id="cal-prev" aria-label="Previous month">&#8249;</button>
      <button type="button" class="cal-todaybtn${onCurrentMonth ? ' isnow' : ''}" id="cal-jump"${onCurrentMonth ? ' disabled' : ''}>Today</button>
      <button type="button" class="cal-navbtn" id="cal-next" aria-label="Next month">&#8250;</button>
    </div>
  </header>

  <div class="card cal-card" id="cal-swipe">
    <div class="cal-weekrow" aria-hidden="true">
      ${WEEKDAYS.map((w) => `<span class="cal-wd">${w}</span>`).join('')}
    </div>
    <div class="cal-grid${animDir ? ' anim-' + animDir : ''}" id="cal-grid" role="grid" aria-label="${esc(monthName)}">
      ${gridHTML(viewY, viewM)}
    </div>
  </div>

  <div class="cal-legend" aria-label="Legend">
    <span class="cal-lg"><i class="cal-sw sw-period"></i>Period</span>
    <span class="cal-lg"><i class="cal-sw sw-pred"></i>Predicted</span>
    <span class="cal-lg"><i class="cal-sw sw-fert"></i>Fertile</span>
    <span class="cal-lg"><i class="cal-sw sw-ovu"></i>Ovulation</span>
    <span class="cal-lg"><i class="cal-sw sw-heart">♥</i>Sex</span>
    <span class="cal-lg"><i class="cal-sw sw-mark"></i>Logged</span>
  </div>

  ${logs.length === 0 ? `
  <div class="card cal-empty">
    <p><strong>No data yet.</strong> Tap a day to add your first log — once a period is logged, predictions appear here.</p>
  </div>` : (!preds && settings.mode !== 'pregnancy' ? `
  <div class="card cal-empty">
    <p>Log a period to see predicted periods, your fertile window and ovulation on the calendar.</p>
  </div>` : '')}

  <div id="cal-sheet-root"></div>
</section>`;

      bind();
    }

    // -------- events --------
    function shiftMonth(delta) {
      const dt = new Date(viewY, viewM + delta, 1);
      viewY = dt.getFullYear();
      viewM = dt.getMonth();
      draw(delta > 0 ? 'left' : 'right');
    }

    function bind() {
      const prev = el.querySelector('#cal-prev');
      const next = el.querySelector('#cal-next');
      const jump = el.querySelector('#cal-jump');
      const swipeEl = el.querySelector('#cal-swipe');
      const grid = el.querySelector('#cal-grid');

      if (prev) prev.addEventListener('click', () => shiftMonth(-1));
      if (next) next.addEventListener('click', () => shiftMonth(1));
      if (jump) jump.addEventListener('click', () => {
        viewY = parseInt(today.slice(0, 4), 10);
        viewM = parseInt(today.slice(5, 7), 10) - 1;
        draw();
      });

      if (grid) grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.cal-cell');
        if (btn && !btn.classList.contains('out') && btn.dataset.date) openSheet(btn.dataset.date);
      });

      // touch swipe left/right to change months
      if (swipeEl) {
        let tx = null;
        let ty = null;
        swipeEl.addEventListener('touchstart', (e) => {
          tx = e.touches[0].clientX;
          ty = e.touches[0].clientY;
        }, { passive: true });
        swipeEl.addEventListener('touchend', (e) => {
          if (tx == null) return;
          const dx = e.changedTouches[0].clientX - tx;
          const dy = e.changedTouches[0].clientY - ty;
          tx = null; ty = null;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            shiftMonth(dx < 0 ? 1 : -1);
          }
        }, { passive: true });
      }
    }

    // -------- day detail bottom sheet --------
    function sheetBadges(ds, log) {
      const out = [];
      if (log && log.flow && FLOW_MAP.has(log.flow)) {
        out.push(`<span class="cal-badge b-period">${'&#129656;'.repeat(DROPLETS[log.flow] || 1)} ${esc(FLOW_MAP.get(log.flow).label || log.flow)} flow</span>`);
      }
      if (predVis(ds)) out.push('<span class="cal-badge b-pred">Predicted period</span>');
      if (ovuVis(ds)) out.push('<span class="cal-badge b-ovu">Predicted ovulation</span>');
      else if (fertVis(ds)) out.push('<span class="cal-badge b-fert">Fertile window</span>');

      // ---- V3 sheet-only badges (glow / libido / expected-heavy) ----
      const notes = [];
      if (settings.mode !== 'pregnancy') {
        let rel = null;
        try { rel = ovuOffset(ds); } catch (e) { rel = null; }
        if (rel != null) {
          if (rel >= -3 && rel <= 0) {
            out.push('<span class="cal-badge b-glow">✨ Glow day</span>');
            notes.push('Oestrogen is at its cycle peak around now — the days it quietly flatters skin and mood.');
          }
          if (rel >= -4 && rel <= 1) {
            out.push('<span class="cal-badge b-sex">💗 High-libido window</span>');
            notes.push(settings.iudType === 'copper'
              ? 'Desire tends to rise on peak oestrogen. Libido information only — not contraception guidance; your copper IUD covers that, and no day here is safe or unsafe.'
              : 'Desire tends to rise on peak oestrogen. Libido information only — never contraception guidance, and no day here is marked safe or unsafe.');
          }
        }
      }
      let heavy = null;
      try { heavy = heavyExpectation(ds); } catch (e) { heavy = null; }
      if (heavy) {
        out.push(`<span class="cal-badge b-heavy">🩸 ${esc(heavy)}</span>`);
        notes.push('Worth lining up a hot water bottle, soft plans and an early night.');
      }

      if (!out.length) return '';
      return `<div class="cal-badges">${out.join('')}</div>` +
        notes.map((t) => `<p class="cal-sheet-note" style="margin:6px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted)">${esc(t)}</p>`).join('');
    }

    function row(name, valueHTML) {
      return `<div class="cal-row"><span class="cal-row-name">${esc(name)}</span><span class="cal-row-val">${valueHTML}</span></div>`;
    }

    function tags(keys, map) {
      return keys.map((k) => `<span class="cal-tag">${esc(labelOf(map, k))}</span>`).join('');
    }

    function sheetRows(log) {
      if (!log) return '';
      const rows = [];
      if (log.flow && FLOW_MAP.has(log.flow)) {
        rows.push(row('Flow', `<span class="cal-tag">${'&#129656;'.repeat(DROPLETS[log.flow] || 1)} ${esc(FLOW_MAP.get(log.flow).label || log.flow)}</span>`));
      }
      if (Array.isArray(log.symptoms) && log.symptoms.length) rows.push(row('Symptoms', tags(log.symptoms, SYM_MAP)));
      if (Array.isArray(log.moods) && log.moods.length) rows.push(row('Moods', tags(log.moods, MOOD_MAP)));
      if (log.discharge != null && log.discharge !== '') rows.push(row('Discharge', `<span class="cal-tag">${esc(labelOf(DIS_MAP, log.discharge))}</span>`));
      if (Array.isArray(log.sex) && log.sex.length) rows.push(row('Sex & drive', tags(log.sex, SEX_MAP)));
      if (log.temperature != null) rows.push(row('Temperature', `${esc(log.temperature)}&nbsp;&deg;C`));
      if (log.weight != null) rows.push(row('Weight', `${esc(log.weight)}&nbsp;kg`));
      if (log.water != null) rows.push(row('Water', `${esc(log.water)} ${Number(log.water) === 1 ? 'glass' : 'glasses'}`));
      if (log.sleep != null) rows.push(row('Sleep', `${esc(log.sleep)}&nbsp;h`));
      if (Array.isArray(log.meds) && log.meds.length) rows.push(row('Medication', tags(log.meds, MED_MAP)));
      if (log.notes && String(log.notes).trim()) {
        rows.push(`<div class="cal-row cal-row-notes"><span class="cal-row-name">Notes</span><div class="cal-note">${esc(log.notes)}</div></div>`);
      }
      return rows.join('');
    }

    function closeSheet() {
      const root = el.querySelector('#cal-sheet-root');
      if (root) root.innerHTML = '';
    }

    function openSheet(ds) {
      const root = el.querySelector('#cal-sheet-root');
      if (!root) return;
      const log = logsMap.get(ds) || null;
      const parts = ds.split('-').map(Number);
      const heading = new Date(parts[0], parts[1] - 1, parts[2])
        .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
      const rowsHTML = sheetRows(log);
      const editable = ds <= today; // log screen can't go into the future

      // V2: moon phase beside the date in the sheet header (guarded).
      let moonBit = '';
      try {
        const mp = moonPhase(ds);
        if (mp && mp.emoji) moonBit = ` <span class="cal-sheet-moon" title="${esc(mp.name)} · ${Math.round(mp.illumination)}% illuminated">${mp.emoji}</span>`;
      } catch (e) { moonBit = ''; }

      root.innerHTML = `
<div class="cal-sheet-backdrop" id="cal-backdrop">
  <div class="sheet cal-sheet" role="dialog" aria-modal="true" aria-label="${esc(heading)}">
    <div class="cal-sheet-handle" aria-hidden="true"></div>
    <div class="cal-sheet-head">
      <h3 class="cal-sheet-title">${esc(heading)}${moonBit}</h3>
      <button type="button" class="cal-sheet-close" id="cal-sheet-close" aria-label="Close">&times;</button>
    </div>
    ${sheetBadges(ds, log)}
    ${rowsHTML || '<p class="cal-sheet-none">Nothing logged for this day.</p>'}
    ${editable ? `<button type="button" class="btn btn-primary cal-sheet-edit" id="cal-sheet-edit">${rowsHTML ? 'Edit' : 'Log this day'}</button>` : ''}
  </div>
</div>`;

      const backdrop = root.querySelector('#cal-backdrop');
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeSheet(); });
      root.querySelector('#cal-sheet-close').addEventListener('click', closeSheet);
      const edit = root.querySelector('#cal-sheet-edit');
      if (edit) edit.addEventListener('click', () => {
        try { sessionStorage.setItem('logDate', ds); } catch (e) { /* private mode */ }
        closeSheet();
        if (typeof window.__nav === 'function') window.__nav('log');
      });
    }

    draw();
  }
};
