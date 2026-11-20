/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { pushNotification } from '../features/alerts/alertWords';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// The app's own files (scripts, styles, fonts, icons), listed at build time. Nothing from the API or the
// live connection is ever cached here, so no trip or location data is kept on the phone by this worker.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every page is the same app, so any address opens from the cache, also without signal. Server routes
// are left to the network.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/ws(\/|$)/, /^\/actuator\//, /^\/swagger-ui/, /^\/v3\//],
  }),
);

// A new version waits until the person taps Reload, so a live trip is never reloaded under them.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Push notifications: the server sends an encrypted alert, the browser hands it here even with the app
// closed, and it is shown in the app's words.
self.addEventListener('push', (event) => {
  let data: unknown = null;
  try {
    data = event.data?.json();
  } catch {
    // Not JSON: nothing to show.
  }
  const shown = pushNotification(data);
  if (!shown) return;
  event.waitUntil(
    self.registration.showNotification(shown.title, {
      body: shown.body,
      tag: shown.tag,
      icon: '/pwa-192x192.png',
      data: { url: shown.url },
    }),
  );
});

// Tapping a notification brings the app forward and moves it to that screen without a reload (a live trip
// keeps running), or opens the app there.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data as { url?: string } | null)?.url ?? '/me/alerts';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        open.postMessage({ type: 'OPEN_PATH', path });
        await open.focus();
        return;
      }
      await self.clients.openWindow(new URL(path, self.location.origin).href);
    })(),
  );
});
