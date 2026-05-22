import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { addImagesToProject } from './import';
import { createEmptyProject, MAX_PROJECT_VERSION } from './defaults';

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

  it('bumps an empty legacy v2 project to the latest schema on first image load', async () => {
    // Simulate a legacy v2 project still empty: no items in any inventory,
    // so the version bump cannot invalidate anything yet.
    const legacy = { ...createEmptyProject(), version: 2 as const, paintings: [] };
    const result = await addImagesToProject(legacy, [makeFile('a.png')]);
    expect(result.state.version).toBe(MAX_PROJECT_VERSION);
  });

  it('does not change the version when adding to a project that already has paintings', async () => {
    // Existing v2 project with paintings already in it: keep v2 so addons
    // already imported into worlds stay byte-identical (matches migrate()).
    const first = await addImagesToProject(
      { ...createEmptyProject(), version: 2 as const, paintings: [] },
      [makeFile('a.png')],
    );
    expect(first.state.version).toBe(MAX_PROJECT_VERSION);
    // Pretend the user re-loaded the project at v2 with the painting in place.
    const stillLegacy = { ...first.state, version: 2 as const };
    const second = await addImagesToProject(stillLegacy, [makeFile('b.png')]);
    expect(second.state.version).toBe(2);
  });

  it('leaves the version alone when the empty project is already at MAX_PROJECT_VERSION', async () => {
    const state = createEmptyProject();
    expect(state.version).toBe(MAX_PROJECT_VERSION);
    const result = await addImagesToProject(state, [makeFile('a.png')]);
    expect(result.state.version).toBe(MAX_PROJECT_VERSION);
  });
});
