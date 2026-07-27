// Log screen — owner: Agent 2
// Date-picker + taxonomy chip sections + measurements + notes. Autosaves via putLog.
import { getLog, putLog, todayStr, addDays } from '../db.js';
import { FLOWS, SYMPTOMS, MOODS, DISCHARGE, SEX, MEDS, PAIN_LEVELS } from '../taxonomy.js';
import { BUNNY_MASCOT, SPARKLES } from '../art.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FLOW_DROPS = { spotting: '🩸', light: '💧', medium: '💧💧', heavy: '💧💧💧' };
const SINGLE_FIELDS = { flow: true, discharge: true };

// Module state — survives the app's re-render on 'data-changed' after every save.
let curDate = null;
let lastSaveTs = 0;
let savedScroll = { win: 0, el: 0 };
let rootEl = null;
let saveChain = Promise.resolve();

function localDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtFull(str) {
  return localDate(str).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
function dateTitle(str, today) {
  if (str === today) return 'Today';
  if (str === addDays(today, -1)) return 'Yesterday';
  return localDate(str).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/* Serialized read-modify-write so rapid taps never clobber each other. */
function queueSave(mutator) {
  saveChain = saveChain
    .then(async () => {
      const existing = (await getLog(curDate)) || { date: curDate };
      const next = mutator({ ...existing });
      next.date = curDate;
      savedScroll = { win: window.scrollY || 0, el: rootEl ? rootEl.scrollTop || 0 : 0 };
      lastSaveTs = Date.now();
      await putLog(next);
    })
    .catch(() => { /* keep the chain alive on failure */ });
  return saveChain;
}

function toggleArray(arr, key) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  const i = a.indexOf(key);
  if (i >= 0) a.splice(i, 1); else a.push(key);
  return a;
}

/* ---------- markup ---------- */

function chipRow(field, items, log, opts = {}) {
  const single = !!SINGLE_FIELDS[field];
  const sel = log[field];
  return (items || []).map((it) => {
    const on = single ? sel === it.key : Array.isArray(sel) && sel.includes(it.key);
    const emoji = (opts.flow ? FLOW_DROPS[it.key] : it.emoji) || it.emoji || '';
    return `<button type="button" class="chip${on ? ' on' : ''}" data-field="${field}" data-key="${esc(it.key)}" aria-pressed="${on}">${emoji ? `<span class="chip-emoji">${emoji}</span>` : ''}<span>${esc(it.label)}</span></button>`;
  }).join('');
}

function sectionCard(title, field, items, log, opts = {}) {
  const sel = log[field];
  const count = SINGLE_FIELDS[field] ? (sel ? 1 : 0) : (Array.isArray(sel) ? sel.length : 0);
  return `
    <div class="card lg-section">
      <div class="section-title">${esc(title)}${count ? ` <span class="lg-count">${count}</span>` : ''}</div>
      <div class="chip-row">${chipRow(field, items, log, opts)}</div>
    </div>`;
}

// V3 (Agent C): 0–10 pain scale. 0 = explicitly pain-free; untouched = null.
function painBand(level) {
  if (typeof level !== 'number') return null;
  return PAIN_LEVELS.find((b) => level >= b.min && level <= b.max) || null;
}

function painSection(log) {
  const lvl = typeof log.painLevel === 'number' ? log.painLevel : null;
  const band = painBand(lvl);
  let chips = '';
  for (let i = 0; i <= 10; i++) {
    const on = lvl === i;
    chips += `<button type="button" class="pain-chip${on ? ' on' : ''}" data-pain="${i}" aria-pressed="${on}" aria-label="${i === 0 ? 'Pain-free' : `Pain ${i} out of 10`}">${i}</button>`;
  }
  return `
    <div class="card lg-section">
      <div class="section-title">Pain <span data-pain-band style="font-weight:600;font-size:13px;color:var(--muted)">${band ? `${band.emoji} ${esc(band.label)}` : ''}</span></div>
      <div class="pain-scale">${chips}</div>
      <div style="margin-top:6px;font-size:12px;color:var(--muted)">0 = pain-free · 10 = the worst it gets · tap again to clear</div>
    </div>`;
}

function numInput(field, label, emoji, unit, step, value, placeholder) {
  return `
    <label class="measure">
      <span class="measure-label">${emoji} ${esc(label)}</span>
      <span class="measure-input">
        <input type="number" inputmode="decimal" step="${step}" data-mfield="${field}"
               value="${value != null ? esc(value) : ''}" placeholder="${esc(placeholder)}">
        <span class="unit">${esc(unit)}</span>
      </span>
    </label>`;
}

function screenHTML(log, today) {
  const water = log.water != null ? log.water : 0;
  return `
    <div class="log-screen">
      <div class="lg-hello">
        <span class="bunny-art-sm" aria-hidden="true">${BUNNY_MASCOT}</span>
        <span class="lg-hello-text">How are you feeling?<span class="lg-hello-sub">Every little note helps your predictions</span></span>
      </div>
      <div class="lg-datebar card">
        <button type="button" class="datenav" data-act="prev" aria-label="Previous day">‹</button>
        <div class="lg-datelabel">
          <div class="lg-datemain">${esc(dateTitle(curDate, today))}</div>
          <div class="lg-datesub">${esc(fmtFull(curDate))}</div>
        </div>
        <button type="button" class="datenav" data-act="next" aria-label="Next day" ${curDate >= today ? 'disabled' : ''}>›</button>
      </div>
      ${curDate !== today ? `<button type="button" class="lg-jump" data-act="jump">Jump to today ↩</button>` : ''}

      ${sectionCard('Flow', 'flow', FLOWS, log, { flow: true })}
      ${painSection(log)}
      ${sectionCard('Symptoms', 'symptoms', SYMPTOMS, log)}
      ${sectionCard('Mood', 'moods', MOODS, log)}
      ${sectionCard('Discharge', 'discharge', DISCHARGE, log)}
      ${sectionCard('Sex & drive', 'sex', SEX, log)}

      <div class="card lg-section">
        <div class="section-title">Measurements</div>
        <div class="measure-grid">
          ${numInput('temperature', 'Temperature', '🌡️', '°C', '0.01', log.temperature, '36.60')}
          ${numInput('weight', 'Weight', '⚖️', 'kg', '0.1', log.weight, '—')}
          ${numInput('sleep', 'Sleep', '😴', 'h', '0.5', log.sleep, '8')}
        </div>
        <div class="water-row">
          <span class="water-label">💧 Water</span>
          <div class="stepper">
            <button type="button" class="step-btn" data-act="water-dec" aria-label="One less glass" ${water <= 0 ? 'disabled' : ''}>−</button>
            <span class="water-val" data-water>${water}</span>
            <button type="button" class="step-btn" data-act="water-inc" aria-label="One more glass" ${water >= 12 ? 'disabled' : ''}>+</button>
          </div>
          <span class="water-unit">glass${water === 1 ? '' : 'es'}</span>
        </div>
      </div>

      ${sectionCard('Medication', 'meds', MEDS, log)}

      <div class="sparkle-art" aria-hidden="true">${SPARKLES}</div>

      <div class="card lg-section">
        <div class="section-title">Notes</div>
        <textarea class="lg-notes" data-notes rows="4" maxlength="2000"
                  placeholder="Anything else about today…">${esc(log.notes || '')}</textarea>
      </div>

      <div class="save-toast" aria-live="polite">Saved ♡</div>
    </div>`;
}

/* ---------- behaviour ---------- */

function flashSaved(el) {
  const t = el.querySelector('.save-toast');
  if (!t) return;
  t.classList.add('show');
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), 1400);
}

