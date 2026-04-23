import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Workbox precache — injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Runtime caching: Supabase public storage assets (static images only).
// We do NOT cache the REST / Storage / Functions API because responses depend
// on Authorization headers and RLS policies per user; caching them would leak
// data across users and break mutations (e.g. 403 on avatar uploads).
registerRoute(
  ({ url, request }) =>
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith('/storage/v1/object/public/') &&
    request.method === 'GET',
  new NetworkFirst({
    cacheName: 'supabase-public-assets',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60,
      }),
    ],
  })
);

// Runtime caching: Google Fonts (cache-first, 1 year)
registerRoute(
  ({ url }) =>
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// --- Push Notifications ---

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'TrainingTrack', body: event.data.text() };
  }

  const { title = 'TrainingTrack', body = '', url = '/', tag = 'tt-default' } = data;

  const options = {
    body,
    icon: '/img/logo_192.png',
    badge: '/img/logo_192.png',
    tag,
    renotify: true,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window if none found
      return self.clients.openWindow(url);
    })
  );
});
