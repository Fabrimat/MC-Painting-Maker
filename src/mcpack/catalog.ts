import type { ProjectState } from '../paintings/types';
import { paintingItemId } from './identifiers';

export function buildCatalog(p: ProjectState) {
  if (p.paintings.length === 0) return null;
  const first = p.paintings[0];
  return {
    format_version: '1.21.60',
    'minecraft:crafting_items_catalog': {
      categories: [{
        // Paintings are decoration items, so the 'items' category is the natural
        // home. The group is namespaced so it cannot collide with vanilla groups.
        category_name: 'items',
        groups: [{
          group_identifier: {
            name: `${p.pack.namespace}:paintings`,
            // Icon must be a real item identifier - use the first painting's placer.
            icon: paintingItemId(p.pack.namespace, first),
          },
          items: p.paintings.map((pt) => paintingItemId(p.pack.namespace, pt)),
        }],
      }],
    },
  };
}
