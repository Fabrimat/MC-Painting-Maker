import type { Painting } from '../paintings/types';
import { renderControllerName } from './identifiers';

export function buildRenderController(p: Painting) {
  return {
    format_version: '1.10.0',
    render_controllers: {
      [renderControllerName(p.id)]: {
        geometry: 'Geometry.default',
        materials: [{ '*': 'Material.default' }],
        textures: ['Texture.default'],
      },
    },
  };
}
