import type { ProjectState, Painting } from '../paintings/types';
import { entityId } from './identifiers';

// Matches X_ORIGIN_PX in geometry.ts (8 pixels = 0.5 blocks) so the hit area
// stays flush with the rendered painting after the model's +X shift.
const X_PIVOT_OFFSET_BLOCKS = 8 / 16;

export function buildEntityBehavior(p: ProjectState, painting: Painting) {
  const W = painting.canvasW16 / 16;
  const H = painting.canvasH16 / 16;
  const width = Math.max(W, 1 / 16);
  const height = Math.max(H, 1 / 16);
  const family = `${p.pack.namespace}_painting`;

  return {
    format_version: '1.21.0',
    'minecraft:entity': {
      description: {
        identifier: entityId(p.pack.namespace, painting),
        is_spawnable: true,
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
          }],
        },
        'minecraft:nameable': { allow_name_tag_renaming: false },
      },
      events: {
        despawn_self: { add: { component_groups: ['instant_despawn'] } },
      },
      component_groups: {
        instant_despawn: { 'minecraft:instant_despawn': {} },
      },
    },
  };
}
