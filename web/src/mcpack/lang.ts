import type { ProjectState } from '../paintings/types';
import { entityId, spawnEggItemId } from './identifiers';

export function buildBpLang(p: ProjectState): string {
  const lines: string[] = [];
  lines.push(`itemGroup.name.${p.pack.namespace}:paintings=${p.pack.creativeGroupName}`);
  for (const pt of p.paintings) {
    lines.push(`item.${spawnEggItemId(p.pack.namespace, pt.id)}.name=${pt.name}`);
  }
  return lines.join('\n') + '\n';
}

export function buildRpLang(p: ProjectState): string {
  const lines: string[] = [];
  for (const pt of p.paintings) {
    lines.push(`entity.${entityId(p.pack.namespace, pt.id)}.name=${pt.name}`);
  }
  return lines.join('\n') + '\n';
}

export const LANGUAGES_JSON = JSON.stringify(['en_US']);
