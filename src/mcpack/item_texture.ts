import type { ProjectState } from '../paintings/types';
import { spawnEggTextureKey } from './identifiers';

export function buildItemTexture(p: ProjectState) {
  const texture_data: Record<string, { textures: string }> = {};
  for (const pt of p.paintings) {
    const k = spawnEggTextureKey(pt.id);
    texture_data[k] = { textures: `textures/items/${k}` };
  }
  return {
    resource_pack_name: p.pack.name,
    texture_name: 'atlas.items',
    texture_data,
  };
}
