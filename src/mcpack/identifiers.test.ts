import { describe, it, expect } from 'vitest';
import {
  sanitizeId,
  entityId,
  paintingFileBase,
  paintingItemId,
  paintingIconTextureKey,
  paintingNameSlug,
  spawnEggItemId,
  spawnEggTextureKey,
  usesPlacerItems,
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

  it('builds the painting item id as <entityId>_painting', () => {
    expect(paintingItemId('myart', P)).toBe('myart:sunset_a3f8b1c2_painting');
  });

  it('builds the icon texture key as <slug>_icon', () => {
    expect(paintingIconTextureKey(P)).toBe('sunset_a3f8b1c2_icon');
  });

  it('builds the legacy spawn-egg item id as <entityId>_spawn_egg', () => {
    expect(spawnEggItemId('myart', P)).toBe('myart:sunset_a3f8b1c2_spawn_egg');
  });

  it('builds the legacy spawn-egg texture key as <slug>_egg', () => {
    expect(spawnEggTextureKey(P)).toBe('sunset_a3f8b1c2_egg');
  });

  it('usesPlacerItems returns true for v3 projects and false for v2', () => {
    expect(usesPlacerItems({ version: 3 })).toBe(true);
    expect(usesPlacerItems({ version: 2 })).toBe(false);
  });

  it('strips the trailing UUID8 to expose a clean name slug for lang keys', () => {
    expect(paintingNameSlug({ slug: 'sunset_a3f8b1c2' })).toBe('sunset');
    expect(paintingNameSlug({ slug: 'p_2_b4f9c2d3' })).toBe('p_2');
    expect(paintingNameSlug({ slug: 'p_a3f8b1c2' })).toBe('p');
  });

  it('builds the geometry name with the geometry. prefix', () => {
    expect(geometryName(P)).toBe('geometry.sunset_a3f8b1c2');
  });

  it('builds the render controller name with the controller.render. prefix', () => {
    expect(renderControllerName(P)).toBe('controller.render.sunset_a3f8b1c2');
  });
});
