import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildEntityBehavior } from './entity';
import { buildGeometry } from './geometry';
import { buildOrientAnimations, ORIENT_ANIMATION_FLOOR_ID, ORIENT_ANIMATION_CEILING_ID } from './orient_animation';
import { paintingFileBase } from './identifiers';

describe('buildEntityBehavior', () => {
  it('v3 project: is_spawnable=false (custom placer item replaces auto egg)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    expect(j['minecraft:entity'].description.identifier).toBe(`paintings:${paintingFileBase(p)}`);
    // Custom placer item replaces the auto spawn egg, so the entity opts out
    // of auto-egg generation to avoid duplicate inventory entries. /summon is
    // still supported as an advanced placement command.
    expect(j['minecraft:entity'].description.is_spawnable).toBe(false);
    expect(j['minecraft:entity'].description.is_summonable).toBe(true);
  });

  it('v2 (legacy) project: is_spawnable=true so the auto spawn egg keeps being generated', () => {
    const proj = { ...createEmptyProject(), version: 2 as const };
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    expect(j['minecraft:entity'].description.is_spawnable).toBe(true);
    expect(j['minecraft:entity'].description.is_summonable).toBe(true);
  });

  it('emits no default custom_hit_test on the base entity (hitboxes only via direction component groups)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('B', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const comps = j['minecraft:entity'].components as any;
    expect(comps['minecraft:custom_hit_test']).toBeUndefined();
    // collision_box stays at zero so the painting blocks nothing in world.
    expect(comps['minecraft:collision_box']).toEqual({ width: 0, height: 0 });
  });

  // -------------------------------------------------------------------------
  // Geometric oracle. Independently re-derives where the rendered painting
  // ends up (from the REAL geometry + animation JSON the pack ships) and
  // checks every one of the 12 hitbox layouts against it, for several sizes.
  // Conventions (see entity.ts header): bone rot X +a == standard rotation
  // by -a; model px -> local blocks is (x, y, -z) / 16; yaw step d turns
  // +Z toward -X (same as entity yaw / bone Y rotation).
  // -------------------------------------------------------------------------
  type V = [number, number, number];
  const DIRS = ['south', 'west', 'north', 'east'] as const;
  const anims = buildOrientAnimations().animations as any;
  const rootAnim: Record<string, { rotation: number[]; position: number[] }> = {
    wall: { rotation: [0, 0, 0], position: [0, 0, 0] },
    floor: anims[ORIENT_ANIMATION_FLOOR_ID].bones.root,
    ceiling: anims[ORIENT_ANIMATION_CEILING_ID].bones.root,
  };

  function toLocal(pPx: V, surface: string, d: number): V {
    const a = (-rootAnim[surface].rotation[0] * Math.PI) / 180;
    const [x, y, z] = pPx;
    const pos = rootAnim[surface].position;
    // standard right-handed rotation about X by `a`, then bone position
    const ry = y * Math.cos(a) - z * Math.sin(a) + pos[1];
    const rz = y * Math.sin(a) + z * Math.cos(a) + pos[2];
    // model -> local (mirror Z), px -> blocks
    const lx = (x + pos[0]) / 16, ly = ry / 16, lz = -rz / 16;
    const psi = (d * Math.PI) / 2;
    return [lx * Math.cos(psi) - lz * Math.sin(psi), ly, lx * Math.sin(psi) + lz * Math.cos(psi)];
  }

  function paintingFor(w16: number, h16: number) {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('G', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = w16; p.canvasH16 = h16;
    proj.paintings.push(p);
    const bones = buildGeometry(p)['minecraft:geometry'][0].bones as any[];
    const cube = bones.find((b) => b.name === 'front').cubes[0];
    return { groups: (buildEntityBehavior(proj, p)['minecraft:entity'] as any).component_groups, cube };
  }

  type HB = { pivot: V; width: number; height: number };
  function inBox(pt: V, hb: HB, eps = 1e-6) {
    const [px, py, pz] = hb.pivot;
    return Math.abs(pt[0] - px) <= hb.width / 2 + eps
      && Math.abs(pt[2] - pz) <= hb.width / 2 + eps
      && Math.abs(pt[1] - py) <= hb.height / 2 + eps;
  }

  const SIZES: [number, number][] = [[16, 16], [48, 16], [16, 32], [24, 32], [8, 4], [40, 48]];
  const EXPECTED_FRONT: Record<string, V> = {
    south: [0, 0, 1], west: [-1, 0, 0], north: [0, 0, -1], east: [1, 0, 0],
  };

  for (const [w16, h16] of SIZES) {
    for (const surface of ['wall', 'floor', 'ceiling'] as const) {
      for (let d = 0; d < 4; d++) {
        it(`hitboxes match the rendered canvas: ${surface}_${DIRS[d]} ${w16}x${h16}px`, () => {
          const { groups, cube } = paintingFor(w16, h16);
          const hbs: HB[] = groups[`oriented_${surface}_${DIRS[d]}`]['minecraft:custom_hit_test'].hitboxes;
          const [ox, oy, oz] = cube.origin as V;
          const [sx, sy] = cube.size as V;
          // Every point of the canvas front face (model plane z = oz) is clickable.
          const N = 8;
          for (let i = 0; i <= N; i++) {
            for (let j = 0; j <= N; j++) {
              const pt = toLocal([ox + (sx * i) / N, oy + (sy * j) / N, oz], surface, d);
              expect(hbs.some((hb) => inBox(pt, hb)), `front point ${pt} uncovered`).toBe(true);
            }
          }
          // Canvas front normal = (0,0,-1) in model space.
          const o = toLocal([0, 0, 0], surface, d);
          const n = toLocal([0, 0, -16], surface, d);
          const normal = n.map((v, k) => Math.round(v - o[k]) + 0) as V;
          if (surface === 'wall') expect(normal).toEqual(EXPECTED_FRONT[DIRS[d]]);
          if (surface === 'floor') expect(normal).toEqual([0, 1, 0]);
          if (surface === 'ceiling') expect(normal).toEqual([0, -1, 0]);
          // No hitbox may stick out in front of the canvas face (clickable air)
          // or past its edges in the face plane; along the normal it must
          // reach the face and may only extend backward into the support.
          const c0 = toLocal([ox, oy, oz], surface, d);
          const c1 = toLocal([ox + sx, oy + sy, oz], surface, d);
          const lo = [0, 1, 2].map((k) => Math.min(c0[k], c1[k]));
          const hi = [0, 1, 2].map((k) => Math.max(c0[k], c1[k]));
          const axis = normal.findIndex((v) => v !== 0);
          const faceCoord = c0[axis];
          for (const hb of hbs) {
            const half = [hb.width / 2, hb.height / 2, hb.width / 2];
            for (let k = 0; k < 3; k++) {
              const min = hb.pivot[k] - half[k];
              const max = hb.pivot[k] + half[k];
              if (k === axis) {
                // Spans exactly the 2px between the supporting block surface
                // and the canvas front: never inside the block, never in the room.
                expect(normal[k] > 0 ? max : min).toBeCloseTo(faceCoord, 6);
                expect(normal[k] > 0 ? min : max).toBeCloseTo(faceCoord - normal[k] * (2 / 16), 6);
              } else {
                expect(min).toBeGreaterThanOrEqual(lo[k] - 1e-6);
                expect(max).toBeLessThanOrEqual(hi[k] + 1e-6);
              }
            }
          }
        });
      }
    }
  }

  it('a 1x1 floor/ceiling painting covers exactly the block it was placed in', () => {
    const { groups } = paintingFor(16, 16);
    for (const surface of ['floor', 'ceiling']) {
      for (const dir of DIRS) {
        const [hb] = groups[`oriented_${surface}_${dir}`]['minecraft:custom_hit_test'].hitboxes;
        expect(hb.pivot[0]).toBeCloseTo(0);
        expect(hb.pivot[2]).toBeCloseTo(0);
        expect(hb.width).toBeCloseTo(1);
      }
    }
    // Floor slab hugs the floor (y 0..2px), ceiling slab hugs the ceiling (14..16px).
    expect(groups.oriented_floor_south['minecraft:custom_hit_test'].hitboxes[0].pivot[1]).toBeCloseTo(1 / 16);
    expect(groups.oriented_ceiling_south['minecraft:custom_hit_test'].hitboxes[0].pivot[1]).toBeCloseTo(15 / 16);
  });

  it('assigns mark_variant tens digit by surface, units digit = d + 1', () => {
    const { groups } = paintingFor(16, 16);
    DIRS.forEach((dir, d) => {
      expect(groups[`oriented_wall_${dir}`]['minecraft:mark_variant'].value).toBe(11 + d);
      expect(groups[`oriented_floor_${dir}`]['minecraft:mark_variant'].value).toBe(21 + d);
      expect(groups[`oriented_ceiling_${dir}`]['minecraft:mark_variant'].value).toBe(31 + d);
    });
  });

  it('clamps zero-size paintings to a single 1/16 hitbox on every group', () => {
    const { groups } = paintingFor(0, 0);
    for (const surface of ['wall', 'floor', 'ceiling']) {
      for (const dir of DIRS) {
        const hb = groups[`oriented_${surface}_${dir}`]['minecraft:custom_hit_test'].hitboxes;
        expect(hb).toHaveLength(1);
        expect(hb[0].width).toBeCloseTo(1 / 16);
      }
    }
  });

  it('adds the painting family to type_family', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('D', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const fam = (j['minecraft:entity'].components as any)['minecraft:type_family'].family;
    expect(fam).toContain('paintings_painting');
    expect(fam).toContain('inanimate');
  });

  it('emits damage_sensor with deals_damage="no", cause="all" and event/target as strings inside on_damage', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('F', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const trigger = (j['minecraft:entity'].components as any)['minecraft:damage_sensor'].triggers[0];
    expect(trigger.deals_damage).toBe('no');
    expect(trigger.cause).toBe('all');
    expect(trigger.on_damage.event).toBe('despawn_self');
    expect(trigger.on_damage.target).toBe('self');
    expect(trigger.event).toBeUndefined();
    expect(trigger.target).toBeUndefined();
  });

  it('emits one set_oriented_<surface>_<dir> event per component group (12 total)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('I', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const events = (j['minecraft:entity'] as any).events;
    for (const surface of ['wall', 'floor', 'ceiling']) {
      for (const dir of DIRS) {
        const ev = events[`set_oriented_${surface}_${dir}`];
        expect(ev, `set_oriented_${surface}_${dir}`).toBeDefined();
        expect(ev.add.component_groups).toContain(`oriented_${surface}_${dir}`);
      }
    }
  });
});
