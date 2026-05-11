import { describe, it, expect } from 'vitest';
import { createPaintingFromImage } from '../paintings/defaults';
import { buildRenderController } from './render_controller';
import { paintingFileBase } from './identifiers';

describe('buildRenderController', () => {
  it('uses standard Geometry.default / Material.default / Texture.default', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    const j = buildRenderController(p);
    const rcName = `controller.render.${paintingFileBase(p.id)}`;
    expect(j.render_controllers[rcName].geometry).toBe('Geometry.default');
    expect(j.render_controllers[rcName].textures).toEqual(['Texture.default']);
    expect(j.render_controllers[rcName].materials).toEqual([{ '*': 'Material.default' }]);
  });
});