function wire(el) {
  // #screen-root is a persistent element and this screen re-renders after every
  // autosave — guard so we attach listeners exactly once, or clicks fire N stacked
  // handlers (which made "tap again to clear" re-select instead of clearing).
  if (el.__logWired) return;
  el.__logWired = true;

  el.addEventListener('click', (e) => {
    const today = todayStr();
    // V3 (Agent C): pain chip — single-select, tap the active one to clear to null.
    const pchip = e.target.closest('.pain-chip[data-pain]');
    if (pchip) {
      const val = parseInt(pchip.dataset.pain, 10);
      const turnOff = pchip.classList.contains('on');
      el.querySelectorAll('.pain-chip').forEach((c) => {
        c.classList.remove('on');
        c.setAttribute('aria-pressed', 'false');
      });
      if (!turnOff) {
        pchip.classList.add('on');
        pchip.setAttribute('aria-pressed', 'true');
      }
      const bandEl = el.querySelector('[data-pain-band]');
      if (bandEl) {
        const b = turnOff ? null : painBand(val);
        bandEl.textContent = b ? `${b.emoji} ${b.label}` : '';
      }
      queueSave((l) => { l.painLevel = turnOff ? null : val; return l; });
      return;
    }

    const chip = e.target.closest('.chip[data-field]');
    if (chip) {
      const field = chip.dataset.field;
      const key = chip.dataset.key;
      if (SINGLE_FIELDS[field]) {
        const turnOff = chip.classList.contains('on');
        chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
        if (!turnOff) chip.classList.add('on');
        queueSave((l) => { l[field] = turnOff ? null : key; return l; });
      } else {
        chip.classList.toggle('on');
        queueSave((l) => { l[field] = toggleArray(l[field], key); return l; });
      }
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'prev') { curDate = addDays(curDate, -1); renderScreen(rootEl); }
    else if (a === 'next') { if (curDate < today) { curDate = addDays(curDate, 1); renderScreen(rootEl); } }
    else if (a === 'jump') { curDate = today; renderScreen(rootEl); }
    else if (a === 'water-inc' || a === 'water-dec') {
      const delta = a === 'water-inc' ? 1 : -1;
      const disp = el.querySelector('[data-water]');
      if (disp) disp.textContent = Math.max(0, Math.min(12, (parseInt(disp.textContent, 10) || 0) + delta));
      queueSave((l) => {
        l.water = Math.max(0, Math.min(12, (l.water != null ? l.water : 0) + delta));
        return l;
      });
    }
  });

  el.addEventListener('change', (e) => {
    const inp = e.target.closest('input[data-mfield]');
    if (inp) {
      const f = inp.dataset.mfield;
      let v = inp.value.trim() === '' ? null : Number(inp.value);
      if (v != null && !Number.isFinite(v)) v = null;
      if (v != null) v = Math.round(v * 100) / 100;
      queueSave((l) => { l[f] = v; return l; });
      return;
    }
    const ta = e.target.closest('textarea[data-notes]');
    if (ta) {
      const v = ta.value;
      queueSave((l) => { l.notes = v; return l; });
    }
  });
}

async function renderScreen(el) {
  rootEl = el;
  const today = todayStr();

  // Calendar hands us a date via sessionStorage.logDate — read once, then remove.
  let handed = null;
  try {
    handed = sessionStorage.getItem('logDate');
    if (handed != null) sessionStorage.removeItem('logDate');
  } catch (e) { handed = null; }

  if (handed && /^\d{4}-\d{2}-\d{2}$/.test(handed) && handed <= today) {
    curDate = handed;
  } else if (!curDate || Date.now() - lastSaveTs > 4000) {
    // Fresh visit → today. A re-render right after an autosave keeps the picked date.
    curDate = today;
  }
  if (curDate > today) curDate = today;

  const log = (await getLog(curDate)) || { date: curDate };
  el.innerHTML = screenHTML(log, today);
  wire(el);

  // This render was likely triggered by our own autosave → restore scroll, flash toast.
  if (Date.now() - lastSaveTs < 1600) {
    requestAnimationFrame(() => {
      window.scrollTo(0, savedScroll.win);
      if (el.scrollTop !== savedScroll.el) el.scrollTop = savedScroll.el;
      flashSaved(el);
    });
  }
}

export default {
  id: 'log',
  title: 'Log',
  render: renderScreen,
};
