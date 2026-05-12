import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('applyUpdate calls updateSW(true) to reload with the new SW', () => {
    applyUpdate();
    expect(mockUpdateSW).toHaveBeenCalledWith(true);
  });

  it('swallows registration errors via onRegisterError', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    captured.onRegisterError?.(new Error('boom'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
