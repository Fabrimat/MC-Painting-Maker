import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildGeometry } from './geometry';

describe('buildGeometry', () => {
  it('sets texture_width/height to canvasW16/canvasH16', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const desc = j['minecraft:geometry'][0].description;
    expect(desc.texture_width).toBe(40);
    expect(desc.texture_height).toBe(48);
  });

  it('emits a single zero-depth cube centered on X and at z=-7', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const cube = j['minecraft:geometry'][0].bones[0].cubes[0];
    expect(cube.origin).toEqual([-20, 0, -7]);
    expect(cube.size).toEqual([40, 48, 0]);
    expect(cube.uv.north).toEqual({ uv: [0, 0], uv_size: [40, 48] });
    expect(cube.uv.south).toEqual({ uv: [0, 48], uv_size: [40, -48] });
  });

  it('produces a valid identifier matching paintingFileBase', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildGeometry(p);
    expect(j['minecraft:geometry'][0].description.identifier)
      .toBe(`geometry.painting_${p.id.replace(/-/g, '_')}`);
  });
});
