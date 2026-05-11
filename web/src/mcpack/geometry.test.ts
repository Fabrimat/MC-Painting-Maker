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

  it('emits front and back bones with mutually exclusive face UVs', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const bones: any = j['minecraft:geometry'][0].bones;
    expect(bones.map((b: any) => b.name)).toEqual(['root', 'front', 'back']);
    expect(bones[1].cubes[0].uv.north).toEqual({ uv: [0, 0], uv_size: [40, 48] });
    expect(bones[1].cubes[0].uv.south).toEqual({ uv: [0, 0], uv_size: [40, 0] });
    expect(bones[2].cubes[0].uv.north).toEqual({ uv: [0, 0], uv_size: [40, 0] });
    expect(bones[2].cubes[0].uv.south).toEqual({ uv: [0, 0], uv_size: [40, 48] });
  });

  it('both planes sit at z=-7 with zero depth', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 32;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const bones: any = j['minecraft:geometry'][0].bones;
    expect(bones[1].cubes[0].origin).toEqual([-16, 0, -7]);
    expect(bones[1].cubes[0].size).toEqual([32, 32, 0]);
    expect(bones[2].cubes[0].origin).toEqual([-16, 0, -7]);
    expect(bones[2].cubes[0].size).toEqual([32, 32, 0]);
  });

  it('produces a valid identifier matching paintingFileBase', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildGeometry(p);
    expect(j['minecraft:geometry'][0].description.identifier).toBe(`geometry.${paintingFileBase(p.id)}`);
  });
});
