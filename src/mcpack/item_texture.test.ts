import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildItemTexture } from './item_texture';
import { paintingFileBase } from './identifiers';

describe('buildItemTexture', () => {
  it('maps painting icon keys to file paths under textures/items/', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const it = buildItemTexture(proj);
    const key = `${paintingFileBase(p)}_icon`;
    expect(it.texture_data[key].textures).toBe(`textures/items/${key}`);
    expect(it.resource_pack_name).toBe(proj.pack.name);
    expect(it.texture_name).toBe('atlas.items');
  });
});
