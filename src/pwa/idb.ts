const DB_NAME = 'mc-painting-maker-pwa';
const STORE = 'pending-shares';
const KEY = 'current';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function putShareFiles(files: File[]): Promise<void> {
  const d = await openDB();
  try {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(files, KEY);
    await txDone(tx);
  } finally {
    d.close();
  }
}

export async function getShareFiles(): Promise<File[] | null> {
  const d = await openDB();
  try {
    const tx = d.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    const value = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    if (!Array.isArray(value)) return null;
    if (!value.every((v) => v instanceof File || (typeof v === 'object' && v !== null && 'name' in v && 'type' in v))) return null;
    return value as File[];
  } finally {
    d.close();
  }
}

export async function deleteShareFiles(): Promise<void> {
  const d = await openDB();
  try {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    await txDone(tx);
  } finally {
    d.close();
  }
}
