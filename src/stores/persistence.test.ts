import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { createProjectStore } from './project';
import { bindPersistence, loadFromStorage, exportProjectJSON, importProjectJSON } from './persistence';

const KEY = 'mc-painting-maker:project';

beforeEach(() => {
  localStorage.clear();
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
