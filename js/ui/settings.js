// js/ui/settings.js — Settings screen (Agent 5)
import { getSettings, saveSettings, exportJSON, importJSON, getAllLogs, todayStr } from '../db.js';
import { requestPermission, formatTime12 } from '../reminders.js';
import { getPeriods } from '../model.js';
import { BUNNY_MASCOT } from '../art.js';

const APP_VERSION = '1.0.0';

const REMINDER_DEFAULTS = {
  periodAhead: true,
  ovulation: true,
  meds: true,
  log: false
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function switchHtml(id, on, label, dataAttr) {
  return `<button type="button" id="${id}" class="switch${on ? ' on' : ''}" role="switch" ` +
         `aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(label)}"${dataAttr || ''}></button>`;
}

/* ---------- toast ---------- */
function toast(message) {
  const prev = document.querySelector('.set-toast');
  if (prev) prev.remove();
  const t = document.createElement('div');
  t.className = 'set-toast';
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 350);
  }, 2000);
}

/* ---------- promise-based bottom sheets (mounted on body so screen
   re-renders triggered by 'data-changed' can't destroy them) ---------- */
function openSheet(innerHtml) {
  const backdrop = document.createElement('div');
  backdrop.className = 'set-backdrop';
  backdrop.innerHTML = `<div class="sheet set-sheet" role="dialog" aria-modal="true">${innerHtml}</div>`;
  document.body.appendChild(backdrop);
  return backdrop;
}

function askDate(title, subtitle, defaultDate) {
  return new Promise((resolve) => {
    const backdrop = openSheet(
      `<h3 class="set-sheet-title">${esc(title)}</h3>` +
      `<p class="set-sheet-sub">${esc(subtitle)}</p>` +
      `<input class="set-date-input" type="date" max="${esc(todayStr())}" value="${esc(defaultDate)}" ` +
      'aria-label="Date of last period">' +
      '<div class="set-sheet-actions">' +
      '<button type="button" class="btn" data-act="cancel">Cancel</button>' +
      '<button type="button" class="btn btn-primary" data-act="ok">Confirm</button>' +
      '</div>'
    );
    const input = backdrop.querySelector('.set-date-input');
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      backdrop.remove();
      resolve(val);
    };
    backdrop.querySelector('[data-act="ok"]').addEventListener('click', () => {
      const v = input.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { input.focus(); return; }
      if (v > todayStr()) { input.focus(); return; }
      done(v);
    });
    backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => done(null));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) done(null); });
  });
}

/* ---------- medication edit sheet (name, dose, 1–4 times) ---------- */
function askMed(med) {
  return new Promise((resolve) => {
    const backdrop = openSheet(
      `<h3 class="set-sheet-title">${med ? 'Edit medication' : 'Add medication'}</h3>` +
      '<p class="set-sheet-sub">Its name, the dose, and when each daily dose is due.</p>' +
      '<label class="set-label" for="med-sheet-name">Name</label>' +
      `<input id="med-sheet-name" class="set-input set-input-text med-sheet-input" type="text" maxlength="40" ` +
      `value="${esc(med ? med.name : '')}" placeholder="Medication name" autocomplete="off" autocapitalize="words">` +
      '<label class="set-label" for="med-sheet-dose">Dose</label>' +
      `<input id="med-sheet-dose" class="set-input set-input-text med-sheet-input" type="text" maxlength="24" ` +
      `value="${esc(med ? med.dose : '')}" placeholder="e.g. 10 mg" autocomplete="off">` +
      '<div class="set-label med-sheet-times-label">Times (up to 4)</div>' +
      '<div id="med-sheet-times"></div>' +
      '<button type="button" class="btn med-sheet-addtime" id="med-sheet-addtime">＋ Add a time</button>' +
      '<div class="set-sheet-actions">' +
      '<button type="button" class="btn" data-act="cancel">Cancel</button>' +
      '<button type="button" class="btn btn-primary" data-act="ok">Save</button>' +
      '</div>'
    );
    const timesWrap = backdrop.querySelector('#med-sheet-times');
    const addBtn = backdrop.querySelector('#med-sheet-addtime');
    const nameInput = backdrop.querySelector('#med-sheet-name');
    const doseInput = backdrop.querySelector('#med-sheet-dose');

    function addTimeRow(value) {
      const row = document.createElement('div');
      row.className = 'med-sheet-timerow';
      row.innerHTML =
        `<input class="set-input set-input-time" type="time" value="${esc(value || '')}" aria-label="Dose time">` +
        '<button type="button" class="btn med-sheet-deltime" aria-label="Remove this time">✕</button>';
      row.querySelector('.med-sheet-deltime').addEventListener('click', () => {
        row.remove();
        refreshTimeUi();
      });
      timesWrap.appendChild(row);
      refreshTimeUi();
    }
    function refreshTimeUi() {
      const rows = timesWrap.querySelectorAll('.med-sheet-timerow');
      rows.forEach((row) => {
        row.querySelector('.med-sheet-deltime').style.visibility = rows.length > 1 ? '' : 'hidden';
      });
      addBtn.style.display = rows.length >= 4 ? 'none' : '';
    }
    const initial = (med && Array.isArray(med.times) && med.times.length) ? med.times.slice(0, 4) : ['09:00'];
    initial.forEach(addTimeRow);
    addBtn.addEventListener('click', () => {
      if (timesWrap.querySelectorAll('.med-sheet-timerow').length < 4) addTimeRow('');
    });

    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      backdrop.remove();
      resolve(val);
    };
    backdrop.querySelector('[data-act="ok"]').addEventListener('click', () => {
      const name = nameInput.value.trim().slice(0, 40);
      if (!name) { nameInput.focus(); return; }
      const times = [...timesWrap.querySelectorAll('input[type="time"]')]
        .map((i) => i.value)
        .filter((v) => /^\d{2}:\d{2}$/.test(v));
      const unique = [...new Set(times)].sort();
      if (!unique.length) {
        const first = timesWrap.querySelector('input[type="time"]');
        if (first) first.focus();
        return;
      }
      done({ name, dose: doseInput.value.trim().slice(0, 24), times: unique.slice(0, 4) });
    });
    backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => done(null));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) done(null); });
    if (!med) nameInput.focus();
  });
}

