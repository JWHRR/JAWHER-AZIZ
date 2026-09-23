// Service Worker — caches the app shell for fast/offline loading on mobile

const CACHE_NAME = 'app-shell-v2';

// App shell files to pre-cache
const PRECACHE_URLS = ['/', '/index.html'];

// Install: cache the app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: delete old caches and claim clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Navigation requests (HTML): network-first with cache fallback → prevents blank screen on slow mobile
// - JS/CSS/image assets: cache-first (Vite hashes them, safe to cache forever)
// - API/Supabase requests: network-only (never cache dynamic data)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept Supabase or external API calls
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('worldtimeapi') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // For JS/CSS/images with a hash in the filename (Vite assets): cache-first
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // For navigation (HTML page): network-first, fall back to cached /index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/index.html').then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // Everything else: network with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Notification click: focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/messagerie';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nouveau message', {
      body: data.body || '',
      icon: '/ipest-logo.png',
      badge: '/ipest-logo.png',
      tag: data.tag || 'chat',
      renotify: true,
      data: { url: data.url || '/messagerie' },
    })
  );
});
