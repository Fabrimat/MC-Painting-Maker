import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { putShareFiles, deleteShareFiles, getShareFiles } from './idb';

type LaunchParams = { files: Array<{ getFile: () => Promise<File> }> };
type LaunchConsumer = (params: LaunchParams) => unknown;

function setUrl(pathAndSearch: string) {
  // Use a relative path so happy-dom does not reject a cross-origin replaceState.
  // Strip any http://localhost prefix the caller may pass in.
  const relative = pathAndSearch.replace(/^https?:\/\/[^/]+/, '');
  window.history.replaceState({}, '', relative || '/');
}

function makeFile(name: string, type = 'image/png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

async function freshModule() {
  vi.resetModules();
  return await import('./incomingFiles');
}

describe('pwa/incomingFiles', () => {
  let setConsumer: ReturnType<typeof vi.fn>;
  let consumer: LaunchConsumer | null;

  beforeEach(async () => {
    await deleteShareFiles();
    setUrl('http://localhost/');
    consumer = null;
    setConsumer = vi.fn((cb: LaunchConsumer) => {
      consumer = cb;
    });
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      writable: true,
      value: { setConsumer },
    });
  });

  it('emits files on incomingFiles when source=share-target and IDB has files', async () => {
    await putShareFiles([makeFile('cat.png')]);
    setUrl('http://localhost/?source=share-target');
    const mod = await freshModule();
    mod.initIncomingFiles();
    await vi.waitFor(() => {
      const v = get(mod.incomingFiles);
      expect(v).not.toBeNull();
      expect(v).toHaveLength(1);
    });
    expect((get(mod.incomingFiles) as File[])[0].name).toBe('cat.png');
    expect(get(mod.incomingError)).toBeNull();
    expect(await getShareFiles()).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('does not emit when source=share-target but IDB is empty', async () => {
    setUrl('http://localhost/?source=share-target');
    const mod = await freshModule();
    mod.initIncomingFiles();
    await vi.waitFor(() => expect(window.location.search).toBe(''));
    expect(get(mod.incomingFiles)).toBeNull();
    expect(get(mod.incomingError)).toBeNull();
  });

  it('emits incomingError on source=share-target&error=1', async () => {
    setUrl('http://localhost/?source=share-target&error=1');
    const mod = await freshModule();
    mod.initIncomingFiles();
    await vi.waitFor(() => {
      expect(get(mod.incomingError)).toBe('Share failed');
    });
    expect(get(mod.incomingFiles)).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('emits files when launchQueue consumer fires with file handles', async () => {
    const mod = await freshModule();
    mod.initIncomingFiles();
    expect(setConsumer).toHaveBeenCalledTimes(1);
    const file = makeFile('dog.png');
    await consumer!({ files: [{ getFile: () => Promise.resolve(file) }] });
    expect(get(mod.incomingFiles)).toHaveLength(1);
    expect((get(mod.incomingFiles) as File[])[0].name).toBe('dog.png');
  });

  it('emits incomingError when launchQueue getFile() rejects', async () => {
    const mod = await freshModule();
    mod.initIncomingFiles();
    expect(setConsumer).toHaveBeenCalledTimes(1);
    await consumer!({
      files: [{ getFile: () => Promise.reject(new Error('handle revoked')) }],
    });
    expect(get(mod.incomingError)).toBe('Share failed');
    expect(get(mod.incomingFiles)).toBeNull();
  });

  it('is a no-op when launchQueue is missing and no share query param is set', async () => {
    delete (window as unknown as { launchQueue?: unknown }).launchQueue;
    const mod = await freshModule();
    mod.initIncomingFiles();
    await new Promise((r) => setTimeout(r, 10));
    expect(get(mod.incomingFiles)).toBeNull();
    expect(get(mod.incomingError)).toBeNull();
  });
});