/* Stable slug id from the name, deduped against existing meds. */
function makeMedId(name, existing) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'med';
  const ids = new Set(existing.map((m) => m && m.id));
  let id = base;
  let n = 2;
  while (ids.has(id)) id = base + '-' + n++;
  return id;
}

/* ---------- number input helper: '' => null, else clamp ---------- */
function readIntOrNull(input, min, max) {
  const raw = input.value.trim();
  if (raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

export default {
  id: 'settings',
  title: 'Settings',

  async render(el) {
    const settings = await getSettings();
    const r = Object.assign({}, REMINDER_DEFAULTS, settings.reminders || {});
    const pregnant = settings.mode === 'pregnancy';
    // Deep working copy of meds — edited in place, persisted wholesale.
    const meds = (Array.isArray(settings.meds) ? settings.meds : []).map((m) => ({
      id: m.id,
      name: m.name || '',
      dose: m.dose || '',
      times: Array.isArray(m.times) ? m.times.slice() : []
    }));

    const medRowsHtml = meds.length
      ? meds.map((m, i) => `
        <div class="med-edit-row" data-idx="${i}">
          <button type="button" class="med-edit-main" data-act="edit" data-idx="${i}"
                  aria-label="Edit ${esc(m.name)}">
            <span class="med-edit-name">${esc(m.name)}
              <span class="med-edit-dose">${esc(m.dose)}</span></span>
            <span class="med-edit-times">${m.times.map((t) =>
              `<span class="med-time-chip">${esc(formatTime12(t))}</span>`).join('')}</span>
          </button>
          <button type="button" class="med-remove" data-act="remove" data-idx="${i}"
                  aria-label="Remove ${esc(m.name)}">✕</button>
        </div>`).join('')
      : '<p class="set-hint med-empty">Nothing here yet — add a medication and Cycle will keep an eye on the clock for you.</p>';

    el.innerHTML = `
    <div class="settings-screen">
      <header class="set-header"><h1>Settings</h1></header>

      <div class="section-title">Profile</div>
      <div class="card set-card">
        <div class="set-row">
          <div class="set-row-text">
            <label class="set-label" for="set-name">Your name</label>
            <div class="set-hint">Used for greetings and your health report</div>
          </div>
          <input id="set-name" class="set-input set-input-text" type="text" maxlength="30"
                 placeholder="Optional" autocomplete="off" autocapitalize="words">
        </div>
      </div>

      <div class="section-title">Cycle</div>
      <div class="card set-card">
        <div class="set-row">
          <div class="set-row-text">
            <label class="set-label" for="set-luteal">Luteal phase length</label>
            <div class="set-hint">Days from ovulation to your period (10–16)</div>
          </div>
          <input id="set-luteal" class="set-input" type="number" inputmode="numeric" min="10" max="16" step="1">
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <label class="set-label" for="set-cyclelen">Cycle length override</label>
            <div class="set-hint">Leave blank to calculate from your logs</div>
          </div>
          <input id="set-cyclelen" class="set-input" type="number" inputmode="numeric" min="15" max="60" step="1" placeholder="Auto">
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <label class="set-label" for="set-periodlen">Period length override</label>
            <div class="set-hint">Leave blank to calculate from your logs</div>
          </div>
          <input id="set-periodlen" class="set-input" type="number" inputmode="numeric" min="1" max="10" step="1" placeholder="Auto">
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <label class="set-label" for="set-iud">IUD</label>
            <div class="set-hint">Tailors pain &amp; bleeding guidance — copper IUDs often mean heavier, crampier periods</div>
          </div>
          <select id="set-iud" class="set-input set-input-select" aria-label="IUD type">
            <option value="">None</option>
            <option value="copper">Copper IUD</option>
            <option value="hormonal">Hormonal IUD</option>
          </select>
        </div>
      </div>

      <div class="section-title">Mode</div>
      <div class="card set-card">
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-label">Pregnancy mode</div>
            <div class="set-hint">${pregnant
              ? `Tracking pregnancy from ${esc(settings.pregnancyLMP || '—')}`
              : 'Pause cycle predictions and track pregnancy weeks instead'}</div>
          </div>
          ${switchHtml('set-mode', pregnant, 'Pregnancy mode')}
        </div>
      </div>

      <div class="section-title">Medications</div>
      <div class="card set-card med-editor">
        <div id="med-list">${medRowsHtml}</div>
        <button type="button" class="med-add" id="med-add">＋ Add a medication</button>
        <p class="set-note">Exactly as prescribed, always — Cycle just remembers the times so you
        don’t have to.</p>
      </div>

      <div class="section-title">Reminders</div>
      <div class="card set-card">
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-label">Period coming up</div>
            <div class="set-hint">Heads-up to 2 days before your predicted period</div>
          </div>
          ${switchHtml('set-rem-period', r.periodAhead, 'Period reminder', ' data-rkey="periodAhead"')}
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-label">Fertile window &amp; ovulation</div>
            <div class="set-hint">When your fertile window opens and on ovulation day</div>
          </div>
          ${switchHtml('set-rem-ovu', r.ovulation, 'Ovulation reminder', ' data-rkey="ovulation"')}
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-label">Medication reminders</div>
            <div class="set-hint">A nudge when each dose falls due</div>
          </div>
          ${switchHtml('set-rem-meds', r.meds !== false, 'Medication reminders', ' data-rkey="meds"')}
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-label">Daily log nudge</div>
            <div class="set-hint">A gentle nudge if you haven’t logged today</div>
          </div>
          ${switchHtml('set-rem-log', r.log, 'Daily log reminder', ' data-rkey="log"')}
        </div>
        <p class="set-note">On iPhone, reminders appear when you open the app — installed web apps
        can’t send true push notifications without a server, and this app never talks to one.</p>
      </div>

      <div class="section-title">Data</div>
      <div class="card set-card">
        <button type="button" id="set-export" class="set-action">
          <span class="set-action-label">Export backup</span>
          <span class="set-action-hint">Download all your data as a JSON file</span>
        </button>
        <button type="button" id="set-import" class="set-action">
          <span class="set-action-label">Import backup</span>
          <span class="set-action-hint">Restore from a backup file — replaces everything</span>
        </button>
        <button type="button" id="set-delete" class="set-action set-action-danger">
          <span class="set-action-label">Delete all data</span>
          <span class="set-action-hint">Remove every log and setting from this device</span>
        </button>
        <input type="file" id="set-import-file" accept=".json,application/json" hidden>
      </div>

      <div class="section-title">About</div>
      <div class="card set-card set-about">
        <div class="bunny-art" aria-hidden="true">${BUNNY_MASCOT}</div>
        <div class="set-about-name">Cycle <span class="set-about-version">v${APP_VERSION}</span></div>
        <p class="set-about-text">100% local — no data ever leaves your device. There is no account,
        no cloud, no analytics and no network requests. Everything you log is stored only in this
        browser’s storage on this device.</p>
        <p class="set-about-text set-hint">Tip: iOS can evict web-app storage that hasn’t been used
        for a while — export a backup every so often to keep your history safe.</p>
        <p class="set-about-text set-hint">Cycle offers general wellbeing information only and is
        not a medical device or a contraceptive. For health concerns, talk to a clinician.</p>
      </div>
    </div>`;

    const $ = (sel) => el.querySelector(sel);

    /* ----- Profile ----- */
    const nameInput = $('#set-name');
    nameInput.value = settings.name || '';
    nameInput.addEventListener('change', async () => {
      await saveSettings({ name: nameInput.value.trim().slice(0, 30) });
      toast('Saved');
    });

    /* ----- Cycle numbers ----- */
    const lutealInput = $('#set-luteal');
    lutealInput.value = settings.lutealLength != null ? settings.lutealLength : 14;
    lutealInput.addEventListener('change', async () => {
      const v = readIntOrNull(lutealInput, 10, 16);
      const val = v == null ? 14 : v; // blank resets to default
      lutealInput.value = val;
      await saveSettings({ lutealLength: val });
      toast('Saved');
    });

    const cycleInput = $('#set-cyclelen');
    cycleInput.value = settings.cycleLengthOverride != null ? settings.cycleLengthOverride : '';
    cycleInput.addEventListener('change', async () => {
      const v = readIntOrNull(cycleInput, 15, 60);
      cycleInput.value = v == null ? '' : v;
      await saveSettings({ cycleLengthOverride: v });
      toast('Saved');
    });

    const periodInput = $('#set-periodlen');
    periodInput.value = settings.periodLengthOverride != null ? settings.periodLengthOverride : '';
    periodInput.addEventListener('change', async () => {
      const v = readIntOrNull(periodInput, 1, 10);
      periodInput.value = v == null ? '' : v;
      await saveSettings({ periodLengthOverride: v });
      toast('Saved');
    });

    const iudSelect = $('#set-iud');
    iudSelect.value = settings.iudType || '';
    iudSelect.addEventListener('change', async () => {
      await saveSettings({ iudType: iudSelect.value || null });
      toast('Saved');
    });

    /* ----- Mode toggle ----- */
    $('#set-mode').addEventListener('click', async () => {
      if (pregnant) {
        await saveSettings({ mode: 'cycle', pregnancyLMP: null });
        toast('Back to cycle tracking');
        return;
      }
      let def = todayStr();
      try {
        const periods = getPeriods(await getAllLogs());
        if (periods.length) def = periods[periods.length - 1].start;
      } catch { /* no logs yet — default to today */ }
      const lmp = await askDate(
        'Pregnancy mode',
        'When did your last period start? This sets your pregnancy week and estimated due date.',
        def
      );
      if (!lmp) return;
      await saveSettings({ mode: 'pregnancy', pregnancyLMP: lmp });
      toast('Pregnancy mode on — congratulations!');
    });

    /* ----- Reminder toggles ----- */
    el.querySelectorAll('.switch[data-rkey]').forEach((sw) => {
      sw.addEventListener('click', async () => {
        const key = sw.dataset.rkey;
        const enabling = !r[key];
        const next = Object.assign({}, r);
        next[key] = enabling;
        if (enabling) {
          const perm = await requestPermission();
          if (perm === 'denied') {
            toast('Notifications are blocked — reminders will still show in the app');
          } else if (perm === 'unsupported') {
            toast('Notifications aren’t supported here — reminders will show in the app');
          }
        }
        await saveSettings({ reminders: next });
      });
    });

    /* ----- Medications editor ----- */
    $('#med-add').addEventListener('click', async () => {
      const res = await askMed(null);
      if (!res) return;
      meds.push({ id: makeMedId(res.name, meds), name: res.name, dose: res.dose, times: res.times });
      await saveSettings({ meds });
      toast('Medication added');
    });

    $('#med-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      const med = meds[idx];
      if (!med) return;
      if (btn.dataset.act === 'remove') {
        if (!confirm(`Remove ${med.name}? Its reminders stop; past ticks stay in your logs.`)) return;
        meds.splice(idx, 1);
        await saveSettings({ meds });
        toast('Medication removed');
        return;
      }
      if (btn.dataset.act === 'edit') {
        const res = await askMed(med);
        if (!res) return;
        meds[idx] = { id: med.id, name: res.name, dose: res.dose, times: res.times };
        await saveSettings({ meds });
        toast('Saved');
      }
    });

    /* ----- Data: export ----- */
    $('#set-export').addEventListener('click', async () => {
      try {
        const json = await exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `period-backup-${todayStr()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast('Backup downloaded');
      } catch {
        toast('Export failed — please try again');
      }
    });

    /* ----- Data: import ----- */
    const fileInput = $('#set-import-file');
    $('#set-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      if (!confirm('Importing this backup will REPLACE all data currently in the app. Continue?')) return;
      try {
        const text = await file.text();
        await importJSON(text);
        document.dispatchEvent(new CustomEvent('data-changed'));
        toast('Backup imported');
      } catch {
        alert('That file doesn’t look like a valid Cycle backup. Nothing was changed.');
      }
    });

    /* ----- Data: delete all ----- */
    $('#set-delete').addEventListener('click', async () => {
      if (!confirm('Delete ALL data? This removes every log and setting from this device.')) return;
      if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
      try {
        await importJSON(JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          logs: [],
          settings: {}
        }));
        document.dispatchEvent(new CustomEvent('data-changed'));
        toast('All data deleted');
      } catch {
        toast('Something went wrong — nothing was deleted');
      }
    });
  }
};
