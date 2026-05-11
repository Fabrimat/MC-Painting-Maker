import type { Painting } from '../paintings/types';
import { geometryName } from './identifiers';

export function buildGeometry(p: Painting) {
  const W = p.canvasW16;
  const H = p.canvasH16;
  const halfW = W / 2;
  const vbHalf = Math.ceil(Math.max(W, H) / 16) + 1;

  // Reference: test_painting.geo.json — two overlapping cubes of depth 1 at z=[6, 7].
  // The painting cube renders only its north face (front), the frame cube renders only
  // its south face (back). Each bone is rendered by a different render controller via
  // part_visibility, so the north face samples Texture.default (painting) and the south
  // face samples Texture.back (shared wood texture).
  function planeCube(showNorth: boolean) {
    return {
      origin: [-halfW, 0, 6],
      size: [W, H, 1],
      uv: showNorth
        ? {
            north: { uv: [0, 0], uv_size: [W, H] },
          }
        : {
            east:  { uv: [0, 0], uv_size: [0, H] },
            south: { uv: [0, 0], uv_size: [W, H] },
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
