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

import { needRefresh, offlineReady, applyUpdate } from './register';

describe('pwa/register', () => {
  beforeEach(() => {
    needRefresh.set(false);
    offlineReady.set(false);
    mockUpdateSW.mockClear();
  });

  it('exposes writable stores with initial value false', () => {
    expect(get(needRefresh)).toBe(false);
    expect(get(offlineReady)).toBe(false);
  });

  it('sets needRefresh to true when the SW reports a pending update', () => {
    captured.onNeedRefresh?.();
    expect(get(needRefresh)).toBe(true);
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
        value: { reload: reloadSpy },
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

    it('unregisters every service worker registration', async () => {
      const unregister1 = vi.fn().mockResolvedValue(true);
      const unregister2 = vi.fn().mockResolvedValue(true);
      vi.stubGlobal('navigator', {
        serviceWorker: {
          getRegistrations: vi.fn().mockResolvedValue([
            { unregister: unregister1 },
            { unregister: unregister2 },
          ]),
        },
      });

      await applyUpdate();

      expect(unregister1).toHaveBeenCalled();
      expect(unregister2).toHaveBeenCalled();
    });

    it('clears every cache', async () => {
      const deleteSpy = vi.fn().mockResolvedValue(true);
      vi.stubGlobal('caches', {
        keys: vi.fn().mockResolvedValue(['workbox-precache', 'runtime-cache']),
        delete: deleteSpy,
      });

      await applyUpdate();

      expect(deleteSpy).toHaveBeenCalledWith('workbox-precache');
      expect(deleteSpy).toHaveBeenCalledWith('runtime-cache');
    });

    it('reloads the page after cleanup', async () => {
      await applyUpdate();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('still reloads when unregister throws', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal('navigator', {
        serviceWorker: {
          getRegistrations: vi.fn().mockRejectedValue(new Error('boom')),
        },
      });

      await applyUpdate();

      expect(warnSpy).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
