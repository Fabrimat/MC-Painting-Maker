import { get, type Writable } from 'svelte/store';
import { ProjectSchema } from '../paintings/schema';
import { migrate } from '../paintings/defaults';
import { debounce } from '../util/debounce';
import { devLog } from '../util/devlog';
import { devMode } from './devMode';
import type { ProjectState } from '../paintings/types';

const KEY = 'mc-painting-maker:project';

export function loadFromStorage(): ProjectState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    devLog('persist', 'load: empty');
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    devLog('persist', 'load: json parse failed', err);
    return null;
  }
  if (get(devMode)) {
    // Debug mode: skip migrate() + ProjectSchema.parse() so deliberately
    // raw-edited values (e.g. schema version downgraded to 1) round trip
    // verbatim instead of being auto-upgraded or rejected.
    devLog('persist', 'load: debug raw passthrough', { bytes: raw.length });
    return parsed as ProjectState;
  }
  try {
    const migrated = migrate(parsed);
    const state = ProjectSchema.parse(migrated);
    devLog('persist', 'load: ok', { paintings: state.paintings.length, bytes: raw.length });
    return state;
  } catch (err) {
    devLog('persist', 'load: parse failed', err);
    return null;
  }
}

export function bindPersistence(store: Writable<ProjectState>, delayMs = 1000): () => void {
  const write = debounce((v: ProjectState) => {
    try {
      const json = JSON.stringify(v);
      localStorage.setItem(KEY, json);
      devLog('persist', 'save', { paintings: v.paintings.length, bytes: json.length });
    } catch (err) {
      console.warn('localStorage save failed', err);
      devLog('persist', 'save failed', err);
    }
  }, delayMs);
  return store.subscribe(write);
}

export function exportProjectJSON(state: ProjectState): string {
  devLog('persist', 'export json', { paintings: state.paintings.length });
  return JSON.stringify(state, null, 2);
}

export function importProjectJSON(text: string): ProjectState {
  const raw = JSON.parse(text);
  const state = ProjectSchema.parse(migrate(raw));
  devLog('persist', 'import json', { paintings: state.paintings.length });
  return state;
}
