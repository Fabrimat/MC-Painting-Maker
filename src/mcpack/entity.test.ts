import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildEntityBehavior } from './entity';
import { paintingFileBase } from './identifiers';

describe('buildEntityBehavior', () => {
  it('emits identifier, is_spawnable=true and is_summonable=true', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    expect(j['minecraft:entity'].description.identifier).toBe(`paintings:${paintingFileBase(p)}`);
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

  it('emits damage_sensor with deals_damage="no" and event/target as strings inside on_damage', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('F', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const trigger = (j['minecraft:entity'].components as any)['minecraft:damage_sensor'].triggers[0];
    expect(trigger.deals_damage).toBe('no');
    expect(trigger.on_damage.event).toBe('despawn_self');
    expect(trigger.on_damage.target).toBe('self');
    expect(trigger.event).toBeUndefined();
    expect(trigger.target).toBeUndefined();
  });
});
