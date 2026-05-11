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

describe('identifiers', () => {
  it('sanitizes a UUID to snake_case', () => {
    expect(sanitizeId('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('a3f8b1c2_1234_5678_9abc_deadbeefcafe');
  });

  it('builds the file base as p_<first 8 hex chars>', () => {
    expect(paintingFileBase('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('p_a3f8b1c2');
  });

  it('keeps the file base under 15 chars', () => {
    expect(paintingFileBase('a3f8b1c2-1234-5678-9abc-deadbeefcafe').length)
      .toBeLessThanOrEqual(15);
  });

  it('builds the entity identifier as <ns>:<paintingFileBase>', () => {
    expect(entityId('myart', 'a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('myart:p_a3f8b1c2');
  });

  it('builds the spawn egg item id as <entityId>_spawn_egg', () => {
    expect(spawnEggItemId('myart', 'a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('myart:p_a3f8b1c2_spawn_egg');
  });

  it('builds the spawn egg texture key as <paintingFileBase>_egg', () => {
    expect(spawnEggTextureKey('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('p_a3f8b1c2_egg');
  });

  it('builds the geometry name with the geometry. prefix', () => {
    expect(geometryName('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('geometry.p_a3f8b1c2');
  });

  it('builds the render controller name with the controller.render. prefix', () => {
    expect(renderControllerName('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('controller.render.p_a3f8b1c2');
  });
});
