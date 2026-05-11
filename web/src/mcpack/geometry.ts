import type { Painting } from '../paintings/types';
import { geometryName } from './identifiers';

export function buildGeometry(p: Painting) {
  const W = p.canvasW16;
  const H = p.canvasH16;
  const halfW = W / 2;
  const vbHalf = Math.ceil(Math.max(W, H) / 16) + 1;

  // Both bones share the same UV layout [0, 0]–[W, H] = "full texture". Each render
  // controller binds a different texture for its bone via part_visibility, so the same
  // UV samples Texture.default on the front bone and Texture.back on the back bone.
  function planeCube(showNorth: boolean) {
    return {
      origin: [-halfW, 0, -7],
      size: [W, H, 0],
      uv: showNorth
        ? {
            north: { uv: [0, 0], uv_size: [W, H] },
            south: { uv: [0, 0], uv_size: [W, 0] },
            east:  { uv: [0, 0], uv_size: [0, H] },
            west:  { uv: [0, 0], uv_size: [0, H] },
            up:    { uv: [0, 0], uv_size: [W, 0] },
            down:  { uv: [0, 0], uv_size: [W, 0] },
          }
        : {
            north: { uv: [0, 0], uv_size: [W, 0] },
            south: { uv: [0, 0], uv_size: [W, H] },
            east:  { uv: [0, 0], uv_size: [0, H] },
            west:  { uv: [0, 0], uv_size: [0, H] },
            up:    { uv: [0, 0], uv_size: [W, 0] },
            down:  { uv: [0, 0], uv_size: [W, 0] },
          },
    };
  }

  return {
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: {
        identifier: geometryName(p.id),
        texture_width: W,
        texture_height: H,
        visible_bounds_width: vbHalf,
        visible_bounds_height: vbHalf,
        visible_bounds_offset: [0, H / 32, 0],
      },
      bones: [
        { name: 'root', pivot: [0, 0, 0] },
        { name: 'front', parent: 'root', pivot: [0, 0, 0], cubes: [planeCube(true)] },
        { name: 'back',  parent: 'root', pivot: [0, 0, 0], cubes: [planeCube(false)] },
      ],
    }],
  };
}
