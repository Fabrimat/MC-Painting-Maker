import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildGeometry } from './geometry';
import { paintingFileBase } from './identifiers';

describe('buildGeometry', () => {
  it('sets texture_width/height to canvasW16/canvasH16 (front only)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const desc = j['minecraft:geometry'][0].description;
    expect(desc.texture_width).toBe(40);
    expect(desc.texture_height).toBe(48);
  });

  it('front bone activates only the north face; back bone activates only the south face', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const bones: any = j['minecraft:geometry'][0].bones;
    expect(bones.map((b: any) => b.name)).toEqual(['root', 'front', 'back']);
    // Front cube: only north is set. Other faces are absent (not rendered).
    expect(bones[1].cubes[0].uv).toEqual({ north: { uv: [0, 0], uv_size: [40, 48] } });
    // Back cube: only south is meaningful; east/west/up/down keep zero-dim placeholders.
    expect(bones[2].cubes[0].uv.south).toEqual({ uv: [0, 0], uv_size: [40, 48] });
    expect(bones[2].cubes[0].uv.north).toBeUndefined();
    expect(bones[2].cubes[0].uv.east.uv_size[0]).toBe(0);
    expect(bones[2].cubes[0].uv.west.uv_size[0]).toBe(0);
    expect(bones[2].cubes[0].uv.up.uv_size[1]).toBe(0);
    expect(bones[2].cubes[0].uv.down.uv_size[1]).toBe(0);
  });

  it('both cubes sit at z=[6, 7] with depth 1 (overlapping volumes, distinct faces)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 32;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const bones: any = j['minecraft:geometry'][0].bones;
    expect(bones[1].cubes[0].origin).toEqual([-16, 0, 6]);
    expect(bones[1].cubes[0].size).toEqual([32, 32, 1]);
    expect(bones[2].cubes[0].origin).toEqual([-16, 0, 6]);
    expect(bones[2].cubes[0].size).toEqual([32, 32, 1]);
  });

  it('produces a valid identifier matching paintingFileBase', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildGeometry(p);
    expect(j['minecraft:geometry'][0].description.identifier).toBe(`geometry.${paintingFileBase(p.id)}`);
  });
});
