import type { ProjectState } from '../paintings/types';
import { entityId, spawnEggItemId, usesPlacerItems } from './identifiers';
import { paintingItemNameLangKey } from './item';

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
  const groupName = `${p.pack.namespace}:paintings`;
  const groupLabel = langSafe(p.pack.creativeGroupName);
  const lines: string[] = [
    `pack.name=${langSafe(p.pack.name)}`,
    `pack.description=${langSafe(p.pack.description)}`,
  ];
  // v3: full group name doubles as the lang key per the Microsoft crafting
  // catalog docs; also emit the legacy `itemGroup.name.<group>` form for older
  // Bedrock versions. v2 builds only the legacy form, matching how the auto
  // spawn-egg pipeline resolved the group label before the placer migration.
  if (usesPlacerItems(p)) {
    lines.push(`${groupName}=${groupLabel}`);
  }
  lines.push(`itemGroup.name.${groupName}=${groupLabel}`);
  const itemKeysWritten = new Set<string>();
  for (const pt of p.paintings) {
    const eid = entityId(p.pack.namespace, pt);
    const safeName = langSafe(pt.name);
    // Entity display name - used when the mob is named or seen in dialogs.
    // Has to carry the full slug (including UUID) because Bedrock looks up
    // entity names by the exact entity identifier, which we can't decouple.
    lines.push(`entity.${eid}.name=${safeName}`);
    if (usesPlacerItems(p)) {
      // Custom placer item display name. The item references this key from its
      // `minecraft:display_name` component (see mcpack/item.ts). Dedup so two
      // paintings whose names normalize identically don't produce duplicate keys.
      const itemKey = paintingItemNameLangKey(p.pack.namespace, pt);
      if (!itemKeysWritten.has(itemKey)) {
        itemKeysWritten.add(itemKey);
        lines.push(`${itemKey}=${safeName}`);
      }
    } else {
      // Legacy spawn-egg display name. Bedrock has changed the lookup format
      // across versions, so emit every documented form to guarantee one
      // resolves:
      //   item.spawn_egg.entity.<entity>.name   - modern form (1.19+)
      //   item.<entity>_spawn_egg.name          - fallback form
      const eggId = spawnEggItemId(p.pack.namespace, pt);
      lines.push(`item.spawn_egg.entity.${eid}.name=${safeName}`);
      lines.push(`item.${eggId}.name=${safeName}`);
    }
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
