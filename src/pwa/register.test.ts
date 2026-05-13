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
      vi.useFakeTimers();
      reloadSpy = vi.fn();
      originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      if (originalLocation) {
        Object.defineProperty(window, 'location', originalLocation);
      }
    });

    it('posts SKIP_WAITING via updateSW(true)', () => {
      void applyUpdate();
      expect(mockUpdateSW).toHaveBeenCalledWith(true);
    });

    it('reloads on controllerchange without waiting for the timeout', () => {
      let controllerChangeHandler: EventListener | undefined;
      vi.stubGlobal('navigator', {
        serviceWorker: {
          addEventListener: (event: string, handler: EventListener) => {
            if (event === 'controllerchange') controllerChangeHandler = handler;
          },
          getRegistration: vi.fn().mockResolvedValue(null),
        },
      });

      void applyUpdate();
      controllerChangeHandler?.(new Event('controllerchange'));

      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to unregister + reload after the timeout when controllerchange never fires', async () => {
      const unregister = vi.fn().mockResolvedValue(true);
      vi.stubGlobal('navigator', {
        serviceWorker: {
          addEventListener: vi.fn(),
          getRegistration: vi.fn().mockResolvedValue({ unregister }),
        },
      });

      void applyUpdate();
      await vi.runAllTimersAsync();

      expect(unregister).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('does not reload twice when controllerchange beats the timeout', async () => {
      let controllerChangeHandler: EventListener | undefined;
      const unregister = vi.fn().mockResolvedValue(true);
      vi.stubGlobal('navigator', {
        serviceWorker: {
          addEventListener: (event: string, handler: EventListener) => {
            if (event === 'controllerchange') controllerChangeHandler = handler;
          },
          getRegistration: vi.fn().mockResolvedValue({ unregister }),
        },
      });

      void applyUpdate();
      controllerChangeHandler?.(new Event('controllerchange'));
      await vi.runAllTimersAsync();

      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(unregister).not.toHaveBeenCalled();
    });
  });
});
