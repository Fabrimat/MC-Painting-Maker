import type { ProjectState, Painting } from '../paintings/types';
import { entityId, usesPlacerItems } from './identifiers';

// Matches X_ORIGIN_PX in geometry.ts (-8 pixels = -0.5 blocks) so the hit
// area stays flush with the rendered painting after the model's X shift.
const X_PIVOT_OFFSET_BLOCKS = -8 / 16;

// Tile a rectangular ground plane with unit (1x1) hitboxes so each painting
// block of canvas gets its own clickable cell. custom_hit_test forces a
// square footprint per hitbox, so a single hitbox cannot cover a non-square
// painting without overhang; tiling is the only way to get accurate coverage.
// For paintings smaller than one block on both axes a single right-sized
// hitbox is returned, avoiding an oversized 1x1 hit area on tiny canvases.
type Hitbox = { pivot: [number, number, number]; width: number; height: number };
function tileFlatHitboxes(
  xRange: [number, number],
  yCenter: number,
  zRange: [number, number],
  yHeight: number,
): Hitbox[] {
  const w = xRange[1] - xRange[0];
  const d = zRange[1] - zRange[0];
  if (w <= 1 && d <= 1) {
    return [{
      pivot: [(xRange[0] + xRange[1]) / 2, yCenter, (zRange[0] + zRange[1]) / 2],
      width: Math.max(w, d, 1 / 16),
      height: yHeight,
    }];
  }
  const tilesX = Math.ceil(w);
  const tilesZ = Math.ceil(d);
  const out: Hitbox[] = [];
  for (let i = 0; i < tilesX; i++) {
    for (let j = 0; j < tilesZ; j++) {
      out.push({
        pivot: [xRange[0] + i + 0.5, yCenter, zRange[0] + j + 0.5],
        width: 1,
        height: yHeight,
      });
    }
  }
  return out;
}

export function buildEntityBehavior(p: ProjectState, painting: Painting) {
  const W = painting.canvasW16 / 16;
  const H = painting.canvasH16 / 16;
  const width = Math.max(W, 1 / 16);
  const height = Math.max(H, 1 / 16);
  const family = `${p.pack.namespace}_painting`;

  // Visual extents (in entity-local blocks) of the painting plane after the
  // root bone is rotated and translated by the orient animations. Derived by
  // composing the geometry cube (origin [-8, 0, 6] px, size [W_px, H_px, 1])
  // with rotation+position from painting_orient.animation.json:
  //   floor   (rot [-90,0,0], pos [0, 8, -8]):  Y -> [14,15] px, Z -> [-H-8,-8] px
  //   ceiling (rot [+90,0,0], pos [0, 8,  8]):  Y -> [ 1, 2] px, Z -> [   8, H+8] px
  //   X is unchanged in both cases: [-0.5, W-0.5] blocks.
  // Hitbox Y is centered on the painting face slab (14.5 / 1.5 px in blocks).
  const FLOOR_X: [number, number] = [-0.5, width - 0.5];
  const FLOOR_Z: [number, number] = [-(height + 0.5), -0.5];
  const FLOOR_Y_CENTER = 14.5 / 16;
  const CEILING_X: [number, number] = [-0.5, width - 0.5];
  const CEILING_Z: [number, number] = [0.5, height + 0.5];
  const CEILING_Y_CENTER = 1.5 / 16;

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
        // Floor / ceiling component groups carry both the rotated hitbox set
        // AND a mark_variant value that the client-side animation controller
        // reads via Molang to play the matching root-bone rotation animation.
        //
        // Hitboxes are tiled with 1x1 unit cells covering the painting's
        // visual footprint after the orient animation rotates and translates
        // the geometry. One cell per canvas block so the player can click any
        // part of the painting to interact with it.
        flat_orient_floor: {
          'minecraft:mark_variant': { value: 1 },
          'minecraft:custom_hit_test': {
            hitboxes: tileFlatHitboxes(FLOOR_X, FLOOR_Y_CENTER, FLOOR_Z, 1 / 16),
          },
        },
        flat_orient_ceiling: {
          'minecraft:mark_variant': { value: 2 },
          'minecraft:custom_hit_test': {
            hitboxes: tileFlatHitboxes(CEILING_X, CEILING_Y_CENTER, CEILING_Z, 1 / 16),
          },
        },
      },
    },
  };
}
