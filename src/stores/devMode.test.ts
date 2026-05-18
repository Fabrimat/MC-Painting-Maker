import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

const KEY = 'mc-painting-maker:dev';

describe('devMode store', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('starts false when the flag is absent', async () => {
    const { devMode } = await import('./devMode');
    expect(get(devMode)).toBe(false);
  });

  it('starts true when the flag is "1" in localStorage', async () => {
    localStorage.setItem(KEY, '1');
    const { devMode } = await import('./devMode');
    expect(get(devMode)).toBe(true);
  });

  it('writes "1" to localStorage when enabled', async () => {
    const { devMode } = await import('./devMode');
    devMode.set(true);
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('removes the localStorage entry when disabled', async () => {
    localStorage.setItem(KEY, '1');
    const { devMode } = await import('./devMode');
    devMode.set(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
