import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildItem, paintingItemNameLangKey } from './item';
import { paintingFileBase } from './identifiers';

describe('buildItem', () => {
  it('emits a placer item with icon, display name, and entity_placer pointing at the painting entity', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 64, naturalH: 64,
    });
    proj.paintings.push(p);
    const j = buildItem(proj, p);
    const fb = paintingFileBase(p);
    expect(j.format_version).toBe('1.21.40');
    const item = j['minecraft:item'];
    expect(item.description.identifier).toBe(`paintings:${fb}_painting`);
    const comps = item.components;
    expect(comps['minecraft:icon']).toEqual({ textures: { default: `${fb}_icon` } });
    // Display name resolves through a UUID-free lang key for readability of
    // the generated .lang file.
    expect(comps['minecraft:display_name']).toEqual({
      value: 'item.paintings:sunset_painting.name',
    });
    expect(comps['minecraft:max_stack_size']).toBe(64);
    expect(comps['minecraft:entity_placer']).toEqual({ entity: `paintings:${fb}` });
  });

  it('uses the project namespace in both the item id and the placed entity id', () => {
    const proj = createEmptyProject();
    proj.pack.namespace = 'myart';
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildItem(proj, p);
    const item = j['minecraft:item'];
    expect(item.description.identifier.startsWith('myart:')).toBe(true);
    const placer = item.components['minecraft:entity_placer'];
    expect(placer.entity.startsWith('myart:')).toBe(true);
    expect(placer.entity.endsWith('_painting')).toBe(false);
  });

  it('paintingItemNameLangKey strips the UUID suffix from the slug', () => {
    const p = { slug: 'sunset_a3f8b1c2' };
    expect(paintingItemNameLangKey('myart', p))
      .toBe('item.myart:sunset_painting.name');
  });
});
