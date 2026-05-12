import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadView, saveView, clearView, flushPendingSaves } from './viewState';

const KEY = 'mc-pm-views';

beforeEach(() => {
  // Flush any module-level pending state left over from a previous test
  // before clearing storage, so the next test starts from a clean slate.
  flushPendingSaves();
  localStorage.clear();
});

describe('loadView', () => {
  it('returns null for an unknown painting id', () => {
    expect(loadView('nope')).toBeNull();
  });

  it('returns the saved view for a known id', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: { zoom: 2, panX: 10, panY: 20 } }));
    expect(loadView('a')).toEqual({ zoom: 2, panX: 10, panY: 20 });
  });

  it('returns null on corrupt JSON', () => {
    localStorage.setItem(KEY, '{ not json');
    expect(loadView('a')).toBeNull();
  });

  it('returns null on schema-mismatched entries', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: { zoom: 'bogus' } }));
    expect(loadView('a')).toBeNull();
  });
});

describe('saveView', () => {
  it('writes the value to localStorage after the debounce window', () => {
    vi.useFakeTimers();
    saveView('a', { zoom: 1.5, panX: 5, panY: 7 });
    expect(localStorage.getItem(KEY)).toBeNull();
    vi.advanceTimersByTime(300);
    const blob = JSON.parse(localStorage.getItem(KEY)!);
    expect(blob.a).toEqual({ zoom: 1.5, panX: 5, panY: 7 });
    vi.useRealTimers();
  });

  it('merges multiple ids in the same storage blob', () => {
    vi.useFakeTimers();
    saveView('a', { zoom: 1, panX: 0, panY: 0 });
    saveView('b', { zoom: 2, panX: 1, panY: 1 });
    vi.advanceTimersByTime(300);
    const blob = JSON.parse(localStorage.getItem(KEY)!);
    expect(blob.a).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(blob.b).toEqual({ zoom: 2, panX: 1, panY: 1 });
    vi.useRealTimers();
  });
});

describe('clearView', () => {
  it('removes only the requested id', () => {
    vi.useFakeTimers();
    saveView('a', { zoom: 1, panX: 0, panY: 0 });
    saveView('b', { zoom: 2, panX: 0, panY: 0 });
    vi.advanceTimersByTime(300);
    clearView('a');
    flushPendingSaves();
    const blob = JSON.parse(localStorage.getItem(KEY)!);
    expect(blob.a).toBeUndefined();
    expect(blob.b).toEqual({ zoom: 2, panX: 0, panY: 0 });
    vi.useRealTimers();
  });
});

describe('flushPendingSaves', () => {
  it('forces an immediate write of pending changes', () => {
    saveView('a', { zoom: 3, panX: 4, panY: 5 });
    flushPendingSaves();
    const blob = JSON.parse(localStorage.getItem(KEY)!);
    expect(blob.a).toEqual({ zoom: 3, panX: 4, panY: 5 });
  });
});
