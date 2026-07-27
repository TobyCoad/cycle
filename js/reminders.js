// js/reminders.js — best-effort local reminders (Agent 5)
//
// HONEST LIMITATION: this is a local-first app with no server, so there is no
// real push. Notifications here fire only while the app is actually running —
// at the moment the user opens it (app.js calls checkReminders() on startup)
// and then every 5 minutes while it stays open (see startRecheckInterval).
// On iOS, PWA Notification support is limited (iOS 16.4+ and only
// for Home-Screen-installed apps), and scheduled/background delivery is not
// possible at all without a push server. That's why checkReminders() ALWAYS
// returns the active reminder strings too, so the UI can surface them
// in-app regardless of notification permission.

import { getAllLogs, getLog, getSettings, todayStr, diffDays } from './db.js';
import { predictions } from './predict.js';

const FIRED_KEY = 'reminders.fired';

const REMINDER_DEFAULTS = {
  periodAhead: true,
  ovulation: true,
  meds: true,
  log: false
};

/** '21:00' -> '9:00 pm'. Returns the input untouched if it isn't HH:MM. */
export function formatTime12(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return hhmm || '';
  let h = Number(m[1]);
  const suffix = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m[2]} ${suffix}`;
}

/* While the app is open, re-check every 5 minutes so med-dose notifications
   fire near their scheduled time, not just at app open. Started exactly once
   (module-level guard) from checkReminders(). */
let _recheckStarted = false;
function startRecheckInterval() {
  if (_recheckStarted) return;
  _recheckStarted = true;
  try {
    setInterval(() => { checkReminders(); }, 5 * 60 * 1000);
  } catch {
    // setInterval unavailable (odd embed/test context) — open-time checks still run.
  }
}

function readFired() {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function writeFired(map) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {
    // Storage full/blocked — worst case we re-notify; never throw.
  }
}

/**
 * Ask for Notification permission. Safe everywhere:
 * returns 'granted' | 'denied' | 'default' | 'unsupported', never throws.
 */
export async function requestPermission() {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Notification.permission;
    }
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// Fire a system notification at most once per day per key. Best-effort only.
function fireOncePerDay(key, title, body, today) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const fired = readFired();
    if (fired[key] === today) return;
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag: 'periodtracker-' + key, icon: 'icons/icon-192.png' });
    fired[key] = today;
    // Prune entries from previous days so the map never grows.
    for (const k of Object.keys(fired)) {
      if (fired[k] !== today) delete fired[k];
    }
    writeFired(fired);
  } catch {
    // Some engines throw on `new Notification` (e.g. Android Chrome requires
    // a ServiceWorkerRegistration). Swallow — in-app strings still work.
  }
}

/**
 * Compute today's active reminders from predictions + settings.
 * Fires system notifications when permitted (deduped per day via
 * localStorage 'reminders.fired'), and ALWAYS returns an array of active
 * reminder strings for in-app display. Never throws.
 */
export async function checkReminders() {
  startRecheckInterval();
  const active = [];
  try {
    const settings = await getSettings();
    const logs = await getAllLogs();
    const r = Object.assign({}, REMINDER_DEFAULTS, (settings && settings.reminders) || {});
    const today = todayStr();

    if (!settings || settings.mode !== 'pregnancy') {
      let pred = null;
      try {
        pred = predictions(logs, settings);
      } catch {
        pred = null; // No predictions yet — nothing cycle-based to remind about.
      }

      if (pred) {
        if (r.periodAhead && pred.nextPeriodStart) {
          const d = diffDays(today, pred.nextPeriodStart);
          if (d >= 0 && d <= 2) {
            const msg = d === 0
              ? 'Your period is predicted to start today'
              : `Your period is predicted in ${d} day${d === 1 ? '' : 's'}`;
            active.push(msg);
            fireOncePerDay('period', 'Period reminder', msg, today);
          }
        }

        if (r.ovulation && pred.ovulationDate) {
          const o = diffDays(today, pred.ovulationDate);
          const f = pred.fertileStart ? diffDays(today, pred.fertileStart) : null;
          if (o === 0) {
            const msg = 'Ovulation is predicted today';
            active.push(msg);
            fireOncePerDay('ovulation', 'Ovulation', msg, today);
          } else if (f === 0 || f === 1) {
            const msg = f === 0
              ? 'Your fertile window starts today'
              : 'Your fertile window starts tomorrow';
            active.push(msg);
            fireOncePerDay('fertile', 'Fertile window', msg, today);
          }
        }
      }
    }

    // Named medications (V3). A dose is "due" once the clock passes its time
    // and it hasn't been ticked off in today's log (log.medsTaken holds
    // 'medId|HH:MM' strings). Master toggle: settings.reminders.meds
    // (default ON — missing key means enabled).
    if (r.meds !== false && settings && Array.isArray(settings.meds) && settings.meds.length) {
      const now = new Date();
      const hhmm = String(now.getHours()).padStart(2, '0') + ':' +
                   String(now.getMinutes()).padStart(2, '0');
      let taken = new Set();
      try {
        const log = await getLog(today);
        if (log && Array.isArray(log.medsTaken)) taken = new Set(log.medsTaken);
      } catch {
        // Log unreadable — treat nothing as taken; strings stay best-effort.
      }
      for (const med of settings.meds) {
        if (!med || !med.id || !Array.isArray(med.times)) continue;
        const label = [med.name, med.dose].filter(Boolean).join(' ') || med.id;
        for (const t of med.times) {
          if (typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)) continue;
          if (taken.has(med.id + '|' + t)) continue;
          if (hhmm >= t) {
            const msg = `${label} — ${formatTime12(t)} dose due`;
            active.push(msg);
            // Dedupe key is med|time; fired-map values are dates and old days
            // are pruned, so effectively keyed med|time|date, once per day.
            fireOncePerDay('med|' + med.id + '|' + t, label,
              `Your ${formatTime12(t)} dose is due — tick it off once it’s taken`, today);
          }
        }
      }
    }

    if (r.log) {
      const loggedToday = Array.isArray(logs) && logs.some((l) => l && l.date === today);
      if (!loggedToday) {
        const msg = 'Don’t forget to log how you’re feeling today';
        active.push(msg);
        fireOncePerDay('log', 'Daily log', msg, today);
      }
    }
  } catch {
    // Absolutely never throw from here — app startup depends on it.
  }
  return active;
}
