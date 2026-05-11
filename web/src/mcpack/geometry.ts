import type { Painting } from '../paintings/types';
import { geometryName } from './identifiers';

export function buildGeometry(p: Painting) {
  const W = p.canvasW16;
  const H = p.canvasH16;
  const halfW = W / 2;
  const vbHalf = Math.ceil(Math.max(W, H) / 16) + 1;

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
      bones: [{
        name: 'root',
        pivot: [0, 0, 0],
        cubes: [{
          origin: [-halfW, 0, -7],
          size: [W, H, 0],
          uv: {
            north: { uv: [0, 0], uv_size: [W, H] },
            south: { uv: [0, H], uv_size: [W, -H] },
            east:  { uv: [0, 0], uv_size: [0, H] },
            west:  { uv: [0, 0], uv_size: [0, H] },
            up:    { uv: [0, 0], uv_size: [W, 0] },
            down:  { uv: [0, 0], uv_size: [W, 0] },
          },
        }],
      }],
    }],
  };
}
