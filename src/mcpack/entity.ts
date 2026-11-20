import type { ProjectState, Painting } from '../paintings/types';
import { entityId, usesPlacerItems } from './identifiers';

type Hitbox = { pivot: [number, number, number]; width: number; height: number };

// ---------------------------------------------------------------------------
// Hitbox math. All values below are in blocks, in the entity-LOCAL hit-test
// frame, i.e. world axes relative to the entity position (entity yaw is
// always forced to 0 by the runtime script, so local == world).
//
// Conventions (see orient_animation.ts for the derivation):
//   * Geometry (model px) -> local blocks: (x, y, z) -> (x, y, -z) / 16.
//     A model's north face (-Z, the painting front) ends up facing +Z
//     (south) at yaw 0 - the same mirror Blockbench applies on export.
//   * Bedrock bone rotation on X by +a is a standard right-handed rotation
//     by -a in model space (calibrated in-game: floor [-90,0,0] -> front up).
//   * custom_hit_test boxes are axis-aligned, centered on `pivot` vertically
//     (pivot.y +- height/2) and with a square width x width XZ footprint.
//
// Painting cube in model px: x [-8, W-8], y [0, H], z [6, 7]  (geometry.ts)
//   wall    (no root anim):           y [0, H],  z [6, 7]        -> local z [-7, -6] px
//   floor   (rot X -90, pos 0,8,-8):  (y,z)->(-z, y) + (8,-8)  -> y [1, 2] px,   z [-8, H-8]
//                                                                -> local z [8-H, 8] px
//   ceiling (rot X +90, pos 0,8, 8):  (y,z)->( z,-y) + (8, 8)  -> y [14, 15] px, z [8-H, 8]
//                                                                -> local z [-8, H-8] px
// Sanity check: a 1x1 floor/ceiling painting covers exactly x,z in [-0.5, 0.5],
// i.e. the block it was placed in.
// ---------------------------------------------------------------------------

// Lay out squares of side `s` along [a0, a1] so their union is exactly the
// range: centers step by s and the last one is clamped to end at a1 (a small
// overlap is harmless, an overhang would make empty air clickable).
function tileAxis(a0: number, a1: number, s: number): number[] {
  const n = Math.max(1, Math.ceil((a1 - a0) / s - 1e-9));
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.min(a0 + s / 2 + i * s, a1 - s / 2));
  return out;
}

// Wall: vertical plane along X, front face at local z = -6/16 facing +Z,
// backed by the wall block at z <= -8/16. Columns are as deep as they are
// wide (square footprint) and extend BACKWARD from the front face into the
// wall block, which the player can never reach, so nothing sticks out.
function wallHitboxes(W: number, H: number): Hitbox[] {
  const s = Math.min(1, W);
  const zCenter = -6 / 16 - s / 2;
  return tileAxis(-0.5, W - 0.5, s).map((x) => ({ pivot: [x, H / 2, zCenter], width: s, height: H }));
}

// Floor/ceiling: horizontal slab. Squares of side min(1, shorter side) tile
// the W x H footprint exactly. The slab spans from the painting face to the
// block surface so no click falls through the 1px gap.
function flatHitboxes(W: number, H: number, zRange: [number, number], yRange: [number, number]): Hitbox[] {
  const s = Math.min(1, W, H);
  const out: Hitbox[] = [];
  const yc = (yRange[0] + yRange[1]) / 2;
  const h = yRange[1] - yRange[0];
  for (const x of tileAxis(-0.5, W - 0.5, s)) {
    for (const z of tileAxis(zRange[0], zRange[1], s)) out.push({ pivot: [x, yc, z], width: s, height: h });
  }
  return out;
}

// Rotate hitboxes around local Y by d * 90 deg, matching the root yaw the
// client animation applies (painting_orient.yaw: rotation Y = d * 90, which
// in Bedrock turns the model the same way as entity yaw: +Z -> -X).
// One step: (x, z) -> (-z, x). The square footprint is invariant.
function rotateHitboxesAroundY(hitboxes: Hitbox[], d: number): Hitbox[] {
  const s = ((d % 4) + 4) % 4;
  return hitboxes.map((h) => {
    let [x, y, z] = h.pivot;
    for (let i = 0; i < s; i++) [x, z] = [-z, x];
    return { pivot: [x + 0, y, z + 0] as [number, number, number], width: h.width, height: h.height };
  });
}

// Index d = number of +90 deg yaw steps. Labels are the direction the
// painting FRONT faces on a wall at that d: d=0 front faces south (+Z),
// d=1 west, d=2 north, d=3 east. Clicking a block's South face therefore
// produces d=0 (see FACE_TO_D in script.ts).
export const ORIENTED_DIRS = ['south', 'west', 'north', 'east'] as const;
// mark_variant tens digit encodes the surface; units digit = d + 1 (1..4).
// The client yaw animation reads the units digit back.
const ORIENTED_VARIANT_BASE = { wall: 11, floor: 21, ceiling: 31 } as const;

export function orientedHitboxes(W: number, H: number, surface: 'wall' | 'floor' | 'ceiling', d: number): Hitbox[] {
  const base = surface === 'wall'
    ? wallHitboxes(W, H)
    : surface === 'floor'
      ? flatHitboxes(W, H, [0.5 - H, 0.5], [0, 2 / 16])
      : flatHitboxes(W, H, [-0.5, H - 0.5], [14 / 16, 1]);
  return rotateHitboxesAroundY(base, d);
}

export function buildEntityBehavior(p: ProjectState, painting: Painting) {
  const width = Math.max(painting.canvasW16 / 16, 1 / 16);
  const height = Math.max(painting.canvasH16 / 16, 1 / 16);
  const family = `${p.pack.namespace}_painting`;

  // 4 yaw steps x 3 surfaces = 12 component groups + instant_despawn.
  const componentGroups: Record<string, unknown> = {
    instant_despawn: { 'minecraft:instant_despawn': {} },
  };
  const events: Record<string, unknown> = {
    despawn_self: { add: { component_groups: ['instant_despawn'] } },
  };
  for (const surface of ['wall', 'floor', 'ceiling'] as const) {
    for (let i = 0; i < ORIENTED_DIRS.length; i++) {
      const dir = ORIENTED_DIRS[i];
      const groupName = `oriented_${surface}_${dir}`;
      componentGroups[groupName] = {
        'minecraft:mark_variant': { value: ORIENTED_VARIANT_BASE[surface] + i },
        'minecraft:custom_hit_test': {
          hitboxes: orientedHitboxes(width, height, surface, i),
        },
      };
      events[`set_${groupName}`] = { add: { component_groups: [groupName] } };
    }
  }

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
      events,
      component_groups: componentGroups,
    },
  };
}
