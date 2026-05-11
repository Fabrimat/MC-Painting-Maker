import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage, migrate } from './defaults';
import { ProjectSchema } from './schema';

describe('createEmptyProject', () => {
  it('produces a project that satisfies ProjectSchema', () => {
    const p = createEmptyProject();
    expect(() => ProjectSchema.parse(p)).not.toThrow();
  });

  it('produces unique UUIDs each call', () => {
    const a = createEmptyProject();
    const b = createEmptyProject();
    expect(a.uuids.bpHeader).not.toBe(b.uuids.bpHeader);
  });

  it('starts with no paintings', () => {
    expect(createEmptyProject().paintings).toEqual([]);
  });
});

describe('createPaintingFromImage', () => {
  it('produces a schema-valid Painting', () => {
    const p = createPaintingFromImage('test', { pngBase64: '', naturalW: 200, naturalH: 100 });
    const proj = createEmptyProject();
    proj.paintings.push(p);
    expect(() => ProjectSchema.parse(proj)).not.toThrow();
  });

  it('produces unique IDs across calls', () => {
    const a = createPaintingFromImage('a', { pngBase64: '', naturalW: 100, naturalH: 100 });
    const b = createPaintingFromImage('b', { pngBase64: '', naturalW: 100, naturalH: 100 });
    expect(a.id).not.toBe(b.id);
  });

  it('snaps canvas dimensions to multiples of 16', () => {
    const p = createPaintingFromImage('t', { pngBase64: '', naturalW: 200, naturalH: 100 });
    expect(p.canvasW16 % 16).toBe(0);
    expect(p.canvasH16 % 16).toBe(0);
  });
});

describe('migrate', () => {
  it('throws on null input', () => {
    expect(() => migrate(null)).toThrow();
  });

  it('throws on object without version', () => {
    expect(() => migrate({})).toThrow();
  });

  it('throws on unsupported version', () => {
    expect(() => migrate({ version: 2 })).toThrow();
  });

  it('throws on structurally invalid version-1 object (e.g. missing pack)', () => {
    expect(() => migrate({ version: 1 })).toThrow();
  });

  it('accepts a valid project', () => {
    const valid = createEmptyProject();
    expect(() => migrate(valid)).not.toThrow();
  });
});
