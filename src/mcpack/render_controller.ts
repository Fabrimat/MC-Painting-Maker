import type { Painting } from '../paintings/types';
import { renderControllerName } from './identifiers';

// Per-painting render controller that renders ONLY the "front" bone, binding the
// painting's own texture. The "back" bone is rendered by a separate, pack-shared
// render controller (see back_render_controller.ts).
export function buildRenderController(p: Painting) {
  return {
    format_version: '1.10.0',
    render_controllers: {
      [renderControllerName(p)]: {
        geometry: 'Geometry.default',
        part_visibility: [{ back: false }],
        materials: [{ '*': 'Material.default' }],
        textures: ['Texture.default'],
        // Transparent hurt tint: no red flash when a player hits the painting.
        is_hurt_color: { r: 0, g: 0, b: 0, a: 0 },
      },
    },
  };
}
