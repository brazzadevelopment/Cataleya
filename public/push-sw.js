// Obavijesti na mobitel. Uključuje se u service worker (vite.config.ts, importScripts).

self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Cataleya Cup', {
      body: d.body || '',
      tag: d.tag,
      renotify: !!d.tag,
      icon: '/icon-192.png',
      data: { url: d.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const c of list) {
        try {
          await c.navigate(url);
          return c.focus();
        } catch {
          // prozor ne pripada ovom service workeru; otvori novi
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
