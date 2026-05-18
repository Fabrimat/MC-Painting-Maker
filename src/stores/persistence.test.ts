import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { createProjectStore } from './project';
import { devMode } from './devMode';
import { bindPersistence, loadFromStorage, exportProjectJSON, importProjectJSON } from './persistence';

const KEY = 'mc-painting-maker:project';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  devMode.set(false);
});

describe('loadFromStorage', () => {
  it('returns null when nothing stored', () => {
    expect(loadFromStorage()).toBeNull();
  });
  it('returns the parsed project when stored', () => {
    const s = createProjectStore();
    localStorage.setItem(KEY, JSON.stringify(get(s)));
    expect(loadFromStorage()?.version).toBe(3);
  });
  it('returns null when the stored JSON fails validation', () => {
    localStorage.setItem(KEY, JSON.stringify({ bogus: true }));
    expect(loadFromStorage()).toBeNull();
  });
  it('returns null on schema-invalid input when debug mode is off', () => {
    const s = createProjectStore();
    const broken = { ...get(s), version: 99 };
    localStorage.setItem(KEY, JSON.stringify(broken));
    devMode.set(false);
    expect(loadFromStorage()).toBeNull();
  });
  it('falls back to the raw parsed payload when debug mode is on', () => {
    const s = createProjectStore();
    const broken = { ...get(s), version: 99 };
    localStorage.setItem(KEY, JSON.stringify(broken));
    devMode.set(true);
    const loaded = loadFromStorage();
    expect(loaded).not.toBeNull();
    expect((loaded as { version: number }).version).toBe(99);
  });
  it('still returns null when JSON itself is malformed, even in debug mode', () => {
    localStorage.setItem(KEY, '{ not json');
    devMode.set(true);
    expect(loadFromStorage()).toBeNull();
  });
});

describe('bindPersistence', () => {
  it('debounce-writes to localStorage on changes', async () => {
    vi.useFakeTimers();
    const s = createProjectStore();
    const stop = bindPersistence(s, 50);
    s.update((v) => ({ ...v, pack: { ...v.pack, name: 'Changed' } }));
    vi.advanceTimersByTime(50);
    const raw = localStorage.getItem(KEY);
    expect(raw && JSON.parse(raw).pack.name).toBe('Changed');
    stop();
    vi.useRealTimers();
  });
});

describe('exportProjectJSON / importProjectJSON', () => {
  it('round-trips through JSON text', () => {
    const s = createProjectStore();
    const text = exportProjectJSON(get(s));
    const back = importProjectJSON(text);
    expect(back.version).toBe(3);
  });
  it('throws on malformed input', () => {
    expect(() => importProjectJSON('{ not json')).toThrow();
  });
  it('throws on schema-invalid input', () => {
    expect(() => importProjectJSON(JSON.stringify({ version: 1 }))).toThrow();
  });
});
