// Service Worker — handles notification clicks and future Web Push events

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Fired when a push arrives from the server (requires VAPID setup server-side)
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

// Redirect to the app when user taps a notification
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
