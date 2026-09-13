const CACHE_NAME = 'wi-shell-v1';

// Application shell assets to pre-cache
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-maskable-192x192.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[SW] Precache partial failure:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[SW] Purging outdated cache:', key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. CRITICAL: NEVER cache API endpoints or external data
  // Bypasses: /api/*, Firebase, Open-Meteo, RainViewer, etc.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('googleapis.com') ||
    url.pathname.includes('firebase')
  ) {
    return; // Pass through directly to network
  }

  // 3. Navigation requests (Page load / HTML): Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If network is good, update the cached shell for offline use
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback: return cached page or app shell '/'
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const cachedShell = await caches.match('/');
          if (cachedShell) return cachedShell;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Weather Intelligence - Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;padding:30px;background:#f6f4ee;color:#111;"><h1>WEATHER INTELLIGENCE</h1><p><strong>OFFLINE:</strong> Please connect to the internet to retrieve live weather, air quality, and radar data.</p></body></html>',
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html' },
            }
          );
        })
    );
    return;
  }

  // 4. Next.js Immutable Static Chunks (/_next/static/*): Cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Static public assets (icons, manifest, fonts): Stale-while-revalidate
  if (
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});

// ============================================================================
// PHASE 6: REAL WEB PUSH NOTIFICATIONS (FIREBASE CLOUD MESSAGING COMPATIBLE)
// ============================================================================

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      notification: {
        title: 'Weather Alert',
        body: event.data ? event.data.text() : 'New atmospheric intelligence update available.',
      },
    };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || 'Weather Alert';
  const body = notification.body || data.body || 'New atmospheric intelligence update available.';
  const icon = notification.icon || data.icon || '/icon-192x192.png';
  const badge = notification.badge || data.badge || '/icon-192x192.png';
  const tag = notification.tag || data.tag || 'weather-intelligence-alert';

  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
      ...data,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions).then(() => {
      // Notify active open clients in foreground
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: { title, body, data: notificationOptions.data },
          });
        });
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open at this origin, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
