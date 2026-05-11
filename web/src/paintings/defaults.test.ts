import { describe, it, expect } from 'vitest';
import { createEmptyProject } from './defaults';
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
