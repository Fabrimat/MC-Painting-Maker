import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildItemTexture } from './item_texture';
import { paintingFileBase } from './identifiers';

describe('buildItemTexture', () => {
  it('v3: maps painting icon keys to file paths under textures/items/', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const it = buildItemTexture(proj);
    const key = `${paintingFileBase(p)}_icon`;
    expect(it.texture_data[key].textures).toBe(`textures/items/${key}`);
    expect(it.resource_pack_name).toBe(proj.pack.name);
    expect(it.texture_name).toBe('atlas.items');
  });

  it('v2 (legacy): maps spawn-egg texture keys (<slug>_egg)', () => {
    const proj = { ...createEmptyProject(), version: 2 as const };
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const it = buildItemTexture(proj);
    const key = `${paintingFileBase(p)}_egg`;
    expect(it.texture_data[key].textures).toBe(`textures/items/${key}`);
    expect(it.texture_data[`${paintingFileBase(p)}_icon`]).toBeUndefined();
  });
});
