// js/ui/cards/meds.js — "Today's doses" card (Agent B, V3).
// Card contract: default-export { id, html(ctx), wire(el, ctx) } where
// ctx = { logs, settings, preds, state, today }. Ticking a dose does a
// read-modify-write of today's log (log.medsTaken = ['medId|HH:MM', ...])
// via putLog, which fires 'data-changed' and re-renders the whole screen —
// so this module holds no state of its own; everything derives from the log.

import { getLog, putLog, todayStr } from '../../db.js';
import { formatTime12 } from '../../reminders.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function nowHHMM() {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' +
         String(now.getMinutes()).padStart(2, '0');
}

/* Flatten settings.meds into one dose list, sorted by time of day. */
function doseList(ctx) {
  const meds = (ctx && ctx.settings && Array.isArray(ctx.settings.meds)) ? ctx.settings.meds : [];
  const doses = [];
  for (const med of meds) {
    if (!med || !med.id || !Array.isArray(med.times)) continue;
    for (const t of med.times) {
      if (typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)) continue;
      doses.push({ id: med.id, name: med.name || med.id, dose: med.dose || '', time: t });
    }
  }
  doses.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return doses;
}

function takenSet(ctx, today) {
  const logs = (ctx && Array.isArray(ctx.logs)) ? ctx.logs : [];
  const log = logs.find((l) => l && l.date === today);
  return new Set((log && Array.isArray(log.medsTaken)) ? log.medsTaken : []);
}

export default {
  id: 'meds',

  html(ctx) {
    const today = (ctx && ctx.today) || todayStr();
    const doses = doseList(ctx);

    if (!doses.length) {
      return `<div class="card meds-card">
        <div class="section-title">Today’s doses</div>
        <p class="meds-empty">Add your meds in Settings and they’ll be waiting for you here,
        right on time.</p>
      </div>`;
    }

    const taken = takenSet(ctx, today);
    const now = nowHHMM();
    let allDone = true;

    const rows = doses.map((d) => {
      const key = d.id + '|' + d.time;
      const isTaken = taken.has(key);
      if (!isTaken) allDone = false;
      const overdue = !isTaken && now >= d.time;
      const label = [d.name, d.dose].filter(Boolean).join(' ');
      return `<div class="med-row${overdue ? ' med-overdue' : ''}">
        <div class="med-row-info">
          <span class="med-row-name">${esc(d.name)}</span>
          <span class="med-row-dose">${esc(d.dose)}</span>
          <span class="med-row-time">${esc(formatTime12(d.time))}</span>
        </div>
        <button type="button" class="med-tick${isTaken ? ' taken' : ''}"
                data-key="${esc(key)}" aria-pressed="${isTaken ? 'true' : 'false'}"
                aria-label="${isTaken ? 'Untick' : 'Tick off'} ${esc(label)}, ${esc(formatTime12(d.time))} dose">✓</button>
      </div>`;
    }).join('');

    return `<div class="card meds-card">
      <div class="section-title">Today’s doses</div>
      ${rows}
      ${allDone
        ? '<p class="meds-praise">Every dose, right on time — you take such lovely care of yourself. 🎀</p>'
        : ''}
    </div>`;
  },

  wire(el, ctx) {
    if (!el) return;
    const today = (ctx && ctx.today) || todayStr();
    el.querySelectorAll('.med-tick').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true; // putLog → 'data-changed' re-renders the screen anyway
        try {
          const key = btn.dataset.key;
          const log = (await getLog(today)) || { date: today };
          const set = new Set(Array.isArray(log.medsTaken) ? log.medsTaken : []);
          if (set.has(key)) set.delete(key);
          else set.add(key);
          log.medsTaken = [...set];
          await putLog(log);
        } catch {
          btn.disabled = false; // write failed — let her try again
        }
      });
    });
  }
};
