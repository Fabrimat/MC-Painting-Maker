import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createHistory } from './history';
import { createProjectStore } from './project';
import { createEmptyProject } from '../paintings/defaults';
import type { ProjectState } from '../paintings/types';

// Test clock that ignores the COALESCE_MS window so each edit lands as its
// own undo step. Individual tests override it when they need to exercise
// burst coalescing.
function farApartClock() {
  let t = 0;
  return () => { t += 10_000; return t; };
}

function withName(name: string): ProjectState {
  const p = createEmptyProject();
  p.pack.name = name;
  return p;
}

describe('createHistory', () => {
  it('starts empty: canUndo and canRedo are both false', () => {
    const s = createProjectStore();
    const h = createHistory(s, farApartClock());
    expect(get(h.canUndo)).toBe(false);
    expect(get(h.canRedo)).toBe(false);
    h.destroy();
  });

  it('records a change and enables undo', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    s.set(withName('B'));
    expect(get(h.canUndo)).toBe(true);
    expect(get(h.canRedo)).toBe(false);
    h.destroy();
  });

  it('undo restores the previous snapshot and enables redo', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    s.set(withName('B'));
    h.undo();
    expect(get(s).pack.name).toBe('A');
    expect(get(h.canUndo)).toBe(false);
    expect(get(h.canRedo)).toBe(true);
    h.destroy();
  });

  it('redo re-applies the undone change', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    s.set(withName('B'));
    h.undo();
    h.redo();
    expect(get(s).pack.name).toBe('B');
    expect(get(h.canUndo)).toBe(true);
    expect(get(h.canRedo)).toBe(false);
    h.destroy();
  });

  it('a new edit after undo clears the redo stack', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    s.set(withName('B'));
    s.set(withName('C'));
    h.undo();
    expect(get(h.canRedo)).toBe(true);
    s.set(withName('D'));
    expect(get(h.canRedo)).toBe(false);
    h.destroy();
  });

  it('chains multiple undos all the way to the baseline', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    s.set(withName('B'));
    s.set(withName('C'));
    s.set(withName('D'));
    h.undo();
    h.undo();
    h.undo();
    expect(get(s).pack.name).toBe('A');
    expect(get(h.canUndo)).toBe(false);
    h.destroy();
  });

  it('undo on an empty past stack is a no-op', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    h.undo();
    expect(get(s).pack.name).toBe('A');
    h.destroy();
  });

  it('redo on an empty future stack is a no-op', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    s.set(withName('B'));
    h.redo();
    expect(get(s).pack.name).toBe('B');
    h.destroy();
  });

  it('coalesces rapid-fire changes into a single undo step', () => {
    let t = 0;
    const clock = () => t;
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, clock);
    t = 0;     s.set(withName('B'));
    t = 100;   s.set(withName('C'));
    t = 200;   s.set(withName('D'));
    t = 300;   s.set(withName('E'));
    h.undo();
    expect(get(s).pack.name).toBe('A');
    expect(get(h.canUndo)).toBe(false);
    h.destroy();
  });

  it('does NOT coalesce changes separated by more than the burst window', () => {
    let t = 0;
    const clock = () => t;
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, clock);
    t = 0;     s.set(withName('B'));
    t = 1000;  s.set(withName('C'));
    h.undo();
    expect(get(s).pack.name).toBe('B');
    h.undo();
    expect(get(s).pack.name).toBe('A');
    h.destroy();
  });

  it('reset() wipes both stacks and rebaselines on the given state', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    s.set(withName('B'));
    s.set(withName('C'));
    h.undo();
    h.reset(get(s));
    expect(get(h.canUndo)).toBe(false);
    expect(get(h.canRedo)).toBe(false);
    h.destroy();
  });

  it('destroy unsubscribes so later store changes are not recorded', () => {
    const s = createProjectStore(withName('A'));
    const h = createHistory(s, farApartClock());
    h.destroy();
    s.set(withName('B'));
    // After destroy the controller is dead; canUndo never updates again.
    expect(get(h.canUndo)).toBe(false);
  });
});
