import type { ProjectState, Painting } from '../paintings/types';
import { entityId, usesPlacerItems } from './identifiers';

// Matches X_ORIGIN_PX in geometry.ts (-8 pixels = -0.5 blocks) so the hit
// area stays flush with the rendered painting after the model's X shift.
const X_PIVOT_OFFSET_BLOCKS = -8 / 16;

type Hitbox = { pivot: [number, number, number]; width: number; height: number };

// Tile a rectangular ground plane (Y-thin slab) with unit (1x1) hitboxes so
// each painting block of canvas gets its own clickable cell. custom_hit_test
// forces a square footprint per hitbox, so a single hitbox cannot cover a
// non-square painting without overhang; tiling is the only way to get
// accurate coverage. Sub-block paintings collapse to a single right-sized
// hitbox to avoid an oversized 1x1 hit area on tiny canvases.
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

// Tile a vertical wall plane with column-shaped hitboxes (1 wide x H tall x 1
// deep). One column per canvas block of width. Z extent overshoots the
// painting's 1/16 thickness but custom_hit_test forces a square XZ footprint,
// so this is the closest we can get without exploding the hitbox count.
function tileColumnHitboxes(
  xRange: [number, number],
  yCenter: number,
  yHeight: number,
  zCenter: number,
): Hitbox[] {
  const w = xRange[1] - xRange[0];
  if (w <= 1) {
    return [{
      pivot: [(xRange[0] + xRange[1]) / 2, yCenter, zCenter],
      width: Math.max(w, 1 / 16),
      height: yHeight,
    }];
  }
  const tilesX = Math.ceil(w);
  const out: Hitbox[] = [];
  for (let i = 0; i < tilesX; i++) {
    out.push({
      pivot: [xRange[0] + i + 0.5, yCenter, zCenter],
      width: 1,
      height: yHeight,
    });
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
  const WALL_X: [number, number] = [-0.5, width - 0.5];
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
        // No default custom_hit_test: hitboxes are added only via the
        // direction-specific component groups below, so the player can only
        // click the entity after the script has assigned it an orientation.
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
        set_oriented_wall: { add: { component_groups: ['oriented_wall'] } },
        set_oriented_floor: { add: { component_groups: ['oriented_floor'] } },
        set_oriented_ceiling: { add: { component_groups: ['oriented_ceiling'] } },
      },
      component_groups: {
        instant_despawn: { 'minecraft:instant_despawn': {} },
        // One component group per placement surface. The script picks which
        // event to trigger based on intent.face. Each group carries:
        //   - minecraft:mark_variant so the client animation controller can
        //     read q.mark_variant via Molang and pick the matching pose;
        //   - minecraft:custom_hit_test sized to the visible painting plane
        //     for that surface, with no general (default) hitbox to fall back
        //     on - clickability requires an orientation to be set.
        //
        // Wall variant: one column-shaped hitbox per canvas block of width,
        // each 1 wide x H tall x 1 deep. mark_variant 3 leaves the model in
        // the controller's default state (no root rotation).
        oriented_wall: {
          'minecraft:mark_variant': { value: 3 },
          'minecraft:custom_hit_test': {
            hitboxes: tileColumnHitboxes(WALL_X, height / 2, height, -7 / 16),
          },
        },
        // Floor variant: one square hitbox (1x1x(1/16)) per canvas block,
        // tiled across the painting's post-rotation footprint.
        oriented_floor: {
          'minecraft:mark_variant': { value: 1 },
          'minecraft:custom_hit_test': {
            hitboxes: tileFlatHitboxes(FLOOR_X, FLOOR_Y_CENTER, FLOOR_Z, 1 / 16),
          },
        },
        // Ceiling variant: same shape as floor, positioned for the painting's
        // post-rotation footprint hanging from above.
        oriented_ceiling: {
          'minecraft:mark_variant': { value: 2 },
          'minecraft:custom_hit_test': {
            hitboxes: tileFlatHitboxes(CEILING_X, CEILING_Y_CENTER, CEILING_Z, 1 / 16),
          },
        },
      },
    },
  };
}
