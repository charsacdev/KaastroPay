/* ==========================================================================
   Kaastro Pay — service worker
   Makes the app installable and usable on a flaky connection, which is the
   normal case in the markets this serves.

   Two strategies, chosen by what the request is:
     • App shell (our own HTML, CSS, JS, images) — stale-while-revalidate, so
       a page opens instantly from cache and quietly updates behind you.
     • Everything else (CDN libraries) — cache-first with a network fallback.
   Nothing is cached from a non-GET request, and nothing is ever served stale
   for a navigation the network can satisfy quickly.
   ========================================================================== */

const VERSION = 'kaastro-v1';
const SHELL = VERSION + '-shell';
const VENDOR = VERSION + '-vendor';
const RUNTIME = VERSION + '-runtime';

/* The minimum needed to open the app with no network at all. */
const PRECACHE = [
  './',
  './index.html',
  './login.html',
  './offline.html',
  './manifest.webmanifest',
  './css/kaastro.css',
  './css/public.css',
  './js/boot.js',
  './js/config.js',
  './js/rates-engine.js',
  './js/mock-data.js',
  './js/rails.js',
  './js/receipt.js',
  './js/review.js',
  './js/shell.js',
  './js/pwa.js',
  './dashboard/index.html',
  './dashboard/wallets.html',
  './dashboard/buy.html',
  './dashboard/sell.html',
  './dashboard/swap.html',
  './dashboard/rates.html',
  './dashboard/transactions.html',
  './images/logo.png',
  './images/icon-192.png',
  './images/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll fails the whole install if any single file 404s, which would
      // leave the app permanently uninstallable. Add them individually.
      .then(cache => Promise.all(
        PRECACHE.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Let the page tell a waiting worker to take over immediately. */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

function isVendor(url) {
  return url.origin !== self.location.origin;
}

function isShellAsset(url) {
  return /\.(css|js|png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Navigations: try the network first so a deployed change is picked up,
     but fall back to cache — and then to a real offline page — when it fails. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)
          .then(hit => hit || caches.match('./offline.html'))
          .then(hit => hit || new Response('Offline', { status: 503 })))
    );
    return;
  }

  /* CDN libraries change rarely and are expensive to re-fetch. */
  if (isVendor(url)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VENDOR).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  /* Our own assets: serve from cache instantly, refresh in the background. */
  if (isShellAsset(url)) {
    event.respondWith(
      caches.match(req).then(hit => {
        const network = fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || network;
      })
    );
    return;
  }

  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
