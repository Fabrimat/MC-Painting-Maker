import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
      expect(v?.files).toHaveLength(1);
    });
    const v = get(mod.incomingFiles);
    expect(v?.files[0].name).toBe('cat.png');
    expect(v?.source).toBe('share-target');
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
    const v = get(mod.incomingFiles);
    expect(v?.files).toHaveLength(1);
    expect(v?.files[0].name).toBe('dog.png');
    expect(v?.source).toBe('file-handler');
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

  describe('analytics tracking', () => {
    let saEvent: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      saEvent = vi.fn();
      vi.stubGlobal('sa_event', saEvent);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('tracks import_failed with reason=other when error=1', async () => {
      setUrl('http://localhost/?source=share-target&error=1');
      const mod = await freshModule();
      mod.initIncomingFiles();
      await vi.waitFor(() => {
        expect(saEvent).toHaveBeenCalledWith('import_failed', { source: 'share-target', reason: 'other' });
      });
    });

    it('tracks import_failed with reason=no-valid-files when all share files are filtered out', async () => {
      await putShareFiles([makeFile('movie.mp4', 'video/mp4')]);
      setUrl('http://localhost/?source=share-target');
      const mod = await freshModule();
      mod.initIncomingFiles();
      await vi.waitFor(() => {
        expect(saEvent).toHaveBeenCalledWith('import_failed', { source: 'share-target', reason: 'no-valid-files' });
      });
      expect(get(mod.incomingFiles)).toBeNull();
      expect(get(mod.incomingError)).toBeNull();
    });

    it('tracks import_failed with reason=other when launchQueue getFile rejects', async () => {
      const mod = await freshModule();
      mod.initIncomingFiles();
      await consumer!({
        files: [{ getFile: () => Promise.reject(new Error('handle revoked')) }],
      });
      expect(saEvent).toHaveBeenCalledWith('import_failed', { source: 'file-handler', reason: 'other' });
    });

    it('tracks import_failed with reason=no-valid-files when launchQueue files are all filtered out', async () => {
      const mod = await freshModule();
      mod.initIncomingFiles();
      const video = makeFile('movie.mp4', 'video/mp4');
      await consumer!({ files: [{ getFile: () => Promise.resolve(video) }] });
      expect(saEvent).toHaveBeenCalledWith('import_failed', { source: 'file-handler', reason: 'no-valid-files' });
      expect(get(mod.incomingFiles)).toBeNull();
    });

    it('does not fire import_failed on a clean share-target success', async () => {
      await putShareFiles([makeFile('cat.png')]);
      setUrl('http://localhost/?source=share-target');
      const mod = await freshModule();
      mod.initIncomingFiles();
      await vi.waitFor(() => {
        expect(get(mod.incomingFiles)).not.toBeNull();
      });
      const failureCalls = saEvent.mock.calls.filter((c) => c[0] === 'import_failed');
      expect(failureCalls).toHaveLength(0);
    });
  });
});
