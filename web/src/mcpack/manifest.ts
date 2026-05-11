import type { ProjectState } from '../paintings/types';

export const SCRIPT_MODULE_VERSION = '2.4.0';

export function buildBpManifest(p: ProjectState) {
  return {
    format_version: 2,
    header: {
      name: 'pack.name',
      description: 'pack.description',
      uuid: p.uuids.bpHeader,
      version: p.pack.semver,
      min_engine_version: p.pack.minEngineVersion,
    },
    modules: [
      { type: 'data', uuid: p.uuids.bpModule, version: p.pack.semver },
      {
        type: 'script',
        uuid: p.uuids.bpScriptModule,
        version: p.pack.semver,
        language: 'javascript',
        entry: 'scripts/main.js',
      },
    ],
    dependencies: [
      { uuid: p.uuids.rpHeader, version: p.pack.semver },
      { module_name: '@minecraft/server', version: SCRIPT_MODULE_VERSION },
    ],
  };
}

export function buildRpManifest(p: ProjectState) {
  return {
    format_version: 2,
    header: {
      name: 'pack.name',
      description: 'pack.description',
      uuid: p.uuids.rpHeader,
      version: p.pack.semver,
      min_engine_version: p.pack.minEngineVersion,
    },
    modules: [{ type: 'resources', uuid: p.uuids.rpModule, version: p.pack.semver }],
    dependencies: [{ uuid: p.uuids.bpHeader, version: p.pack.semver }],
  };
}
