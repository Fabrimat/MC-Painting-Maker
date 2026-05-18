import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildCatalog } from './catalog';
import { paintingFileBase } from './identifiers';

describe('buildCatalog', () => {
  it('v3: places painting placer items under the items category in a namespaced group', () => {
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
    const expectedIcon = `paintings:${paintingFileBase(a)}_painting`;
    expect(group.groups[0].group_identifier.icon).toBe(expectedIcon);
    expect(group.groups[0].items).toHaveLength(2);
    expect(group.groups[0].items[0]).toContain('_painting');
    expect(group.groups[0].items[0]).not.toContain('_spawn_egg');
  });

  it('v2 (legacy): references the auto-generated spawn egg ids', () => {
    const proj = { ...createEmptyProject(), version: 2 as const };
    const a = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(a);
    const cat = buildCatalog(proj);
    if (!cat) throw new Error('catalog is null');
    const group = cat['minecraft:crafting_items_catalog'].categories[0].groups[0];
    expect(group.group_identifier.icon).toBe(`paintings:${paintingFileBase(a)}_spawn_egg`);
    expect(group.items[0]).toContain('_spawn_egg');
    expect(group.items[0]).not.toContain('_painting');
  });

  it('returns null when there are no paintings', () => {
    const proj = createEmptyProject();
    expect(buildCatalog(proj)).toBeNull();
  });
});
