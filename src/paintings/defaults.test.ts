import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage, ensurePackUUIDs, migrate } from './defaults';
import { ProjectSchema } from './schema';
import { CURRENT_SLUG_VERSION } from './slug';

describe('createEmptyProject', () => {
  it('produces a project that satisfies ProjectSchema', () => {
    const p = createEmptyProject();
    expect(() => ProjectSchema.parse(p)).not.toThrow();
  });

  it('leaves UUIDs empty until the first image is loaded', () => {
    const p = createEmptyProject();
    expect(p.uuids.bpHeader).toBe('');
    expect(p.uuids.bpModule).toBe('');
    expect(p.uuids.bpScriptModule).toBe('');
    expect(p.uuids.rpHeader).toBe('');
    expect(p.uuids.rpModule).toBe('');
  });

  it('starts with no paintings', () => {
    expect(createEmptyProject().paintings).toEqual([]);
  });
});

describe('ensurePackUUIDs', () => {
  it('fills all empty UUIDs with uuidv4 values', () => {
    const filled = ensurePackUUIDs(createEmptyProject());
    expect(filled.uuids.bpHeader).toMatch(/^[0-9a-f-]{36}$/);
    expect(filled.uuids.bpModule).toMatch(/^[0-9a-f-]{36}$/);
    expect(filled.uuids.bpScriptModule).toMatch(/^[0-9a-f-]{36}$/);
    expect(filled.uuids.rpHeader).toMatch(/^[0-9a-f-]{36}$/);
    expect(filled.uuids.rpModule).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns distinct UUIDs across the five slots', () => {
    const u = ensurePackUUIDs(createEmptyProject()).uuids;
    const all = [u.bpHeader, u.bpModule, u.bpScriptModule, u.rpHeader, u.rpModule];
    expect(new Set(all).size).toBe(5);
  });

  it('is idempotent - does not regenerate UUIDs that are already set', () => {
    const first = ensurePackUUIDs(createEmptyProject());
    const second = ensurePackUUIDs(first);
    expect(second.uuids).toEqual(first.uuids);
  });

  it('only fills the slots that are empty (preserves the rest)', () => {
    const base = createEmptyProject();
    base.uuids.bpHeader = '11111111-1111-4111-8111-111111111111';
    const next = ensurePackUUIDs(base);
    expect(next.uuids.bpHeader).toBe('11111111-1111-4111-8111-111111111111');
    expect(next.uuids.bpModule).not.toBe('');
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

  it('derives a slug from the name with a uuid8 suffix', () => {
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    expect(p.slug).toMatch(/^sunset_[0-9a-f]{8}$/);
  });

  it('stamps the current slug-generation version on the painting', () => {
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    expect(p.slugVersion).toBe(CURRENT_SLUG_VERSION);
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

  it('backfills slug on paintings saved before the slug field existed', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const raw = JSON.parse(JSON.stringify(proj)) as { paintings: Array<{ slug?: string }> };
    delete raw.paintings[0].slug;
    const migrated = migrate(raw);
    expect(migrated.paintings[0].slug).toBe(p.slug);
  });

  it('preserves an existing slug even when the display name has been changed', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const originalSlug = p.slug;
    const raw = JSON.parse(JSON.stringify(proj)) as { paintings: Array<{ name: string }> };
    raw.paintings[0].name = 'Renamed to something else';
    const migrated = migrate(raw);
    expect(migrated.paintings[0].slug).toBe(originalSlug);
  });

  it('backfills slugVersion to 1 on paintings predating the version field', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const raw = JSON.parse(JSON.stringify(proj)) as {
      paintings: Array<{ slugVersion?: number }>;
    };
    delete raw.paintings[0].slugVersion;
    const migrated = migrate(raw);
    expect(migrated.paintings[0].slugVersion).toBe(1);
  });

  it('preserves an explicit slugVersion through migration', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const raw = JSON.parse(JSON.stringify(proj)) as {
      paintings: Array<{ slugVersion: number }>;
    };
    raw.paintings[0].slugVersion = 7;
    const migrated = migrate(raw);
    expect(migrated.paintings[0].slugVersion).toBe(7);
  });
});
