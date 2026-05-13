import { writable, type Writable } from 'svelte/store';
import { registerSW } from 'virtual:pwa-register';

export const needRefresh: Writable<boolean> = writable(false);
export const offlineReady: Writable<boolean> = writable(false);

const UPDATE_FLAG_KEY = 'pwa-update-in-flight';
const SUPPRESS_WINDOW_MS = 30_000;

function shouldSuppressNeedRefresh(): boolean {
  try {
    const raw = sessionStorage.getItem(UPDATE_FLAG_KEY);
    if (!raw) return false;
    const updatedAt = Number(raw);
    if (!Number.isFinite(updatedAt)) {
      sessionStorage.removeItem(UPDATE_FLAG_KEY);
      return false;
    }
    if (Date.now() - updatedAt < SUPPRESS_WINDOW_MS) {
      return true;
    }
    sessionStorage.removeItem(UPDATE_FLAG_KEY);
    return false;
  } catch {
    return false;
  }
}

registerSW({
  onNeedRefresh() {
    // After applyUpdate() forces a reload we sometimes get a spurious
    // onNeedRefresh on the fresh page (workbox seems to race the freshly
    // installed SW against the about-to-be-removed one). The flag set in
    // applyUpdate() suppresses these for a short window.
    if (shouldSuppressNeedRefresh()) return;
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

  try {
    sessionStorage.setItem(UPDATE_FLAG_KEY, String(Date.now()));
  } catch {
    // sessionStorage might be unavailable (private mode quirks); not fatal.
  }

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
