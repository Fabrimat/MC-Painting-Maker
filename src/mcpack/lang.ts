import type { ProjectState } from '../paintings/types';
import { entityId } from './identifiers';
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
    // Per Microsoft's crafting_item_catalog docs, the full group name doubles
    // as the localization key. Older Bedrock versions also resolved a legacy
    // `itemGroup.name.<group>` key, so emit both to stay compatible.
    `${groupName}=${groupLabel}`,
    `itemGroup.name.${groupName}=${groupLabel}`,
  ];
  const itemKeysWritten = new Set<string>();
  for (const pt of p.paintings) {
    const eid = entityId(p.pack.namespace, pt);
    const safeName = langSafe(pt.name);
    // Entity display name - used when the mob is named or seen in dialogs.
    // Has to carry the full slug (including UUID) because Bedrock looks up
    // entity names by the exact entity identifier, which we can't decouple.
    lines.push(`entity.${eid}.name=${safeName}`);
    // Custom placer item display name. The item references this key from its
    // `minecraft:display_name` component (see mcpack/item.ts). Dedup so two
    // paintings whose names normalize identically don't produce duplicate keys.
    const itemKey = paintingItemNameLangKey(p.pack.namespace, pt);
    if (!itemKeysWritten.has(itemKey)) {
      itemKeysWritten.add(itemKey);
      lines.push(`${itemKey}=${safeName}`);
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
