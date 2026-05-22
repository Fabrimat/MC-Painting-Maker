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

  it('tiles oriented_wall into one column hitbox per canvas block of width', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 48; // 2 wide x 3 tall painting
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const wall = (j['minecraft:entity'] as any).component_groups.oriented_wall;
    expect(wall['minecraft:mark_variant'].value).toBe(3);
    const hb = wall['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(2);
    for (const h of hb) {
      // 1 wide x 3 tall per column. Z extent stays square with the X width.
      expect(h.width).toBeCloseTo(1);
      expect(h.height).toBeCloseTo(3);
      // Centered vertically across the painting height.
      expect(h.pivot[1]).toBeCloseTo(1.5);
      // Same Z offset as the legacy single hitbox, so the click area sits on
      // the player-facing side of the painting plane.
      expect(h.pivot[2]).toBeCloseTo(-7 / 16);
    }
    const xs = hb.map((h: any) => h.pivot[0]).sort();
    expect(xs[0]).toBeCloseTo(0);
    expect(xs[1]).toBeCloseTo(1);
  });

  it('falls back to a single right-sized wall hitbox for sub-block paintings', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C2', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 0; p.canvasH16 = 16;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const wall = (j['minecraft:entity'] as any).component_groups.oriented_wall;
    const hb = wall['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(1);
    expect(hb[0].width).toBeCloseTo(1 / 16);
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
    const wall = (j['minecraft:entity'] as any).component_groups.oriented_wall;
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

  it('tiles oriented_floor with one 1x1 hitbox per canvas block, extending north (-Z) from the entity', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('G', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 16; // 2x1 painting
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const flat = (j['minecraft:entity'] as any).component_groups.oriented_floor;
    expect(flat['minecraft:mark_variant'].value).toBe(1);
    const hb = flat['minecraft:custom_hit_test'].hitboxes;
    // 2 columns x 1 row = 2 unit hitboxes covering X=[-0.5, 1.5], Z=[-1.5, -0.5].
    expect(hb).toHaveLength(2);
    for (const h of hb) {
      expect(h.width).toBeCloseTo(1);
      expect(h.height).toBeCloseTo(1 / 16);
      // Slab at the painting face Y after the floor animation lands.
      expect(h.pivot[1]).toBeCloseTo(14.5 / 16);
      // Single row in Z, centered at -1 block (north of the entity).
      expect(h.pivot[2]).toBeCloseTo(-1);
    }
    const xs = hb.map((h: any) => h.pivot[0]).sort();
    expect(xs[0]).toBeCloseTo(0);
    expect(xs[1]).toBeCloseTo(1);
  });

  it('tiles oriented_ceiling with one 1x1 hitbox per canvas block, extending south (+Z) from the entity', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('G', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 16; p.canvasH16 = 32; // 1x2 painting
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const flat = (j['minecraft:entity'] as any).component_groups.oriented_ceiling;
    expect(flat['minecraft:mark_variant'].value).toBe(2);
    const hb = flat['minecraft:custom_hit_test'].hitboxes;
    // 1 column x 2 rows = 2 unit hitboxes covering X=[-0.5, 0.5], Z=[0.5, 2.5].
    expect(hb).toHaveLength(2);
    for (const h of hb) {
      expect(h.width).toBeCloseTo(1);
      expect(h.height).toBeCloseTo(1 / 16);
      // Slab at the painting face Y after the ceiling animation lands.
      expect(h.pivot[1]).toBeCloseTo(1.5 / 16);
      // Single column in X, centered at 0 blocks.
      expect(h.pivot[0]).toBeCloseTo(0);
    }
    const zs = hb.map((h: any) => h.pivot[2]).sort();
    expect(zs[0]).toBeCloseTo(1);
    expect(zs[1]).toBeCloseTo(2);
  });

  it('uses a single right-sized hitbox for sub-block paintings instead of an oversized 1x1', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('H', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 0; p.canvasH16 = 0;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const ent = j['minecraft:entity'] as any;
    for (const group of ['oriented_wall', 'oriented_floor', 'oriented_ceiling']) {
      const hb = ent.component_groups[group]['minecraft:custom_hit_test'].hitboxes;
      expect(hb).toHaveLength(1);
      // Clamp keeps a clickable area even for a zero-canvas painting.
      expect(hb[0].width).toBeCloseTo(1 / 16);
      expect(hb[0].height).toBeCloseTo(1 / 16);
    }
  });

  it('emits set_oriented_wall, set_oriented_floor and set_oriented_ceiling events that add the matching component group', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('I', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const events = (j['minecraft:entity'] as any).events;
    expect(events.set_oriented_wall.add.component_groups).toContain('oriented_wall');
    expect(events.set_oriented_floor.add.component_groups).toContain('oriented_floor');
    expect(events.set_oriented_ceiling.add.component_groups).toContain('oriented_ceiling');
  });
});
