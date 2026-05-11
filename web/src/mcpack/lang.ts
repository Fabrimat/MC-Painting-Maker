import type { ProjectState } from '../paintings/types';
import { entityId, spawnEggItemId } from './identifiers';

// .lang values cannot contain newlines or carriage returns; the manifest uses pack.name
// / pack.description placeholders that resolve via these keys.
function langSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

function packHeader(p: ProjectState): string[] {
  return [
    `pack.name=${langSafe(p.pack.name)}`,
    `pack.description=${langSafe(p.pack.description)}`,
  ];
}

export function buildBpLang(p: ProjectState): string {
  const lines: string[] = [
    ...packHeader(p),
    `itemGroup.name.${p.pack.namespace}:paintings=${langSafe(p.pack.creativeGroupName)}`,
  ];
  for (const pt of p.paintings) {
    const eid = entityId(p.pack.namespace, pt.id);
    const itemId = spawnEggItemId(p.pack.namespace, pt.id);
    const safeName = langSafe(pt.name);
    // Bedrock has used multiple key formats for auto-generated spawn egg names across
    // versions. Emit all known forms so the right one always resolves:
    //   item.spawn_egg.entity.<entity>.name   — modern form (1.19+)
    //   item.<entity>_spawn_egg.name          — fallback form
    //   entity.<entity>.name                  — final fallback used as "Spawn <X>"
    lines.push(`item.spawn_egg.entity.${eid}.name=${safeName}`);
    lines.push(`item.${itemId}.name=${safeName}`);
  }
  return lines.join('\n') + '\n';
}

export function buildRpLang(p: ProjectState): string {
  const lines: string[] = [...packHeader(p)];
  for (const pt of p.paintings) {
    lines.push(`entity.${entityId(p.pack.namespace, pt.id)}.name=${langSafe(pt.name)}`);
  }
  return lines.join('\n') + '\n';
}

export const LANGUAGES_JSON = JSON.stringify(['en_US']);
