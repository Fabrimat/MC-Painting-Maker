import { describe, it, expect } from 'vitest';
import { createPaintingFromImage } from '../paintings/defaults';
import { buildRenderController } from './render_controller';
import { renderControllerName } from './identifiers';

describe('buildRenderController', () => {
  it('renders only the front bone, hiding the back bone', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    const j = buildRenderController(p);
    const rcName = renderControllerName(p);
    expect(j.render_controllers[rcName].geometry).toBe('Geometry.default');
    expect(j.render_controllers[rcName].textures).toEqual(['Texture.default']);
    expect(j.render_controllers[rcName].materials).toEqual([{ '*': 'Material.default' }]);
    expect(j.render_controllers[rcName].part_visibility).toEqual([{ back: false }]);
  });
});
