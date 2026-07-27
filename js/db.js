// db.js — IndexedDB storage + local-date helpers. Owner: Agent 1.
// Database: 'periodtracker' v1. Stores: 'logs' (keyPath 'date'), 'settings' (keyPath 'key').

const DB_NAME = 'periodtracker';
const DB_VERSION = 1;

let _db = null;

const DEFAULT_SETTINGS = Object.freeze({
  lutealLength: 14,
  cycleLengthOverride: null,
  periodLengthOverride: null,
  pinHash: null,
  pinSalt: null,
  lockEnabled: false,
  mode: 'cycle',                 // 'cycle' | 'pregnancy'
  pregnancyLMP: null,
  reminders: Object.freeze({
    periodAhead: true,
    ovulation: true,
    pill: false,
    pillTime: '09:00',
    log: false
  }),
  name: '',
  // V3: named medications — starts empty; add yours in Settings (stays on-device).
  meds: Object.freeze([]),
  iudType: null,                 // 'copper' | 'hormonal' | null — set in Settings
  partner: Object.freeze({ name: '', includeLibido: false, includePain: true })
});

// ---------- Date helpers (local time, 'YYYY-MM-DD' strings only) ----------
// Never use new Date('YYYY-MM-DD') — that parses as UTC midnight and shifts
// the day in western timezones. Parse the parts manually instead.

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error('Bad date string: ' + s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); // local midnight
}

function fmtDate(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function todayStr() {
  return fmtDate(new Date());
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

// diffDays(a, b) -> b - a in whole days.
export function diffDays(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  // Round to defeat DST offsets (a DST day is 23h or 25h long).
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// ---------- IndexedDB core ----------

export function initDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  if (!_db) throw new Error('DB not initialised — call initDB() first');
  return _db.transaction(store, mode).objectStore(store);
}

function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function fireChanged() {
  document.dispatchEvent(new CustomEvent('data-changed'));
}

// ---------- Logs ----------

export async function getLog(dateStr) {
  await initDB();
  const res = await reqAsPromise(tx('logs', 'readonly').get(dateStr));
  return res || null;
}

export async function putLog(log) {
  await initDB();
  if (!log || typeof log.date !== 'string') throw new Error('log.date required');
  await reqAsPromise(tx('logs', 'readwrite').put(log));
  fireChanged();
  return log;
}

export async function deleteLog(dateStr) {
  await initDB();
  await reqAsPromise(tx('logs', 'readwrite').delete(dateStr));
  fireChanged();
}

export async function getAllLogs() {
  await initDB();
  const all = await reqAsPromise(tx('logs', 'readonly').getAll());
  all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return all;
}

export async function getLogsInRange(startStr, endStr) {
  await initDB();
  const range = IDBKeyRange.bound(startStr, endStr); // inclusive both ends
  const res = await reqAsPromise(tx('logs', 'readonly').getAll(range));
  res.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return res;
}

// ---------- Settings ----------
// Stored as one record per key: {key, value}. Defaults merged on read.

async function readRawSettings() {
  const rows = await reqAsPromise(tx('settings', 'readonly').getAll());
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function getSettings() {
  await initDB();
  const raw = await readRawSettings();
  const merged = Object.assign({}, DEFAULT_SETTINGS, raw);
  merged.reminders = Object.assign({}, DEFAULT_SETTINGS.reminders, raw.reminders || {});
  merged.partner = Object.assign({}, DEFAULT_SETTINGS.partner, raw.partner || {});
  // meds: stored value wins wholesale when present; otherwise hand out a
  // mutable deep copy of the (frozen) defaults so callers can edit freely.
  merged.meds = Array.isArray(raw.meds)
    ? raw.meds
    : DEFAULT_SETTINGS.meds.map((m) => Object.assign({}, m, { times: m.times.slice() }));
  return merged;
}

export async function saveSettings(patch) {
  await initDB();
  const store = tx('settings', 'readwrite');
  const done = new Promise((resolve, reject) => {
    store.transaction.oncomplete = () => resolve();
    store.transaction.onerror = () => reject(store.transaction.error);
    store.transaction.onabort = () => reject(store.transaction.error || new Error('aborted'));
  });
  for (const key of Object.keys(patch || {})) {
    store.put({ key, value: patch[key] });
  }
  await done;
  fireChanged();
  return getSettings();
}

// ---------- Export / import ----------

export async function exportJSON() {
  await initDB();
  const logs = await getAllLogs();
  const settings = await getSettings();
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    logs,
    settings
  }, null, 2);
}

export async function importJSON(str) {
  await initDB();
  let data;
  try {
    data = JSON.parse(str);
  } catch (e) {
    throw new Error('Invalid backup: not valid JSON');
  }
  if (!data || typeof data !== 'object' || data.version !== 1 ||
      !Array.isArray(data.logs) || typeof data.settings !== 'object' || data.settings === null) {
    throw new Error('Invalid backup: unexpected format');
  }
  for (const log of data.logs) {
    if (!log || !/^\d{4}-\d{2}-\d{2}$/.test(log.date || '')) {
      throw new Error('Invalid backup: bad log entry');
    }
  }

  // Replace all data atomically-ish: clear both stores, then write.
  const t = _db.transaction(['logs', 'settings'], 'readwrite');
  const logsStore = t.objectStore('logs');
  const settingsStore = t.objectStore('settings');
  const done = new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('aborted'));
  });
  logsStore.clear();
  settingsStore.clear();
  for (const log of data.logs) logsStore.put(log);
  for (const key of Object.keys(data.settings)) {
    settingsStore.put({ key, value: data.settings[key] });
  }
  await done;
  fireChanged();
}
