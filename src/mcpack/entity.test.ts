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

  it('produces a custom_hit_test sized to the painting (W x H blocks)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('B', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const comps = j['minecraft:entity'].components as any;
    const hb = comps['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(1);
    expect(hb[0].width).toBeCloseTo(2.5);
    expect(hb[0].height).toBeCloseTo(3);
    expect(hb[0].pivot[0]).toBeCloseTo(1.25 - 8 / 16);
    expect(hb[0].pivot[1]).toBeCloseTo(1.5);
    expect(hb[0].pivot[2]).toBeCloseTo(-7 / 16);
  });

  it('clamps hitbox width to 1/16 minimum for zero-canvas paintings', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 0; p.canvasH16 = 16;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const hb = (j['minecraft:entity'].components as any)['minecraft:custom_hit_test'].hitboxes[0];
    expect(hb.width).toBeCloseTo(1 / 16);
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

  it('clamps hitbox height to 1/16 minimum for zero-height paintings', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('E', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 16; p.canvasH16 = 0;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const hb = (j['minecraft:entity'].components as any)['minecraft:custom_hit_test'].hitboxes[0];
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

  it('exposes flat_orient_floor and flat_orient_ceiling with a flat custom_hit_test and distinct mark_variants', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('G', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 16;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const ent = j['minecraft:entity'] as any;
    for (const [group, variant] of [
      ['flat_orient_floor', 1],
      ['flat_orient_ceiling', 2],
    ] as const) {
      const flat = ent.component_groups[group];
      expect(flat, group).toBeDefined();
      expect(flat['minecraft:mark_variant'].value, group).toBe(variant);
      const hb = flat['minecraft:custom_hit_test'].hitboxes;
      expect(hb).toHaveLength(1);
      // Square footprint that covers the longer canvas side (W=2, H=1 -> 2).
      expect(hb[0].width).toBeCloseTo(2);
      // Thin in world Y after rotation (1 pixel).
      expect(hb[0].height).toBeCloseTo(1 / 16);
      // Same pivot as the wall hitbox: rotates with the entity.
      expect(hb[0].pivot[0]).toBeCloseTo(1 - 0.5);
      expect(hb[0].pivot[1]).toBeCloseTo(0.5);
      expect(hb[0].pivot[2]).toBeCloseTo(-7 / 16);
    }
  });

  it('flat_orient hitboxes clamp width to 1/16 minimum for zero-canvas paintings', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('H', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 0; p.canvasH16 = 0;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const ent = j['minecraft:entity'] as any;
    for (const group of ['flat_orient_floor', 'flat_orient_ceiling']) {
      const hb = ent.component_groups[group]['minecraft:custom_hit_test'].hitboxes[0];
      expect(hb.width).toBeCloseTo(1 / 16);
      expect(hb.height).toBeCloseTo(1 / 16);
    }
  });

  it('emits set_flat_orient_floor and set_flat_orient_ceiling events that add the matching component group', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('I', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const events = (j['minecraft:entity'] as any).events;
    expect(events.set_flat_orient_floor.add.component_groups).toContain('flat_orient_floor');
    expect(events.set_flat_orient_ceiling.add.component_groups).toContain('flat_orient_ceiling');
  });
});
