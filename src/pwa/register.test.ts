import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

const { mockUpdateSW, captured } = vi.hoisted(() => ({
  mockUpdateSW: vi.fn(),
  captured: {
    onNeedRefresh: undefined as (() => void) | undefined,
    onOfflineReady: undefined as (() => void) | undefined,
    onRegisterError: undefined as ((error: unknown) => void) | undefined,
  },
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisterError?: (error: unknown) => void;
  }) => {
    captured.onNeedRefresh = options.onNeedRefresh;
    captured.onOfflineReady = options.onOfflineReady;
    captured.onRegisterError = options.onRegisterError;
    return mockUpdateSW;
  },
}));

import { needRefresh, offlineReady, applyUpdate, recoverIfStaleSWNavigation } from './register';

type SWListener = (event?: unknown) => void;

interface MockServiceWorkerContainer {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  getRegistration: ReturnType<typeof vi.fn>;
  getRegistrations: ReturnType<typeof vi.fn>;
  fireControllerChange: () => void;
}

function makeServiceWorkerContainer(): MockServiceWorkerContainer {
  const listeners = new Set<SWListener>();
  return {
    addEventListener: vi.fn((event: string, listener: SWListener) => {
      if (event === 'controllerchange') listeners.add(listener);
    }),
    removeEventListener: vi.fn((event: string, listener: SWListener) => {
      if (event === 'controllerchange') listeners.delete(listener);
    }),
    getRegistration: vi.fn(),
    getRegistrations: vi.fn().mockResolvedValue([]),
    fireControllerChange() {
      for (const l of Array.from(listeners)) l();
    },
  };
}

function setPathname(pathname: string): void {
  Object.defineProperty(window, 'location', {
    value: { pathname, reload: vi.fn() },
    writable: true,
    configurable: true,
  });
}

