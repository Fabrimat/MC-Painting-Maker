import { writable, type Writable } from 'svelte/store';
import { registerSW } from 'virtual:pwa-register';

export const needRefresh: Writable<boolean> = writable(false);
export const offlineReady: Writable<boolean> = writable(false);

registerSW({
  onNeedRefresh() {
    needRefresh.set(true);
  },
  onOfflineReady() {
    offlineReady.set(true);
  },
  onRegisterError(error) {
    console.warn('Service worker registration failed', error);
  },
});

// Force a clean update: unregister every SW registration and clear every cache
// before reloading. The SKIP_WAITING dance is fragile - it silently fails when
// the waiting SW pre-dates the message handler, and stale registrations from
// older scopes can keep firing onNeedRefresh after a successful reload. Nuking
// the SW state guarantees the next navigation comes through fresh from the
// network and installs the latest SW from scratch.
export async function applyUpdate(): Promise<void> {
  needRefresh.set(false);

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    } catch (err) {
      console.warn('Failed to unregister service workers', err);
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch (err) {
      console.warn('Failed to clear caches', err);
    }
  }

  window.location.reload();
}
