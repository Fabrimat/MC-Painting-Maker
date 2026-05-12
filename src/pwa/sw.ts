/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { putShareFiles } from './idb';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// SPA navigation fallback: serve precached index.html for navigation requests.
// Denylist matches what the previous generateSW config had: analytics path and
// static asset extensions stay on the network.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/\/sa\//, /\.(?:png|jpe?g|gif|svg|ico|woff2?)$/],
  }),
);

// Web Share Target POST intercept. The browser POSTs the shared files here when
// the user picks our PWA from the system share sheet. We stash the files in
// IndexedDB and redirect to the SPA with a marker query param so the client can
// pick them up on boot.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request: Request): Promise<Response> {
  const okUrl = new URL('./?source=share-target', request.url).toString();
  const errUrl = new URL('./?source=share-target&error=1', request.url).toString();
  try {
    const form = await request.formData();
    const files = form.getAll('images').filter(
      (v): v is File =>
        v instanceof File &&
        (v.type === 'image/png' || /^image\/jpe?g$/.test(v.type)),
    );
    if (files.length === 0) return Response.redirect(errUrl, 303);
    await putShareFiles(files);
    return Response.redirect(okUrl, 303);
  } catch {
    return Response.redirect(errUrl, 303);
  }
}
