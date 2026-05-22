import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { assembleArchive } from './build';

describe('assembleArchive', () => {
  it('v3: produces a zip with both BP_<ns>/ and RP_<ns>/ trees', async () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(p);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipped = await assembleArchive(proj, new Map([
      [p.id, { texture: png, iconTexture: png }],
    ]), png);
    const entries = unzipSync(zipped);
    const names = Object.keys(entries);
    expect(names.some((n) => n.startsWith('BP_paintings/manifest.json'))).toBe(true);
    expect(names.some((n) => n.startsWith('RP_paintings/manifest.json'))).toBe(true);
    expect(names.some((n) => n.endsWith('item_catalog/crafting_item_catalog.json'))).toBe(true);
    expect(names.some((n) => n.endsWith('scripts/main.js'))).toBe(true);
    expect(names.some((n) => n.includes('BP_paintings/items/') && n.endsWith('.item.json'))).toBe(true);
    expect(names.some((n) => n.includes('models/entity/'))).toBe(true);
    expect(names.some((n) => n.includes('textures/entity/'))).toBe(true);
    expect(names.some((n) => n.includes('textures/items/') && n.endsWith('_icon.png'))).toBe(true);
    expect(names.some((n) => n.endsWith('texts/en_US.lang'))).toBe(true);
    expect(names.some((n) => n.endsWith('textures/entity/painting_back.png'))).toBe(true);
    expect(names.some((n) => n.endsWith('render_controllers/painting_back.rc.json'))).toBe(true);
    expect(names.some((n) => n.endsWith('animations/painting_orient.animation.json'))).toBe(true);
    expect(names.some((n) => n.endsWith('animation_controllers/painting_orient.ac.json'))).toBe(true);
    for (const [name, bytes] of Object.entries(entries)) {
      if (name.endsWith('.json')) {
        expect(() => JSON.parse(strFromU8(bytes))).not.toThrow();
      }
    }
  });

  it('includes the default pack_icon.png in both BP and RP for a fresh project', async () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(p);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipped = await assembleArchive(proj, new Map([
      [p.id, { texture: png, iconTexture: png }],
    ]), png);
    const names = Object.keys(unzipSync(zipped));
    expect(names).toContain('BP_paintings/pack_icon.png');
    expect(names).toContain('RP_paintings/pack_icon.png');
  });

  it('omits pack_icon.png when the user has explicitly cleared it', async () => {
    const proj = createEmptyProject();
    proj.pack.iconPngBase64 = null;
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(p);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipped = await assembleArchive(proj, new Map([
      [p.id, { texture: png, iconTexture: png }],
    ]), png);
    const names = Object.keys(unzipSync(zipped));
    expect(names).not.toContain('BP_paintings/pack_icon.png');
    expect(names).not.toContain('RP_paintings/pack_icon.png');
  });

  it('ships a /function <ns>/version mcfunction stamped with the build sha and date', async () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(p);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipped = await assembleArchive(
      proj,
      new Map([[p.id, { texture: png, iconTexture: png }]]),
      png,
      { buildSha: 'deadbee', buildDate: '2026-05-22T20:30:00Z' },
    );
    const entries = unzipSync(zipped);
    const fn = entries['BP_paintings/functions/paintings/version.mcfunction'];
    expect(fn).toBeDefined();
    const text = strFromU8(fn);
    expect(text).toContain('# build: deadbee');
    expect(text).toContain('# generated: 2026-05-22T20:30:00Z');
    expect(text).toContain('tellraw @s {"rawtext":[{"text":"[paintings] build deadbee"}]}');
  });

  it('propagates opts.debug into the bundled scripts/main.js', async () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(p);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const offBytes = await assembleArchive(proj, new Map([[p.id, { texture: png, iconTexture: png }]]), png);
    const onBytes = await assembleArchive(proj, new Map([[p.id, { texture: png, iconTexture: png }]]), png, { debug: true });

    const offScript = strFromU8(unzipSync(offBytes)['BP_paintings/scripts/main.js']);
    const onScript = strFromU8(unzipSync(onBytes)['BP_paintings/scripts/main.js']);

    // Header marker confirms which build went into the archive end-to-end.
    expect(offScript).toContain('// debug: false');
    expect(onScript).toContain('// debug: true');
    // And the actual runtime emit must follow the header.
    expect(offScript).toContain('function dbg() {}');
    expect(onScript).toContain('world.sendMessage');
  });

  it('v2 (legacy): omits BP items/.item.json and writes _egg.png instead of _icon.png', async () => {
    const proj = { ...createEmptyProject(), version: 2 as const };
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(p);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipped = await assembleArchive(proj, new Map([
      [p.id, { texture: png, iconTexture: png }],
    ]), png);
    const names = Object.keys(unzipSync(zipped));
    expect(names.some((n) => n.includes('BP_paintings/items/'))).toBe(false);
    expect(names.some((n) => n.includes('textures/items/') && n.endsWith('_icon.png'))).toBe(false);
    expect(names.some((n) => n.includes('textures/items/') && n.endsWith('_egg.png'))).toBe(true);
  });
});