describe('pwa/register', () => {
  beforeEach(() => {
    needRefresh.set(false);
    offlineReady.set(false);
    mockUpdateSW.mockClear();
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });

  it('exposes writable stores with initial value false', () => {
    expect(get(needRefresh)).toBe(false);
    expect(get(offlineReady)).toBe(false);
  });

  it('sets needRefresh to true when the SW reports a pending update', () => {
    captured.onNeedRefresh?.();
    expect(get(needRefresh)).toBe(true);
  });

  it('suppresses onNeedRefresh inside the post-applyUpdate window', () => {
    sessionStorage.setItem('pwa-update-in-flight', String(Date.now()));
    captured.onNeedRefresh?.();
    expect(get(needRefresh)).toBe(false);
  });

  it('clears the suppression flag and fires once the window expires', () => {
    sessionStorage.setItem('pwa-update-in-flight', String(Date.now() - 60_000));
    captured.onNeedRefresh?.();
    expect(get(needRefresh)).toBe(true);
    expect(sessionStorage.getItem('pwa-update-in-flight')).toBeNull();
  });

  it('sets offlineReady to true when the SW reports offline-ready', () => {
    captured.onOfflineReady?.();
    expect(get(offlineReady)).toBe(true);
  });

  it('swallows registration errors via onRegisterError', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    captured.onRegisterError?.(new Error('boom'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('applyUpdate', () => {
    let reloadSpy: ReturnType<typeof vi.fn>;
    let originalLocation: PropertyDescriptor | undefined;

    beforeEach(() => {
      reloadSpy = vi.fn();
      originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy, pathname: '/' },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      if (originalLocation) {
        Object.defineProperty(window, 'location', originalLocation);
      }
    });

    it('hides the toast immediately for instant user feedback', async () => {
      needRefresh.set(true);
      await applyUpdate();
      expect(get(needRefresh)).toBe(false);
    });

    it('sets a suppression flag in sessionStorage before reloading', async () => {
      const before = Date.now();
      await applyUpdate();
      const raw = sessionStorage.getItem('pwa-update-in-flight');
      expect(raw).not.toBeNull();
      expect(Number(raw)).toBeGreaterThanOrEqual(before);
    });

    it('reloads the page after cleanup', async () => {
      await applyUpdate();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('promotes the waiting SW via SKIP_WAITING and reloads on controllerchange', async () => {
      const container = makeServiceWorkerContainer();
      const waitingPostMessage = vi.fn();
      container.getRegistration.mockResolvedValue({
        waiting: { postMessage: waitingPostMessage },
      });
      vi.stubGlobal('navigator', { serviceWorker: container });

      const pending = applyUpdate();
      await Promise.resolve();
      await Promise.resolve();
      container.fireControllerChange();
      await pending;

      expect(waitingPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(reloadSpy).toHaveBeenCalled();
      // The fast path skips the nuclear unregister.
      expect(container.getRegistrations).not.toHaveBeenCalled();
    });

    it('falls back to unregister + cache clear when no SW is waiting', async () => {
      const container = makeServiceWorkerContainer();
      container.getRegistration.mockResolvedValue({ waiting: null });
      const unregister1 = vi.fn().mockResolvedValue(true);
      const unregister2 = vi.fn().mockResolvedValue(true);
      container.getRegistrations.mockResolvedValue([
        { unregister: unregister1 },
        { unregister: unregister2 },
      ]);
      vi.stubGlobal('navigator', { serviceWorker: container });
      const cachesDelete = vi.fn().mockResolvedValue(true);
      vi.stubGlobal('caches', {
        keys: vi.fn().mockResolvedValue(['workbox-precache', 'runtime-cache']),
        delete: cachesDelete,
      });

      await applyUpdate();

      expect(unregister1).toHaveBeenCalled();
      expect(unregister2).toHaveBeenCalled();
      expect(cachesDelete).toHaveBeenCalledWith('workbox-precache');
      expect(cachesDelete).toHaveBeenCalledWith('runtime-cache');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('falls back to unregister when SKIP_WAITING is not acknowledged in time', async () => {
      vi.useFakeTimers();
      const container = makeServiceWorkerContainer();
      const waitingPostMessage = vi.fn();
      container.getRegistration.mockResolvedValue({
        waiting: { postMessage: waitingPostMessage },
      });
      const unregister = vi.fn().mockResolvedValue(true);
      container.getRegistrations.mockResolvedValue([{ unregister }]);
      vi.stubGlobal('navigator', { serviceWorker: container });

      const pending = applyUpdate();
      // No controllerchange fired. Push past the 1.5s SKIP_WAITING timeout.
      await vi.advanceTimersByTimeAsync(2000);
      await pending;

      expect(waitingPostMessage).toHaveBeenCalled();
      expect(unregister).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('still reloads when unregister throws', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const container = makeServiceWorkerContainer();
      container.getRegistration.mockResolvedValue(undefined);
      container.getRegistrations.mockRejectedValue(new Error('boom'));
      vi.stubGlobal('navigator', { serviceWorker: container });

      await applyUpdate();

      expect(warnSpy).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('recoverIfStaleSWNavigation', () => {
    let originalLocation: PropertyDescriptor | undefined;

    beforeEach(() => {
      originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      if (originalLocation) {
        Object.defineProperty(window, 'location', originalLocation);
      }
    });

    it('does nothing at the SPA root', async () => {
      setPathname('/');
      const container = makeServiceWorkerContainer();
      vi.stubGlobal('navigator', { serviceWorker: container });
      await recoverIfStaleSWNavigation();
      expect(container.getRegistration).not.toHaveBeenCalled();
    });

    it('does nothing at /index.html', async () => {
      setPathname('/index.html');
      const container = makeServiceWorkerContainer();
      vi.stubGlobal('navigator', { serviceWorker: container });
      await recoverIfStaleSWNavigation();
      expect(container.getRegistration).not.toHaveBeenCalled();
    });

    it('does nothing at non-html paths', async () => {
      setPathname('/some/spa/route');
      const container = makeServiceWorkerContainer();
      vi.stubGlobal('navigator', { serviceWorker: container });
      await recoverIfStaleSWNavigation();
      expect(container.getRegistration).not.toHaveBeenCalled();
    });

    it('promotes the waiting SW and reloads when stuck on /how-to.html', async () => {
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { pathname: '/how-to.html', reload: reloadSpy },
        writable: true,
        configurable: true,
      });
      const container = makeServiceWorkerContainer();
      const waitingPostMessage = vi.fn();
      const updateSpy = vi.fn().mockResolvedValue(undefined);
      container.getRegistration.mockResolvedValue({
        waiting: { postMessage: waitingPostMessage },
        installing: null,
        update: updateSpy,
      });
      vi.stubGlobal('navigator', { serviceWorker: container });

      const pending = recoverIfStaleSWNavigation();
      // Recovery chains getRegistration -> update -> waitForInstall ->
      // promoteWaitingSW.getRegistration before the controllerchange listener
      // is attached. A macrotask flush is the simplest way to settle all of
      // those microtasks before we fire the event.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      container.fireControllerChange();
      await pending;

      expect(updateSpy).toHaveBeenCalled();
      expect(waitingPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(reloadSpy).toHaveBeenCalled();
      expect(sessionStorage.getItem('pwa-stale-sw-recovered')).not.toBeNull();
    });

    it('does not reload when there is no waiting SW available', async () => {
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { pathname: '/how-to.html', reload: reloadSpy },
        writable: true,
        configurable: true,
      });
      const container = makeServiceWorkerContainer();
      container.getRegistration.mockResolvedValue({
        waiting: null,
        installing: null,
        update: vi.fn().mockResolvedValue(undefined),
      });
      vi.stubGlobal('navigator', { serviceWorker: container });

      await recoverIfStaleSWNavigation();
      expect(reloadSpy).not.toHaveBeenCalled();
    });

    it('only attempts recovery once per tab', async () => {
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { pathname: '/how-to.html', reload: reloadSpy },
        writable: true,
        configurable: true,
      });
      sessionStorage.setItem('pwa-stale-sw-recovered', String(Date.now()));
      const container = makeServiceWorkerContainer();
      vi.stubGlobal('navigator', { serviceWorker: container });

      await recoverIfStaleSWNavigation();

      expect(container.getRegistration).not.toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });
});
