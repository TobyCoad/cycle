// app.js — router/shell. Owner: Agent 1.
import { initDB } from './db.js';
import { checkReminders } from './reminders.js';
import today from './ui/today.js';
import log from './ui/log.js';
import calendar from './ui/calendar.js';
import insights from './ui/insights.js';
import settings from './ui/settings.js';

const SCREENS = { today, log, calendar, insights, settings };

const root = document.getElementById('screen-root');
const tabbar = document.getElementById('tabbar');

let currentScreenId = 'today';
let renderToken = 0;

async function renderScreen(id) {
  const screen = SCREENS[id];
  if (!screen) return;
  currentScreenId = id;

  // Tab highlight
  for (const btn of tabbar.querySelectorAll('.tab-btn')) {
    btn.classList.toggle('active', btn.dataset.screen === id);
  }

  const token = ++renderToken;
  try {
    await screen.render(root);
  } catch (err) {
    console.error(`Screen '${id}' failed to render:`, err);
    if (token === renderToken) {
      root.innerHTML = '<div class="card" style="margin:16px"><p>Something went wrong loading this screen.</p></div>';
    }
  }
  if (typeof document !== 'undefined') {
    document.title = 'Cycle — ' + (screen.title || id);
  }
  root.scrollTop = 0;
  window.scrollTo(0, 0);
}

// Navigation helper for screens (e.g. Today's "Log today" button).
window.__nav = function (screenId) {
  renderScreen(screenId);
};

tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-screen]');
  if (!btn) return;
  renderScreen(btn.dataset.screen);
});

// Any data mutation re-renders the current screen.
document.addEventListener('data-changed', () => {
  renderScreen(currentScreenId);
});

async function boot() {
  await initDB();

  // Reminders come from an Agent 5 module — never let it block boot.
  try {
    await checkReminders();
  } catch (err) {
    console.error('checkReminders failed:', err);
  }

  await renderScreen('today');

  if ('serviceWorker' in navigator) {
    initUpdates().catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  }
}

/* ---------- update flow ----------
   A new deploy = a byte-different sw.js. The browser installs it in the
   background; instead of activating silently we show a pretty pill. Tapping
   it tells the waiting worker to skipWaiting, and the controllerchange
   reload brings in the fresh precache. */
function showUpdatePill(reg) {
  if (document.getElementById('update-pill')) return;
  const pill = document.createElement('button');
  pill.id = 'update-pill';
  pill.type = 'button';
  pill.innerHTML = 'An update is ready&nbsp;🎀&nbsp; tap to refresh';
  pill.addEventListener('click', () => {
    pill.disabled = true;
    pill.textContent = 'Refreshing…';
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Safety: if controllerchange never fires (edge cases), reload anyway.
    setTimeout(() => window.location.reload(), 2500);
  });
  document.body.appendChild(pill);
}

async function initUpdates() {
  const reg = await navigator.serviceWorker.register('sw.js');

  // Already-waiting worker from a previous visit.
  if (reg.waiting && navigator.serviceWorker.controller) showUpdatePill(reg);

  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    if (!sw) return;
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdatePill(reg);
      }
    });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  // Look for updates on launch, when the app is foregrounded, and hourly.
  const check = () => reg.update().catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setInterval(check, 60 * 60 * 1000);
}

boot().catch(err => {
  console.error('App failed to start:', err);
  root.innerHTML = '<div class="card" style="margin:16px"><p>App failed to start. Try reloading.</p></div>';
});
