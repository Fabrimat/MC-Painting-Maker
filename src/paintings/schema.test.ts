import { describe, it, expect } from 'vitest';
import { ProjectSchema } from './schema';

const minimalProject = {
  version: 2,
  pack: {
    name: 'Test',
    description: '',
    namespace: 'test',
    semver: [1, 0, 0],
    minEngineVersion: [1, 21, 0],
    iconPngBase64: null,
    creativeGroupName: 'Test Paintings',
  },
  uuids: {
    bpHeader: '00000000-0000-0000-0000-000000000001',
    bpModule: '00000000-0000-0000-0000-000000000002',
    bpScriptModule: '00000000-0000-0000-0000-000000000003',
    rpHeader: '00000000-0000-0000-0000-000000000004',
    rpModule: '00000000-0000-0000-0000-000000000005',
  },
  paintings: [],
};

describe('ProjectSchema', () => {
  it('accepts a minimal valid project', () => {
    expect(() => ProjectSchema.parse(minimalProject)).not.toThrow();
  });

  it('accepts version 3 (placer-items pipeline)', () => {
    const v3 = { ...minimalProject, version: 3 };
    expect(() => ProjectSchema.parse(v3)).not.toThrow();
  });

  it('rejects an unknown future version (e.g. 99)', () => {
    const future = { ...minimalProject, version: 99 };
    expect(() => ProjectSchema.parse(future)).toThrow();
  });

  it('fills autoBumpVersion with true when the field is missing (legacy migration)', () => {
    const parsed = ProjectSchema.parse(minimalProject);
    expect(parsed.pack.autoBumpVersion).toBe(true);
  });

  it('preserves an explicit autoBumpVersion=false', () => {
    const withFlag = {
      ...minimalProject,
      pack: { ...minimalProject.pack, autoBumpVersion: false },
    };
    expect(ProjectSchema.parse(withFlag).pack.autoBumpVersion).toBe(false);
  });

  it('rejects an invalid namespace', () => {
    const bad = { ...minimalProject, pack: { ...minimalProject.pack, namespace: 'Invalid-Name' } };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('rejects the reserved namespace "minecraft"', () => {
    const bad = { ...minimalProject, pack: { ...minimalProject.pack, namespace: 'minecraft' } };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('rejects a painting with non-integer canvasW16', () => {
    const bad = {
      ...minimalProject,
      paintings: [{
        id: 'p1', name: 'a',
        canvasW16: 1.5, canvasH16: 16,
        source: null,
        transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
        resampling: 'smooth', textureDensity: 'auto', material: 'alphatest',
      }],
    };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('rejects a painting missing slugLocked', () => {
    const bad = {
      ...minimalProject,
      paintings: [{
        id: 'p1', name: 'a',
        slug: 'a_uuid8', slugVersion: 1,
        canvasW16: 16, canvasH16: 16,
        source: null,
        transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
        resampling: 'smooth', textureDensity: 'auto', material: 'alphatest',
      }],
    };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });
});
