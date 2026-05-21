const CACHE_NAME = 'asobiplan-static-v1';
const API_CACHE_NAME = 'asobiplan-api-v1';
const TILE_CACHE_NAME = 'asobiplan-tiles-v1';
const IS_LOCAL_DEV = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);

const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  if (IS_LOCAL_DEV) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  if (IS_LOCAL_DEV) {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== API_CACHE_NAME &&
            cacheName !== TILE_CACHE_NAME
          ) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (IS_LOCAL_DEV) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Ignore non-http/https schemes (e.g. chrome-extension://, data://) to prevent put/Cache errors
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 1. Handle Map Tiles (CartoDB tiles)
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                const reqUrl = new URL(event.request.url);
                if (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:') {
                  cache.put(event.request, networkResponse.clone());
                }
              }
              return networkResponse;
            })
            .catch(() => {
              // Return a CORS-friendly response for cross-origin tile requests
              return new Response('Offline tile unavailable', { 
                status: 503,
                headers: { 'Access-Control-Allow-Origin': '*' }
              });
            });
        });
      })
    );
    return;
  }

  // 2. Handle Backend API requests (local or production api routes)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const reqUrl = new URL(event.request.url);
              if (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:') {
                cache.put(event.request, networkResponse.clone());
              }
            }
            return networkResponse;
          })
          .catch(() => {
            return cache.match(event.request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return a CORS-friendly JSON fallback
              return new Response(
                JSON.stringify({ error: "Offline: cached data unavailable" }),
                { 
                  status: 503, 
                  headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                  } 
                }
              );
            });
          });
      })
    );
    return;
  }

  // 3. Static assets & Next.js files (Cache first, then network fallback)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (
            url.pathname.includes('/_next/static/') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.ico') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.includes('fonts.googleapis.com') ||
            url.pathname.includes('fonts.gstatic.com')
          ) {
            const responseToCache = networkResponse.clone();
            const reqUrl = new URL(event.request.url);
            if (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:') {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/').then((response) => {
              return response || new Response('Offline: Page not cached', {
                status: 503,
                headers: { 'Content-Type': 'text/html' }
              });
            });
          }
          return new Response('Offline asset unavailable', { 
            status: 503,
            headers: { 'Access-Control-Allow-Origin': '*' }
          });
        });
    })
  );
});
