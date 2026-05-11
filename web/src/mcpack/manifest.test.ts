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
    expect(m.modules[1].language).toBe('javascript');
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

  it('produces stable UUIDs across repeated builds with the same state', () => {
    const proj = createEmptyProject();
    const a = buildBpManifest(proj);
    const b = buildBpManifest(proj);
    expect(a.header.uuid).toBe(b.header.uuid);
    expect(a.modules[0].uuid).toBe(b.modules[0].uuid);
    expect(a.modules[1].uuid).toBe(b.modules[1].uuid);
    expect(a.dependencies[0]).toEqual(b.dependencies[0]);
    const ra = buildRpManifest(proj);
    const rb = buildRpManifest(proj);
    expect(ra.header.uuid).toBe(rb.header.uuid);
    expect(ra.modules[0].uuid).toBe(rb.modules[0].uuid);
  });
});
