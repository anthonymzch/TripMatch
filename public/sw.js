const CACHE_NAME = 'via-a-dos-v4';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/firebase-init.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No tocar peticiones a otros orígenes (Firebase Auth, Firestore, Google
  // Fonts, el SDK de gstatic...). Interceptarlas rompe las conexiones en
  // tiempo real de Firestore, sobre todo en PWA de iPhone.
  if (url.origin !== self.location.origin) return;

  // Nunca cachear las llamadas a la función de rutas: siempre red.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response(
      JSON.stringify({ ok: false, motivo: 'sin-conexion' }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // App shell: cache-first, con actualización en segundo plano.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
