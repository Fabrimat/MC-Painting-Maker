import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { wipeAllData } from './wipe';

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('s');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

describe('wipeAllData', () => {
  it('clears localStorage, sessionStorage and every IndexedDB database', async () => {
    localStorage.setItem('mc-painting-maker:project', '{}');
    sessionStorage.setItem('x', '1');
    (await openDb('mc-painting-maker-pwa')).close();
    (await openDb('some-other-db')).close();

    await wipeAllData();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    const left = (await indexedDB.databases()).map((d) => d.name);
    expect(left).toEqual([]);
  });
});
