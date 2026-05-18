import { writable, type Writable } from 'svelte/store';
import { registerSW } from 'virtual:pwa-register';
import { devLog } from '../util/devlog';

export const needRefresh: Writable<boolean> = writable(false);
export const offlineReady: Writable<boolean> = writable(false);

const UPDATE_FLAG_KEY = 'pwa-update-in-flight';
const SUPPRESS_WINDOW_MS = 30_000;
const RECOVERED_FLAG_KEY = 'pwa-stale-sw-recovered';
const SKIP_WAITING_TIMEOUT_MS = 1500;
const INSTALL_WAIT_TIMEOUT_MS = 3000;

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
    if (shouldSuppressNeedRefresh()) {
      devLog('pwa', 'onNeedRefresh suppressed (within update window)');
      return;
    }
    devLog('pwa', 'onNeedRefresh');
    needRefresh.set(true);
  },
  onOfflineReady() {
    devLog('pwa', 'onOfflineReady');
    offlineReady.set(true);
  },
  onRegisterError(error) {
    console.warn('Service worker registration failed', error);
    devLog('pwa', 'onRegisterError', error);
  },
});

// Promote the waiting service worker to active and wait for it to take control
// of this client. Returns true if the swap actually happened, false if there
// was no waiting SW or SKIP_WAITING was not handled in time.
//
// The new SW has clientsClaim(), so once it activates it becomes the controller
// of this page immediately. We listen for controllerchange to know that.
// `unregister()` is a delayed operation: it does not remove the active SW from
// the current clients, so calling it before reload leaves the old SW in charge
// of the navigation request. SKIP_WAITING is the only way to swap in-session.
async function promoteWaitingSW(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const waiting = reg?.waiting;
    if (!waiting) return false;

    const swapped = new Promise<true>((resolve) => {
      const onChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onChange);
        resolve(true);
      };
      navigator.serviceWorker.addEventListener('controllerchange', onChange);
    });
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return await Promise.race([
      swapped,
      new Promise<false>((resolve) => setTimeout(() => resolve(false), SKIP_WAITING_TIMEOUT_MS)),
    ]);
  } catch (err) {
    devLog('pwa', 'promoteWaitingSW failed', err);
    return false;
  }
}

// Apply a pending service worker update by promoting the waiting SW so the
// next navigation is served by the up-to-date worker. Falls back to a
// nuclear unregister + cache wipe if the SKIP_WAITING message is ignored.
export async function applyUpdate(): Promise<void> {
  devLog('pwa', 'applyUpdate start');
  needRefresh.set(false);

  try {
    sessionStorage.setItem(UPDATE_FLAG_KEY, String(Date.now()));
  } catch {
    // sessionStorage might be unavailable (private mode quirks); not fatal.
  }

  if ('serviceWorker' in navigator) {
    const swapped = await promoteWaitingSW();
    if (swapped) {
      devLog('pwa', 'applyUpdate reloading after SW swap');
      window.location.reload();
      return;
    }

    // No swap happened. Fall back to the brute-force path: unregister every
    // registration and wipe every cache so stale workers from older scopes
    // can't keep firing onNeedRefresh after a successful reload. The active
    // SW won't actually be evicted mid-session (unregister is delayed), but
    // the next page open starts from a clean slate.
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      devLog('pwa', 'unregistering service workers', { count: registrations.length });
      await Promise.all(registrations.map((r) => r.unregister()));
    } catch (err) {
      console.warn('Failed to unregister service workers', err);
      devLog('pwa', 'unregister failed', err);
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const names = await caches.keys();
      devLog('pwa', 'clearing caches', { names });
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch (err) {
      console.warn('Failed to clear caches', err);
      devLog('pwa', 'cache clear failed', err);
    }
  }

  devLog('pwa', 'applyUpdate reloading');
  window.location.reload();
}

async function waitForInstall(reg: ServiceWorkerRegistration, timeoutMs: number): Promise<void> {
  const installing = reg.installing;
  if (!installing) return;
  await new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      installing.removeEventListener('statechange', onStateChange);
      if (timer !== null) clearTimeout(timer);
    };
    const onStateChange = () => {
      if (installing.state !== 'installing') {
        cleanup();
        resolve();
      }
    };
    installing.addEventListener('statechange', onStateChange);
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);
  });
}

// Self-heal when the SPA shell has been wrongly served at a standalone static
// page URL by a stale service worker. This happens when an older SW's
// NavigationRoute fallback substitutes index.html for a path that did not
// exist in its precache manifest (e.g. /how-to.html on a build that pre-dates
// the page's introduction): the SW returns the new index.html under the wrong
// URL, the SPA boots and shows the homepage instead of the requested page.
//
// Without this, the only way out is Ctrl+F5. With this, we trigger a SW
// update, promote the waiting worker, and reload exactly once per tab.
export async function recoverIfStaleSWNavigation(): Promise<void> {
  const path = window.location.pathname;
  // Root and index.html are legitimate SPA URLs; anything else ending in .html
  // is a standalone static page that should not be running the SPA bundle.
  if (!/\.html$/.test(path) || /(?:^|\/)index\.html$/.test(path)) return;
  if (!('serviceWorker' in navigator)) return;

  try {
    if (sessionStorage.getItem(RECOVERED_FLAG_KEY)) {
      devLog('pwa', 'recoverIfStaleSWNavigation skipped (already attempted)', { path });
      return;
    }
    sessionStorage.setItem(RECOVERED_FLAG_KEY, String(Date.now()));
  } catch {
    // Without sessionStorage we can't gate against loops; bail out to be safe.
    return;
  }

  devLog('pwa', 'recoverIfStaleSWNavigation triggered', { path });

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      try {
        await reg.update();
      } catch (err) {
        devLog('pwa', 'reg.update failed during recovery', err);
      }
      await waitForInstall(reg, INSTALL_WAIT_TIMEOUT_MS);
    }
  } catch (err) {
    devLog('pwa', 'getRegistration failed during recovery', err);
  }

  const swapped = await promoteWaitingSW();
  if (swapped) {
    devLog('pwa', 'recovery reloading after SW swap');
    window.location.reload();
  } else {
    devLog('pwa', 'recovery: no waiting SW, leaving the user on the SPA shell');
  }
}
