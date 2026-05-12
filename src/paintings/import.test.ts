import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { addImagesToProject } from './import';
import { createEmptyProject } from './defaults';

// happy-dom does not implement createImageBitmap. Provide a stub that returns
// a zero-dimension ImageBitmap object, which is what the happy-dom docs imply
// would happen. The implementation guards against width/height 0 with || 1.
beforeAll(() => {
  vi.stubGlobal('createImageBitmap', async () => ({ width: 0, height: 0, close: () => {} }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function makeFile(name: string, type = 'image/png'): File {
  // A minimal 1x1 transparent PNG (8 bytes header + IHDR + IDAT + IEND would
  // be overkill - we only need createImageBitmap to resolve. happy-dom's
  // createImageBitmap returns a stub bitmap with width/height 0 from any blob,
  // so the test does not need real PNG bytes.)
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type });
}

describe('addImagesToProject', () => {
  it('appends one painting per input file and returns the new ids', async () => {
    const state = createEmptyProject();
    const result = await addImagesToProject(state, [
      makeFile('cat.png'),
      makeFile('dog.jpg', 'image/jpeg'),
    ]);
    expect(result.state.paintings).toHaveLength(2);
    expect(result.addedIds).toHaveLength(2);
    expect(result.state.paintings.map((p) => p.name)).toEqual(['cat', 'dog']);
  });

  it('preserves existing paintings', async () => {
    const state = createEmptyProject();
    const first = await addImagesToProject(state, [makeFile('a.png')]);
    const second = await addImagesToProject(first.state, [makeFile('b.png')]);
    expect(second.state.paintings).toHaveLength(2);
    expect(second.state.paintings[0].name).toBe('a');
    expect(second.state.paintings[1].name).toBe('b');
  });

  it('fills empty pack UUIDs on first add', async () => {
    const state = createEmptyProject();
    expect(state.uuids.bpHeader).toBe('');
    const result = await addImagesToProject(state, [makeFile('a.png')]);
    expect(result.state.uuids.bpHeader).not.toBe('');
  });

  it('returns the unchanged state with no addedIds when no files given', async () => {
    const state = createEmptyProject();
    const result = await addImagesToProject(state, []);
    expect(result.state).toBe(state);
    expect(result.addedIds).toEqual([]);
  });
});
