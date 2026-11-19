/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

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
