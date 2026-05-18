import { writable } from 'svelte/store';

const KEY = 'mc-painting-maker:dev';

function readInitial(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const devMode = writable<boolean>(readInitial());

devMode.subscribe((v) => {
  try {
    if (v) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage may be unavailable in private mode; toggle still works in-session.
  }
});
