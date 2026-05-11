import { describe, it, expect } from 'vitest';
import {
  sanitizeId,
  entityId,
  paintingFileBase,
  spawnEggItemId,
  spawnEggTextureKey,
  geometryName,
  renderControllerName,
} from './identifiers';

const P = { slug: 'sunset_a3f8b1c2' };

describe('identifiers', () => {
  it('sanitizes a UUID to snake_case', () => {
    expect(sanitizeId('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('a3f8b1c2_1234_5678_9abc_deadbeefcafe');
  });

  it('paintingFileBase returns the painting slug verbatim', () => {
    expect(paintingFileBase(P)).toBe('sunset_a3f8b1c2');
  });

  it('builds the entity identifier as <ns>:<slug>', () => {
    expect(entityId('myart', P)).toBe('myart:sunset_a3f8b1c2');
  });

  it('builds the spawn egg item id as <entityId>_spawn_egg', () => {
    expect(spawnEggItemId('myart', P)).toBe('myart:sunset_a3f8b1c2_spawn_egg');
  });

  it('builds the spawn egg texture key as <slug>_egg', () => {
    expect(spawnEggTextureKey(P)).toBe('sunset_a3f8b1c2_egg');
  });

  it('builds the geometry name with the geometry. prefix', () => {
    expect(geometryName(P)).toBe('geometry.sunset_a3f8b1c2');
  });

  it('builds the render controller name with the controller.render. prefix', () => {
    expect(renderControllerName(P)).toBe('controller.render.sunset_a3f8b1c2');
  });
});
