import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildEntityBehavior } from './entity';
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

  it('emits 12 oriented component groups: 3 surfaces (wall/floor/ceiling) x 4 cardinals (n/e/s/w)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const groups = (j['minecraft:entity'] as any).component_groups;
    for (const surface of ['wall', 'floor', 'ceiling']) {
      for (const dir of ['north', 'east', 'south', 'west']) {
        expect(groups[`oriented_${surface}_${dir}`], `${surface}_${dir}`).toBeDefined();
      }
    }
  });

  it('assigns mark_variant tens digit by surface, units digit by direction', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C2', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const groups = (j['minecraft:entity'] as any).component_groups;
    // Tens: wall=10, floor=20, ceiling=30. Units: north=1, east=2, south=3,
    // west=4. Keeps the animation controller's per-surface ranges contiguous.
    expect(groups.oriented_wall_north['minecraft:mark_variant'].value).toBe(11);
    expect(groups.oriented_wall_east['minecraft:mark_variant'].value).toBe(12);
    expect(groups.oriented_wall_south['minecraft:mark_variant'].value).toBe(13);
    expect(groups.oriented_wall_west['minecraft:mark_variant'].value).toBe(14);
    expect(groups.oriented_floor_north['minecraft:mark_variant'].value).toBe(21);
    expect(groups.oriented_floor_west['minecraft:mark_variant'].value).toBe(24);
    expect(groups.oriented_ceiling_north['minecraft:mark_variant'].value).toBe(31);
    expect(groups.oriented_ceiling_west['minecraft:mark_variant'].value).toBe(34);
  });

  it('tiles oriented_wall_north into column hitboxes (1 wide x H tall) along entity-local X', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C3', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 48; // 2 wide x 3 tall painting
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const wall = (j['minecraft:entity'] as any).component_groups.oriented_wall_north;
    const hb = wall['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(2);
    for (const h of hb) {
      expect(h.width).toBeCloseTo(1);
      expect(h.height).toBeCloseTo(3);
      expect(h.pivot[1]).toBeCloseTo(1.5);
      // Player-facing side of the painting plane, same Z as the legacy hitbox.
      expect(h.pivot[2]).toBeCloseTo(-7 / 16);
    }
    const xs = hb.map((h: any) => h.pivot[0]).sort();
    expect(xs[0]).toBeCloseTo(0);
    expect(xs[1]).toBeCloseTo(1);
  });

  it('rotates wall_east hitboxes 90 deg around Y from wall_north - same shape, columns laid along Z', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C4', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const east = (j['minecraft:entity'] as any).component_groups.oriented_wall_east;
    const hb = east['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(2);
    for (const h of hb) {
      expect(h.width).toBeCloseTo(1);
      expect(h.height).toBeCloseTo(3);
      // Y unchanged by yaw rotation.
      expect(h.pivot[1]).toBeCloseTo(1.5);
      // After 90 deg around Y: original (i, H/2, -7/16) -> (+7/16, H/2, i).
      expect(h.pivot[0]).toBeCloseTo(7 / 16);
    }
    const zs = hb.map((h: any) => h.pivot[2]).sort();
    expect(zs[0]).toBeCloseTo(0);
    expect(zs[1]).toBeCloseTo(1);
  });

  it('rotates wall_south hitboxes 180 deg around Y from wall_north', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C5', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const south = (j['minecraft:entity'] as any).component_groups.oriented_wall_south;
    const hb = south['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(2);
    // After 180 deg: (i, H/2, -7/16) -> (-i, H/2, +7/16).
    for (const h of hb) {
      expect(h.pivot[1]).toBeCloseTo(1.5);
      expect(h.pivot[2]).toBeCloseTo(7 / 16);
    }
    const xs = hb.map((h: any) => h.pivot[0]).sort();
    expect(xs[0]).toBeCloseTo(-1);
    expect(xs[1]).toBeCloseTo(0);
  });

  it('falls back to a single right-sized wall hitbox for sub-block paintings (all 4 cardinals)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C6', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 0; p.canvasH16 = 16;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const groups = (j['minecraft:entity'] as any).component_groups;
    for (const dir of ['north', 'east', 'south', 'west']) {
      const hb = groups[`oriented_wall_${dir}`]['minecraft:custom_hit_test'].hitboxes;
      expect(hb).toHaveLength(1);
      expect(hb[0].width).toBeCloseTo(1 / 16);
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

  it('clamps wall hitbox height to 1/16 minimum for zero-height paintings', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('E', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 16; p.canvasH16 = 0;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const wall = (j['minecraft:entity'] as any).component_groups.oriented_wall_north;
    const hb = wall['minecraft:custom_hit_test'].hitboxes[0];
    expect(hb.height).toBeCloseTo(1 / 16);
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

  it('tiles oriented_floor_north into 1x1 horizontal cells extending north (-Z) from the entity', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('G', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 16; // 2x1 painting
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const flat = (j['minecraft:entity'] as any).component_groups.oriented_floor_north;
    const hb = flat['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(2);
    for (const h of hb) {
      expect(h.width).toBeCloseTo(1);
      expect(h.height).toBeCloseTo(1 / 16);
      expect(h.pivot[1]).toBeCloseTo(14.5 / 16);
      expect(h.pivot[2]).toBeCloseTo(-1);
    }
    const xs = hb.map((h: any) => h.pivot[0]).sort();
    expect(xs[0]).toBeCloseTo(0);
    expect(xs[1]).toBeCloseTo(1);
  });

  it('tiles oriented_floor_east as the north tiling rotated 90 deg around Y', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('G2', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 16;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const east = (j['minecraft:entity'] as any).component_groups.oriented_floor_east;
    const hb = east['minecraft:custom_hit_test'].hitboxes;
    // After 90 deg yaw: each (x, _, z) -> (-z, _, x). The original north
    // tiles at (0|1, _, -1) become (1, _, 0|1).
    expect(hb).toHaveLength(2);
    for (const h of hb) {
      expect(h.width).toBeCloseTo(1);
      expect(h.pivot[1]).toBeCloseTo(14.5 / 16);
      expect(h.pivot[0]).toBeCloseTo(1);
    }
    const zs = hb.map((h: any) => h.pivot[2]).sort();
    expect(zs[0]).toBeCloseTo(0);
    expect(zs[1]).toBeCloseTo(1);
  });

  it('tiles oriented_ceiling_north with one 1x1 hitbox per canvas block, extending south (+Z) from the entity', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('G3', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 16; p.canvasH16 = 32;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const flat = (j['minecraft:entity'] as any).component_groups.oriented_ceiling_north;
    const hb = flat['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(2);
    for (const h of hb) {
      expect(h.width).toBeCloseTo(1);
      expect(h.height).toBeCloseTo(1 / 16);
      expect(h.pivot[1]).toBeCloseTo(1.5 / 16);
      expect(h.pivot[0]).toBeCloseTo(0);
    }
    const zs = hb.map((h: any) => h.pivot[2]).sort();
    expect(zs[0]).toBeCloseTo(1);
    expect(zs[1]).toBeCloseTo(2);
  });

  it('uses a single right-sized hitbox for sub-block paintings across all 12 oriented groups', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('H', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 0; p.canvasH16 = 0;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const groups = (j['minecraft:entity'] as any).component_groups;
    for (const surface of ['wall', 'floor', 'ceiling']) {
      for (const dir of ['north', 'east', 'south', 'west']) {
        const hb = groups[`oriented_${surface}_${dir}`]['minecraft:custom_hit_test'].hitboxes;
        expect(hb, `${surface}_${dir}`).toHaveLength(1);
        expect(hb[0].width).toBeCloseTo(1 / 16);
        expect(hb[0].height).toBeCloseTo(1 / 16);
      }
    }
  });

  it('emits one set_oriented_<surface>_<dir> event per component group (12 total)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('I', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const events = (j['minecraft:entity'] as any).events;
    for (const surface of ['wall', 'floor', 'ceiling']) {
      for (const dir of ['north', 'east', 'south', 'west']) {
        const ev = events[`set_oriented_${surface}_${dir}`];
        expect(ev, `set_oriented_${surface}_${dir}`).toBeDefined();
        expect(ev.add.component_groups).toContain(`oriented_${surface}_${dir}`);
      }
    }
  });
});
