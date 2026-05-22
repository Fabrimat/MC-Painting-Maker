import type { ProjectState, Painting } from '../paintings/types';
import { entityId, usesPlacerItems } from './identifiers';

// Matches X_ORIGIN_PX in geometry.ts (-8 pixels = -0.5 blocks) so the hit
// area stays flush with the rendered painting after the model's X shift.
const X_PIVOT_OFFSET_BLOCKS = -8 / 16;

export function buildEntityBehavior(p: ProjectState, painting: Painting) {
  const W = painting.canvasW16 / 16;
  const H = painting.canvasH16 / 16;
  const width = Math.max(W, 1 / 16);
  const height = Math.max(H, 1 / 16);
  // For floor/ceiling orientations the painting plane is horizontal in world,
  // so the AABB hitbox is a thin slab. custom_hit_test only exposes width and
  // height (square footprint), so we pick max(W,H) to cover the long side and
  // accept a small overhang on the short side.
  const flatFootprint = Math.max(W, H, 1 / 16);
  const family = `${p.pack.namespace}_painting`;

  return {
    format_version: '1.21.0',
    'minecraft:entity': {
      description: {
        identifier: entityId(p.pack.namespace, painting),
        // v3 ships custom placer items, so the auto-egg pipeline is disabled to
        // avoid duplicate inventory entries next to the real placer items.
        // v2 keeps `is_spawnable: true` so legacy addons keep producing the
        // spawn egg their users already have in their hotbars.
        is_spawnable: !usesPlacerItems(p),
        is_summonable: true,
        is_experimental: false,
      },
      components: {
        'minecraft:type_family': { family: [family, 'inanimate'] },
        'minecraft:collision_box': { width: 0, height: 0 },
        'minecraft:custom_hit_test': {
          hitboxes: [{ pivot: [width / 2 + X_PIVOT_OFFSET_BLOCKS, height / 2, -7 / 16], width, height }],
        },
        'minecraft:physics': { has_collision: false, has_gravity: false },
        'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: false },
        'minecraft:knockback_resistance': { value: 1000, max: 1000 },
        'minecraft:health': { value: 1, max: 1 },
        'minecraft:damage_sensor': {
          triggers: [{
            on_damage: {
              filters: { test: 'is_family', subject: 'other', value: 'player' },
              event: 'despawn_self',
              target: 'self',
            },
            deals_damage: 'no',
            cause: 'all',
          }],
        },
        'minecraft:nameable': { allow_name_tag_renaming: false },
      },
      events: {
        despawn_self: { add: { component_groups: ['instant_despawn'] } },
        set_flat_orient_floor: { add: { component_groups: ['flat_orient_floor'] } },
        set_flat_orient_ceiling: { add: { component_groups: ['flat_orient_ceiling'] } },
      },
      component_groups: {
        instant_despawn: { 'minecraft:instant_despawn': {} },
        // Floor / ceiling component groups carry both the rotated hitbox AND a
        // mark_variant value that the client-side animation controller reads
        // via Molang to play the matching root-bone rotation animation.
        //
        // The dimensions are flat: a square footprint covering the long side
        // of the canvas, 1 pixel thin in world Y. The pivot is identical to
        // the wall hitbox in entity-local space.
        flat_orient_floor: {
          'minecraft:mark_variant': { value: 1 },
          'minecraft:custom_hit_test': {
            hitboxes: [{
              pivot: [width / 2 + X_PIVOT_OFFSET_BLOCKS, height / 2, -7 / 16],
              width: flatFootprint,
              height: 1 / 16,
            }],
          },
        },
        flat_orient_ceiling: {
          'minecraft:mark_variant': { value: 2 },
          'minecraft:custom_hit_test': {
            hitboxes: [{
              pivot: [width / 2 + X_PIVOT_OFFSET_BLOCKS, height / 2, -7 / 16],
              width: flatFootprint,
              height: 1 / 16,
            }],
          },
        },
      },
    },
  };
}
