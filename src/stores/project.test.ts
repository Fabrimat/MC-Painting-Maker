import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createProjectStore } from './project';

describe('project store', () => {
  it('exposes an initial empty project', () => {
    const s = createProjectStore();
    const v = get(s);
    expect(v.version).toBe(3);
    expect(v.paintings).toEqual([]);
  });

  it('updates with the set method', () => {
    const s = createProjectStore();
    const v = get(s);
    s.set({ ...v, paintings: [] });
    expect(get(s).paintings).toEqual([]);
  });
});
