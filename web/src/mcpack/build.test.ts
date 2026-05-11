import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { assembleArchive } from './build';

describe('assembleArchive', () => {
  it('produces a zip with both BP_<ns>/ and RP_<ns>/ trees', async () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(p);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipped = await assembleArchive(proj, new Map([
      [p.id, { texture: png, eggTexture: png }],
    ]));
    const entries = unzipSync(zipped);
    const names = Object.keys(entries);
    expect(names.some((n) => n.startsWith('BP_paintings/manifest.json'))).toBe(true);
    expect(names.some((n) => n.startsWith('RP_paintings/manifest.json'))).toBe(true);
    expect(names.some((n) => n.endsWith('item_catalog/crafting_item_catalog.json'))).toBe(true);
    expect(names.some((n) => n.endsWith('scripts/main.js'))).toBe(true);
    expect(names.some((n) => n.includes('models/entity/'))).toBe(true);
    expect(names.some((n) => n.includes('textures/entity/'))).toBe(true);
    expect(names.some((n) => n.includes('textures/items/'))).toBe(true);
    expect(names.some((n) => n.endsWith('texts/en_US.lang'))).toBe(true);
    for (const [name, bytes] of Object.entries(entries)) {
      if (name.endsWith('.json')) {
        expect(() => JSON.parse(strFromU8(bytes))).not.toThrow();
      }
    }
  });
});
