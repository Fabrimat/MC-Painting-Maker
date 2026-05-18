import type { ProjectState, Painting } from '../paintings/types';
import {
  entityId, paintingItemId, paintingIconTextureKey, paintingNameSlug,
} from './identifiers';

// Lang key Bedrock looks up for the item's hover text. Kept UUID-free for
// readability of the .lang file - uniqueness is enforced by the item's
// identifier (which carries the UUID), not by this display-name key.
export function paintingItemNameLangKey(namespace: string, painting: { slug: string }): string {
  return `item.${namespace}:${paintingNameSlug(painting)}_painting.name`;
}

// One custom item per painting. Used to be auto-generated spawn eggs, but those
// land in a fixed creative category and clutter the inventory with mob-like UI.
// A bespoke item with minecraft:entity_placer gives us full control over icon,
// display name, and stack size while still placing the painting entity on use.
export function buildItem(p: ProjectState, painting: Painting) {
  return {
    format_version: '1.21.40',
    'minecraft:item': {
      description: {
        identifier: paintingItemId(p.pack.namespace, painting),
      },
      components: {
        'minecraft:icon': {
          textures: { default: paintingIconTextureKey(painting) },
        },
        'minecraft:display_name': {
          value: paintingItemNameLangKey(p.pack.namespace, painting),
        },
        'minecraft:max_stack_size': 64,
        'minecraft:entity_placer': {
          entity: entityId(p.pack.namespace, painting),
        },
      },
    },
  };
}
