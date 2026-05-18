import type { ProjectState } from '../paintings/types';
import { paintingItemId, spawnEggItemId, usesPlacerItems } from './identifiers';

export function buildCatalog(p: ProjectState) {
  if (p.paintings.length === 0) return null;
  const first = p.paintings[0];
  // Pick the real item id Bedrock will resolve: placer item in v3, the
  // auto-generated spawn egg in legacy v2 builds.
  const itemId = usesPlacerItems(p)
    ? (pt: typeof first) => paintingItemId(p.pack.namespace, pt)
    : (pt: typeof first) => spawnEggItemId(p.pack.namespace, pt);
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
            // Icon must be a real item identifier - first painting's actual item.
            icon: itemId(first),
          },
          items: p.paintings.map(itemId),
        }],
      }],
    },
  };
}
