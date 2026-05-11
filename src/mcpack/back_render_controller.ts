import { BACK_RENDER_CONTROLLER_NAME, BACK_TEXTURE_FILENAME } from './back_texture';

// Single render controller shared by all paintings in the pack. Renders ONLY the "back"
// bone of any painting geometry, binding the shared back texture.
export function buildBackRenderController() {
  return {
    format_version: '1.10.0',
    render_controllers: {
      [BACK_RENDER_CONTROLLER_NAME]: {
        geometry: 'Geometry.default',
        part_visibility: [{ front: false }],
        materials: [{ '*': 'Material.back' }],
        textures: ['Texture.back'],
      },
    },
  };
}

// Re-export so build.ts can write the texture under the right filename.
export { BACK_RENDER_CONTROLLER_NAME, BACK_TEXTURE_FILENAME };
