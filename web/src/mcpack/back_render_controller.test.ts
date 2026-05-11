import { describe, it, expect } from 'vitest';
import { buildBackRenderController } from './back_render_controller';

describe('buildBackRenderController', () => {
  it('renders only the back bone with the back material and texture', () => {
    const j = buildBackRenderController();
    const rc = j.render_controllers['controller.render.painting_back'];
    expect(rc.geometry).toBe('Geometry.default');
    expect(rc.part_visibility).toEqual([{ front: false }]);
    expect(rc.materials).toEqual([{ '*': 'Material.back' }]);
    expect(rc.textures).toEqual(['Texture.back']);
  });
});
