import type { Writable } from 'svelte/store';
import { ProjectSchema } from '../paintings/schema';
import { migrate } from '../paintings/defaults';
import { debounce } from '../util/debounce';
import type { ProjectState } from '../paintings/types';

const KEY = 'mc-painting-maker:project';

export function loadFromStorage(): ProjectState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    return ProjectSchema.parse(migrated);
  } catch {
    return null;
  }
}

export function bindPersistence(store: Writable<ProjectState>, delayMs = 1000): () => void {
  const write = debounce((v: ProjectState) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch (err) {
      console.warn('localStorage save failed', err);
    }
  }, delayMs);
  return store.subscribe(write);
}

export function exportProjectJSON(state: ProjectState): string {
  return JSON.stringify(state, null, 2);
}

export function importProjectJSON(text: string): ProjectState {
  const raw = JSON.parse(text);
  return ProjectSchema.parse(migrate(raw));
}
