// sw.js — cache-first service worker. Owner: Agent 1.
// Bump CACHE_VERSION on any deploy to invalidate the old cache.
const CACHE_VERSION = 'v5';
const CACHE_NAME = `periodtracker-${CACHE_VERSION}`;

const PRECACHE = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/today.css',
  'css/calendar.css',
  'css/insights.css',
  'css/settings.css',
  'js/app.js',
  'js/db.js',
  'js/model.js',
  'js/predict.js',
  'js/taxonomy.js',
  'js/moon.js',
  'js/art.js',
  'js/reminders.js',
  'js/partner.js',
  'js/ui/today.js',
  'js/ui/cards/meds.js',
  'js/ui/cards/pain.js',
  'js/ui/cards/science.js',
  'js/ui/cards/meals.js',
  'js/ui/cards/partner.js',
  'js/ui/log.js',
  'js/ui/calendar.js',
  'js/ui/insights.js',
  'js/ui/report.js',
  'js/ui/settings.js',
  'js/content/tips.js',
  'js/content/hormones.js',
  'js/content/meals.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Add files individually so one missing file doesn't fail the install.
      // cache:'reload' bypasses the HTTP cache so a version bump always
      // precaches fresh files, never stale disk-cached copies.
      Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
    // No skipWaiting here: the new version waits until the user taps the
    // in-app "update ready" button (app.js posts SKIP_WAITING below).
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('periodtracker-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // app makes no external requests anyway

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Offline and not cached: fall back to the app shell for navigations.
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
