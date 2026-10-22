const CACHE_NAME = 'daily-island-shell-20261023-1';
const BASE_URL = new URL('./', self.registration.scope);
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-lighthouse.svg',
  './icon-lighthouse-180.png',
  './icon-lighthouse-192.png',
  './icon-lighthouse-512.png',
  './actor-depth.js',
  './account-backend.js',
  './account.css',
  './account.js',
  './cloud-sync.js',
  './supabase-config.js',
  './supabase-sdk.js',
  './app.js',
  './coast.js',
  './detail-position.js',
  './idle.js',
  './journal-art.js',
  './journal-date.js',
  './journal-layout.js',
  './journal-model.js',
  './journal-stars.js',
  './journal.css',
  './journal.js',
  './light-control.js',
  './lighting.js',
  './model.js',
  './motion.js',
  './scene.js',
  './sea.js',
  './style.css',
  './visual.css',
  './voyage.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES.map(file => new URL(file, BASE_URL).href)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('daily-island-shell-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE_URL.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await cache.match(new URL('./index.html', BASE_URL).href)) || Response.error();
      }
      return Response.error();
    }
  })());
});
