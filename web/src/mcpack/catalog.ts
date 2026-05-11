import type { ProjectState } from '../paintings/types';
import { entityId, spawnEggItemId } from './identifiers';

export function buildCatalog(p: ProjectState) {
  if (p.paintings.length === 0) return null;
  const first = p.paintings[0];
  return {
    format_version: '1.21.60',
    'minecraft:crafting_items_catalog': {
      categories: [{
        category_name: 'equipment',
        groups: [{
          group_identifier: {
            name: `${p.pack.namespace}:paintings`,
            icon: entityId(p.pack.namespace, first.id),
          },
          items: p.paintings.map((pt) => spawnEggItemId(p.pack.namespace, pt.id)),
        }],
      }],
    },
  };
}
