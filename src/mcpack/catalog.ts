import type { ProjectState } from '../paintings/types';
import { spawnEggItemId } from './identifiers';

export function buildCatalog(p: ProjectState) {
  if (p.paintings.length === 0) return null;
  const first = p.paintings[0];
  return {
    format_version: '1.21.60',
    'minecraft:crafting_items_catalog': {
      categories: [{
        // Auto-generated spawn eggs land in the 'items' category by default in Bedrock.
        // Using a different category here would trigger a "category changed" warning.
        category_name: 'items',
        groups: [{
          group_identifier: {
            name: `${p.pack.namespace}:paintings`,
            // Must reference a real item identifier - the spawn egg, not the entity.
            icon: spawnEggItemId(p.pack.namespace, first),
          },
          items: p.paintings.map((pt) => spawnEggItemId(p.pack.namespace, pt)),
        }],
      }],
    },
  };
}
