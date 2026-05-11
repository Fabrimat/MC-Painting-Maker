import type { ProjectState } from '../paintings/types';
import { entityId, spawnEggItemId } from './identifiers';

// .lang values cannot contain newlines or carriage returns; the manifest uses pack.name
// / pack.description placeholders that resolve via these keys.
function langSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

// All user-visible string keys. Emitted into BOTH BP and RP lang files because:
//   - pack.name / pack.description: required in the lang of the pack whose manifest
//     references them. BP manifest references its own pack.name, RP manifest references
//     its own pack.name - each side reads its own .lang.
//   - itemGroup.name.*: read from BP because the crafting catalog lives in BP.
//   - item.* and entity.*: vanilla Bedrock looks for these in the RP lang.
// Duplicating the keys in both files is harmless (the lookup just picks whichever side
// resolves first) and guarantees the right key is always present where Bedrock looks.
function commonKeys(p: ProjectState): string[] {
  const lines: string[] = [
    `pack.name=${langSafe(p.pack.name)}`,
    `pack.description=${langSafe(p.pack.description)}`,
    `itemGroup.name.${p.pack.namespace}:paintings=${langSafe(p.pack.creativeGroupName)}`,
  ];
  for (const pt of p.paintings) {
    const eid = entityId(p.pack.namespace, pt);
    const itemId = spawnEggItemId(p.pack.namespace, pt);
    const safeName = langSafe(pt.name);
    // Entity display name - used when the mob is named or seen in dialogs.
    lines.push(`entity.${eid}.name=${safeName}`);
    // Spawn egg display names - Bedrock has changed format across versions, so emit
    // every documented form to guarantee one resolves:
    //   item.spawn_egg.entity.<entity>.name   - modern form (1.19+)
    //   item.<entity>_spawn_egg.name          - fallback form
    lines.push(`item.spawn_egg.entity.${eid}.name=${safeName}`);
    lines.push(`item.${itemId}.name=${safeName}`);
  }
  return lines;
}

export function buildBpLang(p: ProjectState): string {
  return commonKeys(p).join('\n') + '\n';
}

export function buildRpLang(p: ProjectState): string {
  return commonKeys(p).join('\n') + '\n';
}

export const LANGUAGES_JSON = JSON.stringify(['en_US']);
