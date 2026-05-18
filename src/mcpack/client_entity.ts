import type { ProjectState, Painting } from '../paintings/types';
import {
  entityId, paintingFileBase, geometryName, renderControllerName,
  spawnEggTextureKey, usesPlacerItems,
} from './identifiers';
import { BACK_RENDER_CONTROLLER_NAME, BACK_TEXTURE_FILENAME } from './back_texture';

export function buildClientEntity(p: ProjectState, painting: Painting) {
  const fb = paintingFileBase(painting);
  const material = painting.material === 'alphablend' ? 'entity_alphablend' : 'entity_alphatest';
  // Legacy v2 registers the per-painting spawn-egg texture so the auto-generated
  // egg picks up the painting thumbnail. v3 has no spawn egg, so the field is
  // simply absent.
  const spawn_egg = usesPlacerItems(p)
    ? undefined
    : { texture: spawnEggTextureKey(painting), texture_index: 0 };
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: entityId(p.pack.namespace, painting),
        materials: { default: material, back: material },
        textures: {
          default: `textures/entity/${fb}`,
          back: `textures/entity/${BACK_TEXTURE_FILENAME}`,
        },
        geometry: { default: geometryName(painting) },
        render_controllers: [
          renderControllerName(painting),
          BACK_RENDER_CONTROLLER_NAME,
        ],
        ...(spawn_egg ? { spawn_egg } : {}),
      },
    },
  };
}
