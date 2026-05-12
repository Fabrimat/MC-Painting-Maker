import type { Painting } from '../paintings/types';
import { geometryName } from './identifiers';

// Shift along the entity-local +X axis so the painting's visible bounds land
// flush against the wall block instead of starting at its half-way mark.
const X_ORIGIN_PX = 8;

export function buildGeometry(p: Painting) {
  const W = p.canvasW16;
  const H = p.canvasH16;
  const vbHalf = Math.ceil(Math.max(W, H) / 16) + 1;

  // Reference: test_painting.geo.json - two overlapping cubes of depth 1 at z=[6, 7].
  // The painting cube renders only its north face (front, painting texture).
  // The frame cube renders south + the four side faces (back + outer frame, wood
  // texture). Side faces sample the OUTER EDGE of the shared back texture - which is
  // designed to look like a beveled wooden frame edge - so the painting appears as a
  // real framed picture when viewed from any angle except straight-on.
  function planeCube(showNorth: boolean) {
    return {
      origin: [X_ORIGIN_PX, 0, 6],
      size: [W, H, 1],
      uv: showNorth
        ? {
            north: { uv: [0, 0], uv_size: [W, H] },
          }
        : {
            east:  { uv: [0, 0], uv_size: [1, H] },
            south: { uv: [0, 0], uv_size: [W, H] },
            west:  { uv: [0, 0], uv_size: [1, H] },
            up:    { uv: [0, 0], uv_size: [W, 1] },
            down:  { uv: [0, 0], uv_size: [W, 1] },
          },
    };
  }

  return {
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: {
        identifier: geometryName(p),
        texture_width: W,
        texture_height: H,
        visible_bounds_width: vbHalf,
        visible_bounds_height: vbHalf,
        visible_bounds_offset: [(W + 2 * X_ORIGIN_PX) / 32, H / 32, 0],
      },
      bones: [
        { name: 'root', pivot: [0, 0, 0] },
        { name: 'front', parent: 'root', pivot: [0, 0, 0], cubes: [planeCube(true)] },
        { name: 'back',  parent: 'root', pivot: [0, 0, 0], cubes: [planeCube(false)] },
      ],
    }],
  };
}
