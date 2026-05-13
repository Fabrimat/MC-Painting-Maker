import { writable, type Writable } from 'svelte/store';
import { registerSW } from 'virtual:pwa-register';

export const needRefresh: Writable<boolean> = writable(false);
export const offlineReady: Writable<boolean> = writable(false);

const updateSW = registerSW({
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

const FALLBACK_DELAY_MS = 2000;

// Activate the waiting SW and reload. The elegant path posts SKIP_WAITING and
// relies on controllerchange to reload, but it silently fails when the waiting
// SW pre-dates the SKIP_WAITING handler (older deploys) or when there is no
// waiting SW at all. The timeout below catches those cases by unregistering the
// SW entirely so the next navigation fetches fresh assets from the network.
export async function applyUpdate(): Promise<void> {
  let done = false;
  const reload = (): void => {
    if (done) return;
    done = true;
    window.location.reload();
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  }

  void updateSW(true);

  window.setTimeout(async () => {
    if (done) return;
    done = true;
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.unregister();
      } catch (err) {
        console.warn('Failed to unregister service worker before reload', err);
      }
    }
    window.location.reload();
  }, FALLBACK_DELAY_MS);
}
