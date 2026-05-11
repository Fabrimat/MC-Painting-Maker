import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildCatalog } from './catalog';
import { paintingFileBase } from './identifiers';

describe('buildCatalog', () => {
  it('places spawn eggs under the items category in a namespaced group', () => {
    const proj = createEmptyProject();
    const a = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    const b = createPaintingFromImage('B', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(a, b);
    const cat = buildCatalog(proj);
    expect(cat).not.toBeNull();
    if (!cat) throw new Error('catalog is null');
    expect(cat.format_version).toBe('1.21.60');
    const group = cat['minecraft:crafting_items_catalog'].categories[0];
    expect(group.category_name).toBe('items');
    expect(group.groups[0].group_identifier.name).toBe('paintings:paintings');
    const expectedIcon = `paintings:${paintingFileBase(a)}_spawn_egg`;
    expect(group.groups[0].group_identifier.icon).toBe(expectedIcon);
    expect(group.groups[0].items).toHaveLength(2);
    expect(group.groups[0].items[0]).toContain('_spawn_egg');
  });

  it('returns null when there are no paintings', () => {
    const proj = createEmptyProject();
    expect(buildCatalog(proj)).toBeNull();
  });
});
