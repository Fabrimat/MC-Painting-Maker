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

  it('front bone activates only the north face; back bone activates south + frame sides', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const bones: any = j['minecraft:geometry'][0].bones;
    // orient_yaw (cardinal yaw from the orient animation) is the parent of root
    // (floor/ceiling pitch), so pitch is applied first and yaw after it.
    expect(bones.map((b: any) => b.name)).toEqual(['orient_yaw', 'root', 'front', 'back']);
    expect(bones[1].parent).toBe('orient_yaw');
    bones.shift();
    // Front cube: only north is set. Other faces absent.
    expect(bones[1].cubes[0].uv).toEqual({ north: { uv: [0, 0], uv_size: [40, 48] } });
    // Back cube: south is the full back; sides sample a 1-unit slice of the back texture
    // to render the outer frame edge.
    expect(bones[2].cubes[0].uv.south).toEqual({ uv: [0, 0], uv_size: [40, 48] });
    expect(bones[2].cubes[0].uv.east).toEqual({ uv: [0, 0], uv_size: [1, 48] });
    expect(bones[2].cubes[0].uv.west).toEqual({ uv: [0, 0], uv_size: [1, 48] });
    expect(bones[2].cubes[0].uv.up).toEqual({ uv: [0, 0], uv_size: [40, 1] });
    expect(bones[2].cubes[0].uv.down).toEqual({ uv: [0, 0], uv_size: [40, 1] });
    expect(bones[2].cubes[0].uv.north).toBeUndefined();
  });

  it('both cubes are anchored with their bottom-left at (-8, 0, 6) and depth 1', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 32;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const bones: any = j['minecraft:geometry'][0].bones.slice(1);
    expect(bones[1].cubes[0].origin).toEqual([-8, 0, 6]);
    expect(bones[1].cubes[0].size).toEqual([32, 32, 1]);
    expect(bones[2].cubes[0].origin).toEqual([-8, 0, 6]);
    expect(bones[2].cubes[0].size).toEqual([32, 32, 1]);
  });

  it('uses origin-centered visible bounds big enough for every orient pose', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const desc = j['minecraft:geometry'][0].description;
    // Canvas reaches at most max(W, H) + 0.5 = 3.5 blocks from the origin.
    expect(desc.visible_bounds_offset).toEqual([0, 0, 0]);
    expect(desc.visible_bounds_width).toBe(8);
    expect(desc.visible_bounds_height).toBe(8);
  });

  it('produces a valid identifier matching paintingFileBase', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildGeometry(p);
    expect(j['minecraft:geometry'][0].description.identifier).toBe(`geometry.${paintingFileBase(p)}`);
  });
});
