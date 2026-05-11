import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../paintings/defaults';
import { buildBpManifest, buildRpManifest } from './manifest';

describe('manifest', () => {
  it('builds a BP manifest with header, data + script modules, and RP+@minecraft/server deps', () => {
    const proj = createEmptyProject();
    const m = buildBpManifest(proj);
    expect(m.format_version).toBe(2);
    expect(m.header.uuid).toBe(proj.uuids.bpHeader);
    expect(m.header.version).toEqual(proj.pack.semver);
    expect(m.header.min_engine_version).toEqual(proj.pack.minEngineVersion);
    expect(m.modules.length).toBe(2);
    expect(m.modules[0].type).toBe('data');
    expect(m.modules[1].type).toBe('script');
    expect(m.modules[1].entry).toBe('scripts/main.js');
    expect(m.dependencies).toContainEqual({ uuid: proj.uuids.rpHeader, version: proj.pack.semver });
    expect(m.dependencies).toContainEqual({ module_name: '@minecraft/server', version: '2.4.0' });
  });

  it('builds an RP manifest with header and resources module + BP dep', () => {
    const proj = createEmptyProject();
    const m = buildRpManifest(proj);
    expect(m.header.uuid).toBe(proj.uuids.rpHeader);
    expect(m.modules[0].type).toBe('resources');
    expect(m.dependencies).toContainEqual({ uuid: proj.uuids.bpHeader, version: proj.pack.semver });
  });
});
