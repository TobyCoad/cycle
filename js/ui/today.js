// Today screen — owner: Agent 2
// Renders the Flo-style dashboard: cycle ring, status cards, tip, feelings preview.
import { getAllLogs, getSettings, todayStr, addDays, diffDays } from '../db.js';
import { currentState, getPeriods } from '../model.js';
import { predictions } from '../predict.js';
import { FLOWS, SYMPTOMS, MOODS, DISCHARGE, SEX, MEDS } from '../taxonomy.js';
import { tipFor } from '../content/tips.js';
import { moonPhase, moonCycleType } from '../moon.js';
import { BUNNY_MASCOT, BUNNY_CHEER } from '../art.js';

/* V3 dashboard cards (meds / pain / science / meals / partner).
   Loaded dynamically and individually guarded: a missing or broken card
   renders as nothing rather than taking the whole Today screen down. */
async function loadCards(ctx) {
  const paths = {
    meds: './cards/meds.js',
    pain: './cards/pain.js',
    science: './cards/science.js',
    meals: './cards/meals.js',
    partner: './cards/partner.js',
  };
  const html = {};
  const wires = [];
  for (const [id, path] of Object.entries(paths)) {
    html[id] = '';
    try {
      const mod = (await import(path)).default;
      if (!mod || typeof mod.html !== 'function') continue;
      const h = mod.html(ctx);
      html[id] = typeof h === 'string' ? h : '';
      if (html[id] && typeof mod.wire === 'function') {
        wires.push((el) => { try { mod.wire(el, ctx); } catch (e) { console.warn(`card '${id}' wire failed`, e); } });
      }
    } catch (e) {
      console.warn(`card '${id}' unavailable:`, e && e.message);
    }
  }
  return { html, wires };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FLOW_DROPS = { spotting: '🩸', light: '💧', medium: '💧💧', heavy: '💧💧💧' };
const PHASE_LABEL = {
  menstrual: 'Period',
  follicular: 'Follicular phase',
  ovulation: 'Ovulation',
  luteal: 'Luteal phase',
};

function localDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtLong(str) {
  return localDate(str).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtShort(str) {
  return localDate(str).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
function byKey(list) {
  const o = {};
  for (const it of list || []) o[it.key] = it;
  return o;
}

/* ---------- cycle ring (SVG donut, one arc segment per cycle day) ---------- */

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function ringHTML(state, preds, logs, today) {
  const size = 240, cx = size / 2, cy = size / 2, r = 96, sw = 15;
  const n = Math.max(preds.avgCycle, state.cycleDay || 1);
  const per = 360 / n;
  const gap = Math.min(2.6, per * 0.18);
  const flowDates = new Set(logs.filter((l) => l && l.flow).map((l) => l.date));
  const parts = [];

  for (let i = 0; i < n; i++) {
    const d = addDays(state.cycleStart, i);
    let color = 'var(--border)';
    if (i < preds.avgPeriod || flowDates.has(d)) color = 'var(--period)';
    if (preds.fertileStart && d >= preds.fertileStart && d <= preds.fertileEnd) color = 'var(--fertile)';
    if (d === preds.ovulationDate) color = 'var(--ovulation)';
    const a0 = i * per + gap / 2;
    let a1 = (i + 1) * per - gap / 2;
    if (a1 <= a0) a1 = a0 + 0.4;
    const op = d > today ? 0.38 : 1;
    parts.push(`<path d="${arcPath(cx, cy, r, a0, a1)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none" opacity="${op}"/>`);
  }

  // ovulation dot just outside the ring
  if (preds.ovulationDate) {
    const oi = diffDays(state.cycleStart, preds.ovulationDate);
    if (oi >= 0 && oi < n) {
      const [ox, oy] = polar(cx, cy, r + sw / 2 + 8, (oi + 0.5) * per);
      parts.push(`<circle cx="${ox.toFixed(2)}" cy="${oy.toFixed(2)}" r="3.5" fill="var(--ovulation)"/>`);
    }
  }

  // today marker
  const k = Math.min(state.cycleDay, n) - 1;
  const [mx, my] = polar(cx, cy, r, (k + 0.5) * per);
  parts.push(`<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="8" fill="var(--card)" stroke="var(--accent)" stroke-width="3.5"/>`);

  const phase = PHASE_LABEL[state.phase] || 'Cycle';
  return `
    <div class="ring-wrap" role="img" aria-label="Cycle day ${state.cycleDay}, ${esc(phase)}">
      <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>
      <div class="ring-center">
        <div class="ring-phase">${esc(phase)}</div>
        <div class="ring-day">Day ${state.cycleDay}</div>
        <div class="ring-sub">of ~${preds.avgCycle}-day cycle</div>
      </div>
    </div>`;
}

/* ---------- status cards ---------- */

function statusCardsHTML(state, preds, today) {
  const cards = [];
  const overdue = Math.max(0, preds.overdueDays || 0);

  if (state.onPeriod) {
    const left = preds.avgPeriod - state.cycleDay;
    cards.push(`
      <div class="card status-card status-grad">
        <div class="status-kicker">Period</div>
        <div class="status-title">Day ${state.cycleDay} of period</div>
        <div class="status-sub">${left > 0 ? `About ${left} day${left === 1 ? '' : 's'} to go` : 'Should be wrapping up soon'}</div>
      </div>`);
  } else if (overdue > 0) {
    cards.push(`
      <div class="card status-card status-grad">
        <div class="status-kicker">Period</div>
        <div class="status-title">${overdue} day${overdue === 1 ? '' : 's'} late</div>
        <div class="status-sub">Your period hasn't been logged yet — log it when it starts${preds.irregular ? '. Your cycles look a little irregular, so this can shift' : ''}</div>
      </div>`);
  } else {
    const dTo = diffDays(today, preds.nextPeriodStart);
    const title = dTo <= 0 ? 'Period expected today' : dTo === 1 ? 'Period expected tomorrow' : `Period in ${dTo} days`;
    cards.push(`
      <div class="card status-card status-grad">
        <div class="status-kicker">Period</div>
        <div class="status-title">${title}</div>
        <div class="status-sub">Expected ${esc(fmtShort(preds.nextPeriodStart))}${preds.irregular ? ' · cycles look irregular, prediction is approximate' : ''}</div>
      </div>`);
  }

  if (today === preds.ovulationDate) {
    cards.push(`
      <div class="card status-card status-ovu">
        <div class="status-kicker">Fertility</div>
        <div class="status-title">✨ Ovulation day</div>
        <div class="status-sub">Highest chance of pregnancy today</div>
      </div>`);
  } else if (preds.fertileStart && today >= preds.fertileStart && today <= preds.fertileEnd) {
    cards.push(`
      <div class="card status-card status-fertile">
        <div class="status-kicker">Fertility</div>
        <div class="status-title">High chance of pregnancy today</div>
        <div class="status-sub">Fertile window ${esc(fmtShort(preds.fertileStart))} – ${esc(fmtShort(preds.fertileEnd))}</div>
      </div>`);
  } else if (preds.fertileStart && today < preds.fertileStart) {
    const inD = diffDays(today, preds.fertileStart);
    cards.push(`
      <div class="card status-card status-fertile">
        <div class="status-kicker">Fertility</div>
        <div class="status-title">Fertile window starts in ${inD} day${inD === 1 ? '' : 's'}</div>
        <div class="status-sub">${esc(fmtShort(preds.fertileStart))} – ${esc(fmtShort(preds.fertileEnd))} · ovulation ${esc(fmtShort(preds.ovulationDate))}</div>
      </div>`);
  }
  return cards.join('');
}

/* ---------- pregnancy mode ---------- */

function pregnancyHTML(settings, today) {
  const lmp = settings.pregnancyLMP;
  if (!lmp) {
    return `
      <div class="card onboard-card">
        <div class="onboard-emoji">🤰</div>
        <h2>Pregnancy mode</h2>
        <p>Set your last menstrual period date in Settings to track your week and due date.</p>
      </div>`;
  }
  const days = Math.max(0, diffDays(lmp, today));
  const week = Math.floor(days / 7) + 1; // ordinal week (week 1 = days 0–6)
  const dayOfWeek = (days % 7) + 1;
  const completedWeeks = Math.floor(days / 7);
  const tri = completedWeeks < 13 ? 'First trimester' : completedWeeks < 27 ? 'Second trimester' : 'Third trimester';
  const due = addDays(lmp, 280);
  const pct = Math.min(100, (days / 280) * 100).toFixed(1);
  return `
    <div class="card preg-card">
      <div class="status-kicker">Pregnancy</div>
      <div class="preg-week">Week ${week}, day ${dayOfWeek}</div>
      <div class="preg-tri">${tri} · ${completedWeeks} week${completedWeeks === 1 ? '' : 's'} pregnant</div>
      <div class="preg-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="preg-fill" style="width:${pct}%"></div>
      </div>
      <div class="preg-due">🗓️ Due date: <strong>${esc(fmtLong(due))}</strong></div>
    </div>`;
}

/* ---------- V2: moon card ---------- */

const AFFIRMATIONS = [
  'I move with my own rhythm, and that is enough.',
  'My body is wise — I listen to it with kindness.',
  'Soft days grow strong things.',
  'I am allowed to rest without earning it.',
  'Little by little, I bloom.',
  'I trust the season my body is in.',
  'My energy is precious; I spend it gently.',
  'I make space for what makes me feel light.',
  'Today I choose warmth — for myself first.',
  'I am becoming, quietly and surely.',
  'My feelings are messengers, not problems.',
  'I glow at my own pace.',
  'Tenderness is a kind of strength.',
  'I let today be soft.'
];

function affirmationFor(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return AFFIRMATIONS[(y + m * 7 + d) % AFFIRMATIONS.length];
}

function moonCardHTML(logs, today) {
  const mp = moonPhase(today);
  let arch = '';
  try {
    const periods = getPeriods(logs || []);
    if (periods && periods.length) {
      const a = moonCycleType(periods[periods.length - 1].start);
      if (a && a.title) {
        arch = `
        <div class="moon-arch">
          <span class="mini-chip moon-chip moon-${esc(a.type)}"><span>🌙</span><span>${esc(a.title)}</span></span>
          <p class="moon-blurb">${esc(a.blurb || '')}</p>
        </div>`;
      }
    }
  } catch (e) { arch = ''; }
  return `
    <div class="card moon-card">
      <div class="moon-main">
        <span class="moon-emoji" aria-hidden="true">${mp.emoji}</span>
        <div class="moon-text">
          <div class="section-title">Moon tonight</div>
          <div class="moon-name">${esc(mp.name)}</div>
          <div class="moon-illum">${Math.round(mp.illumination)}% illuminated</div>
        </div>
      </div>
      ${arch}
      <p class="moon-affirmation">“${esc(affirmationFor(today))}”</p>
    </div>`;
}

/* ---------- feelings preview ---------- */

function previewChips(log) {
  if (!log) return [];
  const flows = byKey(FLOWS), sym = byKey(SYMPTOMS), moods = byKey(MOODS),
    dis = byKey(DISCHARGE), sex = byKey(SEX), meds = byKey(MEDS);
  const chips = [];
  const add = (emoji, label) => chips.push(`<span class="mini-chip">${emoji ? `<span>${emoji}</span>` : ''}<span>${esc(label)}</span></span>`);

  if (log.flow && flows[log.flow]) add(FLOW_DROPS[log.flow] || flows[log.flow].emoji || '', flows[log.flow].label);
  for (const k of log.symptoms || []) if (sym[k]) add(sym[k].emoji || '', sym[k].label);
  for (const k of log.moods || []) if (moods[k]) add(moods[k].emoji || '', moods[k].label);
  if (log.discharge && dis[log.discharge]) add(dis[log.discharge].emoji || '', dis[log.discharge].label);
  for (const k of log.sex || []) if (sex[k]) add(sex[k].emoji || '', sex[k].label);
  for (const k of log.meds || []) if (meds[k]) add(meds[k].emoji || '', meds[k].label);
  if (log.water != null && log.water > 0) add('💧', `${log.water} glass${log.water === 1 ? '' : 'es'}`);
  if (log.temperature != null) add('🌡️', `${log.temperature} °C`);
  if (log.sleep != null) add('😴', `${log.sleep} h sleep`);
  if (log.notes) add('📝', 'Note');
  return chips;
}

function feelingsHTML(todayLog) {
  const chips = previewChips(todayLog);
  return `
    <div class="card feel-card">
      <div class="section-title">How are you feeling today?</div>
      ${chips.length
        ? `<div class="feel-chips">${chips.join('')}</div>`
        : `<p class="feel-empty">Nothing logged yet today.</p>`}
      <button type="button" class="btn btn-primary feel-btn" data-act="go-log">${chips.length ? 'Edit today’s log' : '+ Log how you feel'}</button>
    </div>`;
}

/* ---------- screen ---------- */

export default {
  id: 'today',
  title: 'Today',

  async render(el) {
    const [logs, settings] = await Promise.all([getAllLogs(), getSettings()]);
    const today = todayStr();
    const todayLog = (logs || []).find((l) => l && l.date === today) || null;
    const name = settings && settings.name ? settings.name.trim() : '';

    let bunnyGreet = '';
    try {
      if (typeof BUNNY_MASCOT === 'string') bunnyGreet = `<span class="bunny-art-sm" aria-hidden="true">${BUNNY_MASCOT}</span>`;
    } catch (e) { bunnyGreet = ''; }

    const header = `
      <header class="today-header">
        ${bunnyGreet}
        <div class="today-header-text">
          <div class="today-greet">${esc(greeting())}${name ? `, ${esc(name)}` : ''}</div>
          <div class="today-date">${esc(fmtLong(today))}</div>
        </div>
      </header>`;

    let main = '';
    let tipCard = '';
    let moonCard = '';
    let preds = null;
    let state = null;

    // V2: moon card renders in both modes — a bad moon calc must never kill Today.
    try { moonCard = moonCardHTML(logs || [], today); } catch (e) { moonCard = ''; }

    if (settings && settings.mode === 'pregnancy') {
      main = pregnancyHTML(settings, today);
    } else {
      preds = predictions(logs || [], settings || {});
      state = currentState(logs || [], settings || {});
      if (!preds || !state || state.cycleDay == null || !state.cycleStart) {
        let bunnyCheer = '<div class="onboard-emoji">🌸</div>';
        try {
          if (typeof BUNNY_CHEER === 'string') bunnyCheer = `<div class="bunny-art" aria-hidden="true">${BUNNY_CHEER}</div>`;
        } catch (e) { /* keep emoji fallback */ }
        main = `
          <div class="card onboard-card">
            ${bunnyCheer}
            <h2>Welcome to Cycle</h2>
            <p>Log your first period and you'll see predictions, your fertile window and daily insights here. Everything stays private, on this device.</p>
            <button type="button" class="btn btn-primary" data-act="go-log">Log your period</button>
          </div>`;
      } else {
        main = ringHTML(state, preds, logs || [], today) + statusCardsHTML(state, preds, today);
      }
      // daily tip (guard null — tips module may have nothing for this phase/day)
      let tip = null;
      try { tip = tipFor(state ? state.phase : null, state ? state.cycleDay : null); } catch (e) { tip = null; }
      if (tip && tip.title) {
        tipCard = `
          <div class="card tip-card">
            <div class="tip-icon">💡</div>
            <div class="tip-text">
              <div class="tip-title">${esc(tip.title)}</div>
              <div class="tip-body">${esc(tip.body || '')}</div>
            </div>
          </div>`;
      }
    }

    // V3 dashboard cards — each loads and fails independently.
    const ctx = { logs: logs || [], settings: settings || {}, preds, state, today };
    const cards = await loadCards(ctx);

    el.innerHTML = `
      <div class="today-screen">
        ${header}
        ${main}
        ${cards.html.meds}
        ${cards.html.pain}
        ${tipCard}
        ${cards.html.science}
        ${cards.html.meals}
        ${moonCard}
        ${cards.html.partner}
        ${feelingsHTML(todayLog)}
      </div>`;

    for (const wire of cards.wires) wire(el);

    el.querySelectorAll('[data-act="go-log"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        try { sessionStorage.setItem('logDate', today); } catch (e) { /* private mode */ }
        if (typeof window.__nav === 'function') window.__nav('log');
      });
    });
  },
};
