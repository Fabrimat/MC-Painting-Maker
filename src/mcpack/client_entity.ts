import type { ProjectState, Painting } from '../paintings/types';
import {
  entityId, paintingFileBase, geometryName, renderControllerName,
  spawnEggTextureKey, usesPlacerItems,
} from './identifiers';
import { BACK_RENDER_CONTROLLER_NAME, BACK_TEXTURE_FILENAME } from './back_texture';
import {
  ORIENT_ANIMATION_FLOOR_ID, ORIENT_ANIMATION_CEILING_ID, ORIENT_CONTROLLER_ID,
  ORIENT_FLOOR_SHORTNAME, ORIENT_CEILING_SHORTNAME, ORIENT_CONTROLLER_SHORTNAME,
  ORIENT_ANIMATION_YAW_ID, ORIENT_YAW_SHORTNAME,
} from './orient_animation';

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
        // Animations + controller drive the floor/ceiling pose. The
        // controller reads q.mark_variant (set server-side by the
        // flat_orient_* component groups) and switches to the matching
        // root-bone rotation animation. Wall placements stay in the
        // default state with no rotation.
        animations: {
          [ORIENT_FLOOR_SHORTNAME]: ORIENT_ANIMATION_FLOOR_ID,
          [ORIENT_CEILING_SHORTNAME]: ORIENT_ANIMATION_CEILING_ID,
          [ORIENT_CONTROLLER_SHORTNAME]: ORIENT_CONTROLLER_ID,
          [ORIENT_YAW_SHORTNAME]: ORIENT_ANIMATION_YAW_ID,
        },
        scripts: {
          animate: [ORIENT_CONTROLLER_SHORTNAME, ORIENT_YAW_SHORTNAME],
        },
        ...(spawn_egg ? { spawn_egg } : {}),
      },
    },
  };
}
