import type { ProjectState } from '../paintings/types';
import { paintingIconTextureKey, spawnEggTextureKey, usesPlacerItems } from './identifiers';

export function buildItemTexture(p: ProjectState) {
  const texture_data: Record<string, { textures: string }> = {};
  // v3 maps the placer item's icon key; v2 still maps the spawn-egg texture
  // key referenced from client_entity.spawn_egg.texture.
  const textureKey = usesPlacerItems(p) ? paintingIconTextureKey : spawnEggTextureKey;
  for (const pt of p.paintings) {
    const k = textureKey(pt);
    texture_data[k] = { textures: `textures/items/${k}` };
  }
  return {
    resource_pack_name: p.pack.name,
    texture_name: 'atlas.items',
    texture_data,
  };
}
