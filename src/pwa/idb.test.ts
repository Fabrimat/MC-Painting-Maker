import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { putShareFiles, getShareFiles, deleteShareFiles } from './idb';

function makeFile(name: string, type = 'image/png'): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type });
}

describe('pwa/idb', () => {
  beforeEach(async () => {
    await deleteShareFiles();
  });

  it('returns null when no files are stored', async () => {
    expect(await getShareFiles()).toBeNull();
  });

  it('round-trips a list of files', async () => {
    await putShareFiles([makeFile('a.png'), makeFile('b.jpg', 'image/jpeg')]);
    const got = await getShareFiles();
    expect(got).not.toBeNull();
    expect(got).toHaveLength(2);
    expect(got![0].name).toBe('a.png');
    expect(got![1].type).toBe('image/jpeg');
  });

  it('deleteShareFiles removes the entry', async () => {
    await putShareFiles([makeFile('a.png')]);
    await deleteShareFiles();
    expect(await getShareFiles()).toBeNull();
  });

  it('putShareFiles overwrites the previous entry', async () => {
    await putShareFiles([makeFile('first.png')]);
    await putShareFiles([makeFile('second.png')]);
    const got = await getShareFiles();
    expect(got).toHaveLength(1);
    expect(got![0].name).toBe('second.png');
  });
});
