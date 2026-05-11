import type { ProjectState, Painting } from '../paintings/types';
import {
  entityId, paintingFileBase, geometryName, renderControllerName, spawnEggTextureKey,
} from './identifiers';
import { BACK_RENDER_CONTROLLER_NAME, BACK_TEXTURE_FILENAME } from './back_texture';

export function buildClientEntity(p: ProjectState, painting: Painting) {
  const fb = paintingFileBase(painting.id);
  const material = painting.material === 'alphablend' ? 'entity_alphablend' : 'entity_alphatest';
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: entityId(p.pack.namespace, painting.id),
        materials: { default: material, back: material },
        textures: {
          default: `textures/entity/${fb}`,
          back: `textures/entity/${BACK_TEXTURE_FILENAME}`,
        },
        geometry: { default: geometryName(painting.id) },
        render_controllers: [
          renderControllerName(painting.id),
          BACK_RENDER_CONTROLLER_NAME,
        ],
        spawn_egg: { texture: spawnEggTextureKey(painting.id), texture_index: 0 },
      },
    },
  };
}
