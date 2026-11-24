// Debug-only: erase everything this site stores in the browser (project,
// settings, IndexedDB, service worker + its caches) so the app starts as
// on a first visit. Each step is best-effort: one failing API must not
// stop the others.
const KNOWN_DBS = ['mc-painting-maker-pwa'];

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

export async function wipeAllData(): Promise<void> {
  try { localStorage.clear(); } catch { /* storage unavailable */ }
  try { sessionStorage.clear(); } catch { /* storage unavailable */ }
  try {
    const listed = typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases()).map((d) => d.name).filter((n): n is string => !!n)
      : [];
    await Promise.all([...new Set([...listed, ...KNOWN_DBS])].map(deleteDb));
  } catch { /* indexedDB unavailable */ }
  try {
    if ('caches' in globalThis) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* Cache Storage unavailable */ }
  try {
    if ('serviceWorker' in navigator) {
      await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
    }
  } catch { /* no service worker support */ }
}
