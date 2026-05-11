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
    lines.push(`item.${spawnEggItemId(p.pack.namespace, pt.id)}.name=${langSafe(pt.name)}`);
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
